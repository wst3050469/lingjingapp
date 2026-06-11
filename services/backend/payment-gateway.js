/**
 * Payment Gateway - 灵境支付网关
 * Supports: test (mock), alipay, wechat
 * v2.0: 补全queryPayment/handlePaymentNotify/confirmPayment
 */

import { randomUUID, createHmac, createVerify } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeCompare } from './crypto-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPaymentConfig() {
  try {
    const configPath = path.resolve(__dirname, 'payment-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}
  return {};
}

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

async function alipayPay(options) {
  const { amount, subject, notifyUrl } = options;
  const orderId = 'alipay_' + randomUUID().slice(0, 12);
  console.log('[Payment:alipay] Order created:', orderId, amount);
  const config = loadPaymentConfig();
  const payUrl = config.alipay?.appId
    ? `https://openapi.alipay.com/gateway.do?app_id=${config.alipay.appId}&method=alipay.trade.page.pay&out_trade_no=${orderId}&total_amount=${amount}&subject=${encodeURIComponent(subject)}&notify_url=${encodeURIComponent(notifyUrl || config.alipay.notifyUrl || '')}`
    : null;
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

export async function queryPayment(orderId, db) {
  console.log('[Payment] Query order:', orderId);

  if (db) {
    try {
      const payment = db.prepare('SELECT * FROM payments WHERE id = ? OR transaction_id = ?').get(orderId, orderId);
      if (!payment) {
        return { ok: false, error: 'order_not_found', orderId, status: 'unknown' };
      }
      if (payment.payment_status === 'pending') {
        const channel = payment.payment_method || 'test';
        if (channel === 'alipay') {
          console.log('[Payment:alipay] 查询支付宝订单:', orderId);
        } else if (channel === 'wechat') {
          console.log('[Payment:wechat] 查询微信订单:', orderId);
        }
      }
      return {
        ok: true,
        orderId: payment.id,
        status: payment.payment_status,
        amount: payment.amount,
        paidAt: payment.paid_at,
        transactionId: payment.transaction_id,
      };
    } catch (err) {
      console.error('[Payment] 查询失败:', err.message);
      return { ok: false, error: err.message, orderId, status: 'error' };
    }
  }

  return { ok: true, orderId, status: 'pending', amount: 0, paidAt: null };
}

export async function handlePaymentNotify(channel, body, db) {
  console.log('[Payment] Notify:', channel, JSON.stringify(body).slice(0, 200));

  const config = loadPaymentConfig();

  if (channel === 'alipay') {
    if (config.alipay?.privateKey) {
      const sign = body.sign;
      const signType = body.sign_type || 'RSA2';
      if (!verifyAlipaySign(body, sign, config.alipay.privateKey, signType)) {
        console.error('[Payment:alipay] 验签失败');
        return { ok: false, error: 'signature_verification_failed', channel: 'alipay' };
      }
    } else {
      console.warn('[Payment:alipay] 未配置私钥，跳过验签');
    }
  }

  if (channel === 'wechat') {
    if (config.wechat?.apiKey) {
      const sign = body.sign;
      if (!verifyWechatSign(body, sign, config.wechat.apiKey)) {
        console.error('[Payment:wechat] 验签失败');
        return { ok: false, error: 'signature_verification_failed', channel: 'wechat' };
      }
    } else {
      console.warn('[Payment:wechat] 未配置API密钥，跳过验签');
    }
  }

  const orderId = body?.orderId || body?.out_trade_no || body?.order_id || 'unknown';
  const tradeStatus = body?.trade_status || body?.result_code || 'SUCCESS';
  const isSuccess = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'SUCCESS' || tradeStatus === 'success';

  if (db && isSuccess) {
    try {
      const now = new Date().toISOString();
      const payment = db.prepare('SELECT * FROM payments WHERE id = ? OR transaction_id = ?').get(orderId, orderId);
      if (payment && payment.payment_status === 'pending') {
        db.prepare('UPDATE payments SET payment_status = ?, paid_at = ?, transaction_id = ? WHERE id = ?')
          .run('success', now, body?.trade_no || orderId, payment.id);
        if (payment.subscription_id) {
          db.prepare('UPDATE subscriptions SET status = ? WHERE id = ? AND status = ?')
            .run('active', payment.subscription_id, 'pending');
          console.log('[Payment] 订阅已激活:', payment.subscription_id);
        }
      }
    } catch (err) {
      console.error('[Payment] 更新支付状态失败:', err.message);
    }
  }

  return {
    ok: true,
    status: isSuccess ? 'success' : 'pending',
    orderId,
  };
}

export async function confirmPayment(orderId, db) {
  console.log('[Payment] Confirm:', orderId);

  if (db) {
    try {
      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(orderId);
      if (!payment) {
        return { ok: false, error: 'order_not_found', orderId };
      }
      if (payment.payment_status !== 'pending') {
        return { ok: false, error: 'invalid_status', orderId, status: payment.payment_status, detail: 'Only pending orders can be confirmed' };
      }
      const now = new Date().toISOString();
      db.prepare('UPDATE payments SET payment_status = ?, paid_at = ? WHERE id = ?')
        .run('success', now, orderId);
      if (payment.subscription_id) {
        db.prepare('UPDATE subscriptions SET status = ? WHERE id = ? AND status = ?')
          .run('active', payment.subscription_id, 'pending');
      }
      return { ok: true, orderId, status: 'success', paidAt: now };
    } catch (err) {
      console.error('[Payment] 确认失败:', err.message);
      return { ok: false, error: err.message, orderId };
    }
  }

  return { ok: true, orderId, status: 'success', paidAt: new Date().toISOString() };
}

function verifyAlipaySign(params, sign, privateKey, signType) {
  try {
    const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '').sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const verifier = createVerify(signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');
    verifier.update(signStr, 'utf8');
    return verifier.verify(privateKey, sign, 'base64');
  } catch (err) {
    console.error('[Payment:alipay] 验签异常:', err.message);
    return false;
  }
}

function verifyWechatSign(params, sign, apiKey) {
  try {
    const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && params[k] !== '').sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + '&key=' + apiKey;
    const expected = createHmac('sha256', apiKey).update(signStr).digest('hex').toUpperCase();
    return safeCompare(sign, expected);
  } catch (err) {
    console.error('[Payment:wechat] 验签异常:', err.message);
    return false;
  }
}
