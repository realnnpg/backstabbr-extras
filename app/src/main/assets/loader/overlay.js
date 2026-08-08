(function () {
  "use strict";

  if (window.__bseOverlayMounted) return;
  if (!document.body) return;
  window.__bseOverlayMounted = true;

  var DEFAULTS = {
    profileStats: true, boardWarnings: true, historyFilter: true, orderDrafts: true,
    pressNotes: true, autoSave: false, gameStats: true, tabIcons: false
  };

  var THEMES = [
    ["default", "Backstabbr (default)"], ["midnight", "Midnight (blue)"],
    ["crimson", "Crimson (red)"], ["forest", "Forest (green)"],
    ["royal", "Royal (purple)"], ["slate", "Slate (teal)"],
    ["ember", "Ember (orange)"], ["troll", "Best theme ever!"]
  ];

  var ITEMS = [
    ["profileStats", "Profile stats", "Per-country W/D/L, rates & highlights on member pages."],
    ["boardWarnings", "Illegal-move warnings", "Flags illegal orders on the game / sandbox board."],
    ["historyFilter", "Filter history by country", "On a past turn of a game or sandbox, tap countries in the map legend to show only their orders."],
    ["orderDrafts", "Order drafts", "Save the orders on the board, try something else, then load them back. Stored on this device only."],
    ["pressNotes", "Press notes & pins", "Personal notes, pinned chats & per-chat notes in press."],
    ["autoSave", "Auto-save orders", "Auto-clicks “Update Orders” after a change. Saves the draft only — never marks you ready."],
    ["gameStats", "Game stats & export", "Adds a Stats tab to games and sandboxes: SC graph, score table, HTML/PDF export."],
    ["tabIcons", "Tab icons", "Shows an icon on each game / sandbox tab: Orders, Press, Info, Sandboxes, Stats."]
  ];

  var FALLBACK = {
    "--o-accent": "#0d3b66", "--o-accent-h": "#0a2e50", "--o-surface": "#ffffff",
    "--o-surface2": "#f5f5f7", "--o-text": "#1c1c1e", "--o-muted": "#6c757d", "--o-border": "#eeeeee"
  };
  var VAR_SRC = {
    "--o-accent": "--bse-accent", "--o-accent-h": "--bse-accent-h", "--o-surface": "--bse-surface",
    "--o-surface2": "--bse-surface2", "--o-text": "--bse-text", "--o-muted": "--bse-muted", "--o-border": "--bse-border"
  };

  var version = "";
  try { version = chrome.runtime.getManifest().version; } catch (e) {}

  var host = document.createElement("div");
  host.id = "bse-overlay-host";
  host.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;";
  document.body.appendChild(host);
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var style = document.createElement("style");
  style.textContent = [
    "*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}",
    ".gear{width:48px;height:48px;border-radius:50%;border:none;background:var(--o-accent);color:#fff;",
    "font-size:24px;line-height:48px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35);}",
    ".gear:active{transform:scale(.94);}",
    ".panel{position:absolute;right:0;bottom:58px;width:320px;max-width:88vw;max-height:76vh;overflow-y:auto;",
    "background:var(--o-surface);color:var(--o-text);border:1px solid var(--o-border);border-radius:12px;",
    "box-shadow:0 8px 32px rgba(0,0,0,.4);}",
    ".panel.hidden{display:none;}",
    ".hdr{display:flex;align-items:baseline;justify-content:space-between;background:var(--o-accent);color:#fff;",
    "padding:10px 14px;border-radius:12px 12px 0 0;position:sticky;top:0;}",
    ".title{font-weight:700;font-size:14px;}",
    ".ver{font-size:11px;opacity:.7;}",
    ".row{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--o-border);}",
    ".name{font-weight:600;font-size:13px;}",
    ".sel{flex:1;padding:6px 8px;font-size:13px;border:1px solid var(--o-border);border-radius:6px;",
    "background:var(--o-surface2);color:var(--o-text);}",
    ".item{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-bottom:1px solid var(--o-border);}",
    ".txt{flex:1;}",
    ".desc{font-size:11.5px;color:var(--o-muted);margin-top:2px;line-height:1.3;}",
    ".sw{position:relative;display:inline-block;width:40px;height:22px;flex:0 0 auto;margin-top:1px;}",
    ".sw input{opacity:0;width:0;height:0;}",
    ".sl{position:absolute;inset:0;background:#c7c7cc;border-radius:22px;transition:background .15s;cursor:pointer;}",
    ".sl::before{content:'';position:absolute;height:18px;width:18px;left:2px;top:2px;background:#fff;",
    "border-radius:50%;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.3);}",
    ".sw input:checked + .sl{background:#2e8b57;}",
    ".sw input:checked + .sl::before{transform:translateX(18px);}",
    ".act{padding:12px 14px;border-bottom:1px solid var(--o-border);}",
    ".act .btn{margin-top:8px;padding:7px 12px;font-size:12.5px;font-weight:600;border:none;",
    "border-radius:6px;background:var(--o-accent);color:#fff;cursor:pointer;}",
    ".act .btn:active{transform:scale(.97);}"
  ].join("");
  root.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "gear";
  btn.type = "button";
  btn.title = "Backstabbr Extras";
  btn.textContent = "⚙";
  root.appendChild(btn);

  var panel = document.createElement("div");
  panel.className = "panel hidden";
  root.appendChild(panel);

  var hdr = document.createElement("div");
  hdr.className = "hdr";
  var t = document.createElement("span"); t.className = "title"; t.textContent = "Backstabbr Extras";
  var v = document.createElement("span"); v.className = "ver"; v.textContent = version ? "v" + version : "";
  hdr.appendChild(t); hdr.appendChild(v);
  panel.appendChild(hdr);

  var themeRow = document.createElement("div");
  themeRow.className = "row";
  var themeLabel = document.createElement("span"); themeLabel.className = "name"; themeLabel.textContent = "Theme";
  var sel = document.createElement("select"); sel.className = "sel";
  THEMES.forEach(function (pair) {
    var o = document.createElement("option");
    o.value = pair[0]; o.textContent = pair[1];
    sel.appendChild(o);
  });
  themeRow.appendChild(themeLabel); themeRow.appendChild(sel);
  panel.appendChild(themeRow);

  var inputs = {};
  ITEMS.forEach(function (it) {
    var id = it[0];
    var li = document.createElement("div"); li.className = "item";

    var sw = document.createElement("label"); sw.className = "sw";
    var cb = document.createElement("input"); cb.type = "checkbox";
    var sl = document.createElement("span"); sl.className = "sl";
    sw.appendChild(cb); sw.appendChild(sl);

    var txt = document.createElement("div"); txt.className = "txt";
    var nm = document.createElement("div"); nm.className = "name"; nm.textContent = it[1];
    var ds = document.createElement("div"); ds.className = "desc"; ds.textContent = it[2];
    txt.appendChild(nm); txt.appendChild(ds);

    li.appendChild(sw); li.appendChild(txt);
    panel.appendChild(li);

    inputs[id] = cb;
    cb.addEventListener("change", function () {
      var patch = {}; patch[id] = cb.checked;
      try { chrome.storage.sync.set(patch); } catch (e) {}
    });
  });

  (function () {
    var api = null;
    try { api = window.BSEAndroidLinks || null; } catch (e) {}
    if (!api || typeof api.needsOptIn !== "function") return;
    var needed = false;
    try { needed = !!api.needsOptIn(); } catch (e) { return; }
    if (!needed) return;

    var box = document.createElement("div"); box.className = "act";
    var nm = document.createElement("div"); nm.className = "name";
    nm.textContent = "Open Backstabbr links in the app";
    var ds = document.createElement("div"); ds.className = "desc";
    ds.textContent = "Android needs this allowed once. Turn on “Open supported links”, then " +
      "add backstabbr.com under “Supported web addresses”.";
    var go = document.createElement("button");
    go.className = "btn"; go.type = "button"; go.textContent = "Open settings";
    go.addEventListener("click", function () {
      try { api.openSettings(); } catch (e) {}
    });
    box.appendChild(nm); box.appendChild(ds); box.appendChild(go);
    panel.appendChild(box);
  })();

  function readVar(name) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
    catch (e) { return ""; }
  }

  function rgbToHex(c) {
    if (!c) return "";
    if (c.charAt(0) === "#") return c;
    var m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "";
    function h(n) { n = parseInt(n, 10).toString(16); return n.length < 2 ? "0" + n : n; }
    return "#" + h(m[1]) + h(m[2]) + h(m[3]);
  }

  function barColor() {
    try {
      var nb = document.querySelector(".navbar");
      if (nb) { var hx = rgbToHex(getComputedStyle(nb).backgroundColor); if (hx) return hx; }
    } catch (e) {}
    return readVar("--bse-accent") || "#0d3b66";
  }

  function applyTheme() {
    Object.keys(VAR_SRC).forEach(function (o) {
      var val = readVar(VAR_SRC[o]) || FALLBACK[o];
      host.style.setProperty(o, val);
    });
    var name = document.documentElement.getAttribute("data-bse-theme") || "";
    btn.textContent = (name === "troll") ? "🗡" : "⚙";
    try { if (window.BSEAndroidBar && BSEAndroidBar.setColor) BSEAndroidBar.setColor(barColor()); } catch (e) {}
  }

  btn.addEventListener("click", function () { panel.classList.toggle("hidden"); });

  try {
    chrome.storage.sync.get(DEFAULTS, function (cfg) {
      Object.keys(inputs).forEach(function (id) {
        inputs[id].checked = cfg[id] !== false;
      });
    });
    chrome.storage.sync.get({ theme: "default" }, function (cfg) {
      sel.value = cfg.theme || "default";
    });
  } catch (e) {}

  sel.addEventListener("change", function () {
    try { chrome.storage.sync.set({ theme: sel.value }); } catch (e) {}
  });

  applyTheme();
  try {
    var mo = new MutationObserver(applyTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-bse-theme"] });
  } catch (e) {}
})();
