/* Feature flags — MVP launch scope is the core buy -> grow -> reorder loop:
   OTP login, Shop, Cart, Orders, Garden (plant tracking), Wishlist, Profile.
   Phase-2 surfaces stay in the codebase but ship disabled; flip to true to
   re-enable them. Mirrors src/config/features.js in the React Native app. */
window.FEATURES = {
  COMMUNITY: false,
  WELLNESS: false,
  EXPERTS: false,
  REWARDS: false,
  FUTURE_PLANTS: false,
  /* Everything outside the core loop: AI coach, space analyzer, seasonal
     calendar, compost helper, learn/courses, kids games, subscriptions,
     family ecosystem, R&D lab, the "More" menu, coming-soon teasers. */
  EXTRAS: false,
};

/* tab/screen name -> flag key. Screens not listed are always available. */
window.FEATURE_TAB_MAP = {
  community: 'COMMUNITY',
  wellness: 'WELLNESS',
  eating: 'WELLNESS',
  soil: 'WELLNESS',
  expert: 'EXPERTS',
  rewards: 'REWARDS',
  future: 'FUTURE_PLANTS',
  aicoach: 'EXTRAS',
  calendar: 'EXTRAS',
  analyzer: 'EXTRAS',
  compost: 'EXTRAS',
  learn: 'EXTRAS',
  kids: 'EXTRAS',
  subs: 'EXTRAS',
  family: 'EXTRAS',
  rd: 'EXTRAS',
  more: 'EXTRAS',
};

window.featureOn = function (key) {
  return !!(window.FEATURES && window.FEATURES[key]);
};

window.featureOnForTab = function (tab) {
  var f = window.FEATURE_TAB_MAP[tab];
  return f ? window.featureOn(f) : true;
};

(function () {
  /* Whole page gated? Redirect home (e.g. community.html opened directly). */
  function gatePage() {
    var page = document.body && document.body.getAttribute('data-feature-page');
    if (page && !window.featureOn(page)) {
      location.replace('growfresh-app.html');
      return true;
    }
    return false;
  }

  /* Remove DOM nodes tagged data-feature="FLAG1 FLAG2".
     A node survives only if at least one listed flag is enabled. */
  function prune() {
    document.querySelectorAll('[data-feature]').forEach(function (el) {
      var flags = (el.getAttribute('data-feature') || '').split(/\s+/);
      var on = flags.some(function (f) { return window.featureOn(f); });
      if (!on) el.remove();
    });
  }

  function run() {
    if (gatePage()) return;
    prune();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
