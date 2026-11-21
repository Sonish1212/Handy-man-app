import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { areas } from '../../data/areas';
import { LOCAL_SERVICES } from '../../data/catalog';
import { districtLabel, PROVINCE_DISTRICTS } from '../../data/districts';
import { isDemoMode, normalizeNepaliMobile } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { saveApplicationDetails } from '../../lib/pro';
import { colors, fonts, MIN_TAP, radius } from '../../theme';
import { Box, Field, Notice, WorkButton, workStyles } from '../work/ui';

// The professional's application, one topic per screen, so nobody faces a
// long page (the way government forms in the UK and elsewhere are built for
// people who are not confident with forms). Choices instead of typing
// wherever possible, an example under every box, and each problem shown
// next to the answer it belongs to. The database checks everything again
// (save_professional_application).

const SERVICE_SLUGS = Object.keys(LOCAL_SERVICES).filter((slug) => slug !== 'other');
const STEPS = ['you', 'home', 'work', 'id', 'people', 'money', 'check'];

export const GENDERS = ['male', 'female', 'other'];
export const SKILL_LEVELS = ['none', 'training', 'level1', 'level2', 'level3'];
export const TOOLS = ['all', 'some', 'none'];
export const TRAVEL = ['bike', 'public', 'walk'];
export const ID_TYPES = ['citizenship', 'national_id'];
export const EMERGENCY_RELATIONS = ['father', 'mother', 'spouse', 'sibling', 'child', 'relative', 'friend'];
export const REFERENCE_RELATIONS = ['employer', 'customer', 'coworker', 'trainer', 'neighbour', 'other'];
export const PAYOUT_METHODS = ['esewa', 'khalti', 'bank'];

// Nepali keyboards type ०-९. Turn them into 0-9 so numbers are not lost.
export const toLatinDigits = (text) => text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
const digitsOnly = (text, max) => toLatinDigits(text).replace(/\D/g, '').slice(0, max);
const localPhone = (phone) => (phone ?? '').replace(/^\+977/, '');

// Today's date in the Nepali calendar, near enough (within a few days) for
// the 18-or-older check. The team checks the exact date on the citizenship.
function todayInBs() {
  const nepal = new Date(Date.now() + (5 * 60 + 45) * 60000);
  const shifted = new Date(Date.UTC(nepal.getUTCFullYear() + 56, nepal.getUTCMonth() + 8, nepal.getUTCDate() + 17));
  return [shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()];
}

function startingAnswers(application) {
  const [dobY = '', dobM = '', dobD = ''] = (application?.dob_bs ?? '').split('-');
  const wallet = application?.payout_method && application.payout_method !== 'bank';
  return {
    full_name: application?.full_name ?? '',
    phone: localPhone(application?.phone),
    gender: application?.gender ?? null,
    dob_y: dobY,
    dob_m: dobM ? Number(dobM) : null,
    dob_d: dobD ? String(Number(dobD)) : '',
    permanent_district: application?.permanent_district ?? null,
    current_address: application?.current_address ?? '',
    area: application?.area ?? '',
    services: application?.services ?? [],
    years: application?.years_experience != null ? String(application.years_experience) : '',
    skill_level: application?.skill_level ?? null,
    has_tools: application?.has_tools ?? null,
    travel_mode: application?.travel_mode ?? null,
    about: application?.about ?? '',
    id_type: application?.id_type ?? null,
    id_number: application?.citizenship_number ?? '',
    id_district: application?.id_district ?? null,
    emergency_name: application?.emergency_name ?? '',
    emergency_relation: application?.emergency_relation ?? null,
    emergency_phone: localPhone(application?.emergency_phone),
    reference_name: application?.reference_name ?? '',
    reference_relation: application?.reference_relation ?? null,
    reference_phone: localPhone(application?.reference_phone),
    payout_method: application?.payout_method ?? null,
    payout_account: wallet ? localPhone(application.payout_account) : (application?.payout_account ?? ''),
    payout_bank: application?.payout_bank ?? '',
    payout_account_name: application?.payout_account_name ?? '',
    consent: Boolean(application?.dob_bs),
  };
}

