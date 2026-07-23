(function () {
  "use strict";
  var html = document.documentElement;
  var LS = "bse_theme";

  function apply(name) {
    if (name && name !== "default") html.setAttribute("data-bse-theme", name);
    else html.removeAttribute("data-bse-theme");
  }

  try { apply(localStorage.getItem(LS)); } catch (e) {}

  try {
    chrome.storage.sync.get({ theme: "default" }, function (cfg) {
      apply(cfg.theme);
      try { localStorage.setItem(LS, cfg.theme); } catch (e) {}
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "sync" && changes.theme) {
        apply(changes.theme.newValue);
        try { localStorage.setItem(LS, changes.theme.newValue); } catch (e) {}
      }
    });
  } catch (e) {}
})();
