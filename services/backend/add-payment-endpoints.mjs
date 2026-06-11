import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
let c = fs.readFileSync(resolve(__dirname, 'server.js'), 'utf8');

// 1. Add import for payment-gateway
const importLine = "import { createPayment, queryPayment, handlePaymentNotify, confirmPayment } from './payment-gateway.js';";
const lastImport = c.lastIndexOf("import { createTelegramBot }");
if (lastImport === -1) process.exit(1);
const afterImport = c.indexOf('\n', lastImport);
c = c.slice(0, afterImport + 1) + '\n' + importLine + c.slice(afterImport + 1);

// 2. Add online payment endpoints after the offline payment endpoint
const marker = "  }\r\n});\r\n\r\n// ── Invoices ──";

const endpoints = `  }\r\n});\r\n\r\n// ── Online Payment Gateway ──\r\n` +
`// Create a payment order (supports test/alipay/wechat channels)\r\n` +
`app.post('/api/payments/create', auth, async (req, res) => {\r\n` +
`  try {\r\n` +
`    if (!req.userId) return res.status(401).json({ error: 'user_auth_required' });\r\n` +
`    const { channel, amount, subject, planId, billingCycle } = req.body;\r\n` +
`    if (!channel || !amount) return res.status(400).json({ error: 'channel_and_amount_required' });\r\n` +
`    if (['test', 'alipay', 'wechat'].indexOf(channel) === -1) {\r\n` +
`      return res.status(400).json({ error: 'unsupported_channel', supported: ['test', 'alipay', 'wechat'] });\r\n` +
`    }\r\n` +
`    const result = await createPayment(channel, {\r\n` +
`      amount,\r\n` +
`      subject: subject || '灵境订阅支付',\r\n` +
`      notifyUrl: 'https://ide.zhejiangjinmo.com/api/payments/notify/' + channel,\r\n` +
`    });\r\n` +
`    // Store payment record in DB\r\n` +
`    const paymentId = randomUUID();\r\n` +
`    const now = new Date().toISOString();\r\n` +
`    db.prepare('INSERT INTO payments (id, user_id, amount, currency, payment_method, payment_status, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')\r\n` +
`      .run(paymentId, req.userId, amount, 'CNY', channel, 'pending', result.orderId, now);\r\n` +
`    console.log('[Payment] Created:', req.username, channel, amount, result.orderId);\r\n` +
`    res.status(201).json({ ok: true, paymentId, ...result });\r\n` +
`  } catch (err) {\r\n` +
`    console.error('[Payment] create error:', err.message);\r\n` +
`    res.status(500).json({ error: 'payment_create_failed', detail: err.message });\r\n` +
`  }\r\n` +
`});\r\n` +
`\r\n` +
`// Payment notification callback (called by Alipay/WeChat or test mode)\r\n` +
`app.post('/api/payments/notify/:channel', async (req, res) => {\r\n` +
`  try {\r\n` +
`    const { channel } = req.params;\r\n` +
`    const result = await handlePaymentNotify(channel, req.body);\r\n` +
`    if (result.ok && result.status === 'success') {\r\n` +
`      // Find the payment record and update status\r\n` +
`      const payment = db.prepare('SELECT * FROM payments WHERE transaction_id = ?').get(result.orderId);\r\n` +
`      if (payment) {\r\n` +
`        db.prepare('UPDATE payments SET payment_status = ?, paid_at = ? WHERE id = ?')\r\n` +
`          .run('success', new Date().toISOString(), payment.id);\r\n` +
`        console.log('[Payment] Confirmed:', payment.id, result.orderId);\r\n` +
`      }\r\n` +
`    }\r\n` +
`    res.json({ ok: true });\r\n` +
`  } catch (err) {\r\n` +
`    console.error('[Payment] notify error:', err.message);\r\n` +
`    res.status(500).json({ error: 'notify_error' });\r\n` +
`  }\r\n` +
`});\r\n` +
`\r\n` +
`// Query payment status\r\n` +
`app.get('/api/payments/query/:orderId', auth, async (req, res) => {\r\n` +
`  try {\r\n` +
`    const result = await queryPayment(req.params.orderId);\r\n` +
`    res.json(result);\r\n` +
`  } catch (err) {\r\n` +
`    console.error('[Payment] query error:', err.message);\r\n` +
`    res.json({ ok: true, status: 'unknown' });\r\n` +
`  }\r\n` +
`});\r\n` +
`\r\n` +
`// Confirm payment (test mode - simulates user scanning QR code and paying)\r\n` +
`app.post('/api/payments/confirm/:orderId', auth, async (req, res) => {\r\n` +
`  try {\r\n` +
`    const result = await confirmPayment(req.params.orderId);\r\n` +
`    if (result.ok && result.status === 'success') {\r\n` +
`      // Update payment record in DB\r\n` +
`      db.prepare('UPDATE payments SET payment_status = ?, paid_at = ? WHERE transaction_id = ?')\r\n` +
`        .run('success', new Date().toISOString(), req.params.orderId);\r\n` +
`      console.log('[Payment] Manual confirm:', req.params.orderId);\r\n` +
`    }\r\n` +
`    res.json(result);\r\n` +
`  } catch (err) {\r\n` +
`    console.error('[Payment] confirm error:', err.message);\r\n` +
`    res.json({ ok: false, status: 'error', detail: err.message });\r\n` +
`  }\r\n` +
`});\r\n`;

c = c.replace(marker, endpoints);

fs.writeFileSync(resolve(__dirname, 'server.js'), c, 'utf8');
console.log('Payment endpoints added. Length:', c.length);
