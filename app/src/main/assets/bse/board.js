(function () {
  "use strict";
  var MAP = window.__BSE_MAP;
  if (!MAP) return;
  var SVGNS = "http://www.w3.org/2000/svg";

  var COAST_ADJ = {
    Stp: { nc: ["Nwy", "BAR"], sc: ["Fin", "Lvn", "BOT"] },
    Spa: { nc: ["Gas", "Por", "MAO"], sc: ["Mar", "Por", "MAO", "LYO", "WES"] },
    Bul: { ec: ["Con", "Rum", "BLA"], sc: ["Con", "Gre", "AEG"] }
  };

  function unitAt(prov) {
    var u = window.unitsByPlayer || {};
    for (var pw in u) {
      if (u[pw] && u[pw][prov] != null) {
        var v = u[pw][prov];
        if (typeof v === "string") return { isFleet: v === "F", coast: null };
        return { isFleet: (v.type || "") === "F", coast: v.coast || null };
      }
    }
    return null;
  }

  function fleetDests(prov, coast) {
    if (COAST_ADJ[prov]) {
      if (coast && COAST_ADJ[prov][coast]) return COAST_ADJ[prov][coast];
      return MAP[prov].fu || MAP[prov].f;
    }
    return MAP[prov].f;
  }

  function canMoveTo(prov, isFleet, coast, to) {
    return (isFleet ? fleetDests(prov, coast) : MAP[prov].a).indexOf(to) >= 0;
  }

  function seaTouches(sea, land) {
    return MAP[sea] && MAP[sea].t === "w" && MAP[sea].f.indexOf(land) >= 0;
  }

  function convoyValid(from, to) {
    if (!MAP[from] || !MAP[to] || MAP[from].t !== "l" || MAP[to].t !== "l") return false;
    var orders = window.orders || {};
    var cseas = {};
    for (var pw in orders) {
      for (var p in orders[pw]) {
        var o = orders[pw][p];
        if (o && o.type === "CONVOY" && o.from === from && o.to === to &&
            MAP[p] && MAP[p].t === "w") cseas[p] = true;
      }
    }
    var queue = [], seen = {};
    for (var s in cseas) if (seaTouches(s, from)) queue.push(s);
    while (queue.length) {
      var sea = queue.shift();
      if (seen[sea]) continue;
      seen[sea] = true;
      if (seaTouches(sea, to)) return true;
      MAP[sea].f.forEach(function (n) {
        if (cseas[n] && !seen[n]) queue.push(n);
      });
    }
    return false;
  }

  function badMove(prov, isFleet, coast, to, toCoast) {
    if (!MAP[prov] || !to || !MAP[to]) return false;
    if (isFleet) {
      if (!canMoveTo(prov, true, coast, to)) return true;
      if (COAST_ADJ[to] && toCoast) {
        var arr = COAST_ADJ[to][toCoast];
        if (!arr || arr.indexOf(prov) < 0) return true;
      }
      return false;
    }

    if (canMoveTo(prov, false, coast, to)) return false;
    if (convoyValid(prov, to)) return false;
    return true;
  }

  function badSupport(prov, isFleet, coast, target) {
    if (!MAP[prov] || !target || !MAP[target]) return false;
    return !canMoveTo(prov, isFleet, coast, target);
  }

  function scan() {
    var bad = [];
    var orders = window.orders || {};
    for (var pw in orders) {
      var po = orders[pw] || {};
      for (var prov in po) {
        var o = po[prov];
        if (!o || !o.type) continue;
        if (o.type !== "MOVE" && o.type !== "SUPPORT") continue;
        var u = unitAt(prov);
        if (!u) continue;
        var isBad = o.type === "MOVE"
          ? badMove(prov, u.isFleet, u.coast, o.to, o.to_coast)
          : badSupport(prov, u.isFleet, u.coast, o.to || o.from);
        if (isBad && bad.indexOf(prov) < 0) bad.push(prov);
      }
    }
    return bad;
  }

  function clearHighlights() {
    var prev = document.querySelectorAll(".bse-bad-overlay");
    for (var i = 0; i < prev.length; i++) prev[i].remove();
  }

  function highlight(prov) {
    var terr = document.getElementById("ter_" + prov);
    if (!terr || !terr.getAttribute("d")) return;
    var svg = terr.ownerSVGElement;
    if (!svg) return;
    var o = document.createElementNS(SVGNS, "path");
    o.setAttribute("d", terr.getAttribute("d"));
    var tf = terr.getAttribute("transform");
    if (tf) o.setAttribute("transform", tf);
    o.setAttribute("class", "bse-bad-overlay");
    svg.appendChild(o);
  }

  function apply(bad) {
    clearHighlights();
    var enabled = document.documentElement.getAttribute("data-bse-board") !== "0";
    if (!enabled) return;
    bad.forEach(highlight);
  }

  var lastOrders = "", lastEnabled = null;

  function tick() {
    var enabled = document.documentElement.getAttribute("data-bse-board") !== "0";
    var snap = "";
    try { snap = JSON.stringify(window.orders || {}); } catch (e) { snap = ""; }
    if (snap === lastOrders && enabled === lastEnabled) return;
    lastOrders = snap;
    lastEnabled = enabled;
    apply(scan());
  }

  tick();
  setInterval(tick, 700);

  new MutationObserver(tick).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-bse-board"]
  });
})();
