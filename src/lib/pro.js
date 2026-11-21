import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { isDemoMode, useAuth } from './auth';
import { supabase } from './supabase';
import { callRpc } from './work';

// Joining as a professional, and what the professional app shows about
// money. Everything goes through database functions that check who is
// calling (migration 20261115000000_professional_onboarding.sql); document
// photos go to a private storage folder only their owner and the team can
// open.

const BUCKET = 'professional-documents';

// In the order the applicant adds them. The police report can follow later.
export const DOCUMENT_KINDS = [
  { kind: 'citizenship_front', required: true, icon: 'credit-card' },
  { kind: 'citizenship_back', required: true, icon: 'credit-card' },
  { kind: 'selfie', required: true, icon: 'user' },
  { kind: 'police_report', required: false, icon: 'shield' },
];

export const REQUIRED_DOCUMENTS = DOCUMENT_KINDS.filter((doc) => doc.required).map((doc) => doc.kind);

// Demo mode keeps a made-up application in memory so every screen can be
// tried without Supabase.
const DEMO_APPLICATION = null;

// The signed-in person's application: null until they start one, otherwise
// { state: draft | in_review | rejected | verified | suspended, ... }.
export function useApplication() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [application, setApplication] = useState(DEMO_APPLICATION);
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (isDemoMode || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await callRpc('my_application');
    setLoading(false);
    if (result.error) return setError(result.error);
    setError(null);
    return setApplication(result.data);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Demo only: change the made-up application so each screen can be seen.
  const setDemo = useCallback((change) => {
    if (isDemoMode) setApplication((current) => (typeof change === 'function' ? change(current) : change));
  }, []);

  return { application, loading, error, refresh, setDemo };
}

// Saves the whole application (see ApplicationForm's toPayload for the keys).
export async function saveApplicationDetails(payload) {
  return callRpc('save_professional_application', { p: payload });
}

// Every photo becomes a JPEG at most 1600 px wide before upload. iPhone
// gallery photos are often HEIC, which the storage folder does not accept,
// and full-size photos are slow on mobile data. 1600 px keeps ID text sharp.
const MAX_WIDTH = 1600;

async function toJpeg(asset) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width && asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return result.uri;
}

// Uploads one photo to the applicant's own folder and records it. Each kind
// has one file, so taking a new photo replaces the old one.
export async function uploadDocument(userId, kind, asset) {
  try {
    const uri = await toJpeg(asset);
    const body = await (await fetch(uri)).arrayBuffer();
    const path = `${userId}/${kind}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType: 'image/jpeg', upsert: true });
    if (error) {
      if (__DEV__) console.warn('[upload]', kind, error.statusCode ?? '', error.message);
      return { error: 'upload' };
    }
    const recorded = await callRpc('record_professional_document', { p_kind: kind, p_path: path });
    return { error: recorded.error };
  } catch (error) {
    if (__DEV__) console.warn('[upload]', kind, error?.message);
    return { error: 'upload' };
  }
}

export const submitApplication = () => callRpc('submit_professional_application');

// What the professional earned; see my_earnings() for the meaning of each number.
export function useEarnings() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [earnings, setEarnings] = useState(() => (isDemoMode ? DEMO_EARNINGS : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (isDemoMode || !userId) return;
    setLoading(true);
    const result = await callRpc('my_earnings');
    setLoading(false);
    if (result.error) return setError(result.error);
    setError(null);
    return setEarnings(result.data);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { earnings, loading, error, refresh };
}

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

const DEMO_EARNINGS = {
  commission_percent: 15,
  balance: -180,
  jobs: [
    { booking_id: 'demo-1', completed_at: daysAgo(1), title: '2 BHK deep clean', title_ne: '२ बीएचके सफाइ', billed: 1800, commission: 270, net: 1530, cash_collected: 1600 },
    { booking_id: 'demo-2', completed_at: daysAgo(3), title: 'Tap repair', title_ne: 'धारा मर्मत', billed: 530, commission: 72, net: 458, cash_collected: 330 },
  ],
  settlements: [{ id: 'demo-s', amount: 238, method: 'esewa', note: 'Weekly payout', created_at: daysAgo(2) }],
};

// ---------------------------------------------------------------------------
// Team: applications waiting for review
// ---------------------------------------------------------------------------

const APPLICANT_COLUMNS = `
  id, full_name, phone, area, years_experience, about, applied_at, gender, skill_level, has_tools, travel_mode,
  professional_private (citizenship_number, reference_contacts, date_of_birth_bs, permanent_district, current_address,
    id_type, id_issue_district, emergency_name, emergency_relation, emergency_phone,
    reference_name, reference_relation, reference_phone, payout_method, payout_bank, payout_account_number, payout_account_name),
  professional_documents (kind, path, uploaded_at),
  professional_services (service:services (name))
`;

const DEMO_APPLICANTS = [
  {
    id: 'demo-applicant',
    full_name: 'Hari Karki',
    phone: '+9779811111111',
    area: 'Baneshwor',
    years_experience: 6,
    about: 'Six years of plumbing. I have my own tools.',
    applied_at: daysAgo(1),
    gender: 'male',
    skill_level: 'level1',
    has_tools: 'all',
    travel_mode: 'bike',
    professional_private: {
      citizenship_number: '27-01-73-01234',
      reference_contacts: 'Ram Thapa (employer) 9800000009',
      date_of_birth_bs: '2045-03-12',
      permanent_district: 'Kavrepalanchok',
      current_address: 'Shantinagar, Kathmandu-34',
      id_type: 'citizenship',
      id_issue_district: 'Kavrepalanchok',
      emergency_name: 'Sita Karki',
      emergency_relation: 'spouse',
      emergency_phone: '+9779800000007',
      reference_name: 'Ram Thapa',
      reference_relation: 'employer',
      reference_phone: '+9779800000009',
      payout_method: 'esewa',
      payout_account_number: '+9779811111111',
    },
    professional_documents: [
      { kind: 'citizenship_front', path: 'demo' },
      { kind: 'citizenship_back', path: 'demo' },
      { kind: 'selfie', path: 'demo' },
    ],
    professional_services: [{ service: { name: 'Plumber' } }],
  },
];

export function useApplicants() {
  const [applicants, setApplicants] = useState(() => (isDemoMode ? DEMO_APPLICANTS : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (isDemoMode) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('professionals')
      .select(APPLICANT_COLUMNS)
      .eq('verification_status', 'pending')
      .not('applied_at', 'is', null)
      .is('rejection_reason', null)
      .order('applied_at');
    setLoading(false);
    if (loadError) return setError('Could not load the applications. Pull down to try again.');
    setError(null);
    return setApplicants(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { applicants, loading, error, refresh };
}

// Short-lived links so the team can look at an applicant's photos. The
// files stay private; each link stops working after ten minutes.
export async function documentLinks(documents) {
  if (isDemoMode || !documents?.length) return {};
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(documents.map((doc) => doc.path), 600);
  const links = {};
  (data ?? []).forEach((item, index) => {
    if (item.signedUrl) links[documents[index].kind] = item.signedUrl;
  });
  return links;
}
