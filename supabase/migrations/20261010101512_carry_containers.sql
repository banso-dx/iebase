-- 持ち物（家や部屋とは独立して持ち歩く入れ物）
-- 財布・バッグに加えてポーチを追加する。持ち物は kind で判別し、家の木構造とは別に扱う
alter type public.location_kind add value if not exists 'pouch';
