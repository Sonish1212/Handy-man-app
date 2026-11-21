import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapPicker, { toRegion } from '../components/location/MapPicker';
import { areas, cities, nearestArea } from '../data/areas';
import { useLocation } from '../lib/location';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius, spacing } from '../theme';

// A pin on the map may sit between two listed places, so it counts as
// served up to this far from the nearest one.
const MAP_RANGE_KM = 5;

const CITY_NE = { Kathmandu: 'काठमाडौं', Lalitpur: 'ललितपुर', Bhaktapur: 'भक्तपुर' };

// Opened from the location pill on the homepage and from the booking
// address. Like Foodmandu: pick the city, then a popular place in it, then
// move the map until the pin sits on the house.
export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const { area: selected, pin, setPlace, locateMe } = useLocation();
  const [step, setStep] = useState('list');
  const [city, setCity] = useState(selected?.city ?? cities[0]);
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const openMap = (point) => {
    setCenter(point);
    setError(null);
    setStep('map');
  };

  const findMe = async () => {
    setLocating(true);
    setError(null);
    const result = await locateMe();
    setLocating(false);
    if (result.error) return setError(result.error);
    if (step === 'map') {
      setCenter(result.point);
      return mapRef.current?.animateToRegion(toRegion(result.point), 500);
    }
    return openMap(result.point);
  };

  const places = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areas.filter((area) => area.city === city);
    return areas.filter(
      (area) => area.name.toLowerCase().includes(q) || area.nameNe.includes(q) || area.city.toLowerCase().includes(q),
    );
  }, [city, query]);

  if (step === 'map' && center) {
    const match = nearestArea(center, MAP_RANGE_KM);
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => setStep('list')} accessibilityLabel="Back to the list">
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.title}>Set your exact location</Text>
            <Text style={styles.subtitle}>Move the map, or tap your house, so the pin sits on it.</Text>
          </View>
        </View>

        <View style={styles.flex}>
          <MapPicker ref={mapRef} initial={center} onCenterChange={setCenter} style={styles.flex} />
          <Pressable
            style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}
            onPress={findMe}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Go to my current location"
          >
            {locating ? <ActivityIndicator color={colors.primary} /> : <Feather name="crosshair" size={22} color={colors.primary} />}
          </Pressable>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {error ? <ErrorBox text={error} /> : null}
          <View style={styles.placeRow}>
            <View style={[styles.placeIcon, !match && styles.placeIconOff]}>
              <Feather name={match ? 'map-pin' : 'slash'} size={20} color={match ? colors.primary : colors.terracotta} />
            </View>
            <View style={styles.flex}>
              {match ? (
                <>
                  <Text style={styles.placeName}>
                    {match.name}, {match.city}
                  </Text>
                  <Text style={styles.placeNe}>{match.nameNe}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.placeName}>Outside the areas we serve</Text>
                  <Text style={styles.placeHint}>Move the pin back inside Kathmandu, Lalitpur or Bhaktapur.</Text>
                </>
              )}
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.confirm, !match && styles.disabled, pressed && match && styles.pressed]}
            onPress={() => {
              setPlace(match, center);
              close();
            }}
            disabled={!match}
            accessibilityRole="button"
          >
            <Text style={styles.confirmText}>Confirm location</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Choose your location</Text>
          <Text style={styles.titleNe}>तपाईंको ठेगाना छान्नुहोस्</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Close">
          <Feather name="x" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cities} accessibilityRole="tablist">
          {cities.map((name) => {
            const active = name === city && !query.trim();
            return (
              <Pressable
                key={name}
                style={[styles.cityChip, active && styles.cityChipActive]}
                onPress={() => {
                  setCity(name);
                  setQuery('');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.cityText, active && styles.cityTextActive]}>{name}</Text>
                <Text style={[styles.cityNe, active && styles.cityTextActive]}>{CITY_NE[name]}</Text>
              </Pressable>
            );
          })}
        </View>

        {pin && selected ? (
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={() => openMap(pin)}
            accessibilityRole="button"
          >
            <View style={styles.optionIcon}>
              <Feather name="home" size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.optionTitle}>Your saved pin</Text>
              <Text style={styles.optionBody}>
                {selected.name}, {selected.city} · tap to adjust
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          onPress={findMe}
          disabled={locating}
          accessibilityRole="button"
        >
          <View style={styles.optionIcon}>
            {locating ? <ActivityIndicator color={colors.primary} /> : <Feather name="crosshair" size={20} color={colors.primary} />}
          </View>
          <View style={styles.flex}>
            <Text style={styles.optionTitle}>{locating ? 'Finding you…' : 'Use my current location'}</Text>
            <Text style={styles.optionBody}>Opens the map where you are now</Text>
          </View>
        </Pressable>

        {error ? <ErrorBox text={error} /> : null}

        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for a place"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityLabel="Clear search">
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.groupTitle}>{query.trim() ? 'Places found' : `Popular places in ${city}`}</Text>
        {places.length === 0 ? (
          <Text style={styles.empty}>
            We don’t serve “{query.trim()}” yet. We are starting in Kathmandu, Lalitpur and Bhaktapur.
          </Text>
        ) : (
          <View style={styles.box}>
            {places.map((area, index) => {
              const isSelected = area.id === selected?.id;
              return (
                <Pressable
                  key={area.id}
                  style={({ pressed }) => [
                    styles.row,
                    index < places.length - 1 && styles.rowBorder,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => openMap({ lat: area.lat, lng: area.lng })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.flex}>
                    <Text style={[styles.rowName, isSelected && styles.rowNameSelected]}>{area.name}</Text>
                    <Text style={styles.rowNameNe}>
                      {area.nameNe}
                      {query.trim() ? ` · ${area.city}` : ''}
                    </Text>
                  </View>
                  {isSelected ? <Feather name="check" size={20} color={colors.primary} /> : null}
                  <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ErrorBox({ text }) {
  return (
    <View style={styles.errorBox}>
      <Feather name="alert-circle" size={16} color={colors.terracotta} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.gutter,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  iconButton: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  content: { paddingHorizontal: spacing.gutter, gap: spacing.boxGap },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  cities: { flexDirection: 'row', gap: 8 },
  cityChip: {
    flex: 1,
    minHeight: MIN_TAP + 12,
    paddingVertical: 8,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityChipActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.sage },
  cityText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  cityNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary },
  cityTextActive: { color: colors.primary },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
  },
  optionIcon: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: radius.card,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  optionBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: '#F8E6DF',
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.terracotta },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 10 },
  empty: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  groupTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowName: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  rowNameSelected: { fontFamily: fonts.semibold, color: colors.primary },
  rowNameNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary },
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: MIN_TAP + 4,
    height: MIN_TAP + 4,
    borderRadius: radius.box,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    gap: 14,
    paddingTop: 16,
    paddingHorizontal: spacing.gutter,
    backgroundColor: colors.box,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeIcon: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: radius.card,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeIconOff: { backgroundColor: '#F8E6DF' },
  placeName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  placeNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary },
  placeHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  confirm: {
    minHeight: 52,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
});
