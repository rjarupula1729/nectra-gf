// auth.js - Postgres edition
// OTP login + profile + family CRUD + health profile.
// POST /send-otp issues a real OTP (SMS_PROVIDER); in non-production the
// DEMO_OTP code (default "1234") also verifies so demo mode still works.
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const auth = require('../middleware/auth');
const { sendOtpSms } = require('../utils/sms');

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const hashOtp = (mobile, otp) =>
  crypto.createHash('sha256').update(`${mobile}:${otp}:${process.env.JWT_SECRET}`).digest('hex');

// POST /api/auth/send-otp  { mobile }
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ msg: 'Valid 10-digit mobile is required' });
    }
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    await db('otps').where({ mobile }).del(); // one active OTP per mobile
    await db('otps').insert({
      mobile,
      otp_hash: hashOtp(mobile, otp),
      expires_at: new Date(Date.now() + OTP_TTL_MS),
    });
    const result = await sendOtpSms(mobile, otp);
    // devOtp is only ever set by the "console" provider — never a real SMS one
    res.json({ sent: true, provider: result.provider, ...(result.devOtp ? { devOtp: result.devOtp } : {}) });
  } catch (err) {
    res.status(500).json({ msg: 'Could not send OTP', error: err.message });
  }
});

// POST /api/auth/verify-otp  { mobile, otp }
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ msg: 'Mobile and OTP are required' });

    // 1) stored OTP path (real send-otp flow)
    const row = await db('otps').where({ mobile }).orderBy('created_at', 'desc').first();
    let ok = false;
    if (row) {
      if (row.attempts >= 5) return res.status(429).json({ msg: 'Too many attempts — request a new OTP' });
      ok = row.expires_at > new Date() && row.otp_hash === hashOtp(mobile, otp);
      if (ok) {
        await db('otps').where({ id: row.id }).del();
      } else {
        await db('otps').where({ id: row.id }).increment('attempts', 1);
      }
    }
    // 2) demo fallback — disabled in production unless DEMO_OTP is explicitly set
    if (!ok) {
      const demoCode = process.env.DEMO_OTP || (process.env.NODE_ENV !== 'production' ? '1234' : null);
      ok = demoCode && otp === demoCode;
    }
    if (!ok) return res.status(400).json({ msg: 'Invalid or expired OTP' });

    let user = await db('users').where({ mobile }).first();
    if (!user) {
      [user] = await db('users').insert({ mobile }).returning('*');
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { ...user, rewardPoints: user.reward_points } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ msg: 'User not found' });
    const family = await db('family_members').where({ user_id: user.id });
    const health = await db('user_health_profile').where({ user_id: user.id }).first();
    res.json({ ...user, rewardPoints: user.reward_points, family, health: health || null });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// PUT /api/auth/me  -> name | email | city | avatar
router.put('/me', auth, async (req, res) => {
  try {
    const allowed = ['name', 'email', 'city', 'avatar'];
    const update = { updated_at: db.fn.now() };
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    const [user] = await db('users').where({ id: req.user.id }).update(update).returning('*');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ ...user, rewardPoints: user.reward_points });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Family
router.get('/family', auth, async (req, res) => {
  const list = await db('family_members').where({ user_id: req.user.id }).orderBy('created_at');
  res.json(list);
});

router.post('/family', auth, async (req, res) => {
  try {
    const { name, relation, age } = req.body;
    if (!name || !relation) return res.status(400).json({ msg: 'Name and relation are required' });
    await db('family_members').insert({ user_id: req.user.id, name, relation, age: age || '' });
    const list = await db('family_members').where({ user_id: req.user.id }).orderBy('created_at');
    res.json(list);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.delete('/family/:memberId', auth, async (req, res) => {
  try {
    await db('family_members').where({ id: req.params.memberId, user_id: req.user.id }).del();
    const list = await db('family_members').where({ user_id: req.user.id }).orderBy('created_at');
    res.json(list);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Health profile
router.get('/health', auth, async (req, res) => {
  const h = await db('user_health_profile').where({ user_id: req.user.id }).first();
  res.json(h || null);
});

router.put('/health', auth, async (req, res) => {
  try {
    const allowed = ['age','gender','height_cm','weight_kg','water_glasses_per_day','sleep_hours_per_day','conditions','goals','insurance_provider'];
    const payload = { user_id: req.user.id, updated_at: db.fn.now() };
    allowed.forEach((k) => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });
    const [row] = await db('user_health_profile').insert(payload).onConflict('user_id').merge().returning('*');
    res.json(row);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
