import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
let c = fs.readFileSync(resolve(__dirname, 'server.js'), 'utf8');

// Helper function to activate subscription after payment
const helperFunc = `
/**
 * Activate subscription after successful payment.
 * Finds the subscription linked to a payment and marks it active.
 */
function activateSubscriptionAfterPayment(paymentId, transactionId) {
  try {
    // Find the payment record
    const payment = db.prepare('SELECT * FROM payments WHERE id = ? OR transaction_id = ?').get(paymentId, transactionId);
    if (!payment) {
      console.log('[Payment] No payment record found for activation:', paymentId);
      return;
    }
    // Update payment status
    db.prepare('UPDATE payments SET payment_status = ?, paid_at = ? WHERE id = ?')
      .run('success', new Date().toISOString(), payment.id);
    
    // If payment is linked to a subscription, activate it
    if (payment.subscription_id) {
      const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(payment.subscription_id);
      if (sub && sub.status !== 'active') {
        const now = new Date().toISOString();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // 1 month from activation
        db.prepare('UPDATE subscriptions SET status = ?, started_at = ?, expires_at = ? WHERE id = ?')
          .run('active', now, endDate.toISOString(), payment.subscription_id);
        console.log('[Payment] Subscription activated:', payment.subscription_id);
      }
    }
  } catch (err) {
    console.error('[Payment] activation error:', err.message);
  }
}
`;

// Insert the helper function after requireSubscription definition
const helperMarker = "  };\r\n}\r\n\r\n// ====== Database ======";
if (c.indexOf(helperMarker) === -1) {
  console.log('ERROR: helper marker not found');
  process.exit(1);
}
c = c.replace(helperMarker, `  };\r\n}\r\n\r\n${helperFunc}\r\n// ====== Database ======`);

// Update the notify handler to call activateSubscriptionAfterPayment
const oldNotify = `    if (result.ok && result.status === 'success') {\r\n` +
`      // Find the payment record and update status\r\n` +
`      const payment = db.prepare('SELECT * FROM payments WHERE transaction_id = ?').get(result.orderId);\r\n` +
`      if (payment) {\r\n` +
`        db.prepare('UPDATE payments SET payment_status = ?, paid_at = ? WHERE id = ?')\r\n` +
`          .run('success', new Date().toISOString(), payment.id);\r\n` +
`        console.log('[Payment] Confirmed:', payment.id, result.orderId);\r\n` +
`      }\r\n` +
`    }`;

const newNotify = `    if (result.ok && result.status === 'success') {\r\n` +
`      activateSubscriptionAfterPayment('', result.orderId);\r\n` +
`    }`;

if (c.indexOf(oldNotify) === -1) {
  console.log('ERROR: old notify not found');
  process.exit(1);
}
c = c.replace(oldNotify, newNotify);

// Update the confirm handler to call activateSubscriptionAfterPayment
const oldConfirm = `    if (result.ok && result.status === 'success') {\r\n` +
`      // Update payment record in DB\r\n` +
`      db.prepare('UPDATE payments SET payment_status = ?, paid_at = ? WHERE transaction_id = ?')\r\n` +
`        .run('success', new Date().toISOString(), req.params.orderId);\r\n` +
`      console.log('[Payment] Manual confirm:', req.params.orderId);\r\n` +
`    }`;

const newConfirm = `    if (result.ok && result.status === 'success') {\r\n` +
`      activateSubscriptionAfterPayment('', req.params.orderId);\r\n` +
`    }`;

if (c.indexOf(oldConfirm) === -1) {
  console.log('ERROR: old confirm not found');
  process.exit(1);
}
c = c.replace(oldConfirm, newConfirm);

fs.writeFileSync(resolve(__dirname, 'server.js'), c, 'utf8');
console.log('Auto-activation logic added. Length:', c.length);
