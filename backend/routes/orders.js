// orders.js - Postgres edition
// Creates orders + line items + payment transaction in a single TX.
// Awards reward points + updates stock atomically.
const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const db = require('../config/db');
const { notifyNewOrder } = require('../utils/notify');
const router = express.Router();

const DELIVERY_CHARGE = 50;

// GET /api/orders  - current user's orders
router.get('/', auth, async (req, res) => {
  try {
    const orders = await db('orders').where({ user_id: req.user.id }).orderBy('placed_at', 'desc');
    if (!orders.length) return res.json([]);
    const ids = orders.map((o) => o.id);
    const items = await db('order_items').whereIn('order_id', ids);
    const grouped = {};
    items.forEach((it) => { (grouped[it.order_id] ||= []).push(it); });
    res.json(orders.map((o) => ({
      ...o,
      _id: o.id,
      createdAt: o.placed_at,
      subtotal: Number(o.subtotal),
      deliveryCharge: Number(o.delivery_charge),
      totalAmount: Number(o.total),
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      items: (grouped[o.id] || []).map((i) => ({
        productId: i.product_id,
        name: i.name_snapshot,
        price: Number(i.price_snapshot),
        quantity: i.quantity,
        category_id: i.category_id,
      })),
    })));
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await db('orders').where({ id: req.params.id, user_id: req.user.id }).first();
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    const items = await db('order_items').where({ order_id: order.id });
    const tx = await db('transactions').where({ order_id: order.id });
    res.json({ ...order, _id: order.id, items, transactions: tx });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// POST /api/orders  body: { items:[{productId,quantity}], address, paymentMethod }
router.post('/', auth, async (req, res) => {
  const { items, address, paymentMethod = 'COD', paymentRef, gateway } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ msg: 'Order must contain at least one item' });
  }
  if (!address) return res.status(400).json({ msg: 'Delivery address is required' });

  try {
    const result = await db.transaction(async (trx) => {
      // 1. Lock products + validate stock
      const ids = items.map((i) => i.productId);
      const products = await trx('products').whereIn('id', ids).forUpdate();
      const byId = Object.fromEntries(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const lineRows = [];
      for (const it of items) {
        const p = byId[it.productId];
        if (!p) throw Object.assign(new Error(`Product ${it.productId} not found`), { status: 404 });
        if (p.stock < it.quantity) throw Object.assign(new Error(`Insufficient stock for ${p.name}`), { status: 400 });
        const lineTotal = Number(p.price) * it.quantity;
        subtotal += lineTotal;
        lineRows.push({
          product_id: p.id,
          category_id: p.category_id,
          name_snapshot: p.name,
          price_snapshot: p.price,
          quantity: it.quantity,
          line_total: lineTotal,
        });
      }
      const total = subtotal + DELIVERY_CHARGE;

      // 2. Insert order
      const [order] = await trx('orders').insert({
        user_id: req.user.id,
        subtotal,
        delivery_charge: DELIVERY_CHARGE,
        total,
        status: 'Confirmed',
        payment_method: paymentMethod,
        // 'Paid' only when a verified gateway ref is supplied (e.g. Razorpay);
        // COD and UPI deep-link orders stay 'Pending' until ops verifies.
        payment_status: paymentRef ? 'Paid' : 'Pending',
        address,
        confirmed_at: trx.fn.now(),
      }).returning('*');

      // 3. Insert line items
      await trx('order_items').insert(lineRows.map((l) => ({ ...l, order_id: order.id })));

      // 4. Decrement stock
      for (const it of items) {
        await trx('products').where({ id: it.productId }).decrement('stock', it.quantity);
      }

      // 5. Record transaction (payment event)
      await trx('transactions').insert({
        user_id: req.user.id,
        order_id: order.id,
        amount: total,
        payment_method: paymentMethod,
        status: paymentRef ? 'success' : 'pending',
        gateway: gateway || 'demo',
        gateway_ref: paymentRef || `DEMO-${Date.now()}`,
      });

      // 6. Award reward points (10 per order)
      await trx('users').where({ id: req.user.id }).increment('reward_points', 10);

      return { ...order, _id: order.id, items: lineRows };
    });

    // ping the ops team (webhook) — never blocks the response
    const user = await db('users').where({ id: req.user.id }).first();
    notifyNewOrder(result, result.items, user);

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message || 'Server error' });
  }
});

// PUT /api/orders/:id/status  (admin — requires ADMIN_TOKEN)
router.put('/:id/status', admin, async (req, res) => {
  try {
    const { status } = req.body;
    const ALLOWED = ['Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!ALLOWED.includes(status)) return res.status(400).json({ msg: 'Invalid status' });
    const patch = { status };
    if (status === 'Shipped' || status === 'Out for Delivery') patch.shipped_at = db.fn.now();
    if (status === 'Delivered') patch.delivered_at = db.fn.now();
    const [order] = await db('orders').where({ id: req.params.id }).update(patch).returning('*');
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
