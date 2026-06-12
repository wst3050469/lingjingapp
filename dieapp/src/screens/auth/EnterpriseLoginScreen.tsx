// 企业登录 (SSO)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSize as FS } from '../../constants';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'EnterpriseLogin'>;

export default function EnterpriseLoginScreen({ navigation }: Props) {
  return (
    <View style={s.c}>
      <View style={s.hd}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>企业账号登录</Text>
      </View>
      <View style={s.ct}><Ionicons name="business" size={48} color={Colors.dark.textTertiary} /><Text style={s.m}>请输入企业邮箱域名以跳转 SSO 登录</Text><Text style={s.h}>此功能需要企业管理员配置 SSO 集成</Text></View>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg }, hd: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, gap: 12 },
  t: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  ct: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  m: { color: Colors.dark.textSecondary, fontSize: FS.md, textAlign: 'center' }, h: { color: Colors.dark.textTertiary, fontSize: FS.sm, textAlign: 'center' },
});
