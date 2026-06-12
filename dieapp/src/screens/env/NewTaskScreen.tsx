// 新任务页（首页）- 对齐 qoder.apk NewTask 设计
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui';
import { useAppStore } from '../../stores/app-store';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

const QUICK_PROMPTS = [
  { icon: '📱', title: '搭建新应用', desc: '帮我搭建一个简洁的待办事项应用', prompt: '帮我搭建一个简洁的待办事项应用，包含任务新增、完成、删除和列表展示功能。' },
  { icon: '🐛', title: '修复缺陷', desc: '排查项目的报错、异常逻辑或性能问题', prompt: '排查一下这个项目是否存在明显的报错、异常逻辑或性能问题。如果发现问题，请用尽量小的改动帮我修复。' },
  { icon: '🎨', title: '从截图做界面', desc: '根据上传的截图实现还原的界面', prompt: '请根据我上传的截图，实现一个尽量还原的界面。' },
  { icon: '📖', title: '快速看懂项目', desc: '了解项目结构和主要功能', prompt: '请帮我快速了解这个项目的结构和主要功能，并告诉我如果要继续开发，应该从哪些文件或模块开始看。' },
];

export default function NewTaskScreen() {
  const { user } = useAppStore();
  const name = user?.displayName || user?.username || '用户';

  return (
    <View style={s.c}>
      <ScrollView contentContainerStyle={s.sc} showsVerticalScrollIndicator={false}>
        {/* 问候语 */}
        <Text style={s.greet}>你好，{name}</Text>
        <Text style={s.sub}>我可以帮你做点啥?</Text>

        {/* 积分横幅 */}
        <View style={s.banner}>
          <Text style={s.banTitle}>🎁 300 积分已到账</Text>
          <Text style={s.banSub}>快开始一个任务体验一下吧！</Text>
        </View>

        {/* 快捷提示词 */}
        <Text style={s.secTitle}>快速开始</Text>
        <View style={s.grid}>
          {QUICK_PROMPTS.map((p, i) => (
            <TouchableOpacity key={i} style={s.card} activeOpacity={0.7}>
              <Text style={s.cardIcon}>{p.icon}</Text>
              <Text style={s.cardTitle}>{p.title}</Text>
              <Text style={s.cardDesc}>{p.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 环境选择 */}
        <Text style={s.secTitle}>选择环境</Text>
        <View style={s.envRow}>
          <TouchableOpacity style={s.envCard} activeOpacity={0.7}>
            <Ionicons name="cloud" size={28} color={Colors.dark.primary} />
            <Text style={s.envLabel}>云端</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.envCard} activeOpacity={0.7}>
            <Ionicons name="desktop" size={28} color={Colors.dark.purple} />
            <Text style={s.envLabel}>桌面端</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.envCard} activeOpacity={0.7}>
            <Ionicons name="terminal" size={28} color={Colors.dark.success} />
            <Text style={s.envLabel}>CLI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  sc: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  greet: { color: Colors.dark.text, fontSize: FS.xxxl, fontWeight: '700', marginBottom: 4 },
  sub: { color: Colors.dark.textSecondary, fontSize: FS.lg, marginBottom: 24 },
  banner: { backgroundColor: Colors.dark.primaryBg, borderRadius: BR.lg, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(88,166,255,0.2)' },
  banTitle: { color: Colors.dark.primary, fontSize: FS.md, fontWeight: '600', marginBottom: 4 },
  banSub: { color: Colors.dark.textSecondary, fontSize: FS.sm },
  secTitle: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 16, width: '47%' as any, minHeight: 130 },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { color: Colors.dark.text, fontSize: FS.sm, fontWeight: '600', marginBottom: 4 },
  cardDesc: { color: Colors.dark.textTertiary, fontSize: FS.xs, lineHeight: 16 },
  envRow: { flexDirection: 'row', gap: 12 },
  envCard: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 20, alignItems: 'center', gap: 8 },
  envLabel: { color: Colors.dark.textSecondary, fontSize: FS.sm, fontWeight: '500' },
});
