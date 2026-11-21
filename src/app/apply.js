import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ApplicationForm from '../components/pro/ApplicationForm';
import LanguageSwitch from '../components/pro/LanguageSwitch';
import { Box, Notice, WorkButton, workStyles } from '../components/work/ui';
import { isDemoMode, useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import {
  DOCUMENT_KINDS,
  REQUIRED_DOCUMENTS,
  submitApplication,
  uploadDocument,
  useApplication,
} from '../lib/pro';
import { colors, fonts, MIN_TAP, radius } from '../theme';

// The professional app's home until the team approves someone. It always
// opens here, never straight into the form: the person sees where they are
// (not started, photos missing, being checked, needs a fix) and chooses to
// continue. The form and the photos open only when they tap.
export default function ApplyScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn, profile, session, refreshProfile, signOut } = useAuth();
  const { t } = useT();
  const { application, loading, error, refresh, setDemo } = useApplication();
  // home | form | photos. formOpened keeps the form's answers while the
  // person goes back home and returns (nothing is saved until the last step).
  const [view, setView] = useState('home');
  const [formOpened, setFormOpened] = useState(false);
  const scrollRef = useRef(null);
  const state = application?.state ?? null;
  const signedInAs = session?.user?.email || session?.user?.phone || null;

  // Approved: load the professional record, then the jobs screens open.
  useEffect(() => {
    if (state === 'verified' && !profile?.professional) refreshProfile();
  }, [state, profile?.professional, refreshProfile]);

  if (!isDemoMode && !isSignedIn) return <Redirect href="/pro-welcome" />;
  if (profile?.professional || (isDemoMode && state === 'verified')) return <Redirect href="/work" />;

  const toTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });
  const open = (next) => {
    if (next === 'form') setFormOpened(true);
    setView(next);
    toTop();
  };
  const goHome = () => {
    setView('home');
    toTop();
    refresh();
  };

  const firstLoad = loading && !application;
  const showForm = formOpened && !firstLoad && state !== 'in_review';
  let body = null;
  if (firstLoad || state === 'verified') {
    body = <ActivityIndicator color={colors.primary} style={styles.loader} />;
  } else if (error && !application) {
    // Never show an empty form when we simply could not load the saved
    // one: the person would think their application was lost.
    body = (
      <>
        <StatusCard icon="wifi-off" tone="bad" title={t('status.loadFailed')} />
        <WorkButton label={t('status.tryAgain')} icon="refresh-cw" onPress={refresh} busy={loading} />
      </>
    );
  } else if (view === 'photos' && application) {
    body = (
      <DocumentsStep
        application={application}
        userId={session?.user?.id}
        onEditDetails={() => open('form')}
        onChanged={(kind) => {
          if (isDemoMode) setDemo((a) => ({ ...a, documents: [...new Set([...a.documents, kind])] }));
          else refresh();
        }}
        onSubmitted={() => {
          if (isDemoMode) setDemo((a) => ({ ...a, state: 'in_review', rejection_reason: null }));
          goHome();
        }}
      />
    );
  } else if (view !== 'form') {
    body = (
      <Home
        application={application}
        state={state}
        loading={loading}
        started={formOpened}
        onOpen={open}
        onRefresh={refresh}
        setDemo={setDemo}
      />
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={workStyles.screen}
      contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topRow}>
        {view === 'home' ? (
          <LanguageSwitch />
        ) : (
          <Pressable onPress={goHome} style={styles.back} accessibilityRole="button">
            <Feather name="arrow-left" size={20} color={colors.primary} />
            <Text style={styles.backText}>{t('home.back')}</Text>
          </Pressable>
        )}
        {isDemoMode || view !== 'home' ? null : (
          <Pressable onPress={signOut} style={styles.signOut} accessibilityRole="button">
            <Text style={styles.signOutText}>{t('status.signout')}</Text>
          </Pressable>
        )}
      </View>

      {view === 'home' ? (
        <View style={styles.hello}>
          <Text style={styles.title}>
            {application?.full_name
              ? t('home.helloName', { name: application.full_name.split(' ')[0] })
              : t('home.hello')}
          </Text>
          {/* Which account this is, so someone who signed in another way can tell. */}
          {signedInAs ? <Text style={workStyles.muted}>{t('status.signedInAs', { who: signedInAs })}</Text> : null}
        </View>
      ) : (
        <Text style={styles.title}>{t('apply.title')}</Text>
      )}
      {error && application ? <Text style={workStyles.error}>{error}</Text> : null}
      {body}

      {showForm ? (
        <View style={view === 'form' ? styles.formShown : styles.formHidden}>
          <ApplicationForm
            application={application}
            onStepChange={toTop}
            onSaved={(answers) => {
              setFormOpened(false);
              open('photos');
              if (isDemoMode) {
                // The same shape my_application() returns, so editing works in the demo too.
                const plus = (n) => (n && !n.startsWith('+') && answers.payout_method !== 'bank' ? `+977${n}` : n);
                setDemo((current) => ({
                  ...answers,
                  state: current?.state ?? 'draft',
                  rejection_reason: current?.rejection_reason ?? null,
                  documents: current?.documents ?? [],
                  phone: `+977${answers.phone}`,
                  area: answers.area || null,
                  years_experience: Number(answers.years),
                  citizenship_number: answers.id_number,
                  emergency_phone: `+977${answers.emergency_phone}`,
                  reference_phone: `+977${answers.reference_phone}`,
                  payout_account: plus(answers.payout_account),
                }));
              } else refresh();
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

// Where the person is, and the one thing to do next.
function Home({ application, state, loading, started, onOpen, onRefresh, setDemo }) {
  const { t } = useT();
  const added = application?.documents ?? [];
  const photos = REQUIRED_DOCUMENTS.filter((kind) => added.includes(kind)).length;
  const sent = state === 'in_review';

  if (state === 'suspended') {
    return <StatusCard icon="pause-circle" tone="bad" title={t('status.suspended.title')} body={t('status.suspended.body')} />;
  }

  if (!application) {
    return (
      <>
        <Box title={t('home.start.title')}>
          <Text style={workStyles.body}>{t('home.start.body')}</Text>
          <Text style={styles.readyTitle}>{t('home.ready')}</Text>
          {['home.ready.id', 'home.ready.reference', 'home.ready.family', 'home.ready.payout'].map((key) => (
            <View key={key} style={styles.readyRow}>
              <Feather name="check" size={16} color={colors.primary} />
              <Text style={styles.readyText}>{t(key)}</Text>
            </View>
          ))}
        </Box>
        <WorkButton label={started ? t('home.continue') : t('home.start.button')} icon="arrow-right" onPress={() => onOpen('form')} />
      </>
    );
  }

  return (
    <>
      {sent ? <StatusCard icon="clock" title={t('status.review.title')} body={t('status.review.body')} /> : null}
      {state === 'rejected' ? (
        <StatusCard icon="alert-circle" tone="bad" title={t('status.rejected.title')} body={application.rejection_reason} />
      ) : null}

      <Box title={t('home.progress')}>
        <ProgressRow done label={t('home.step.details')} />
        <ProgressRow
          done={photos === REQUIRED_DOCUMENTS.length}
          label={t('home.step.photos', { n: photos, total: REQUIRED_DOCUMENTS.length })}
        />
        <ProgressRow done={sent} label={t('home.step.send')} />
        <ProgressRow done={false} label={t('home.step.approved')} />
      </Box>

      {sent ? (
        <>
          <WorkButton label={t('status.refresh')} tone="secondary" icon="refresh-cw" onPress={onRefresh} busy={loading} />
          {isDemoMode ? (
            <View style={workStyles.row}>
              <WorkButton label="Demo: approve" tone="secondary" onPress={() => setDemo((a) => ({ ...a, state: 'verified' }))} />
              <WorkButton
                label="Demo: reject"
                tone="secondary"
                onPress={() =>
                  setDemo((a) => ({
                    ...a,
                    state: 'rejected',
                    rejection_reason: 'The citizenship photo is blurred. Please retake it.',
                  }))
                }
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <WorkButton
            label={state === 'rejected' ? t('status.rejected.fix') : t('home.continue')}
            icon="arrow-right"
            onPress={() => onOpen('photos')}
          />
          <WorkButton label={t('apply.editDetails')} tone="secondary" onPress={() => onOpen('form')} />
        </>
      )}
    </>
  );
}

function ProgressRow({ done, label }) {
  return (
    <View style={styles.readyRow}>
      <Feather name={done ? 'check-circle' : 'circle'} size={20} color={done ? colors.primary : colors.textSecondary} />
      <Text style={[styles.readyText, done && styles.progressDone]}>{label}</Text>
    </View>
  );
}

function StatusCard({ icon, title, body, tone }) {
  const bad = tone === 'bad';
  return (
    <View style={[styles.status, bad && styles.statusBad]}>
      <Feather name={icon} size={30} color={bad ? colors.terracotta : colors.primary} />
      <Text style={styles.statusTitle}>{title}</Text>
      {body ? <Text style={styles.statusBody}>{body}</Text> : null}
    </View>
  );
}

function DocumentsStep({ application, userId, onEditDetails, onChanged, onSubmitted }) {
  const { t } = useT();
  const [uploading, setUploading] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const added = application.documents ?? [];
  const ready = REQUIRED_DOCUMENTS.every((kind) => added.includes(kind));

  const pick = async (kind, fromCamera) => {
    setNotice(null);
    if (isDemoMode) return onChanged(kind);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setNotice({ tone: 'error', text: t('doc.noPermission') });

    const options = { mediaTypes: ['images'], quality: 0.5 };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          ...options,
          cameraType: kind === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        })
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return undefined;

    setUploading(kind);
    const uploaded = await uploadDocument(userId, kind, result.assets[0]);
    setUploading(null);
    if (uploaded.error) {
      return setNotice({ tone: 'error', text: uploaded.error === 'upload' ? t('doc.failed') : uploaded.error });
    }
    return onChanged(kind);
  };

  const submit = async () => {
    if (!ready) return setNotice({ tone: 'error', text: t('docs.missing') });
    if (isDemoMode) return onSubmitted();
    setBusy(true);
    const result = await submitApplication();
    setBusy(false);
    if (result.error) return setNotice({ tone: 'error', text: result.error });
    return onSubmitted();
  };

  return (
    <>
      <Box title={t('docs.title')}>
        <Text style={workStyles.muted}>{t('docs.intro')}</Text>
        {DOCUMENT_KINDS.map((doc) => {
          const done = added.includes(doc.kind);
          const working = uploading === doc.kind;
          return (
            <View key={doc.kind} style={[styles.doc, done && styles.docDone]}>
              <View style={styles.docHead}>
                <Feather name={done ? 'check-circle' : doc.icon} size={20} color={done ? colors.primary : colors.textSecondary} />
                <View style={workStyles.flex}>
                  <Text style={styles.docTitle}>{t(`doc.${doc.kind}`)}</Text>
                  {doc.kind === 'police_report' ? <Text style={workStyles.muted}>{t('doc.policeHint')}</Text> : null}
                </View>
                <Text style={[styles.docState, done && styles.docStateDone]}>
                  {working ? t('doc.uploading') : done ? t('doc.added') : doc.required ? t('doc.needed') : t('doc.optional')}
                </Text>
              </View>
              <View style={workStyles.row}>
                <WorkButton
                  label={t('doc.camera')}
                  icon="camera"
                  tone={done ? 'secondary' : 'primary'}
                  busy={working}
                  disabled={Boolean(uploading)}
                  onPress={() => pick(doc.kind, true)}
                />
                <WorkButton
                  label={t('doc.library')}
                  icon="image"
                  tone="secondary"
                  disabled={Boolean(uploading)}
                  onPress={() => pick(doc.kind, false)}
                />
              </View>
            </View>
          );
        })}
      </Box>

      <Notice notice={notice} />
      <WorkButton label={t('docs.submit')} icon="send" onPress={submit} busy={busy} disabled={Boolean(uploading)} />
      <WorkButton label={t('apply.editDetails')} tone="secondary" onPress={onEditDetails} />
    </>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TAP },
  back: { minHeight: MIN_TAP, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  backText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  hello: { gap: 2 },
  readyTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readyText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 23, color: colors.text },
  progressDone: { color: colors.textSecondary },
  formShown: { gap: 16 },
  formHidden: { display: 'none' },
  signOut: { minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: 4 },
  signOutText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.terracotta },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: colors.text },
  loader: { marginTop: 40 },
  status: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  statusBad: { borderColor: colors.terracotta, backgroundColor: '#F8E6DF' },
  statusTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.text, textAlign: 'center' },
  statusBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.text, textAlign: 'center' },
  doc: { gap: 10, padding: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  docDone: { backgroundColor: colors.sageLight },
  docHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  docTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  docState: { fontFamily: fonts.semibold, fontSize: 12, color: colors.terracotta },
  docStateDone: { color: colors.primary },
});
