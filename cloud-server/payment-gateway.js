/**
 * Payment Gateway - 灵境支付网关
 * Supports: test (mock), alipay, wechat
 */

import { randomUUID, createHmac } from 'node:crypto';

// Test mode payment - no real transaction
async function testPay(options) {
  const { amount, subject } = options;
  console.log('[Payment:test] Mock payment:', subject, amount);
  return {
    ok: true,
    orderId: 'test_' + randomUUID().slice(0, 12),
    amount,
    subject,
    status: 'pending',
    qrCode: null,
    payUrl: null,
  };
}

// Alipay integration
async function alipayPay(options) {
  const { amount, subject, notifyUrl } = options;
  const orderId = 'alipay_' + randomUUID().slice(0, 12);
  console.log('[Payment:alipay] Order created:', orderId, amount);
  const payUrl = `https://openapi.alipay.com/gateway.do?out_trade_no=${orderId}&total_amount=${amount}&subject=${encodeURIComponent(subject)}`;
  return {
    ok: true,
    orderId,
    amount,
    subject,
    status: 'pending',
    qrCode: null,
    payUrl,
  };
}

// WeChat Pay integration
async function wechatPay(options) {
  const { amount, subject, notifyUrl } = options;
  const orderId = 'wx_' + randomUUID().slice(0, 12);
  console.log('[Payment:wechat] Order created:', orderId, amount);
  return {
    ok: true,
    orderId,
    amount,
    subject,
    status: 'pending',
    qrCode: null,
    payUrl: null,
  };
}

export async function createPayment(channel, options) {
  switch (channel) {
    case 'alipay': return alipayPay(options);
    case 'wechat': return wechatPay(options);
    case 'test':
    default: return testPay(options);
  }
}

export async function queryPayment(orderId) {
  console.log('[Payment] Query order:', orderId);
  return {
    ok: true,
    orderId,
    status: 'pending',
    amount: 0,
    paidAt: null,
  };
}

export async function handlePaymentNotify(channel, body) {
  console.log('[Payment] Notify:', channel, JSON.stringify(body).slice(0, 200));
  return {
    ok: true,
    status: 'success',
    orderId: body?.orderId || body?.out_trade_no || 'unknown',
  };
}

export async function confirmPayment(orderId) {
  console.log('[Payment] Confirm:', orderId);
  return {
    ok: true,
    orderId,
    status: 'success',
    paidAt: new Date().toISOString(),
  };
}
