-- カテゴリマスタ（本番にも必要なのでマイグレーションで投入）
insert into public.categories (slug, name, icon, sort_order) values
  ('fashion',      'ファッション',     'shirt',          10),
  ('shoes',        '靴',               'footprints',     20),
  ('bags',         'バッグ・財布',     'briefcase',      30),
  ('accessories',  'アクセサリー・時計', 'watch',        40),
  ('electronics',  '家電・デジタル',   'smartphone',     50),
  ('books_media',  '本・メディア',     'book-open',      60),
  ('cosmetics',    'コスメ・美容',     'sparkles',       70),
  ('food',         '食品・飲料',       'apple',          80),
  ('medicine',     '医薬品・日用品',   'pill',           90),
  ('interior',     'インテリア・家具', 'sofa',          100),
  ('kitchen',      'キッチン用品',     'cooking-pot',   110),
  ('hobby',        'ホビー・スポーツ', 'gamepad-2',     120),
  ('cards',        'カード・チケット', 'credit-card',   130),
  ('documents',    '書類・保証書',     'file-text',     140),
  ('other',        'その他',           'package',       999)
on conflict (slug) do nothing;
