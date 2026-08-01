(function () {
  "use strict";

  var enabled = false;
  var timer = null;
  var DELAY = 1200;

  function btn() { return document.getElementById("submit_orders_button"); }

  function schedule() {
    if (!enabled) return;
    var b = btn();
    if (!b || b.disabled) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      var b = btn();
      if (enabled && b && !b.disabled) b.click();
    }, DELAY);
  }

  function watch() {
    var b = btn();
    if (!b) return false;
    if (b.__bseAutoWatched) return true;
    b.__bseAutoWatched = true;
    new MutationObserver(schedule).observe(b, { attributes: true, attributeFilter: ["disabled"] });
    schedule();
    return true;
  }

  if (!watch()) {

    var mo = new MutationObserver(function () { if (watch()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  try {
    chrome.storage.sync.get({ autoSave: false }, function (cfg) {
      enabled = !!cfg.autoSave;
      schedule();
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "sync" && changes.autoSave) {
        enabled = !!changes.autoSave.newValue;
        schedule();
      }
    });
  } catch (e) {  }
})();
