// 欢迎页
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'> & { onLoginSuccess: () => void };

export default function WelcomeScreen({ navigation }: Props) {
  const [termsVisible, setTermsVisible] = useState(false);
  return (
    <View style={st.c}>
      <View style={st.top}>
        <View style={st.lc}><Text style={st.lt}>灵</Text></View>
        <Text style={st.t}>灵境 AI 编程助手</Text><Text style={st.sb}>深度思考，匠心创造</Text>
      </View>
      <View style={st.bt}>
        <Button title="开始使用" size="lg" fullWidth onPress={() => setTermsVisible(true)} />
        <Text style={st.ft}>登录即代表同意 <Text style={st.lk}>服务协议</Text> 和 <Text style={st.lk}>隐私政策</Text></Text>
      </View>
      <Modal visible={termsVisible} transparent animationType="slide">
        <View style={st.mo}>
          <View style={st.mc}>
            <Text style={st.mt}>条款与隐私</Text>
            <ScrollView style={st.ms}>
              <Text style={st.mx}>欢迎使用灵境 AI 编程助手。使用本应用前请仔细阅读服务条款与隐私政策。点击"同意并继续"即表示你已阅读并同意上述条款。</Text>
            </ScrollView>
            <Button title="同意并继续" fullWidth onPress={() => { setTermsVisible(false); navigation.navigate('Login'); }} />
            <TouchableOpacity onPress={() => setTermsVisible(false)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors.dark.textSecondary, fontSize: FS.sm }}>取消</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const st = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg, justifyContent: 'space-between', padding: 32 },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lc: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  lt: { color: '#fff', fontSize: 32, fontWeight: '800' }, t: { color: Colors.dark.text, fontSize: FS.xxl, fontWeight: '700', marginBottom: 8 },
  sb: { color: Colors.dark.textSecondary, fontSize: FS.md }, bt: { paddingBottom: 40, gap: 16 },
  ft: { color: Colors.dark.textTertiary, fontSize: FS.xs, textAlign: 'center' }, lk: { color: Colors.dark.primary },
  mo: { flex: 1, backgroundColor: Colors.dark.overlay, justifyContent: 'flex-end' },
  mc: { backgroundColor: Colors.dark.surface, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: 24, paddingBottom: 40, maxHeight: '70%' },
  mt: { color: Colors.dark.text, fontSize: FS.xl, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  ms: { marginBottom: 20 }, mx: { color: Colors.dark.textSecondary, fontSize: FS.sm, lineHeight: 22 },
});
