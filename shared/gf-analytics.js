/* gf-analytics.js — MVP behavioral layer.
   gfTrack(event, props) records user actions (login, screen views, product
   views, add-to-cart, orders, plants added) to a local ring buffer and
   best-effort POSTs them to the backend. gfAffinity() aggregates the buffer
   into per-category/product scores used to personalise Smart Picks — the
   "track → analyse → suggest" loop for the POC. */
(function () {
  var KEY = 'gf_events_v1';
  var MAX = 500;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(evts) {
    try { localStorage.setItem(KEY, JSON.stringify(evts.slice(-MAX))); } catch (e) {}
  }

  /* Optional server sync — POSTs to the real /api/activity endpoint with the
     user's JWT. No-op when there's no backend or the user isn't logged in. */
  function push(evt) {
    try {
      if (typeof window.gfApi !== 'function' || !localStorage.getItem('gf_jwt')) return;
      var payload = {};
      for (var k in evt) { if (k !== 'e' && k !== 't') payload[k] = evt[k]; }
      window.gfApi('/api/activity', {
        method: 'POST',
        body: { event_type: evt.e, screen: payload.screen || '', payload: payload, client: 'web' }
      }).catch(function () {});
    } catch (e) {}
  }

  window.gfTrack = function (event, props) {
    try {
      var evt = { e: event, t: Date.now() };
      if (props) for (var k in props) evt[k] = props[k];
      var evts = load();
      evts.push(evt);
      save(evts);
      push(evt);
    } catch (e) {}
  };

  /* Aggregate interactions into { cats: {cat: score}, names: {lc name: score} }.
     Weights: order > add-to-cart > view > screen visit. */
  window.gfAffinity = function () {
    var cats = {}, names = {};
    var W = { order_placed: 5, add_to_cart: 3, product_view: 1, plant_added: 4 };
    load().forEach(function (ev) {
      var w = W[ev.e] || 0;
      if (!w) return;
      if (ev.cat) cats[ev.cat] = (cats[ev.cat] || 0) + w;
      var n = (ev.name || ev.product || '').toLowerCase();
      if (n) names[n] = (names[n] || 0) + w;
      if (ev.e === 'plant_added' && ev.type) names[String(ev.type).toLowerCase()] = (names[String(ev.type).toLowerCase()] || 0) + w;
    });
    return { cats: cats, names: names };
  };

  /* Home "Smart picks" rail — season-aware engine picks boosted by affinity. */
  window.gfRenderHomePicks = function () {
    var host = document.getElementById('home-picks-list');
    var titleEl = document.getElementById('home-picks-season');
    if (!host) return;
    var run = function () {
      try {
        if (!window.GFPlants) { host.innerHTML = ''; return; }
        var env = (typeof _gfBuildEnv === 'function') ? _gfBuildEnv() : {};
        var garden = (typeof _gfReadGarden === 'function') ? _gfReadGarden() : [];
        var picks = window.GFPlants.recommend(env, { existingGarden: garden, top: 8, climate: env.climate }) || [];
        var aff = gfAffinity();
        // Behaviour boost: plants the user browsed/bought/grew rank higher.
        picks = picks.map(function (r) {
          var n = (r.plant && r.plant.name || '').toLowerCase();
          var boost = 0;
          Object.keys(aff.names).forEach(function (k) {
            if (n.indexOf(k) !== -1 || k.indexOf(n) !== -1) boost = Math.max(boost, aff.names[k]);
          });
          r._boost = boost;
          r._rank = (r.successPct || 0) + Math.min(boost * 3, 15);
          return r;
        }).sort(function (a, b) { return b._rank - a._rank; }).slice(0, 4);

        if (titleEl && env.season) titleEl.textContent = env.season + ' season · ' + (env.tempC || '') + (env.tempC ? '°C' : '');
        if (!picks.length) { host.innerHTML = ''; var sec = document.getElementById('home-smart-picks'); if (sec) sec.style.display = 'none'; return; }

        host.innerHTML = picks.map(function (r) {
          var p = r.plant;
          var s = r.successPct || 0;
          var col = s >= 70 ? '#43A047' : s >= 45 ? '#FB8C00' : '#E53935';
          var why = r._boost >= 3 ? ' · picked up on your activity' : (p.companions && garden.length ? ' · pairs with your garden' : '');
          return '<div class="home-pick-card" onclick="gfTrack(\'pick_tap\',{name:\'' + String(p.name).replace(/'/g, '') + '\'});(typeof gotoProduct===\'function\'?gotoProduct(\'' + String(p.name).replace(/'/g, '') + '\',\'seeds\'):switchTab(\'shop\'))" style="background:var(--white);border-radius:var(--radius);padding:10px 12px;box-shadow:var(--shadow-sm);border-left:4px solid ' + col + ';display:flex;align-items:center;gap:10px;cursor:pointer">'
            + '<div style="font-size:24px;line-height:1">' + (typeof _gfPickIcon === 'function' ? _gfPickIcon(p) : '🌱') + '</div>'
            + '<div style="flex:1;min-width:0">'
              + '<div style="font-size:12px;font-weight:900;color:var(--text)">' + p.name + '</div>'
              + '<div style="font-size:10px;color:var(--muted);font-weight:700;margin-top:1px">' + (p.daysToHarvest || '?') + 'd to harvest · ' + (p.difficulty <= 2 ? 'easy' : p.difficulty <= 3 ? 'medium' : 'advanced') + why + '</div>'
            + '</div>'
            + '<div style="font-size:12px;font-weight:900;color:' + col + '">' + s + '%</div>'
          + '</div>';
        }).join('');
      } catch (e) { console.warn('[gf] home picks failed', e); }
    };
    if (window.GFPlants && window.GFPlants._state && window.GFPlants._state.loaded) run();
    else if (window.GFPlants && window.GFPlants.ready) window.GFPlants.ready.then(run);
    else setTimeout(run, 400);
  };
})();
