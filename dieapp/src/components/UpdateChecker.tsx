import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking } from 'react-native';
import { api } from '../services/api';
import { Colors, FontSize as FS, BorderRadius as BR, APP_VERSION } from '../constants';

export default function UpdateChecker() {
  const [visible, setVisible] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    check();
  }, []);

  async function check() {
    const res = await api.checkUpdate(APP_VERSION);
    if (res.ok && res.data?.hasUpdate) {
      setNewVersion(res.data.version || '');
      setDownloadUrl(res.data.files?.android || '');
      setVisible(true);
    }
  }

  function handleUpdate() {
    if (downloadUrl) Linking.openURL(downloadUrl);
    setVisible(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.icon}>📦</Text>
          <Text style={styles.title}>发现新版本 {newVersion}</Text>
          <Text style={styles.subtitle}>建议立即更新以获得最佳体验</Text>
          <TouchableOpacity style={styles.btn} onPress={handleUpdate}>
            <Text style={styles.btnText}>前往更新</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setVisible(false)} style={{ marginTop: 12 }}>
            <Text style={styles.later}>稍后再说</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.dark.overlay, justifyContent: 'center', alignItems: 'center', padding: 40 },
  dialog: { backgroundColor: Colors.dark.surface, borderRadius: BR.xl, padding: 28, alignItems: 'center', width: '100%', maxWidth: 320 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  subtitle: { color: Colors.dark.textSecondary, fontSize: FS.sm, textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: Colors.dark.primary, borderRadius: BR.md, paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: FS.md, fontWeight: '600' },
  later: { color: Colors.dark.textSecondary, fontSize: FS.sm },
});
