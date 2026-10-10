# アーキテクチャ方針

## 前提：Web と iOS が同じ Supabase を直接使う

iOS は後日 SwiftUI（supabase-swift）で作るため、**業務ルールを Next.js 側に閉じ込めない**。

- 権限制御は全て Postgres の RLS で行う（`user_id = auth.uid()`）。Next.js の Server Actions は入力整形と画面遷移だけを担う
- 写真はクライアントから Storage へ直接アップロードする（パス: `{user_id}/{item_id}/{uuid}.{ext}`）。iOS も同じ流れ
- 複数クライアントで共通化したい処理（例：買取査定の連携、集計）は DB 関数か Edge Functions に置く
- スキーマの正は `supabase/migrations/`。Swift 側のモデルもここから起こす

## データモデル

| テーブル | 用途 |
| --- | --- |
| `profiles` | auth.users と 1:1。生まれ年・性別・都道府県（任意）は統計の軸 |
| `categories` | 全ユーザー共通のカテゴリマスタ。集計軸を揃えるため自由入力にしない |
| `locations` | 保管場所。`parent_id` で「家 / 寝室 / クローゼット」の階層を表す。財布・バッグも場所 |
| `items` | モノ本体。購入日・購入場所・購入方法・価格・期限・保証期限・JAN コード・ステータス |
| `item_photos` | 写真（Storage `item-photos` バケットのパス） |
| `location_layouts` | 保管場所の 3D 配置（1:1）。部屋は寸法、家具は部屋の左奥の床を原点とした位置・サイズ・向き（cm / 度） |
| `data_sharing_consents` | データ利用への同意履歴（追記のみ）。`current_consents` ビューで最新状態を取る |

## 3D ルーム

- 「部屋」= `kind = 'room'` の保管場所に `location_layouts` を付けたもの。部屋の直下の保管場所が「家具」として 3D に並ぶ
- 家具の中の引き出しなど、さらに下の階層のモノは、その家具の中身として集計する
- Web は three.js（@react-three/fiber）で箱を手で配置する。家具名のラベルは drei の `Html` を使わず、
  3D 座標を毎フレーム画面座標に変換した DOM で描く（React 19 で `Html` のアンマウント時にエラーが出るため）
- iOS 版では RoomPlan（LiDAR）のスキャン結果の家具を同じテーブルに `source = 'roomplan'` で保存する想定

## 収益化に向けた設計上の注意

- **第三者提供には本人同意が必須**（個人情報保護法）。`data_sharing_consents` に目的・同意文言のバージョン・日時を追記で残す。
  文言を変えたら `CONSENT_POLICY_VERSION` を上げ、旧バージョンの同意は無効として再同意を求める
- 法人へ渡すデータは、`third_party_provision` に同意しているユーザーのみを対象とし、メールアドレス等は含めない。
  抽出は service role で動く集計ジョブ（Edge Function など）として別途作る
- 買取送客では `items.status`（所有中 → 出品中 → 売却済み）と `condition` を、売却候補の抽出と成果計測に使う

## 次の候補

- バーコード（JAN）読み取りによる商品情報の自動入力
- レシート・注文メールからの一括登録
- 期限切れ前のプッシュ通知（iOS）／メール通知
- 「使っていないモノ」への買取提案（`resale_offers` 同意者のみ）と査定 API 連携
- iOS アプリ（SwiftUI + supabase-swift、Sign in with Apple）
