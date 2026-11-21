import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

// Shows a photo when one is provided, otherwise a sage block with an icon,
// so real photos can be dropped in later without changing the layout.
export default function PhotoSlot({ image, fallbackImage, icon = 'tool', style, iconSize = 28 }) {
  const [failedSources, setFailedSources] = useState([]);
  const sourceKey = image?.uri ?? image;
  const fallbackKey = fallbackImage?.uri ?? fallbackImage;
  const useFallback = !image || failedSources.includes(sourceKey);
  const source = useFallback
    ? (failedSources.includes(fallbackKey) ? null : fallbackImage)
    : image;
  const currentKey = source?.uri ?? source;
  if (source) {
    return (
      <Image source={source} style={[styles.slot, style]} resizeMode="cover"
        onError={() => setFailedSources((failed) => failed.includes(currentKey) ? failed : [...failed, currentKey])} />
    );
  }

  return (
    <View style={[styles.slot, styles.placeholder, style]}>
      <Feather name={icon} size={iconSize} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: '100%', overflow: 'hidden' },
  placeholder: {
    backgroundColor: colors.photoPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
