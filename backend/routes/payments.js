// payments.js — Razorpay integration (enabled when RAZORPAY_KEY_ID + _SECRET
// are set; otherwise the API stays in mock-payment mode).
// Flow: POST /razorpay/order → client opens Razorpay Checkout →
//       POST /razorpay/verify (HMAC signature) → client places the order.
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const auth = require('../middleware/auth');
const router = express.Router();

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const enabled = () => Boolean(KEY_ID && KEY_SECRET);

const requireEnabled = (_req, res, next) =>
  enabled() ? next() : res.status(503).json({ msg: 'Payment gateway not configured' });

// POST /api/payments/razorpay/order  { amount (₹), receipt? }
router.post('/razorpay/order', auth, requireEnabled, async (req, res) => {
  try {
    const amount = Math.round(Number(req.body.amount) * 100); // → paise
    if (!amount || amount < 100) return res.status(400).json({ msg: 'Invalid amount' });
    const { data } = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount,
        currency: 'INR',
        receipt: req.body.receipt || `gf_${Date.now()}`,
        payment_capture: 1,
      },
      { auth: { username: KEY_ID, password: KEY_SECRET } }
    );
    res.json({ orderId: data.id, amount: data.amount, currency: data.currency, keyId: KEY_ID });
  } catch (err) {
    res.status(500).json({ msg: 'Could not create payment order', error: err.message });
  }
});

// POST /api/payments/razorpay/verify
//   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/razorpay/verify', auth, requireEnabled, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ msg: 'Missing payment fields' });
    }
    const expected = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ msg: 'Payment verification failed' });
    }
    res.json({ verified: true, paymentId: razorpay_payment_id });
  } catch (err) {
    res.status(500).json({ msg: 'Verification error', error: err.message });
  }
});

module.exports = router;
