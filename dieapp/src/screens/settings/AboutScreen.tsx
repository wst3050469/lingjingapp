// 关于灵境
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Colors, FontSize as FS, BorderRadius as BR, APP_VERSION } from '../../constants';

export default function AboutScreen({ navigation }: any) {
  async function handleCheckUpdate() {
    const res = await api.checkUpdate(APP_VERSION);
    if (res.ok && res.data?.hasUpdate) Alert.alert('发现新版本', `版本 ${res.data.version} 可用`);
    else Alert.alert('已是最新版本', `当前版本 ${APP_VERSION}`);
  }
  const links = [
    { label: '服务条款', url: '' }, { label: '隐私政策', url: '' },
    { label: '个人版订阅协议', url: '' }, { label: '应用权限说明', url: '' },
    { label: '个人信息收集清单', url: '' }, { label: '第三方SDK说明', url: '' },
  ];

  return (
    <View style={s.c}>
      <View style={s.hd}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>关于灵境</Text>
      </View>
      <ScrollView contentContainerStyle={s.sc}>
        <View style={s.logo}>
          <View style={s.lc}><Text style={s.lt}>灵</Text></View>
          <Text style={s.ln}>灵境 AI 编程助手</Text>
          <Text style={s.lv}>版本 {APP_VERSION}</Text>
        </View>
        <TouchableOpacity style={s.btn} onPress={handleCheckUpdate}>
          <Ionicons name="refresh" size={20} color={Colors.dark.primary} /><Text style={s.btnT}>检查更新</Text>
        </TouchableOpacity>
        <View style={s.links}>
          {links.map((l, i) => (
            <TouchableOpacity key={i} style={s.link}>
              <Text style={s.linkT}>{l.label}</Text><Ionicons name="chevron-forward" size={16} color={Colors.dark.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.copy}>© 2026 灵境 AI. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  hd: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  t: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  sc: { padding: 20, alignItems: 'center' },
  logo: { alignItems: 'center', marginVertical: 32 },
  lc: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  lt: { color: '#fff', fontSize: 28, fontWeight: '800' }, ln: { color: Colors.dark.text, fontSize: FS.xl, fontWeight: '700', marginBottom: 4 },
  lv: { color: Colors.dark.textSecondary, fontSize: FS.sm },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 14, paddingHorizontal: 24, marginBottom: 32 },
  btnT: { color: Colors.dark.primary, fontSize: FS.md, fontWeight: '500' },
  links: { width: '100%', backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, overflow: 'hidden', marginBottom: 24 },
  link: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  linkT: { color: Colors.dark.text, fontSize: FS.md },
  copy: { color: Colors.dark.textTertiary, fontSize: FS.xs },
});
