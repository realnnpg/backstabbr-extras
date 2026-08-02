(function () {
  "use strict";

  var DEFAULTS = { profileStats: true, boardWarnings: true, historyFilter: true, orderDrafts: true, pressNotes: true, autoSave: false, gameStats: true, tabIcons: false };
  var ids = Object.keys(DEFAULTS);

  try {
    var v = chrome.runtime.getManifest().version;
    document.getElementById("ver").textContent = "v" + v;
  } catch (e) {  }

  chrome.storage.sync.get(DEFAULTS, function (cfg) {
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.checked = cfg[id] !== false;
    });
  });

  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", function () {
      var patch = {};
      patch[id] = el.checked;
      chrome.storage.sync.set(patch);
    });
  });

  var themeSel = document.getElementById("theme");
  if (themeSel) {
    chrome.storage.sync.get({ theme: "default" }, function (cfg) {
      themeSel.value = cfg.theme || "default";
    });
    themeSel.addEventListener("change", function () {
      chrome.storage.sync.set({ theme: themeSel.value });
    });
  }
})();
