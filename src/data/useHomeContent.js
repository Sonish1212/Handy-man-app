import { useEffect, useState } from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import * as fallback from './home';
import { servicePhotos } from './photos';

const OTHER_SERVICE = fallback.services.find((service) => service.isOther);

// A photo uploaded in Supabase (image_url) wins; otherwise use the photo
// bundled with the app for that service, if there is one.
const pickImage = (imageUrl, serviceKey) => (imageUrl ? { uri: imageUrl } : servicePhotos[serviceKey]);

const withLocalPhoto = (item, serviceKey) => ({ ...item, image: item.image ?? servicePhotos[serviceKey] });

const LOCAL = {
  services: fallback.services.map((service) => withLocalPhoto(service, service.id)),
  promos: fallback.promos.map((promo) => withLocalPhoto(promo, promo.service)),
};

const formatPrice = (value) => (value == null ? 'Rs [price]' : `Rs ${Number(value).toLocaleString('en-IN')}`);

const toService = (row) => ({
  id: row.slug,
  name: row.name,
  nameNe: row.name_ne,
  icon: row.icon,
  image: pickImage(row.image_url, row.slug),
  fallbackImage: servicePhotos[row.slug],
  price: formatPrice(row.base_price),
});

const toPromo = (row) => ({
  id: row.id,
  service: row.services?.slug,
  tag: row.tag,
  title: row.title,
  titleNe: row.title_ne,
  cta: row.cta,
  icon: row.icon,
  image: pickImage(row.image_url, row.services?.slug),
  fallbackImage: servicePhotos[row.services?.slug],
});

// Services and promos come from Supabase when it is set up.
// Without it (or if the request fails) the homepage uses the built-in
// placeholder content from ./home, so the app never shows an empty screen.
export default function useHomeContent() {
  const [content, setContent] = useState({
    services: LOCAL.services,
    promos: LOCAL.promos,
    source: 'local',
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    (async () => {
      const [servicesRes, promosRes] = await Promise.all([
        supabase.from('services').select('slug, name, name_ne, icon, image_url, base_price, is_featured').eq('is_active', true).order('sort_order'),
        supabase.from('promos').select('id, tag, title, title_ne, cta, icon, image_url, services(slug)').eq('is_active', true).order('sort_order'),
      ]);

      if (cancelled) return;
      if (servicesRes.error || promosRes.error) {
        console.warn('Could not load homepage from Supabase', servicesRes.error ?? promosRes.error);
        return;
      }

      const rows = servicesRes.data;
      setContent({
        // "Other services" is shown by the special card at the end of the grid.
        services: [...rows.filter((row) => !row.is_featured && row.slug !== 'other').map(toService), OTHER_SERVICE],
        promos: promosRes.data.length > 0 ? promosRes.data.map(toPromo) : LOCAL.promos,
        source: 'supabase',
      });
    })().catch(() => {
      // Keep the bundled content if the network drops during the request.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return content;
}
