// admin.js — ops-team endpoints (order queue, status updates, stats).
// All routes require the ADMIN_TOKEN via x-admin-token / Bearer header.
const express = require('express');
const admin = require('../middleware/admin');
const db = require('../config/db');
const router = express.Router();

router.use(admin);

// GET /api/admin/orders?status=&limit=
// Full order queue newest-first with items + customer contact.
router.get('/orders', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    let q = db('orders')
      .leftJoin('users', 'orders.user_id', 'users.id')
      .select('orders.*', 'users.mobile as customer_mobile', 'users.name as customer_name')
      .orderBy('orders.placed_at', 'desc')
      .limit(limit);
    if (req.query.status) q = q.where('orders.status', req.query.status);
    const orders = await q;

    const ids = orders.map((o) => o.id);
    const items = ids.length ? await db('order_items').whereIn('order_id', ids) : [];
    const grouped = {};
    items.forEach((it) => { (grouped[it.order_id] ||= []).push(it); });

    res.json(orders.map((o) => ({ ...o, items: grouped[o.id] || [] })));
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// GET /api/admin/stats — headline numbers for the ops dashboard
router.get('/stats', async (_req, res) => {
  try {
    const byStatus = await db('orders').select('status').count('id as count').groupBy('status');
    const today = await db('orders')
      .where('placed_at', '>=', db.raw("date_trunc('day', now())"))
      .count('id as count')
      .sum('total as revenue')
      .first();
    const pending = await db('orders').whereIn('status', ['Confirmed', 'Packed']).count('id as count').first();
    res.json({
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
      todayCount: Number(today.count) || 0,
      todayRevenue: Number(today.revenue) || 0,
      openOrders: Number(pending.count) || 0,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// PUT /api/admin/orders/:id/status { status }
// Status machine for the fulfillment team.
const FLOW = {
  Confirmed:          ['Packed', 'Cancelled'],
  Packed:             ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered'],
  Shipped:            ['Delivered'],
  Delivered:          [],
  Cancelled:          [],
};
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    if (!(FLOW[order.status] || []).includes(status)) {
      return res.status(400).json({ msg: `Cannot move ${order.status} → ${status}` });
    }
    const patch = { status };
    if (status === 'Out for Delivery' || status === 'Shipped') patch.shipped_at = db.fn.now();
    if (status === 'Delivered') patch.delivered_at = db.fn.now();
    const [updated] = await db('orders').where({ id: order.id }).update(patch).returning('*');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
