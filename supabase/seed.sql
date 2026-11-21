-- Starting catalogue: the launch services and homepage promos from the design
-- pack. Prices are left empty (null) until Simanta's research gives real
-- numbers; the app shows "Rs [price]" while a price is missing.
-- Nepali wording still needs a native speaker's check.

insert into public.services (slug, name, name_ne, pricing_type, icon, is_featured, sort_order) values
  ('plumber',      'Plumber',           'प्लम्बर',          'fixed_price', 'droplet', false, 10),
  ('electrician',  'Electrician',       'इलेक्ट्रिसियन',     'fixed_price', 'zap',     false, 20),
  ('painter',      'Painter',           'पेन्टर',            'fixed_price', 'edit-3',  false, 30),
  ('tile-marble',  'Tile and marble',   'टायल र मार्बल',     'quote_first', 'grid',    false, 40),
  ('ac-appliance', 'AC and appliances', 'एसी र उपकरण',      'fixed_price', 'wind',    false, 50),
  ('water-purifier','Water purifier',   'पानी फिल्टर',        'fixed_price', 'filter',  false, 60),
  ('labour-mistri','Labour and mistri', 'ज्यामी र मिस्त्री',   'day_rate',    'tool',    false, 70),
  -- "Most booked" jobs: specific fixed-price tasks within the trades above.
  ('tap-repair',   'Tap repair',        'धारा मर्मत',        'fixed_price', 'droplet', true, 110),
  ('fan-install',  'Fan installation',  'पंखा जडान',         'fixed_price', 'wind',    true, 120),
  ('room-paint',   'One room painting', 'एक कोठा रङ',        'fixed_price', 'edit-3',  true, 130),
  ('ac-service',   'AC service',        'एसी सर्भिस',        'fixed_price', 'thermometer', true, 140)
on conflict (slug) do nothing;

insert into public.promos (tag, title, title_ne, cta, icon, service_id, sort_order)
select v.tag, v.title, v.title_ne, v.cta, v.icon, s.id, v.sort_order
from (values
  ('Book for tomorrow', 'Leaking tap? A plumber at your door tomorrow', 'धारा चुहियो? भोलि नै प्लम्बर घरमा', 'Book a plumber', 'droplet', 'plumber', 10),
  ('Festival season', 'Fresh walls before Dashain and Tihar', 'दशैं र तिहारअघि नयाँ रङ', 'Book a painter', 'edit-3', 'painter', 20),
  ('Fixed prices', 'AC and appliance repair, price shown upfront', 'एसी र उपकरण मर्मत, मूल्य पहिल्यै थाहा', 'See prices', 'wind', 'ac-appliance', 30)
) as v (tag, title, title_ne, cta, icon, slug, sort_order)
join public.services s on s.slug = v.slug
where not exists (select 1 from public.promos);
