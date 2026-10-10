# kurabase

家の棚・クローゼット・靴・財布の中身など、身の回りのあらゆる「モノ」を管理するアプリ。
購入日・購入場所・価格・期限を記録し、蓄積したデータを法人向けデータ提供と中古買取の送客に活かす。

- Web: Next.js 16 (App Router) + Tailwind v4 + shadcn/ui (Base UI)
- Backend: Supabase（Auth / Postgres / Storage）
- iOS: 後日 SwiftUI で実装予定（[docs/architecture.md](docs/architecture.md)）

## セットアップ

前提: Node.js 24、Docker Desktop

```bash
npm install
npm run db:start          # ローカル Supabase を起動（マイグレーションも適用）
cp .env.example .env.local # db:start の出力にある Publishable key を設定
npm run dev
```

- アプリ: http://localhost:3000
- Supabase Studio: http://localhost:54323
- 送信メールの確認 (Mailpit): http://localhost:54324

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run db:start` / `db:stop` | ローカル Supabase の起動・停止 |
| `npm run db:new <name>` | 新しいマイグレーションファイルを作成 |
| `npm run db:reset` | ローカル DB を作り直して全マイグレーションを再適用 |
| `npm run db:types` | DB スキーマから `src/types/database.ts` を再生成 |
| `npm run db:migrate` | リンク済みのリモート Supabase にマイグレーションを適用 |
| `npm run typecheck` / `lint` | 型チェック / ESLint |

スキーマを変更したら `db:new` → SQL を書く → `db:reset` → `db:types` の順で反映する。
