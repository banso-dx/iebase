-- 保管場所の 3D 配置
-- 部屋（kind = 'room'）は寸法のみ、部屋の中の家具は部屋の床の左奥を原点とした位置を持つ。
-- 単位は cm、回転は Y 軸（真上から見て時計回り）の度数。
-- iOS 版では RoomPlan のスキャン結果（CapturedRoom.Object）をこの形に変換して保存する想定。

create table public.location_layouts (
  location_id  uuid primary key references public.locations (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  width_cm     integer not null check (width_cm between 1 and 10000),  -- X 方向
  depth_cm     integer not null check (depth_cm between 1 and 10000),  -- Z 方向
  height_cm    integer not null check (height_cm between 1 and 1000),  -- Y 方向
  x_cm         integer not null default 0,  -- 部屋内での中心位置
  z_cm         integer not null default 0,
  elevation_cm integer not null default 0 check (elevation_cm >= 0),  -- 床からの高さ（吊り戸棚など）
  rotation_deg smallint not null default 0 check (rotation_deg between 0 and 359),
  color        text check (color ~ '^#[0-9a-fA-F]{6}$'),
  source       text not null default 'manual' check (source in ('manual', 'roomplan')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index location_layouts_user_id_idx on public.location_layouts (user_id);

create trigger location_layouts_set_updated_at
  before update on public.location_layouts
  for each row execute function public.set_updated_at();

alter table public.location_layouts enable row level security;

create policy "location_layouts: own rows" on public.location_layouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.locations l
      where l.id = location_id and l.user_id = (select auth.uid())
    )
  );
