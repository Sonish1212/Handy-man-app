import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius, spacing } from '../../theme';
import PhotoSlot from '../PhotoSlot';

const BANNER_HEIGHT = 180;

export default function PromoCarousel({ promos, onPress }) {
  const { width } = useWindowDimensions();
  const bannerWidth = width - spacing.gutter * 2;
  const step = bannerWidth + spacing.boxGap;
  const [active, setActive] = useState(0);

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / step);
    if (index !== active) setActive(index);
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={styles.track}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {promos.map((promo) => (
          <View key={promo.id} style={[styles.banner, { width: bannerWidth }]}>
            <PhotoSlot image={promo.image} fallbackImage={promo.fallbackImage} icon={promo.icon} iconSize={56} style={styles.photo} />
            <LinearGradient
              colors={['rgba(31,74,54,1)', 'rgba(31,74,54,0.85)', 'rgba(31,74,54,0)']}
              locations={[0.38, 0.55, 0.75]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.content}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{promo.tag}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {promo.title}
              </Text>
              <Text style={styles.titleNe} numberOfLines={1}>
                {promo.titleNe}
              </Text>
              {/* Visual height is 36; hitSlop pads the touch area to the 44px minimum. */}
              <Pressable
                style={styles.button}
                onPress={() => onPress?.(promo)}
                hitSlop={(MIN_TAP - 36) / 2}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{promo.cta}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {promos.map((promo, index) => (
          <View key={promo.id} style={[styles.dot, index === active && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { paddingHorizontal: spacing.gutter, gap: spacing.boxGap },
  banner: {
    height: BANNER_HEIGHT,
    borderRadius: radius.box,
    overflow: 'hidden',
    backgroundColor: colors.primaryDark,
  },
  // The photo fills the right side so the person stays clear of the text;
  // the gradient blends its left edge into the green.
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '62%' },
  content: {
    flex: 1,
    width: '68%',
    padding: 16,
    justifyContent: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.marigold,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  tagText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: '#FFFFFF' },
  titleNe: {
    fontFamily: fonts.nepali,
    fontSize: MIN_NEPALI_SIZE,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.primary },
});
