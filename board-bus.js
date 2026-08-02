(function () {
  "use strict";

  if (window.__BSE_BUS_READY) return;
  window.__BSE_BUS_READY = true;

  var BUS_EVENTS = {
    DRAW_ORDER: 1, DRAW_TERRITORY: 1, DRAW_UNIT: 1, DRAW_UNIT_TEXT: 1,
    CLICK_TERRITORY: 1, SET_STATE: 1, HIGHLIGHT_TERRITORY: 1, EDITING_STATE: 1
  };

  var api = window.__BSE = window.__BSE || {};
  api.bus = null;
  api.jq = null;

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

  function remember(target) {
    if (api.bus || !target) return;
    if (target.nodeType !== undefined || target === window) return;
    api.bus = target;
  }

  function patch(jq) {
    if (!jq || !jq.fn || jq.__bseBusPatched) return;
    var orig = jq.fn.trigger;
    if (typeof orig !== "function") return;
    jq.__bseBusPatched = true;
    api.jq = jq;
    jq.fn.trigger = function (type, data) {
      var name = (type && type.type) || type;
      var self = this, args = arguments;
      if (BUS_EVENTS[name]) remember(self[0]);
      if (name !== "DRAW_ORDER" || !data || typeof data !== "object") {
        return orig.apply(self, args);
      }
      return tagAround(data, function () { return orig.apply(self, args); });
    };
  }

  api.ready = function () {
    return !!(api.bus && api.jq);
  };

  api.drawOrder = function (terName, order, fullOrder) {
    if (!api.ready()) return false;
    api.jq(api.bus).trigger("DRAW_ORDER", {
      terName: terName,
      order: order,
      fullOrder: fullOrder
    });
    return true;
  };

  if (window.jQuery) {
    patch(window.jQuery);
  } else {
    var held;
    try {
      Object.defineProperty(window, "jQuery", {
        configurable: true,
        enumerable: true,
        get: function () { return held; },
        set: function (v) { held = v; patch(v); }
      });
    } catch (e) {}
  }
})();
