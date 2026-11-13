// gf-config.js — one place to point the web app at a backend.
//
// GOING LIVE: after deploying the API (e.g. Render), set the URL below —
//   window.GF_API = 'https://growfresh-api.onrender.com';
// While it stays blank the app auto-tries http://localhost:5000 and falls
// back to offline/demo mode if no backend answers.
// You can also override per-session with ?api=https://… in the page URL.
(function () {
  window.GF_API = window.GF_API || ''; // e.g. 'https://growfresh-api.onrender.com'

  // ── UPI deep-link payments ──────────────────────────────────────────────
  // Set YOUR business UPI ID (e.g. 'growfresh@ybl' / '98765xxxxx@paytm').
  // When set, "Pay" opens the customer's PhonePe/GPay with the amount
  // prefilled — money lands directly in your account, no gateway needed.
  // Orders then arrive with payment_status "Pending" — your ops team
  // verifies the credit in your UPI app, then packs the order.
  // Leave blank to keep demo-mode payments.
  window.GF_UPI_VPA  = window.GF_UPI_VPA  || '';          // e.g. 'growfresh@ybl'
  window.GF_UPI_NAME = window.GF_UPI_NAME || 'GrowFresh'; // payee name shown to customer
  window.GF_API_DEFAULT = window.GF_API || 'http://localhost:5000';
  window.gfApiBase = function () {
    var qs = new URLSearchParams(location.search);
    return (qs.get('api') || window.GF_API || window.GF_API_DEFAULT).replace(/\/$/, '');
  };
  // Shared fetch helper (Bearer JWT from localStorage when present).
  window.gfApi = function (path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var t = localStorage.getItem('gf_jwt');
    if (opts.auth !== false && t) headers['Authorization'] = 'Bearer ' + t;
    return fetch(window.gfApiBase() + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) { var e = new Error(json.msg || 'HTTP ' + res.status); e.status = res.status; throw e; }
        return json;
      });
    });
  };
})();
