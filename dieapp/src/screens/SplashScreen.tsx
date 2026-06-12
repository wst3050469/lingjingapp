// 闪屏
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, FontSize as FS } from '../constants';

export default function SplashScreen({ loadingText }: { loadingText: string }) {
  return (
    <View style={s.ct}>
      <View style={s.la}>
        <View style={s.lc}><Text style={s.lt}>灵</Text></View>
        <Text style={s.an}>灵境 AI 编程助手</Text>
        <Text style={s.tl}>深度思考，匠心创造</Text>
      </View>
      <View style={s.bt}><ActivityIndicator size="small" color={Colors.dark.textTertiary} /><Text style={s.lt2}>{loadingText}</Text></View>
    </View>
  );
}
const s = StyleSheet.create({
  ct: { flex: 1, backgroundColor: Colors.dark.bg, justifyContent: 'center', alignItems: 'center' },
  la: { alignItems: 'center' }, lc: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  lt: { color: '#fff', fontSize: 36, fontWeight: '800' }, an: { color: Colors.dark.text, fontSize: FS.xxl, fontWeight: '700', marginBottom: 8 },
  tl: { color: Colors.dark.textSecondary, fontSize: FS.md }, bt: { position: 'absolute', bottom: 60, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lt2: { color: Colors.dark.textTertiary, fontSize: FS.sm },
});
