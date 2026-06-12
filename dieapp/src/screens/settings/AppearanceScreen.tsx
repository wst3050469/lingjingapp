// 外观设置 - 深色/浅色/跟随系统
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../stores/app-store';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

const MODES = [
  { key: 'system' as const, label: '跟随系统', icon: 'phone-portrait' },
  { key: 'dark' as const, label: '深色', icon: 'moon' },
  { key: 'light' as const, label: '浅色', icon: 'sunny' },
];

export default function AppearanceScreen({ navigation }: any) {
  const { themeMode, setThemeMode } = useAppStore();

  return (
    <View style={s.c}>
      <View style={s.hd}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>外观</Text>
      </View>
      <View style={s.sc}>
        {MODES.map(m => (
          <TouchableOpacity key={m.key} style={[s.row, themeMode === m.key && s.rowActive]} onPress={() => setThemeMode(m.key)}>
            <Ionicons name={m.icon as any} size={22} color={themeMode === m.key ? Colors.dark.primary : Colors.dark.textSecondary} style={{ marginRight: 12 }} />
            <Text style={[s.rowText, themeMode === m.key && { color: Colors.dark.primary }]}>{m.label}</Text>
            {themeMode === m.key && <Ionicons name="checkmark" size={20} color={Colors.dark.primary} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  hd: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  t: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  sc: { padding: 20, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 16 },
  rowActive: { borderColor: Colors.dark.primary, backgroundColor: Colors.dark.primaryBg },
  rowText: { flex: 1, color: Colors.dark.text, fontSize: FS.md },
});
