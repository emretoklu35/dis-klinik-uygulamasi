/**
 * Parmakla (ya da fareyle) imza alanı. Çizgiler SVG yol verisi olarak tutulur;
 * kaydedilen imza her boyutta aynı görünür. Telefon, tablet ve web'de çalışır.
 */

import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, Radius } from '@/constants/theme';
import type { Signature } from '@/features/patients/types';

export function SignaturePad({
  height = 180,
  onChange,
}: {
  height?: number;
  /** Her çizgiden sonra imza (boşsa null) */
  onChange: (signature: Signature | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const [strokes, setStrokes] = useState<string[]>([]);
  const current = useRef<string>('');
  const [live, setLive] = useState('');

  const point = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    return `${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
  };

  const finish = () => {
    if (!current.current) return;
    const next = [...strokes, current.current];
    current.current = '';
    setLive('');
    setStrokes(next);
    const d = next.join(' ');
    // Çok kısa çizim (yanlışlıkla dokunma) imza sayılmaz
    onChange(d.length >= 20 ? { w: Math.round(width), h: height, d } : null);
  };

  return (
    <View style={{ gap: 6 }}>
      <View
        style={[styles.pad, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Kaydırma imzayı bölmesin
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          current.current = `M ${point(e)}`;
          setLive(current.current);
        }}
        onResponderMove={(e) => {
          current.current += ` L ${point(e)}`;
          setLive(current.current);
        }}
        onResponderRelease={finish}
        onResponderTerminate={finish}
        accessibilityLabel="İmza alanı"
        accessibilityHint="Parmağınızla imzanızı atın">
        {width > 0 ? (
          <Svg width={width} height={height} pointerEvents="none">
            {[...strokes, live].filter(Boolean).map((d, i) => (
              <Path
                key={i}
                d={d}
                fill="none"
                stroke={Colors.text}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        ) : null}
        {strokes.length === 0 && !live ? (
          <Text style={styles.placeholder} pointerEvents="none">
            Buraya imzalayın
          </Text>
        ) : null}
        <View style={styles.baseline} pointerEvents="none" />
      </View>
      <Text
        style={styles.clear}
        accessibilityRole="button"
        onPress={() => {
          setStrokes([]);
          setLive('');
          current.current = '';
          onChange(null);
        }}>
        Temizle
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FAFBFA',
    overflow: 'hidden',
    // Web'de sürüklerken sayfa kaymasın / metin seçilmesin
    touchAction: 'none',
    userSelect: 'none',
  } as object,
  placeholder: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    fontSize: 14,
    color: Colors.textMuted,
  },
  baseline: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 36,
    height: 1,
    backgroundColor: Colors.border,
  },
  clear: { alignSelf: 'flex-end', fontSize: 13, fontWeight: '600', color: Colors.primary },
});
