-- kurabase 初期スキーマ
-- Web (Next.js) と iOS (SwiftUI) の両方が Supabase を直接参照するため、
-- 権限制御は全て RLS で行い、アプリ側のロジックに依存させない。

-- ============================================================
-- Enums
-- ============================================================
create type public.location_kind as enum (
  'home', 'room', 'closet', 'shelf', 'drawer', 'box', 'bag', 'wallet', 'other'
);

create type public.item_status as enum (
  'owned',      -- 所有中
  'listed',     -- 出品中
  'sold',       -- 売却済み
  'disposed',   -- 処分済み
  'given_away'  -- 譲渡済み
);

create type public.item_condition as enum (
  'new', 'like_new', 'good', 'fair', 'poor'
);

create type public.purchase_channel as enum (
  'store', 'online', 'gift', 'secondhand', 'other'
);

create type public.consent_purpose as enum (
  'anonymized_analytics',  -- 匿名加工した統計データとしての利用
  'third_party_provision', -- 法人への第三者提供
  'resale_offers'          -- 買取・出品の提案通知
);

-- ============================================================
-- Helpers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- profiles: auth.users と 1:1。属性情報は法人向け統計の軸になる（任意入力）
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  birth_year   smallint check (birth_year between 1900 and 2100),
  gender       text check (gender in ('male', 'female', 'other', 'no_answer')),
  prefecture   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- categories: 全ユーザー共通のマスタ（統計・買取連携の集計軸を揃えるため自由入力にしない）
-- ============================================================
create table public.categories (
  id         smallint generated always as identity primary key,
  slug       text not null unique,
  name       text not null,
  parent_id  smallint references public.categories (id),
  icon       text,
  sort_order smallint not null default 0
);

-- ============================================================
-- locations: 保管場所（家 > 寝室 > クローゼット > 引き出し のような階層）
-- ============================================================
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id  uuid references public.locations (id) on delete set null,
  name       text not null check (char_length(name) between 1 and 100),
  kind       public.location_kind not null default 'other',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_user_id_idx on public.locations (user_id);
create index locations_parent_id_idx on public.locations (parent_id);

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- ============================================================
-- items: 管理対象のモノ
-- ============================================================
create table public.items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  location_id      uuid references public.locations (id) on delete set null,
  category_id      smallint references public.categories (id),

  name             text not null check (char_length(name) between 1 and 200),
  brand            text,
  model_number     text,
  jan_code         text check (jan_code ~ '^[0-9]{8,14}$'),
  color            text,
  size             text,
  quantity         integer not null default 1 check (quantity >= 0),
  condition        public.item_condition,
  status           public.item_status not null default 'owned',

  purchased_at     date,
  purchase_store   text,
  purchase_channel public.purchase_channel,
  purchase_price   integer check (purchase_price >= 0), -- 円
  expires_at       date,                                -- 消費・使用期限
  warranty_until   date,                                -- 保証期限

  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index items_user_id_idx on public.items (user_id);
create index items_location_id_idx on public.items (location_id);
create index items_category_id_idx on public.items (category_id);
create index items_user_expires_idx on public.items (user_id, expires_at) where expires_at is not null;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ============================================================
-- item_photos: Storage(item-photos バケット) のパスを保持
-- ============================================================
create table public.item_photos (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index item_photos_item_id_idx on public.item_photos (item_id);

-- ============================================================
-- data_sharing_consents: 同意の履歴（追記のみ）。個人情報保護法の第三者提供同意の記録を兼ねる
-- ============================================================
create table public.data_sharing_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose        public.consent_purpose not null,
  granted        boolean not null,
  policy_version text not null,
  created_at     timestamptz not null default now()
);

create index data_sharing_consents_user_purpose_idx
  on public.data_sharing_consents (user_id, purpose, created_at desc);

-- 目的ごとの最新の同意状態
create view public.current_consents
with (security_invoker = true) as
select distinct on (user_id, purpose)
  user_id, purpose, granted, policy_version, created_at
from public.data_sharing_consents
order by user_id, purpose, created_at desc;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.locations             enable row level security;
alter table public.items                 enable row level security;
alter table public.item_photos           enable row level security;
alter table public.data_sharing_consents enable row level security;

create policy "profiles: own row" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "categories: readable by authenticated" on public.categories
  for select to authenticated
  using (true);

create policy "locations: own rows" on public.locations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "items: own rows" on public.items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (location_id is null or exists (
      select 1 from public.locations l
      where l.id = location_id and l.user_id = (select auth.uid())
    ))
  );

create policy "item_photos: own rows" on public.item_photos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

-- 同意履歴は改ざん防止のため参照と追記のみ
create policy "consents: select own" on public.data_sharing_consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "consents: insert own" on public.data_sharing_consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ============================================================
-- Storage: item-photos（非公開。パスは {user_id}/{item_id}/{file}）
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "item-photos: own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
