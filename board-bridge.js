(function () {
  "use strict";
  function apply(on) {
    document.documentElement.setAttribute("data-bse-board", on ? "1" : "0");
  }
  try {
    chrome.storage.sync.get({ boardWarnings: true }, function (cfg) {
      apply(cfg.boardWarnings !== false);
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "sync" && changes.boardWarnings) {
        apply(changes.boardWarnings.newValue !== false);
      }
    });
  } catch (e) {
    apply(true);
  }
})();
