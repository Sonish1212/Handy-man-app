import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PhotoSlot from '../../components/PhotoSlot';
import { DEFAULT_EXCLUDES, DEFAULT_INCLUDES, formatDuration } from '../../data/catalog';
import { servicePhotos } from '../../data/photos';
import { formatRupees } from '../../lib/bookings';
import { useBookingSettings, useServiceCatalog } from '../../lib/catalog';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius, spacing } from '../../theme';

const PRICING_NOTES = {
  fixed_price: 'Check the job price before confirming.',
  quote_first: 'A professional visits first and gives you a price before any work.',
  day_rate: 'Priced per worker per day.',
  contract: 'Priced per contract.',
};

// Service page: what the job includes, the tasks with their prices, and the
// way into the booking flow.
export default function ServiceScreen() {
  const { slug, task: preselected } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { service, tasks, loading } = useServiceCatalog(slug);
  const settings = useBookingSettings();
  const [chosen, setChosen] = useState(preselected ?? null);

  const selectedTask = tasks.find((task) => task.id === chosen || task.slug === chosen) ?? null;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!service) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={styles.title}>Service not found</Text>
            <Pressable style={styles.linkButton} onPress={back}>
              <Text style={styles.link}>Go back</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const includes = service.includes?.length ? service.includes : DEFAULT_INCLUDES;
  const excludes = service.excludes?.length ? service.excludes : DEFAULT_EXCLUDES;
  const image = service.image_url ? { uri: service.image_url } : servicePhotos[service.slug];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={styles.hero}>
          <PhotoSlot image={image} fallbackImage={servicePhotos[service.slug]} icon={service.icon} iconSize={56} style={styles.heroPhoto} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} style={styles.heroShade} />
          <Pressable
            style={[styles.back, { top: insets.top + 8 }]}
            onPress={back}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{service.name}</Text>
          <Text style={styles.titleNe}>{service.name_ne}</Text>
          <Text style={styles.note}>{PRICING_NOTES[service.pricing_type] ?? PRICING_NOTES.fixed_price}</Text>

          <Text style={styles.sectionTitle}>Choose a job</Text>
          <View style={styles.box}>
            {tasks.length === 0 && loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
            {tasks.map((task, index) => {
              const active = selectedTask?.id === task.id;
              return (
                <Pressable
                  key={task.id}
                  style={[styles.taskRow, index < tasks.length - 1 && styles.rowBorder, active && styles.taskRowActive]}
                  onPress={() => setChosen(task.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.taskName}>{task.name}</Text>
                    <Text style={styles.taskNe}>
                      {task.name_ne}
                      {formatDuration(task.duration_minutes) ? `  ·  about ${formatDuration(task.duration_minutes)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.price}>{formatRupees(task.price)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>What’s included</Text>
          <View style={styles.box}>
            {includes.map((line) => (
              <ListLine key={line} icon="check" color={colors.primary} text={line} />
            ))}
            {excludes.map((line) => (
              <ListLine key={line} icon="x" color={colors.terracotta} text={line} />
            ))}
          </View>

          <View style={styles.infoBox}>
            <ListLine
              icon="credit-card"
              color={colors.text}
              text={`Pay a ${formatRupees(settings.advance_amount)} advance to confirm. It counts towards your bill.`}
            />
            <ListLine
              icon="clock"
              color={colors.text}
              text={`Free cancellation up to ${settings.free_cancel_hours} hours before your slot.`}
            />
            <ListLine
              icon="zap"
              color={colors.text}
              text={`Need it now? Choose “As soon as possible” for ${formatRupees(settings.asap_fee)} extra.`}
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.flex}>
          <Text style={styles.footerLabel}>{selectedTask ? selectedTask.name : 'Choose a job above'}</Text>
          <Text style={styles.footerPrice}>{selectedTask ? formatRupees(selectedTask.price) : ' '}</Text>
        </View>
        <Pressable
          style={[styles.cta, !selectedTask && styles.ctaDisabled]}
          disabled={!selectedTask}
          onPress={() => router.push({ pathname: '/book/[slug]', params: { slug: service.slug, task: selectedTask.id } })}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Continue</Text>
          <Feather name="arrow-right" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function ListLine({ icon, color, text }) {
  return (
    <View style={styles.listLine}>
      <Feather name={icon} size={16} color={color} style={styles.listIcon} />
      <Text style={styles.listText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', backgroundColor: colors.page, gap: 12 },
  flex: { flex: 1 },
  hero: { height: 240 },
  heroPhoto: { height: 240 },
  heroShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 120 },
  back: {
    position: 'absolute',
    left: spacing.gutter,
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: MIN_TAP / 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: -20,
    paddingHorizontal: spacing.gutter,
    paddingTop: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.page,
  },
  title: { fontFamily: fonts.bold, fontSize: 26, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 8 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginTop: 24, marginBottom: 10 },
  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  loader: { marginVertical: 16 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  taskRowActive: {},
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
  listLine: { flexDirection: 'row', gap: 10, paddingVertical: 7 },
  listIcon: { marginTop: 2 },
  listText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  infoBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: radius.box,
    backgroundColor: colors.sageLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
  footerPrice: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  cta: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
  linkButton: { minHeight: MIN_TAP, justifyContent: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
});
