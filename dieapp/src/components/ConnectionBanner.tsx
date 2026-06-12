import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppStore } from '../stores/app-store';
import { Colors, FontSize as FS } from '../constants';

export default function ConnectionBanner() {
  const { connected, connectionType } = useAppStore();
  if (connected) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠️ 未连接到灵境服务</Text>
      <TouchableOpacity onPress={() => {}}>
        <Text style={styles.retry}>重试</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dark.warningBg, paddingVertical: 8, paddingHorizontal: 16,
  },
  text: { color: Colors.dark.warning, fontSize: FS.sm, flex: 1 },
  retry: { color: Colors.dark.primary, fontSize: FS.sm, fontWeight: '600' },
});
