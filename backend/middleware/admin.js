// middleware/admin.js — ops-team guard.
// Requires header "x-admin-token: <ADMIN_TOKEN>" (or Bearer <ADMIN_TOKEN>).
// In development, when ADMIN_TOKEN is unset, requests are allowed with a
// warning so local testing isn't blocked. In production it is REQUIRED.
module.exports = function admin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const provided =
    req.get('x-admin-token') ||
    (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ msg: 'Admin API not configured (set ADMIN_TOKEN)' });
    }
    return next(); // dev mode without a token — allowed
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ msg: 'Invalid or missing admin token' });
  }
  next();
};
