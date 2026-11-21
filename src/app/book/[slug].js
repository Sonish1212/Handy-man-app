import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddressStep from '../../components/booking/AddressStep';
import TimeStep from '../../components/booking/TimeStep';
import { formatDuration } from '../../data/catalog';
import { isDemoMode, useAuth } from '../../lib/auth';
import { formatRupees } from '../../lib/bookings';
import { useBookingSettings, useServiceCatalog } from '../../lib/catalog';
import { useLocation } from '../../lib/location';
import { formatSlot } from '../../lib/nepalTime';
import { storage } from '../../lib/storage';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius, spacing } from '../../theme';

const STEPS = [
  { id: 'job', label: 'Job' },
  { id: 'time', label: 'Time' },
  { id: 'address', label: 'Address' },
  { id: 'review', label: 'Confirm' },
];

const EMPTY_ADDRESS = { label: 'Home', landmark: '', details: '' };
const draftKey = (slug) => `bookingDraft:${slug}`;

function readDraft(slug) {
  try {
    const raw = storage?.getItem(draftKey(slug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The booking flow: job → time → address → review and confirm. A half-done
// booking is kept on the phone, so leaving and coming back resumes it.
// The number the professional and the team call about this job: 10 digits
// starting 98 or 97. Nepali-keyboard digits (९८…) count, spaces do not.
const toMobileDigits = (value) =>
  String(value ?? '')
    .replace(/[\u0966-\u096F]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(/\D/g, '')
    .replace(/^977(?=\d{10}$)/, '');
const isMobile = (value) => /^(97|98)\d{8}$/.test(toMobileDigits(value));

// Sign-in is only asked for at the very end (design pack: ask for login late).
export default function BookScreen() {
  const { slug, task: taskParam } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isSignedIn, session, profile, refreshProfile } = useAuth();
  const { area, pin } = useLocation();
  const { service, tasks, loading: catalogLoading, source } = useServiceCatalog(slug);
  const settings = useBookingSettings();

  // The draft is read once, when the screen opens.
  const [saved] = useState(() => readDraft(slug));
  const [step, setStep] = useState(0);
  const [taskId, setTaskId] = useState(taskParam ?? saved?.taskId ?? null);
  const [description, setDescription] = useState(saved?.description ?? '');
  const [contactPhone, setContactPhone] = useState(saved?.contactPhone ?? '');
  const [time, setTime] = useState(
    saved?.time && (saved.time.mode === 'asap' || new Date(saved.time.slotStart) > new Date())
      ? saved.time
      : { mode: null, slotStart: null, slotEnd: null },
  );
  const [address, setAddress] = useState({ addressId: null, newAddress: saved?.newAddress ?? EMPTY_ADDRESS });
  const [rawAddresses, setSavedAddresses] = useState([]);
  const savedAddresses = rawAddresses.filter((item) => item._viewerId === session?.user?.id);
  const [bookedCounts, setBookedCounts] = useState({});
  const [asapAvailable, setAsapAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const task = tasks.find((item) => item.id === taskId || item.slug === taskId) ?? null;
  const needsDescription = slug === 'other' || task?.slug === 'something-else';
  // Priced after a visit (tile work, "other"), not just missing a price yet.
  const quoteFirst = service?.pricing_type === 'quote_first' || task?.slug === 'something-else';

  // Keep the draft on the phone as the customer fills it in.
  useEffect(() => {
    try {
      storage?.setItem(
        draftKey(slug),
        JSON.stringify({ taskId, description, time, newAddress: address.newAddress, contactPhone }),
      );
    } catch {
      // Not saved; the booking still works.
    }
  }, [slug, taskId, description, time, address.newAddress, contactPhone]);

  // Full slots and ASAP availability for the customer's area.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase.rpc('slot_counts', { p_area: area.name }).then(({ data }) => {
      if (cancelled || !data) return;
      setBookedCounts(Object.fromEntries(data.map((row) => [new Date(row.slot_start).toISOString(), row.booked])));
    });
    if (service?.id && service.id !== service.slug) {
      supabase.rpc('asap_available', { p_service_id: service.id, p_area: area.name }).then(({ data }) => {
        if (!cancelled) setAsapAvailable(Boolean(data));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [area.name, service?.id, service?.slug]);

  // The job phone: the number used last time, else the account's own number.
  useEffect(() => {
    if (!isSignedIn || isDemoMode) return;
    let cancelled = false;
    supabase
      .from('bookings')
      .select('contact_phone')
      .eq('customer_id', session.user.id)
      .not('contact_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const last = data?.[0]?.contact_phone ?? profile?.phone ?? profile?.contact_phone ?? '';
        setContactPhone((current) => current || toMobileDigits(last));
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, session?.user?.id, profile?.phone, profile?.contact_phone]);

  // Saved addresses once signed in; pick the first one in the chosen area.
  useEffect(() => {
    if (!isSignedIn || isDemoMode) return;
    let cancelled = false;
    supabase
      .from('addresses')
      .select('id, label, area, city, landmark, details')
      .eq('customer_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSavedAddresses(data.map((item) => ({ ...item, _viewerId: session.user.id })));
        const match = data.find((item) => item.area === area.name);
        if (match) setAddress((current) => (current.addressId ? current : { ...current, addressId: match.id }));
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, session?.user?.id, area.name]);

  const pricing = useMemo(() => {
    const fee = time.mode === 'asap' ? settings.asap_fee : 0;
    const total = task?.price == null ? null : Number(task.price) + fee;
    const advance = total == null ? settings.advance_amount : Math.min(settings.advance_amount, total);
    return { fee, total, advance, later: total == null ? null : total - advance };
  }, [task, time.mode, settings]);

  const chosenAddress = address.addressId
    ? savedAddresses.find((item) => item.id === address.addressId)
    : { ...address.newAddress, area: area.name, city: area.city };

  const canContinue = [
    Boolean(task) && (!needsDescription || description.trim().length >= 10),
    time.mode === 'asap' || Boolean(time.slotStart),
    (address.addressId ? Boolean(chosenAddress) : address.newAddress.landmark.trim().length >= 2),
    isMobile(contactPhone),
  ][step];

  const back = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const next = () => {
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const confirm = async () => {
    if (busy) return;
    setError(null);
    if (isDemoMode) {
      setError('Demo mode: connect Supabase to make real bookings.');
      return;
    }
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    if (source !== 'supabase' || !task) {
      setError('The service could not load from the server. Check your connection and reopen this service.');
      return;
    }
    setBusy(true);
    try {
    let addressId = savedAddresses.some((item) => item.id === address.addressId) ? address.addressId : null;
    if (!addressId) {
      const { data, error: addressError } = await supabase
        .from('addresses')
        .insert({
          customer_id: session.user.id,
          label: address.newAddress.label,
          area: area.name,
          city: area.city,
          landmark: address.newAddress.landmark.trim(),
          details: address.newAddress.details.trim() || null,
          // The exact spot from the map, so the professional can navigate there.
          latitude: pin?.lat ?? null,
          longitude: pin?.lng ?? null,
        })
        .select('id, label, area, city, landmark, details')
        .single();
      if (addressError) {
        setBusy(false);
        setError('Could not save your address. Please try again.');
        return;
      }
      addressId = data.id;
      setSavedAddresses((list) => [{ ...data, _viewerId: session.user.id }, ...list]);
      setAddress((current) => ({ ...current, addressId }));
    }

    const { data: booking, error: bookingError } = await supabase.rpc('create_booking', {
      p_task_id: task.id,
      p_address_id: addressId,
      p_slot_start: time.mode === 'asap' ? null : time.slotStart,
      p_is_urgent: time.mode === 'asap',
      p_description: description.trim() || null,
      p_contact_phone: toMobileDigits(contactPhone),
    });
    setBusy(false);

    if (bookingError) {
      setError(bookingError.message || 'Could not make the booking. Please try again.');
      // A slot may have filled up meanwhile; send them back to pick again.
      if (/slot|time|soon|possible/i.test(bookingError.message ?? '')) setStep(1);
      return;
    }
    try {
      storage?.removeItem(draftKey(slug));
    } catch {
      // Ignore.
    }
    // The first booking saves the number on the account; show it there too.
    refreshProfile();
    router.replace({ pathname: '/pay/[id]', params: { id: booking.id, fresh: '1' } });
    } catch {
      setError('Could not connect. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!service) {
    return (
      <View style={[styles.screen, styles.center]}>
        {catalogLoading ? <ActivityIndicator color={colors.primary} /> : (
          <Pressable onPress={back} accessibilityRole="button">
            <Text style={styles.stepTitle}>This service is unavailable</Text>
            <Text style={styles.edit}>Go back</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.iconButton} onPress={back} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {task ? task.name : service.name}
          </Text>
          <Text style={styles.headerSub}>{service.name}</Text>
        </View>
      </View>

      <View style={styles.progress}>
        {STEPS.map((item, index) => (
          <View key={item.id} style={styles.progressItem}>
            <View style={[styles.progressBar, index <= step && styles.progressBarActive]} />
            <Text style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>What do you need?</Text>
            <View style={styles.box}>
              {tasks.map((item, index) => {
                const active = task?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.taskRow, index < tasks.length - 1 && styles.rowBorder]}
                    onPress={() => setTaskId(item.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.taskName}>{item.name}</Text>
                      <Text style={styles.taskNe}>
                        {item.name_ne}
                        {formatDuration(item.duration_minutes) ? `  ·  ${item.duration_minutes >= 480 ? '' : 'about '}${formatDuration(item.duration_minutes)}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.price}>{formatRupees(item.price)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>
              Describe the problem {needsDescription ? '*' : '(optional)'}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={
                needsDescription
                  ? 'Tell us what needs doing, so we send the right person'
                  : 'e.g. kitchen tap drips all day, the handle is loose'
              }
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={300}
              style={styles.textArea}
              accessibilityLabel="Describe the problem"
            />
            <Text style={styles.counter}>
              {needsDescription && description.trim().length < 10
                ? 'At least 10 characters'
                : `${description.length}/300`}
            </Text>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>When should we come?</Text>
            <TimeStep
              settings={settings}
              bookedCounts={bookedCounts}
              asapAvailable={asapAvailable}
              areaName={area.name}
              value={time}
              onChange={setTime}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>Where is the job?</Text>
            <AddressStep
              savedAddresses={savedAddresses}
              signedIn={isSignedIn}
              area={area}
              hasPin={Boolean(pin)}
              value={address}
              onChange={setAddress}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>Check and confirm</Text>
            <View style={styles.box}>
              <SummaryRow icon="tool" title={task?.name} body={description.trim() || service.name} onEdit={() => setStep(0)} />
              <SummaryRow
                icon={time.mode === 'asap' ? 'zap' : 'calendar'}
                title={
                  time.mode === 'asap'
                    ? 'As soon as possible'
                    : time.slotStart
                      ? formatSlot(time.slotStart, time.slotEnd)
                      : ''
                }
                body={
                  time.mode === 'asap'
                    ? `A professional in about ${settings.asap_promise_hours} hours`
                    : 'Arrival window, Nepal time'
                }
                onEdit={() => setStep(1)}
              />
              <SummaryRow
                icon="map-pin"
                title={chosenAddress?.label ?? 'Address'}
                body={[chosenAddress?.area, chosenAddress?.landmark, chosenAddress?.details].filter(Boolean).join(', ')}
                onEdit={() => setStep(2)}
                last
              />
            </View>

            <>
                <Text style={styles.label}>Phone number for this job</Text>
                <View style={[styles.phoneRow, contactPhone && !isMobile(contactPhone) && styles.phoneRowError]}>
                  <Text style={styles.phonePrefix}>+977</Text>
                  <TextInput
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    placeholder="98XXXXXXXX"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    maxLength={14}
                    style={styles.phoneInput}
                    accessibilityLabel="Phone number for this job"
                  />
                </View>
                <Text style={contactPhone && !isMobile(contactPhone) ? styles.phoneError : styles.phoneHint}>
                  {contactPhone && !isMobile(contactPhone)
                    ? 'Please write a mobile number: 10 digits, starting 98 or 97.'
                    : 'Your professional and our team call this number about the job. It can be someone at the house.'}
                </Text>
            </>

            <Text style={styles.label}>Price</Text>
            <View style={styles.box}>
              <PriceLine label={task?.name ?? 'Job'} value={formatRupees(task?.price)} />
              {pricing.fee ? <PriceLine label="As soon as possible" value={`+${formatRupees(pricing.fee)}`} /> : null}
              <View style={styles.priceDivider} />
              <PriceLine
                label="Total"
                value={pricing.total == null && quoteFirst ? 'After the visit' : formatRupees(pricing.total)}
                bold
              />
              <PriceLine label="Advance to confirm" value={formatRupees(pricing.advance)} accent />
              <PriceLine
                label="Pay after the job"
                value={pricing.later == null && quoteFirst ? 'The rest, once priced' : formatRupees(pricing.later)}
              />
            </View>

            <Text style={styles.label}>If you need to cancel</Text>
            <View style={[styles.box, styles.rules]}>
              <Rule
                text={
                  time.mode === 'asap'
                    ? 'Free until a professional accepts the job. The team arranges your refund.'
                    : `Free up to ${settings.free_cancel_hours} hours before your slot. The team arranges your refund.`
                }
              />
              <Rule
                text={`After the professional sets off: ${formatRupees(settings.travel_fee)} travel fee may be deducted; the team confirms the refund.`}
              />
              <Rule text={`After they arrive: the ${formatRupees(settings.visit_charge)} visit charge applies.`} />
              <Rule text="If we can’t send anyone, or they cancel or don’t come, the team arranges a full refund." />
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={colors.terracotta} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step === 3 ? (
          <View style={styles.flex}>
            <Text style={styles.footerLabel}>Pay now</Text>
            <Text style={styles.footerPrice}>{formatRupees(pricing.advance)}</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.cta, step === 3 ? null : styles.ctaWide, (!canContinue || busy) && styles.ctaDisabled]}
          disabled={!canContinue || busy}
          onPress={step === 3 ? confirm : next}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>
              {step < 3 ? 'Continue' : isSignedIn || isDemoMode ? 'Confirm booking' : 'Sign in to confirm'}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ icon, title, body, onEdit, last = false }) {
  return (
    <View style={[styles.summaryRow, !last && styles.rowBorder]}>
      <Feather name={icon} size={18} color={colors.primary} style={styles.summaryIcon} />
      <View style={styles.flex}>
        <Text style={styles.summaryTitle}>{title}</Text>
        {body ? <Text style={styles.summaryBody}>{body}</Text> : null}
      </View>
      <Pressable onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Change ${title}`}>
        <Text style={styles.edit}>Change</Text>
      </Pressable>
    </View>
  );
}

function PriceLine({ label, value, bold = false, accent = false }) {
  return (
    <View style={styles.priceLine}>
      <Text style={[styles.priceLabel, bold && styles.bold, accent && styles.accent]}>{label}</Text>
      <Text style={[styles.priceValue, bold && styles.bold, accent && styles.accent]}>{value}</Text>
    </View>
  );
}

function Rule({ text }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleDot} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.gutter - 6,
    paddingBottom: 8,
  },
  iconButton: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  headerSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.gutter, paddingBottom: 12 },
  progressItem: { flex: 1, gap: 4 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressBarActive: { backgroundColor: colors.primary },
  progressLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  progressLabelActive: { fontFamily: fonts.semibold, color: colors.primary },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: 140, gap: 14 },
  stepWrap: { gap: 12 },
  stepTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginTop: 4 },
  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    paddingHorizontal: 14,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  taskName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  taskNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary, marginTop: 1 },
  price: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginTop: 6 },
  textArea: {
    minHeight: 96,
    padding: 12,
    textAlignVertical: 'top',
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    paddingHorizontal: 12,
    gap: 8,
  },
  phoneRowError: { borderColor: colors.terracotta },
  phonePrefix: { fontFamily: fonts.semibold, fontSize: 16, color: colors.textSecondary },
  phoneInput: { flex: 1, minHeight: 50, fontFamily: fonts.regular, fontSize: 17, color: colors.text },
  phoneHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: -6 },
  phoneError: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.terracotta, marginTop: -6 },
  counter: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: -6 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  summaryIcon: { marginTop: 2 },
  summaryTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  summaryBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  edit: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  priceLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  priceLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  priceValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  priceDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  bold: { fontFamily: fonts.bold },
  accent: { fontFamily: fonts.semibold, color: colors.primary },
  rules: { paddingVertical: 8, gap: 2 },
  rule: { flexDirection: 'row', gap: 10, paddingVertical: 5 },
  ruleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary, marginTop: 7 },
  ruleText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.text },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: '#F8E6DF',
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.terracotta },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
    backgroundColor: colors.box,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  footerPrice: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  cta: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWide: { flex: 1 },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
});
