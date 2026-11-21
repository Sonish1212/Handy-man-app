import { useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReasonForm } from '../../components/work/JobActions';
import { Box, ContactButtons, InfoLine, Notice, WorkButton, WorkHeader, workStyles } from '../../components/work/ui';
import { isDemoMode } from '../../lib/auth';
import { documentLinks, useApplicants } from '../../lib/pro';
import { callRpc, formatAgo, formatPhone, useWorkRole } from '../../lib/work';
import { colors, fonts, radius } from '../../theme';

// The answers from the application form, in words for the team.
const LABELS = {
  gender: { male: 'Man', female: 'Woman', other: 'Other' },
  skill: {
    none: 'No certificate (learned at work)',
    training: 'CTEVT or other training',
    level1: 'NSTB skill test Level 1',
    level2: 'NSTB skill test Level 2',
    level3: 'NSTB skill test Level 3+',
  },
  tools: { all: 'Has all own tools', some: 'Has some tools', none: 'No own tools' },
  travel: { bike: 'Own bike or scooter', public: 'Bus or micro', walk: 'Walks or cycles' },
  idType: { citizenship: 'Citizenship', national_id: 'National ID card' },
  relation: {
    father: 'father', mother: 'mother', spouse: 'husband or wife', sibling: 'brother or sister', child: 'son or daughter',
    relative: 'relative', friend: 'friend', employer: 'past boss or contractor', customer: 'past customer',
    coworker: 'co-worker', trainer: 'teacher or trainer', neighbour: 'neighbour', other: 'other',
  },
  payout: { esewa: 'eSewa', khalti: 'Khalti', bank: 'Bank', ime_pay: 'IME Pay', cash: 'Cash' },
};
const label = (group, value) => (value ? (LABELS[group][value] ?? value) : null);
const joined = (...parts) => parts.filter(Boolean).join(' · ') || null;

const DOCUMENT_LABELS = {
  citizenship_front: 'ID front',
  citizenship_back: 'ID back',
  selfie: 'Face photo',
  police_report: 'Police report',
};

