// utils/notify.js — fire-and-forget new-order alert to the ops team.
// Set NOTIFY_WEBHOOK_URL to a Slack/Discord/Teams incoming webhook (or any
// endpoint that accepts a JSON POST). Never blocks the order response.
const axios = require('axios');

async function notifyNewOrder(order, items, user) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return;
  try {
    const itemLines = (items || [])
      .map((i) => `• ${i.name_snapshot || i.name} ×${i.quantity} — ₹${i.line_total ?? i.price_snapshot ?? ''}`)
      .join('\n');
    const addr = order.address || {};
    const text =
      `🛒 *New GrowFresh order* ${order.id}\n` +
      `${itemLines}\n` +
      `Total: ₹${order.total} (${order.payment_method} · ${order.payment_status})\n` +
      `Customer: ${user?.name || 'User'} · ${user?.mobile || ''}\n` +
      `Deliver to: ${addr.line1 || ''} ${addr.city || ''} ${addr.pincode || ''}`;

    await axios.post(url, { text, order, items, user: { name: user?.name, mobile: user?.mobile } }, { timeout: 5000 });
  } catch (e) {
    console.warn('[notify] webhook failed:', e.message);
  }
}

module.exports = { notifyNewOrder };
