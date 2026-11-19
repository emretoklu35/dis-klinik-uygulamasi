/**
 * QR kodu düz React Native görünümleriyle çizer (ek yerel modül gerekmez; telefon, tablet ve
 * web'de aynı çalışır). Matris "qrcode" paketiyle üretilir.
 */

import QRCode from 'qrcode';
import { useMemo } from 'react';
import { View } from 'react-native';

export function QrCode({ value, size }: { value: string; size: number }) {
  const matrix = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const rows: boolean[][] = [];
    for (let y = 0; y < n; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < n; x++) row.push(!!qr.modules.get(y, x));
      rows.push(row);
    }
    return rows;
  }, [value]);

  // Etrafında 2 modül boşluk (okuyucular için sessiz alan)
  const quiet = 2;
  const cells = matrix.length + quiet * 2;
  const cell = Math.floor(size / cells);
  const total = cell * cells;

  return (
    <View
      style={{ width: total, height: total, padding: cell * quiet, backgroundColor: '#FFFFFF' }}
      accessible
      accessibilityLabel="Mesai QR kodu">
      {matrix.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((on, x) => (
            <View
              key={x}
              style={{ width: cell, height: cell, backgroundColor: on ? '#0B1220' : '#FFFFFF' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
