// 灵境AI 移动端 - 订阅管理页
// 显示当前订阅信息、用量配额、套餐列表、购买入口
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore, SubscriptionInfo, SubscriptionPlan } from '../stores/app-store';

const PLAN_COLORS: Record<string, string> = {
  free: '#484f58',
  personal: '#58a6ff',
  pro: '#d29922',
  enterprise: '#f85149',
};

const PLAN_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  free: 'pricetag-outline',
  personal: 'person-outline',
  pro: 'star-outline',
  enterprise: 'business-outline',
};

const USAGE_LABELS: Record<string, string> = {
  apiCalls: 'API 调用',
  sessions: '会话数',
  memories: '记忆体',
  storageFiles: '存储文件',
  apiKeys: 'API 密钥',
};

export default function SubscriptionScreen() {
  const { subscription, setSubscription, subscriptionPlans, setSubscriptionPlans } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [subData, plansData, paymentsData] = await Promise.all([
        api.getSubscription().catch(() => null),
        api.getPlans2().catch(() => null),
        api.getPayments().catch(() => []),
      ]);
      if (subData?.subscription) setSubscription(subData.subscription);
      if (plansData?.plans) setSubscriptionPlans(plansData.plans);
      if (Array.isArray(paymentsData)) setPayments(paymentsData);
      else if (paymentsData?.payments) setPayments(paymentsData.payments);
    } catch (e) {
      console.log('[Subscription] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handlePlanAction(plan: SubscriptionPlan) {
    const isCurrent = subscription?.plan_id === plan.id;
    if (plan.price === 0 && !isCurrent) {
      Alert.alert('提示', '免费版无需购买，直接使用即可');
      return;
    }
    if (isCurrent) {
      Alert.alert('提示', '您当前已订阅该套餐');
      return;
    }

    // Determine action type: upgrade, downgrade, or new subscribe
    const hasSubscription = subscription && subscription.status === 'active';
    const actionLabel = hasSubscription
      ? (subscription?.plan_id === 'free' || !subscription?.plan_id ? '订阅' : '切换')
      : '购买';

    Alert.alert(
      `确认${actionLabel}`,
      `${actionLabel} ${plan.name}（¥${plan.price}/月）？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            setPurchasing(plan.id);
            try {
              let result: any;

              if (hasSubscription) {
                // Existing subscription — try upgrade/downgrade first
                try {
                  result = await api.upgrade(plan.id);
                } catch {
                  // If upgrade fails (e.g. price lower), try downgrade
                  result = await api.downgrade(plan.id);
                }
                Alert.alert('成功', `已${actionLabel}到 ${plan.name}！`);
                loadData();
              } else {
                // New subscription — create payment
                result = await api.createPayment('test', plan.price, plan.id);
                if (result.ok) {
                  Alert.alert(
                    '订单已创建',
                    `订单号: ${result.orderId}\n\n点击确认完成模拟支付。`,
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '确认支付',
                        onPress: async () => {
                          try {
                            const confirmResult = await api.confirmPayment(result.orderId);
                            if (confirmResult.ok) {
                              Alert.alert('支付成功', '您的订阅已激活！');
                              loadData();
                            }
                          } catch (e: any) {
                            Alert.alert('支付失败', e?.message || '请重试');
                          }
                        },
                      },
                    ],
                  );
                }
              }
            } catch (e: any) {
              Alert.alert('操作失败', e?.message || '请稍后重试');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ],
    );
  }

  function getUsagePercent(used: number, limit: number): number {
    if (limit <= 0) return 0;
    return Math.min(used / limit, 1);
  }

  function formatLimit(value: number): string {
    if (value >= 99999) return '无限';
    if (value >= 1024) return `${(value / 1024).toFixed(1)}GB`;
    return String(value);
  }

  // Subscription info header
  function renderSubscriptionHeader() {
    if (!subscription) return null;
    const { usage } = subscription;
    const limits = usage?.limits || {};
    const usageItems = Object.entries(USAGE_LABELS).filter(([key]) => key in limits);

    return (
      <View style={styles.subHeader}>
        <View style={styles.planBadge}>
          <Ionicons
            name={PLAN_ICONS[subscription.plan_id] || 'pricetag-outline'}
            size={20}
            color={PLAN_COLORS[subscription.plan_id] || '#58a6ff'}
          />
          <Text style={[styles.planBadgeText, { color: PLAN_COLORS[subscription.plan_id] || '#58a6ff' }]}>
            {subscription.plan_name || subscription.plan_id}
          </Text>
          <View style={[styles.statusDot, {
            backgroundColor: subscription.status === 'active' ? '#3fb950' : '#d29922'
          }]} />
          <Text style={styles.statusText}>
            {subscription.status === 'active' ? '使用中' : subscription.status}
          </Text>
        </View>

        {subscription.expires_at && (
          <Text style={styles.expiryText}>
            到期: {new Date(subscription.expires_at).toLocaleDateString('zh-CN')}
          </Text>
        )}

        {usage && (
          <View style={styles.usageSection}>
            <Text style={styles.sectionTitle}>用量配额</Text>
            {usageItems.map(([key, label]) => {
              const used = (usage as any)[key] || 0;
              const limit = limits[key] || 1;
              const pct = getUsagePercent(used, limit);
              return (
                <View key={key} style={styles.usageRow}>
                  <Text style={styles.usageLabel}>{label}</Text>
                  <Text style={styles.usageValue}>{used} / {formatLimit(limit)}</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, {
                      width: `${Math.min(pct * 100, 100)}%`,
                      backgroundColor: pct > 0.9 ? '#f85149' : pct > 0.7 ? '#d29922' : '#1f6feb',
                    }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  // Payment history footer
  function renderPaymentHistory() {
    if (!payments.length) return null;
    return (
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>支付记录</Text>
        {payments.slice(0, 5).map((p: any, i: number) => (
          <View key={i} style={styles.paymentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentPlan}>{p.plan_id || p.planName}</Text>
              <Text style={styles.paymentDate}>
                {p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : ''}
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: p.status === 'completed' ? '#3fb950' : '#d29922' }]}>
              ¥{p.amount}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // Plan card
  function renderPlanCard({ item }: { item: SubscriptionPlan }) {
    const isCurrent = subscription?.plan_id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.planCard,
          item.recommended === 1 && styles.recommendedCard,
          isCurrent && styles.currentCard,
        ]}
        onPress={() => handlePlanAction(item)}
        disabled={purchasing === item.id}
      >
        {item.recommended === 1 && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>推荐</Text>
          </View>
        )}
        {isCurrent && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>当前套餐</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <Ionicons
            name={PLAN_ICONS[item.id] || 'apps'}
            size={24}
            color={PLAN_COLORS[item.id] || '#58a6ff'}
          />
          <Text style={styles.planName}>{item.name}</Text>
        </View>

        <Text style={styles.planPrice}>
          {item.price === 0 ? '免费' : `¥${item.price}`}
          {item.price > 0 && <Text style={styles.planCycle}>/月</Text>}
        </Text>

        {(item.features || []).map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons
              name={f.included ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={f.included ? '#3fb950' : '#484f58'}
            />
            <Text style={[styles.featureText, !f.included && styles.featureDisabled]}>
              {f.desc || f.name}
            </Text>
          </View>
        ))}

        {purchasing === item.id && (
          <ActivityIndicator size="small" color="#58a6ff" style={{ marginTop: 8 }} />
        )}

        {!isCurrent && (
          <TouchableOpacity
            style={styles.buyBtn}
            onPress={() => handlePlanAction(item)}
          >
            <Text style={styles.buyBtnText}>
              {item.price === 0 ? '免费使用' : `切换到 ${item.name}`}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#58a6ff" />
          <Text style={styles.loadingText}>加载订阅信息...</Text>
        </View>
      ) : (
        <FlatList
          data={subscriptionPlans}
          keyExtractor={item => item.id}
          renderItem={renderPlanCard}
          ListHeaderComponent={renderSubscriptionHeader}
          ListFooterComponent={renderPaymentHistory}
          ListEmptyComponent={
            <Text style={styles.emptyText}>暂无可用套餐</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(); }}
              tintColor="#58a6ff"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b949e', marginTop: 8, fontSize: 14 },
  listContent: { padding: 12, paddingBottom: 40 },

  // Subscription header
  subHeader: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planBadgeText: {
    fontSize: 17,
    fontWeight: '700',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    color: '#8b949e',
    fontSize: 13,
  },
  expiryText: {
    color: '#484f58',
    fontSize: 12,
    marginTop: 6,
  },
  usageSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    paddingTop: 10,
  },
  sectionTitle: {
    color: '#58a6ff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  usageRow: {
    marginBottom: 8,
  },
  usageLabel: {
    color: '#8b949e',
    fontSize: 12,
  },
  usageValue: {
    color: '#c9d1d9',
    fontSize: 12,
    textAlign: 'right',
    marginTop: -16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#21262d',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Plan cards
  planCard: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#21262d',
    position: 'relative',
    overflow: 'hidden',
  },
  recommendedCard: {
    borderColor: '#d29922',
    borderWidth: 1.5,
  },
  currentCard: {
    borderColor: '#1f6feb',
    borderWidth: 1.5,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#d29922',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
  },
  recommendedText: {
    color: '#0d1117',
    fontSize: 11,
    fontWeight: '700',
  },
  currentBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#1f6feb',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomRightRadius: 8,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  planName: {
    color: '#c9d1d9',
    fontSize: 16,
    fontWeight: '600',
  },
  planPrice: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  planCycle: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '400',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  featureText: {
    color: '#c9d1d9',
    fontSize: 13,
  },
  featureDisabled: {
    color: '#484f58',
    textDecorationLine: 'line-through',
  },
  buyBtn: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#484f58',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },

  // Payment history
  historySection: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  paymentPlan: {
    color: '#c9d1d9',
    fontSize: 14,
    fontWeight: '500',
  },
  paymentDate: {
    color: '#484f58',
    fontSize: 11,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
});
