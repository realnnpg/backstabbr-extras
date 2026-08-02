(function () {
  "use strict";

  var FLAGS = {
    boardWarnings: "data-bse-board",
    historyFilter: "data-bse-history",
    orderDrafts: "data-bse-drafts"
  };

  function apply(key, on) {
    document.documentElement.setAttribute(FLAGS[key], on ? "1" : "0");
  }

  try {
    chrome.storage.sync.get({ boardWarnings: true, historyFilter: true, orderDrafts: true }, function (cfg) {
      Object.keys(FLAGS).forEach(function (k) { apply(k, cfg[k] !== false); });
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "sync") return;
      Object.keys(FLAGS).forEach(function (k) {
        if (changes[k]) apply(k, changes[k].newValue !== false);
      });
    });
  } catch (e) {
    Object.keys(FLAGS).forEach(function (k) { apply(k, true); });
  }
})();