// What the database receives.
export function toPayload(a) {
  const pad = (n) => String(n).padStart(2, '0');
  return {
    full_name: a.full_name.trim(),
    phone: a.phone,
    gender: a.gender,
    dob_bs: a.dob_y && a.dob_m && a.dob_d ? `${a.dob_y}-${pad(a.dob_m)}-${pad(a.dob_d)}` : '',
    permanent_district: a.permanent_district,
    current_address: a.current_address.trim(),
    area: a.area,
    services: a.services,
    years: a.years,
    skill_level: a.skill_level,
    has_tools: a.has_tools,
    travel_mode: a.travel_mode,
    about: a.about.trim(),
    id_type: a.id_type,
    id_number: a.id_number.trim(),
    id_district: a.id_district,
    emergency_name: a.emergency_name.trim(),
    emergency_relation: a.emergency_relation,
    emergency_phone: a.emergency_phone,
    reference_name: a.reference_name.trim(),
    reference_relation: a.reference_relation,
    reference_phone: a.reference_phone,
    payout_method: a.payout_method,
    payout_account: a.payout_account,
    payout_bank: a.payout_method === 'bank' ? a.payout_bank.trim() : '',
    payout_account_name: a.payout_method === 'bank' ? a.payout_account_name.trim() : '',
    consent: a.consent,
  };
}

// Every problem on one step, as { answer: message }. Same rules as the database.
function problemsOn(step, a, t) {
  const p = {};
  const mobile = (value) => normalizeNepaliMobile(value ?? '');
  if (step === 'you') {
    if (a.full_name.trim().length < 3) p.full_name = t('f.err.name');
    if (!mobile(a.phone)) p.phone = t('f.err.phone');
    if (!a.gender) p.gender = t('f.err.choose');
    const year = Number(a.dob_y);
    const day = Number(a.dob_d);
    if (!/^\d{4}$/.test(a.dob_y) || year < 1990 || !a.dob_m || !(day >= 1 && day <= 32)) {
      p.dob = t('f.err.dob');
    } else {
      const [ty, tm, td] = todayInBs();
      const eighteen = [year + 18, a.dob_m, day];
      const tooYoung = eighteen[0] > ty || (eighteen[0] === ty && (eighteen[1] > tm || (eighteen[1] === tm && eighteen[2] > td)));
      if (tooYoung) p.dob = t('f.err.age');
    }
  }
  if (step === 'home') {
    if (!a.permanent_district) p.permanent_district = t('f.err.district');
    if (a.current_address.trim().length < 3) p.current_address = t('f.err.address');
  }
  if (step === 'work') {
    if (a.services.length === 0) p.services = t('f.err.services');
    if (a.years === '') p.years = t('f.err.years');
    if (!a.skill_level) p.skill_level = t('f.err.choose');
    if (!a.has_tools) p.has_tools = t('f.err.choose');
    if (!a.travel_mode) p.travel_mode = t('f.err.choose');
  }
  if (step === 'id') {
    if (!a.id_type) p.id_type = t('f.err.choose');
    if (a.id_number.trim().length < 4) p.id_number = t('f.err.idNumber');
    if (!a.id_district) p.id_district = t('f.err.district');
  }
  if (step === 'people') {
    const own = mobile(a.phone);
    if (a.emergency_name.trim().length < 2) p.emergency_name = t('f.err.personName');
    if (!a.emergency_relation) p.emergency_relation = t('f.err.choose');
    if (!mobile(a.emergency_phone)) p.emergency_phone = t('f.err.phone');
    else if (mobile(a.emergency_phone) === own) p.emergency_phone = t('f.err.notYourNumber');
    if (a.reference_name.trim().length < 2) p.reference_name = t('f.err.personName');
    if (!a.reference_relation) p.reference_relation = t('f.err.choose');
    if (!mobile(a.reference_phone)) p.reference_phone = t('f.err.phone');
    else if (mobile(a.reference_phone) === own) p.reference_phone = t('f.err.notYourNumber');
  }
  if (step === 'money') {
    if (!a.payout_method) p.payout_method = t('f.err.choose');
    else if (a.payout_method === 'bank') {
      if (a.payout_bank.trim().length < 3) p.payout_bank = t('f.err.bank');
      if (!/^\d{6,30}$/.test(a.payout_account)) p.payout_account = t('f.err.account');
      if (a.payout_account_name.trim().length < 3) p.payout_account_name = t('f.err.accountName');
    } else if (!mobile(a.payout_account)) p.payout_account = t('f.err.phone');
  }
  if (step === 'check' && !a.consent) p.consent = t('f.err.consent');
  return p;
}

