// Camera screen that scans an employee QR code and routes to the
// survey form. The printed QR encodes a full https URL pointing at the
// web /scan/{token} page, so a diner without the app can still use it
// via their phone's native camera. When they DO have our app and scan
// from inside, we extract the trailing token segment and go straight
// to the in-app survey form — same backend, native UI.
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { C } from '../../constants/colors';

// Pulls the token segment out of any of the shapes our QR could carry:
//   - full URL:    https://savorymind.net/scan/abc-123
//   - relative:    /scan/abc-123
//   - raw token:   abc-123  (used by older codes, kept tolerant)
function extractToken(data) {
  if (!data) return null;
  const trimmed = String(data).trim();
  const match = trimmed.match(/\/scan\/([A-Za-z0-9_\-]+)/);
  if (match) return match[1];
  // Bare UUID-shaped string — if the QR carries just the token. UUID4
  // shape avoids accepting arbitrary scanned text as a token.
  if (/^[A-Za-z0-9_\-]{8,64}$/.test(trimmed)) return trimmed;
  return null;
}


export default function ScanQR() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState(null);
  // Single-shot guard — once we've handed off to the survey screen we
  // don't want another rapid-fire scan to fire onBarcodeScanned again.
  const handled = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcode = ({ data }) => {
    if (handled.current) return;
    const token = extractToken(data);
    if (!token) {
      setScanError(t('scan.invalidQr'));
      return;
    }
    handled.current = true;
    router.replace(`/scan/${token}`);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.header}>{t('scan.cameraTitle')}</Text>
        <Text style={styles.body}>{t('scan.permissionDenied')}</Text>
        {permission.canAskAgain ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>{t('scan.allowCamera')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryBtnText}>{t('scan.openSettings')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.secondary}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.reticle} />
        <Text style={styles.overlayHelp}>{t('scan.cameraTitle')}</Text>
      </View>
      {scanError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{scanError}</Text>
          <TouchableOpacity onPress={() => setScanError(null)}>
            <Text style={styles.errorDismiss}>OK</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  header: { fontSize: 18, fontWeight: '700', color: C.gray[900], marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, color: C.gray[600], textAlign: 'center', marginBottom: 20 },
  primaryBtn: { backgroundColor: C.consumer.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { color: C.gray[500], fontSize: 14, textDecorationLine: 'underline' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 260, height: 260, borderWidth: 3, borderColor: '#fff', borderRadius: 24, opacity: 0.85 },
  overlayHelp: { color: '#fff', marginTop: 18, fontSize: 16, fontWeight: '600' },
  closeBtn: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  errorBanner: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#fff', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: C.gray[800], flex: 1, fontSize: 14 },
  errorDismiss: { color: C.consumer.primary, fontWeight: '700', marginLeft: 12 },
});
