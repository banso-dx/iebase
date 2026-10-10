@AGENTS.md

## プロジェクト固有のルール

- 設計方針は `docs/architecture.md` を参照。iOS(SwiftUI) も同じ Supabase を直接使うため、権限は RLS、スキーマの正は `supabase/migrations/`
- DB 変更時は `npm run db:new <name>` → SQL 記述 → `npm run db:reset` → `npm run db:types`
- shadcn の Select（Base UI）はフォーム送信に使わず、`@/components/ui/native-select` を使う
