(function () {
  "use strict";

  if (!/^\/game\/[^/]+\/[^/]+\/\d{3,4}\/[A-Za-z]+/.test(location.pathname)) return;
  if (window.__bseHistoryFilter) return;
  window.__bseHistoryFilter = true;

  var POWERS = ["Austria", "England", "France", "Germany", "Italy", "Russia", "Turkey"];
  var STORE_KEY = "bse-history-filter:" + location.pathname.split("/").slice(1, 4).join("/");

  var selected = load();
  var chips = [];
  var resetBtn = null;
  var styled = false;

  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (c) { return POWERS.indexOf(c) >= 0; });
    } catch (e) {
      return [];
    }
  }

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(selected)); } catch (e) {}
  }

  function countryOf(node) {
    if (!node || !node.classList) return null;
    for (var i = 0; i < POWERS.length; i++) {
      if (node.classList.contains(POWERS[i])) return POWERS[i];
    }
    return null;
  }

  function mapSvg() {
    var m = document.getElementById("map");
    return m ? m.querySelector("svg") : null;
  }

  function tagAround(data, draw) {
    var svg = mapSvg();
    if (!svg) return draw();

    var before = [], kids = svg.childNodes, i;
    for (i = 0; i < kids.length; i++) before.push(kids[i]);

    var out = draw();

    var country = (data.fullOrder && data.fullOrder.player) || "";
    kids = svg.childNodes;
    for (i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType !== 1 || before.indexOf(n) >= 0) continue;
      if ((n.tagName || "").toLowerCase() === "defs") continue;
      n.setAttribute("data-bse-oc", country);
      n.setAttribute("data-bse-ot", data.terName || "");
    }
    return out;
  }

  function patchJquery(jq) {
    if (!jq || !jq.fn || jq.__bseHistoryPatched) return;
    var orig = jq.fn.trigger;
    if (typeof orig !== "function") return;
    jq.__bseHistoryPatched = true;
    jq.fn.trigger = function (type, data) {
      var name = (type && type.type) || type;
      var self = this, args = arguments;
      if (name !== "DRAW_ORDER" || !data || typeof data !== "object") {
        return orig.apply(self, args);
      }
      return tagAround(data, function () { return orig.apply(self, args); });
    };
  }

  (function hookJquery() {
    if (window.jQuery) { patchJquery(window.jQuery); return; }
    var held;
    try {
      Object.defineProperty(window, "jQuery", {
        configurable: true,
        enumerable: true,
        get: function () { return held; },
        set: function (v) { held = v; patchJquery(v); }
      });
    } catch (e) {}
  })();

  function enabled() {
    return document.documentElement.getAttribute("data-bse-history") !== "0";
  }

  function display(node, on) {
    if (on) node.style.removeProperty("display");
    else node.style.setProperty("display", "none");
  }

  function applyFilter() {
    var on = enabled();
    var showAll = !on || selected.length === 0;

    var svg = mapSvg();
    if (svg) {
      var shapes = svg.querySelectorAll("[data-bse-oc]");
      for (var i = 0; i < shapes.length; i++) {
        var c = shapes[i].getAttribute("data-bse-oc");
        display(shapes[i], showAll || selected.indexOf(c) >= 0);
      }
    }

    var rows = document.querySelectorAll("#orders-text tr");
    for (var j = 0; j < rows.length; j++) {
      var rc = countryOf(rows[j].querySelector(".country-icon"));
      if (!rc) continue;
      display(rows[j], showAll || selected.indexOf(rc) >= 0);
    }

    paintLegend(on);
  }

  function injectStyle() {
    if (styled || !document.head) return;
    styled = true;
    var s = document.createElement("style");
    s.setAttribute("data-bse", "history.js");
    s.textContent = [
      "#map .legend .bse-hf{cursor:pointer;border-radius:6px;padding:1px 5px;",
      "transition:opacity .12s ease,box-shadow .12s ease,background-color .12s ease;}",
      "#map .legend .bse-hf-dim{opacity:.32;}",
      "#map .legend .bse-hf-on{background:rgba(127,127,127,.22);",
      "box-shadow:0 0 0 1.5px rgba(127,127,127,.85);}",
      "#map .legend .bse-hf-reset{cursor:pointer;font:inherit;font-size:.85em;color:inherit;",
      "background:none;border:1px solid rgba(127,127,127,.7);border-radius:6px;",
      "padding:0 7px;margin-left:6px;}",
      "#map .legend .bse-hf-gone{display:none;}"
    ].join("");
    document.head.appendChild(s);
  }

  function onChipClick() {
    if (!enabled()) return;
    var c = this.getAttribute("data-bse-country");
    var at = selected.indexOf(c);
    if (at >= 0) selected.splice(at, 1);
    else selected.push(c);
    save();
    applyFilter();
  }

  function buildLegend() {
    var legend = document.querySelector("#map .legend");
    if (!legend) return false;
    if (legend.hasAttribute("data-bse-hf")) return true;
    legend.setAttribute("data-bse-hf", "1");
    injectStyle();

    var icons = legend.querySelectorAll(".country-icon-map");
    for (var i = 0; i < icons.length; i++) {
      var country = countryOf(icons[i]);
      var chip = icons[i].parentNode;
      if (!country || !chip || chip === legend || chip.nodeType !== 1) continue;
      chip.setAttribute("data-bse-country", country);
      chip.title = "Show only " + country + "'s orders (click again to unselect)";
      chip.addEventListener("click", onChipClick);
      chips.push(chip);
    }
    if (!chips.length) return true;

    resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "bse-hf-reset bse-hf-gone";
    resetBtn.textContent = "Show all";
    resetBtn.addEventListener("click", function () {
      selected = [];
      save();
      applyFilter();
    });
    legend.appendChild(resetBtn);
    return true;
  }

  function paintLegend(on) {
    var filtering = on && selected.length > 0;
    chips.forEach(function (chip) {
      var c = chip.getAttribute("data-bse-country");
      var isOn = filtering && selected.indexOf(c) >= 0;
      chip.classList.toggle("bse-hf", on);
      chip.classList.toggle("bse-hf-on", isOn);
      chip.classList.toggle("bse-hf-dim", filtering && !isOn);
    });
    if (resetBtn) resetBtn.classList.toggle("bse-hf-gone", !filtering);
  }

  var tries = 0;

  function tick() {
    if (buildLegend()) applyFilter();
    var svg = mapSvg();
    var tagged = svg && svg.querySelector("[data-bse-oc]");
    if (tagged || tries++ > 40) return;
    setTimeout(tick, 150);
  }

  try {
    new MutationObserver(function () { applyFilter(); }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bse-history"]
    });
  } catch (e) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(tick, 0); });
  } else {
    setTimeout(tick, 0);
  }
})();
