import { useEffect, useState } from 'react';

import { DEFAULT_SETTINGS, LOCAL_SERVICES, LOCAL_TASKS } from '../data/catalog';
import { isSupabaseConfigured, supabase } from './supabase';

const localService = (slug) =>
  LOCAL_SERVICES[slug] ? { id: slug, slug, includes: [], excludes: [], ...LOCAL_SERVICES[slug] } : null;

// A service with its tasks, loaded from Supabase with the built-in copy as a
// fallback. `service` is null when the slug doesn't exist.
export function useServiceCatalog(slug) {
  const [state, setState] = useState(() => ({
    slug,
    service: localService(slug),
    tasks: LOCAL_TASKS[slug] ?? [],
    loading: isSupabaseConfigured,
    source: 'local',
  }));

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const { data: service, error } = await supabase
        .from('services')
        .select('id, slug, name, name_ne, icon, image_url, pricing_type, includes, excludes')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled) return;
      if (!error && !service) {
        setState({ slug, service: null, tasks: [], loading: false, source: 'supabase' });
        return;
      }
      if (error) {
        setState({ slug, service: localService(slug), tasks: LOCAL_TASKS[slug] ?? [], loading: false, source: 'local' });
        return;
      }
      const { data: tasks, error: taskError } = await supabase
        .from('service_tasks')
        .select('id, slug, name, name_ne, price, duration_minutes')
        .eq('service_id', service.id)
        .eq('is_active', true)
        .order('sort_order');
      if (cancelled) return;
      if (taskError) {
        setState({ slug, service: localService(slug), tasks: LOCAL_TASKS[slug] ?? [], loading: false, source: 'local' });
        return;
      }
      setState({ slug, service, tasks: tasks ?? [], loading: false, source: 'supabase' });
    })().catch(() => {
      if (!cancelled) setState({ slug, service: localService(slug), tasks: LOCAL_TASKS[slug] ?? [], loading: false, source: 'local' });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state.slug === slug ? state : { service: localService(slug), tasks: LOCAL_TASKS[slug] ?? [], loading: isSupabaseConfigured, source: 'local' };
}

// The amounts and rules from booking_settings (advance, ASAP charge, slots).
export function useBookingSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from('booking_settings')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const numeric = Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, typeof DEFAULT_SETTINGS[key] === 'number' && typeof value === 'string' && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value]),
        );
        setSettings({ ...DEFAULT_SETTINGS, ...numeric });
      }).catch(() => {
        // Leave the display defaults in place; the server validates all bookings.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