// People who applied in the professional app and are waiting for the team:
// check the photos against the details, call them and their reference, then
// approve or send back with what to fix.
export default function ApplicantsScreen() {
  const insets = useSafeAreaInsets();
  const { isTeam } = useWorkRole();
  const { applicants, loading, error, refresh } = useApplicants();
  const [notice, setNotice] = useState(null);

  if (!isTeam) {
    return (
      <View style={[workStyles.screen, workStyles.content, { paddingTop: insets.top + 16 }]}>
        <WorkHeader title="Applications" fallback="/team" />
        <Text style={workStyles.empty}>This page is only for the team.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={workStyles.screen}
      contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <WorkHeader title="Applications" subtitle="People who want to join as professionals" fallback="/team" />
      {isDemoMode ? <Text style={workStyles.muted}>Demo mode: a sample application, buttons switched off.</Text> : null}
      {error ? <Text style={workStyles.error}>{error}</Text> : null}
      <Notice notice={notice} />

      <Box title="Before you approve">
        <InfoLine icon="check">The face photo matches the photo on the ID.</InfoLine>
        <InfoLine icon="check">The name and number on the ID match what they typed.</InfoLine>
        <InfoLine icon="check">The date of birth and ID district match the ID photo.</InfoLine>
        <InfoLine icon="check">You called them on their number, and called their reference (not family).</InfoLine>
        <InfoLine icon="check">The police report, if added, is less than 6 months old.</InfoLine>
      </Box>

      {applicants.length === 0 ? <Text style={workStyles.empty}>No applications waiting.</Text> : null}
      {applicants.map((applicant) => (
        <ApplicantCard
          key={applicant.id}
          applicant={applicant}
          onReviewed={(text) => {
            setNotice({ text });
            refresh();
          }}
        />
      ))}
    </ScrollView>
  );
}

function ApplicantCard({ applicant, onReviewed }) {
  const [links, setLinks] = useState({});
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const one = (value) => (Array.isArray(value) ? value[0] : value);
  const details = one(applicant.professional_private);
  const documents = applicant.professional_documents ?? [];
  const services = (applicant.professional_services ?? []).map((row) => row.service?.name).filter(Boolean);

  useEffect(() => {
    let active = true;
    documentLinks(documents).then((result) => {
      if (active) setLinks(result);
    });
    return () => {
      active = false;
    };
    // The photo list only changes when the applicant re-uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant.id, documents.length]);

  const review = async (approve, reason = null) => {
    setBusy(approve ? 'approve' : 'reject');
    setError(null);
    const result = await callRpc('review_professional', {
      p_professional_id: applicant.id,
      p_approve: approve,
      p_reason: reason,
    });
    setBusy(null);
    if (result.error) return setError(result.error);
    return onReviewed(
      approve
        ? `${applicant.full_name} is approved and can now get jobs.`
        : `Sent back to ${applicant.full_name} with what to fix.`,
    );
  };

  return (
    <Box>
      <View style={styles.headRow}>
        <View style={workStyles.flex}>
          <Text style={styles.name}>{applicant.full_name}</Text>
          <Text style={workStyles.muted}>
            {formatPhone(applicant.phone)} · applied {formatAgo(applicant.applied_at)}
          </Text>
        </View>
        <ContactButtons phone={applicant.phone} name={applicant.full_name} />
      </View>
      <InfoLine icon="tool">{services.join(', ')}</InfoLine>
      <InfoLine icon="map-pin">{applicant.area ?? 'Works anywhere in the valley'}</InfoLine>
      <InfoLine icon="award">{`${applicant.years_experience ?? 0} years of experience`}</InfoLine>
      <InfoLine icon="message-circle">{applicant.about}</InfoLine>
      <InfoLine icon="user">
        {joined(label('gender', applicant.gender), details?.date_of_birth_bs && `born ${details.date_of_birth_bs} B.S.`)}
      </InfoLine>
      <InfoLine icon="home">
        {joined(details?.current_address, details?.permanent_district && `from ${details.permanent_district}`)}
      </InfoLine>
      <InfoLine icon="briefcase">
        {joined(label('skill', applicant.skill_level), label('tools', applicant.has_tools), label('travel', applicant.travel_mode))}
      </InfoLine>
      <InfoLine icon="credit-card">
        {details?.citizenship_number
          ? joined(
              `${label('idType', details.id_type) ?? 'ID'} ${details.citizenship_number}`,
              details.id_issue_district && `issued in ${details.id_issue_district}`,
            )
          : null}
      </InfoLine>
      <InfoLine icon="dollar-sign">
        {joined(
          label('payout', details?.payout_method),
          details?.payout_bank,
          details?.payout_account_number && formatPhoneOrAccount(details.payout_account_number),
          details?.payout_account_name,
        )}
      </InfoLine>

      <PersonRow
        title="Reference"
        name={details?.reference_name}
        relation={label('relation', details?.reference_relation)}
        phone={details?.reference_phone}
        fallback={details?.reference_contacts}
      />
      <PersonRow
        title="Emergency contact"
        name={details?.emergency_name}
        relation={label('relation', details?.emergency_relation)}
        phone={details?.emergency_phone}
      />

      <View style={styles.photos}>
        {documents.map((doc) => (
          <View key={doc.kind} style={styles.photoWrap}>
            {links[doc.kind] ? (
              <Image source={{ uri: links[doc.kind] }} style={styles.photo} resizeMode="cover" accessibilityLabel={DOCUMENT_LABELS[doc.kind]} />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]} />
            )}
            <Text style={styles.photoLabel}>{DOCUMENT_LABELS[doc.kind] ?? doc.kind}</Text>
          </View>
        ))}
      </View>
      {!documents.some((doc) => doc.kind === 'police_report') ? (
        <Text style={styles.warning}>No police report yet. Ask for it before or soon after approving.</Text>
      ) : null}

      {error ? <Text style={workStyles.error}>{error}</Text> : null}
      {mode === 'reject' ? (
        <ReasonForm
          label="What should they fix?"
          placeholder="For example: the ID photo is blurred, please retake it"
          hint="They see this message in their app, then send the application again."
          buttonLabel="Send back"
          busy={busy === 'reject'}
          onCancel={() => setMode(null)}
          onSubmit={(reason) => review(false, reason)}
        />
      ) : (
        <View style={workStyles.row}>
          <WorkButton label="Send back" tone="danger" disabled={Boolean(busy)} onPress={() => setMode('reject')} />
          <WorkButton label="Approve" icon="check" busy={busy === 'approve'} disabled={Boolean(busy)} onPress={() => review(true)} />
        </View>
      )}
    </Box>
  );
}

const formatPhoneOrAccount = (value) => (value.startsWith('+977') ? formatPhone(value) : value);

// A person the applicant named, with buttons to call or text them.
function PersonRow({ title, name, relation, phone, fallback }) {
  if (!name && !fallback) return null;
  return (
    <View style={styles.person}>
      <View style={workStyles.flex}>
        <Text style={styles.personTitle}>{title}</Text>
        <Text style={workStyles.body}>
          {name ? `${name}${relation ? ` (${relation})` : ''}` : fallback}
        </Text>
        {phone ? <Text style={workStyles.muted}>{formatPhone(phone)}</Text> : null}
      </View>
      {phone ? <ContactButtons phone={phone} name={name} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personTitle: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: '47%', gap: 4 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card, backgroundColor: colors.photoPlaceholder },
  photoEmpty: { borderWidth: 1, borderColor: colors.border },
  photoLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  warning: { fontFamily: fonts.medium, fontSize: 13, color: colors.terracotta },
});
