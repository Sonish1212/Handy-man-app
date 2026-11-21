import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import PhotoSlot from '../../components/PhotoSlot';
import Section from '../../components/Section';
import HomeHeader from '../../components/home/HomeHeader';
import PromoCarousel from '../../components/home/PromoCarousel';
import ServiceGrid from '../../components/home/ServiceGrid';
import { highlights } from '../../data/home';
import { seasonPhotos, servicePhotos } from '../../data/photos';
import { getSeason } from '../../data/seasons';
import useHomeContent from '../../data/useHomeContent';
import { useLocation } from '../../lib/location';
import { colors, fonts, MIN_NEPALI_SIZE, radius, spacing } from '../../theme';

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const { services, promos } = useHomeContent();
  const { area } = useLocation();
  const season = useMemo(() => getSeason(), []);

  const matchingServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (service) => !service.isOther && (service.name.toLowerCase().includes(q) || service.nameNe.includes(q)),
    );
  }, [query, services]);

  const searching = query.trim().length > 0;

  // Every card, banner and season offer opens that service's page.
  const openService = (slug) => {
    if (slug) router.push({ pathname: '/service/[slug]', params: { slug } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <HomeHeader area={area} query={query} onQueryChange={setQuery} />

      {!searching && <PromoCarousel promos={promos} onPress={(promo) => openService(promo.service)} />}

      {!searching && (
        <Section title="This season" titleNe="यो सिजन">
          <View style={styles.seasonTag}>
            <Text style={styles.seasonTagText}>{season.name}</Text>
            <Text style={styles.seasonTagTextNe}>{season.nameNe}</Text>
          </View>
          <View style={styles.seasonList}>
            {season.items.map((item) => (
              <Pressable
                key={item.id}
                style={styles.seasonCard}
                onPress={() => openService(item.service)}
                accessibilityRole="button"
              >
                <PhotoSlot
                  image={seasonPhotos[item.id] ?? servicePhotos[item.service]}
                  icon={item.icon}
                  style={styles.seasonPhoto}
                />
                <View style={styles.seasonText}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardTitleNe}>{item.titleNe}</Text>
                  <Text style={styles.cardBody}>{item.body}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </Section>
      )}

      <Section title={searching ? 'Search results' : 'Our services'} titleNe={searching ? 'खोज नतिजा' : 'हाम्रा सेवाहरू'}>
        {matchingServices.length > 0 ? (
          <ServiceGrid services={matchingServices} onPress={(service) => openService(service.id)} />
        ) : (
          <Text style={styles.empty}>No service matches “{query.trim()}”. Try Plumber or Painter.</Text>
        )}
      </Section>

      {!searching && (
        <Section title="Why book with us" titleNe="किन हामीसँग बुक गर्ने" bleed>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {highlights.map((item) => (
              <View key={item.id} style={styles.highlight}>
                <View style={styles.highlightIcon}>
                  <Feather name={item.icon} size={20} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardTitleNe}>{item.titleNe}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            ))}
          </ScrollView>
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { gap: spacing.boxGap, paddingBottom: 24 },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  row: { paddingHorizontal: 16, gap: 12 },

  highlight: {
    width: 200,
    padding: 14,
    backgroundColor: colors.sageLight,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.card,
    backgroundColor: colors.box,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },


  seasonTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FDF0DC',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  seasonTagText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  seasonTagTextNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary },
  seasonList: { gap: 12 },
  seasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seasonPhoto: { width: 72, height: 72, borderRadius: 8 },
  seasonText: { flex: 1 },

  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  cardTitleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary },
  cardBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 4 },
});