export default function ApplicationForm({ application, onSaved, onStepChange }) {
  const { t, lang } = useT();
  const [answers, setAnswers] = useState(() => startingAnswers(application));
  const [stepIndex, setStepIndex] = useState(0);
  const [tried, setTried] = useState({});
  const [backToCheck, setBackToCheck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const step = STEPS[stepIndex];
  const set = (change) => setAnswers((current) => ({ ...current, ...change }));

  const problems = problemsOn(step, answers, t);
  const err = (key) => (tried[step] ? problems[key] : null);

  const goTo = (index) => {
    setNotice(null);
    setStepIndex(index);
    onStepChange?.();
  };

  const next = async () => {
    if (Object.keys(problems).length > 0) {
      setTried((current) => ({ ...current, [step]: true }));
      return setNotice({ tone: 'error', text: t('f.fixRed') });
    }
    if (step !== 'check') {
      if (backToCheck) {
        setBackToCheck(false);
        return goTo(STEPS.length - 1);
      }
      return goTo(stepIndex + 1);
    }
    const payload = toPayload(answers);
    if (isDemoMode) return onSaved(payload);
    setBusy(true);
    const result = await saveApplicationDetails(payload);
    setBusy(false);
    if (result.error) return setNotice({ tone: 'error', text: result.error });
    return onSaved(payload);
  };

  const edit = (target) => {
    setBackToCheck(true);
    goTo(STEPS.indexOf(target));
  };

  const choice = (prefix) => (value) => t(`${prefix}.${value}`);
  const areaOptions = [
    { id: '', label: t('apply.anywhere') },
    ...areas.map((area) => ({ id: area.name, label: lang === 'ne' ? area.nameNe : area.name })),
  ];

  let body;
  if (step === 'you') {
    body = (
      <>
        <Field label={t('f.name')} hint={t('f.nameHint')} value={answers.full_name} maxLength={80} autoCapitalize="words"
          onChangeText={(full_name) => set({ full_name })} error={err('full_name')} />
        <Field label={t('f.phone')} hint={t('f.phoneHint')} placeholder="98XXXXXXXX" keyboardType="number-pad" maxLength={10}
          value={answers.phone} onChangeText={(text) => set({ phone: digitsOnly(text, 10) })} error={err('phone')} />
        <Question label={t('f.gender')} hint={t('f.genderHint')} error={err('gender')}>
          <Choices values={GENDERS} label={choice('f.gender')} value={answers.gender} onChange={(gender) => set({ gender })} />
        </Question>
        <DateOfBirth answers={answers} set={set} error={err('dob')} />
      </>
    );
  } else if (step === 'home') {
    body = (
      <>
        <Question label={t('f.permanentDistrict')} hint={t('f.permanentDistrictHint')} error={err('permanent_district')}>
          <DistrictPicker value={answers.permanent_district} onChange={(permanent_district) => set({ permanent_district })} />
        </Question>
        <Field label={t('f.currentAddress')} hint={t('f.currentAddressHint')} placeholder={t('f.currentAddressExample')}
          value={answers.current_address} maxLength={150} onChangeText={(current_address) => set({ current_address })}
          error={err('current_address')} />
        <Question label={t('apply.area')} hint={t('f.areaHint')}>
          <Choices values={areaOptions.map((o) => o.id)} label={(id) => areaOptions.find((o) => o.id === id).label}
            value={answers.area} onChange={(area) => set({ area })} />
        </Question>
      </>
    );
  } else if (step === 'work') {
    body = (
      <>
        <Question label={t('apply.services')} hint={t('apply.servicesHint')} error={err('services')}>
          <Choices multi values={SERVICE_SLUGS} value={answers.services}
            label={(slug) => (lang === 'ne' ? LOCAL_SERVICES[slug].name_ne : LOCAL_SERVICES[slug].name)}
            onChange={(services) => set({ services })} />
        </Question>
        <Field label={t('apply.years')} hint={t('f.yearsHint')} placeholder="0" keyboardType="number-pad" maxLength={2}
          value={answers.years} onChangeText={(text) => set({ years: digitsOnly(text, 2) })} error={err('years')} />
        <Question label={t('f.skill')} hint={t('f.skillHint')} error={err('skill_level')}>
          <Choices values={SKILL_LEVELS} label={choice('f.skill')} value={answers.skill_level} onChange={(skill_level) => set({ skill_level })} />
        </Question>
        <Question label={t('f.tools')} error={err('has_tools')}>
          <Choices values={TOOLS} label={choice('f.tools')} value={answers.has_tools} onChange={(has_tools) => set({ has_tools })} />
        </Question>
        <Question label={t('f.travel')} error={err('travel_mode')}>
          <Choices values={TRAVEL} label={choice('f.travel')} value={answers.travel_mode} onChange={(travel_mode) => set({ travel_mode })} />
        </Question>
        <Field label={t('apply.about')} hint={t('apply.aboutHint')} value={answers.about} maxLength={500} multiline
          onChangeText={(about) => set({ about })} />
      </>
    );
  } else if (step === 'id') {
    body = (
      <>
        <Question label={t('f.idType')} error={err('id_type')}>
          <Choices values={ID_TYPES} label={choice('f.idType')} value={answers.id_type} onChange={(id_type) => set({ id_type })} />
        </Question>
        <Field label={t('f.idNumber')} hint={t('f.idNumberHint')} placeholder="12-34-56-78901" maxLength={30}
          value={answers.id_number} onChangeText={(text) => set({ id_number: toLatinDigits(text) })} error={err('id_number')} />
        <Question label={t('f.idDistrict')} hint={t('f.idDistrictHint')} error={err('id_district')}>
          <DistrictPicker value={answers.id_district} onChange={(id_district) => set({ id_district })} />
        </Question>
      </>
    );
  } else if (step === 'people') {
    body = (
      <>
        <Box title={t('f.emergency')}>
          <Text style={workStyles.muted}>{t('f.emergencyHint')}</Text>
          <Field label={t('f.personName')} placeholder={t('f.personNameExample')} value={answers.emergency_name} maxLength={80}
            autoCapitalize="words" onChangeText={(emergency_name) => set({ emergency_name })} error={err('emergency_name')} />
          <Question label={t('f.relation')} error={err('emergency_relation')}>
            <Choices values={EMERGENCY_RELATIONS} label={choice('f.rel')} value={answers.emergency_relation}
              onChange={(emergency_relation) => set({ emergency_relation })} />
          </Question>
          <Field label={t('f.theirPhone')} placeholder="98XXXXXXXX" keyboardType="number-pad" maxLength={10}
            value={answers.emergency_phone} onChangeText={(text) => set({ emergency_phone: digitsOnly(text, 10) })}
            error={err('emergency_phone')} />
        </Box>
        <Box title={t('f.reference')}>
          <Text style={workStyles.muted}>{t('f.referenceHint')}</Text>
          <Field label={t('f.personName')} placeholder={t('f.personNameExample')} value={answers.reference_name} maxLength={80}
            autoCapitalize="words" onChangeText={(reference_name) => set({ reference_name })} error={err('reference_name')} />
          <Question label={t('f.howKnow')} error={err('reference_relation')}>
            <Choices values={REFERENCE_RELATIONS} label={choice('f.ref')} value={answers.reference_relation}
              onChange={(reference_relation) => set({ reference_relation })} />
          </Question>
          <Field label={t('f.theirPhone')} placeholder="98XXXXXXXX" keyboardType="number-pad" maxLength={10}
            value={answers.reference_phone} onChangeText={(text) => set({ reference_phone: digitsOnly(text, 10) })}
            error={err('reference_phone')} />
        </Box>
      </>
    );
  } else if (step === 'money') {
    const bank = answers.payout_method === 'bank';
    body = (
      <>
        <Question label={t('f.payout')} hint={t('f.payoutHint')} error={err('payout_method')}>
          <Choices values={PAYOUT_METHODS} label={choice('f.payout')} value={answers.payout_method}
            onChange={(payout_method) =>
              set({
                payout_method,
                // A wallet is usually on their own number: fill it in for them.
                payout_account: payout_method === 'bank' ? '' : answers.payout_account || answers.phone,
              })
            } />
        </Question>
        {answers.payout_method && !bank ? (
          <Field label={t('f.walletNumber')} hint={t('f.walletHint')} placeholder="98XXXXXXXX" keyboardType="number-pad"
            maxLength={10} value={answers.payout_account}
            onChangeText={(text) => set({ payout_account: digitsOnly(text, 10) })} error={err('payout_account')} />
        ) : null}
        {bank ? (
          <>
            <Field label={t('f.bankName')} placeholder={t('f.bankExample')} value={answers.payout_bank} maxLength={80}
              onChangeText={(payout_bank) => set({ payout_bank })} error={err('payout_bank')} />
            <Field label={t('f.accountNumber')} keyboardType="number-pad" maxLength={30} value={answers.payout_account}
              onChangeText={(text) => set({ payout_account: digitsOnly(text, 30) })} error={err('payout_account')} />
            <Field label={t('f.accountName')} hint={t('f.accountNameHint')} value={answers.payout_account_name} maxLength={80}
              autoCapitalize="words" onChangeText={(payout_account_name) => set({ payout_account_name })}
              error={err('payout_account_name')} />
          </>
        ) : null}
        <Text style={workStyles.muted}>{t('f.privateNote')}</Text>
      </>
    );
  } else {
    body = <Summary answers={answers} onEdit={edit} err={err} set={set} />;
  }

  return (
    <>
      <View style={styles.progressWrap} accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: STEPS.length, now: stepIndex + 1 }}>
        <Text style={styles.progressText}>
          {t('f.stepOf', { n: stepIndex + 1, total: STEPS.length })} · {t(`f.step.${step}`)}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((stepIndex + 1) / STEPS.length) * 100}%` }]} />
        </View>
      </View>
      <Text style={styles.stepTitle}>{t(`f.title.${step}`)}</Text>
      <Text style={workStyles.muted}>{t(`f.why.${step}`)}</Text>
      {body}
      <Notice notice={notice} />
      <View style={workStyles.row}>
        {stepIndex > 0 ? (
          <WorkButton label={t('f.back')} tone="secondary" icon="arrow-left" onPress={() => goTo(stepIndex - 1)} disabled={busy} />
        ) : null}
        <WorkButton
          label={step === 'check' ? t('apply.save') : backToCheck ? t('f.backToCheck') : t('f.next')}
          icon={step === 'check' ? 'check' : 'arrow-right'}
          onPress={next}
          busy={busy}
        />
      </View>
    </>
  );
}

// A question answered by tapping (choices, a district), with its own error.
function Question({ label, hint, error, children }) {
  return (
    <View style={styles.question}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Choices({ values, value, onChange, label, multi = false }) {
  return (
    <View style={styles.chips}>
      {values.map((item) => {
        const active = multi ? value.includes(item) : value === item;
        const toggle = () => {
          if (!multi) return onChange(item);
          return onChange(active ? value.filter((v) => v !== item) : [...value, item]);
        };
        return (
          <Pressable key={item || 'none'} style={[styles.chip, active && styles.chipActive]} onPress={toggle}
            accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: active }}>
            {active ? <Feather name="check" size={14} color={colors.primary} /> : null}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label(item)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const BS_MONTHS = 12;

function DateOfBirth({ answers, set, error }) {
  const { t } = useT();
  return (
    <Question label={t('f.dob')} hint={t('f.dobHint')} error={error}>
      <View style={styles.dobRow}>
        <View style={styles.dobYear}>
          <Text style={styles.small}>{t('f.year')}</Text>
          <TextInput style={[styles.input, error && styles.inputError]} placeholder="2050" placeholderTextColor="#8A968F"
            keyboardType="number-pad" maxLength={4} value={answers.dob_y}
            onChangeText={(text) => set({ dob_y: digitsOnly(text, 4) })} accessibilityLabel={t('f.year')} />
        </View>
        <View style={styles.dobDay}>
          <Text style={styles.small}>{t('f.day')}</Text>
          <TextInput style={[styles.input, error && styles.inputError]} placeholder="15" placeholderTextColor="#8A968F"
            keyboardType="number-pad" maxLength={2} value={answers.dob_d}
            onChangeText={(text) => set({ dob_d: digitsOnly(text, 2) })} accessibilityLabel={t('f.day')} />
        </View>
      </View>
      <Text style={styles.small}>{t('f.month')}</Text>
      <Choices values={Array.from({ length: BS_MONTHS }, (_, i) => i + 1)} value={answers.dob_m}
        label={(m) => t(`f.month.${m}`)} onChange={(dob_m) => set({ dob_m })} />
    </Question>
  );
}

// Choosing one of the 77 districts: a list to search, valley districts first.
function DistrictPicker({ value, onChange }) {
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const found = useMemo(() => {
    const words = search.trim().toLowerCase();
    return PROVINCE_DISTRICTS.map((province) => ({
      ...province,
      districts: province.districts.filter(
        (d) =>
          !words || d.name.toLowerCase().includes(words) || d.nameNe.includes(search.trim()) || (d.aliases ?? '').includes(words),
      ),
    })).filter((province) => province.districts.length > 0);
  }, [search]);

  const choose = (name) => {
    onChange(name);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <Pressable style={[styles.picker, value && styles.pickerChosen]} onPress={() => setOpen(true)} accessibilityRole="button">
        <Feather name="map" size={18} color={value ? colors.primary : colors.textSecondary} />
        <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
          {value ? districtLabel(value, lang) : t('f.chooseDistrict')}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
          <View style={styles.modalHead}>
            <Text style={styles.stepTitle}>{t('f.chooseDistrict')}</Text>
            <Pressable onPress={() => setOpen(false)} style={styles.close} accessibilityRole="button" accessibilityLabel={t('f.close')}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <TextInput style={styles.input} placeholder={t('f.searchDistrict')} placeholderTextColor="#8A968F" value={search}
            onChangeText={setSearch} autoCorrect={false} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalList}>
            {found.map((province) => (
              <View key={province.name} style={styles.question}>
                <Text style={styles.province}>{lang === 'ne' ? `${province.nameNe} प्रदेश` : `${province.name} Province`}</Text>
                <View style={styles.chips}>
                  {province.districts.map((d) => (
                    <Pressable key={d.name} style={[styles.chip, value === d.name && styles.chipActive]} onPress={() => choose(d.name)}
                      accessibilityRole="radio" accessibilityState={{ checked: value === d.name }}>
                      <Text style={[styles.chipText, value === d.name && styles.chipTextActive]}>{lang === 'ne' ? d.nameNe : d.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {found.length === 0 ? <Text style={workStyles.muted}>{t('f.noDistrict')}</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// The last step: everything on one page to check, each part with Change.
function Summary({ answers: a, onEdit, err, set }) {
  const { t, lang } = useT();
  const service = (slug) => (lang === 'ne' ? LOCAL_SERVICES[slug].name_ne : LOCAL_SERVICES[slug].name);
  const area = areas.find((item) => item.name === a.area);
  const dob = a.dob_y ? `${a.dob_y} ${t(`f.month.${a.dob_m}`)} ${a.dob_d}` : '';
  const wallet = a.payout_method && a.payout_method !== 'bank';
  const sections = [
    ['you', [a.full_name, a.phone, a.gender && t(`f.gender.${a.gender}`), dob && `${t('f.dob')}: ${dob}`]],
    ['home', [
      districtLabel(a.permanent_district, lang),
      a.current_address,
      t('f.sum.area', { place: area ? (lang === 'ne' ? area.nameNe : area.name) : t('apply.anywhere') }),
    ]],
    ['work', [
      a.services.map(service).join(', '),
      t('f.yearsShort', { n: a.years }),
      a.skill_level && t(`f.skill.${a.skill_level}`),
      a.has_tools && t('f.sum.tools', { value: t(`f.tools.${a.has_tools}`) }),
      a.travel_mode && t('f.sum.travel', { value: t(`f.travel.${a.travel_mode}`) }),
    ]],
    ['id', [a.id_type && t(`f.idType.${a.id_type}`), a.id_number,
      a.id_district && t('f.sum.issued', { district: districtLabel(a.id_district, lang) }),]],
    ['people', [
      `${t('f.emergency')}: ${[a.emergency_name, a.emergency_phone, a.emergency_relation && t(`f.rel.${a.emergency_relation}`)].filter(Boolean).join(' · ')}`,
      `${t('f.reference')}: ${[a.reference_name, a.reference_phone, a.reference_relation && t(`f.ref.${a.reference_relation}`)].filter(Boolean).join(' · ')}`,
    ]],
    ['money', [
      a.payout_method && t(`f.payout.${a.payout_method}`),
      wallet ? a.payout_account : [a.payout_bank, a.payout_account, a.payout_account_name].filter(Boolean).join(' · '),
    ]],
  ];
  return (
    <>
      {sections.map(([step, lines]) => (
        <View key={step} style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.summaryTitle}>{t(`f.step.${step}`)}</Text>
            <Pressable onPress={() => onEdit(step)} style={styles.change} accessibilityRole="button">
              <Text style={styles.changeText}>{t('f.change')}</Text>
            </Pressable>
          </View>
          {lines.filter(Boolean).map((line, index) => (
            <Text key={index} style={workStyles.body}>{line}</Text>
          ))}
        </View>
      ))}
      <Pressable style={styles.consent} onPress={() => set({ consent: !a.consent })} accessibilityRole="checkbox"
        accessibilityState={{ checked: a.consent }}>
        <View style={[styles.checkbox, a.consent && styles.checkboxOn, err('consent') && styles.inputError]}>
          {a.consent ? <Feather name="check" size={16} color="#FFFFFF" /> : null}
        </View>
        <Text style={styles.consentText}>{t('f.consent')}</Text>
      </Pressable>
      {err('consent') ? <Text style={styles.error}>{err('consent')}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  progressWrap: { gap: 6 },
  progressText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  stepTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: colors.text, flex: 1 },
  question: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.terracotta },
  small: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  chipActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.sage },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipTextActive: { fontFamily: fonts.semibold, color: colors.primary },
  input: {
    minHeight: MIN_TAP + 4,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.terracotta, borderWidth: 2 },
  dobRow: { flexDirection: 'row', gap: 10 },
  dobYear: { flex: 2, gap: 4 },
  dobDay: { flex: 1, gap: 4 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: MIN_TAP + 4,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  pickerChosen: { borderColor: colors.primary },
  pickerText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  pickerPlaceholder: { color: '#8A968F', fontFamily: fonts.regular },
  modal: { flex: 1, backgroundColor: colors.page, paddingHorizontal: 16, gap: 12 },
  modalHead: { flexDirection: 'row', alignItems: 'center' },
  close: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  modalList: { gap: 16, paddingBottom: 40 },
  province: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  summary: { gap: 4, padding: 14, borderRadius: radius.box, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.box },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  change: { minHeight: MIN_TAP - 8, justifyContent: 'center', paddingHorizontal: 6 },
  changeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.box,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.text },
});
