(function () {
  "use strict";

  if (window.__bseDrafts) return;
  window.__bseDrafts = true;

  var bar = null;
  var saveBtn = null;
  var loadBtn = null;
  var note = null;
  var styled = false;

  function player() {
    return window.activePlayer || null;
  }

  function usable() {
    return window.stage === "NEEDS_ORDERS" && !!player();
  }

  function enabled() {
    return document.documentElement.getAttribute("data-bse-drafts") !== "0";
  }

  function turnLabel() {
    var el = document.getElementById("history_current_season");
    var t = el ? el.textContent.replace(/\s+/g, " ").trim() : "";
    return t || String(window.season || "");
  }

  function storeKey() {
    return "bse-draft:" + (window.base_url || location.pathname) + ":" + turnLabel();
  }

  function readDraft() {
    try {
      var raw = localStorage.getItem(storeKey());
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object" || !d.orders) return null;
      if (d.player && d.player !== player()) return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  function myUnits() {
    return ((window.unitsByPlayer || {})[player()]) || {};
  }

  function myOrders() {
    var all = window.orders || {};
    if (!all[player()]) all[player()] = {};
    return all[player()];
  }

  function unitTypeAt(ter) {
    var u = window.unitsByPlayer || {};
    for (var p in u) {
      if (u[p] && u[p][ter] != null) return u[p][ter];
    }
    return null;
  }

  function buildFullOrder(ter, order) {
    var x = { player: player(), unitTerritory: ter };
    var t = unitTypeAt(ter);
    if (t) {
      x.type = t;
      if (t.coast) {
        x.unitType = t.type;
        x.unitCoast = t.coast;
      } else {
        x.unitType = t;
      }
    }
    if (!order) return x;

    x.orderType = order.type;
    if (order.type === "MOVE") {
      x.moveTarget = order.to;
      if (order.to_coast) x.moveTargetCoast = order.to_coast;
    } else if (order.type === "SUPPORT") {
      x.supportedUnitTerritory = order.from;
      x.supportedType = unitTypeAt(order.from);
      if (x.supportedType && x.supportedType.coast) {
        x.supportedUnitType = x.supportedType.type;
        x.supportedUnitCoast = x.supportedType.coast;
      }
      if (order.to_coast) x.supportedUnitMoveOrderCoast = order.to_coast;
      if (order.to) x.supportedUnitMoveOrder = order.to;
    } else if (order.type === "CONVOY") {
      x.convoyedUnitTerritory = order.from;
      x.convoyedUnitMoveTarget = order.to;
    }
    if (order.result) x.result = order.result;
    if (order.result_reason) x.resultReason = order.result_reason;
    return x;
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function markUnsaved() {
    var btn = document.getElementById("submit_orders_button");
    if (btn) btn.removeAttribute("disabled");
    var icon = document.getElementById("unsubmitted-orders-alert-icon");
    if (icon) icon.classList.remove("d-none");
    var box = document.getElementById("alert");
    if (box && !document.getElementById("unsubmitted-orders-alert")) {
      box.innerHTML +=
        '<p class="text-warning" id="unsubmitted-orders-alert">You have unsaved orders.</p>';
    }
  }

  var ICONS = { save: "fas fa-bookmark", load: "fas fa-rotate-left" };
  var SPINNER = "fa fa-spinner fa-spin";
  var DONE = "fas fa-check-circle text-success";
  var FAILED = "fas fa-exclamation-circle text-danger";
  var SETTLE_MS = 260;
  var RESET_MS = 2000;
  var timers = {};

  function setIcon(btn, cls) {
    var i = btn.querySelector("i");
    if (!i) {
      i = document.createElement("i");
      btn.insertBefore(i, btn.firstChild);
    }
    i.className = cls;
  }

  function run(btn, key, work) {
    if (timers[key]) {
      clearTimeout(timers[key]);
      timers[key] = null;
    }
    var ok;
    try {
      ok = work() !== false;
    } catch (e) {
      ok = false;
    }
    setIcon(btn, SPINNER);
    btn.disabled = true;
    timers[key] = setTimeout(function () {
      setIcon(btn, ok ? DONE : FAILED);
      btn.disabled = false;
      refresh();
      timers[key] = setTimeout(function () {
        setIcon(btn, ICONS[key]);
        timers[key] = null;
      }, RESET_MS);
    }, SETTLE_MS);
  }

  function saveDraft() {
    if (!usable()) return false;
    var data = {
      turn: turnLabel(),
      player: player(),
      savedAt: Date.now(),
      units: Object.keys(myUnits()).sort(),
      orders: clone(myOrders())
    };
    try {
      localStorage.setItem(storeKey(), JSON.stringify(data));
    } catch (e) {
      say("Couldn't save the draft (storage full?).", true);
      return false;
    }
    var n = Object.keys(data.orders).length;
    say("Draft saved - " + n + " order" + (n === 1 ? "" : "s") + " at " + clock(data.savedAt) + ".");
    refresh();
    return true;
  }

  function loadDraft() {
    if (!usable()) return false;
    var data = readDraft();
    if (!data) return false;
    if (!window.__BSE || !window.__BSE.ready()) {
      say("Can't redraw the board - reload the page and try again.", true);
      return false;
    }

    var units = myUnits();
    var current = myOrders();
    var touched = {};
    var next = {};
    var skipped = 0;

    Object.keys(current).forEach(function (t) { touched[t] = 1; });
    Object.keys(data.orders).forEach(function (t) {
      if (!(t in units)) { skipped++; return; }
      next[t] = clone(data.orders[t]);
      touched[t] = 1;
    });

    Object.keys(current).forEach(function (t) { delete current[t]; });
    Object.keys(next).forEach(function (t) { current[t] = next[t]; });

    Object.keys(touched).forEach(function (t) {
      var o = current[t];
      window.__BSE.drawOrder(t, o || undefined, buildFullOrder(t, o));
    });

    var input = document.getElementById("input_orders");
    if (input) input.value = JSON.stringify(window.orders || {});
    markUnsaved();

    var n = Object.keys(next).length;
    var msg = "Draft loaded - " + n + " order" + (n === 1 ? "" : "s") + " restored.";
    if (skipped) msg += " " + skipped + " skipped (unit no longer there).";
    msg += " Press Update Orders to keep it.";
    say(msg, false);
    return true;
  }

  function clock(ts) {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function say(text, bad) {
    if (!note) return;
    note.textContent = text || "";
    note.className = "bse-draft-note" + (bad ? " bse-draft-bad" : "");
  }

  function refresh() {
    if (!bar) return;
    var on = enabled();
    bar.style.display = on ? "" : "none";
    if (!on) return;
    styleButtons();
    var d = readDraft();
    loadBtn.disabled = !d;
    if (!note.textContent || !d) {
      say(d
        ? "Draft from " + clock(d.savedAt) + " (" + Object.keys(d.orders).length + " orders)."
        : "No draft saved for " + turnLabel() + " yet.");
    }
  }

  function injectStyle() {
    if (styled) return;
    styled = true;
    var s = document.createElement("style");
    s.setAttribute("data-bse", "drafts.js");
    s.textContent = [
      ".bse-draft-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 4px;}",
      ".bse-draft-note{flex:1 1 100%;font-size:.78em;opacity:.75;line-height:1.3;}",
      ".bse-draft-note.bse-draft-bad{color:#e06c6c;opacity:1;}"
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  var LAYOUT_CLASS = /^(w-|h-|d-|float-|col-|col$|row$|m-|mt-|mb-|ms-|me-|mx-|my-|position-|top-|bottom-|start-|end-)/;

  function submitClasses() {
    var b = document.getElementById("submit_orders_button");
    var raw = b ? String(b.className || "").split(/\s+/) : [];
    var keep = raw.filter(function (c) { return c && !LAYOUT_CLASS.test(c); });
    if (keep.indexOf("btn") < 0) return "btn btn-primary";
    return keep.join(" ");
  }

  function styleButtons() {
    if (!saveBtn) return;
    var cls = submitClasses();
    saveBtn.className = cls + " bse-draft-btn";
    loadBtn.className = cls + " bse-draft-btn";
  }

  function mount() {
    if (bar) return true;
    var host = document.getElementById("orders_prompt");
    if (!host) return false;
    injectStyle();

    bar = document.createElement("div");
    bar.className = "bse-draft-bar";

    saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.innerHTML = '<i class="' + ICONS.save + '"></i> Save Draft';
    saveBtn.title = "Remember the orders currently on the board, in this browser only";
    saveBtn.addEventListener("click", function () { run(saveBtn, "save", saveDraft); });

    loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.innerHTML = '<i class="' + ICONS.load + '"></i> Load Draft';
    loadBtn.title = "Put the saved orders back on the board";
    loadBtn.addEventListener("click", function () { run(loadBtn, "load", loadDraft); });

    styleButtons();

    note = document.createElement("div");
    note.className = "bse-draft-note";

    bar.appendChild(saveBtn);
    bar.appendChild(loadBtn);
    bar.appendChild(note);
    host.appendChild(bar);
    return true;
  }

  var tries = 0;

  function tick() {
    if (!usable()) return;
    if (mount()) {
      refresh();
      return;
    }
    if (tries++ < 40) setTimeout(tick, 200);
  }

  try {
    new MutationObserver(function () { refresh(); }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bse-drafts"]
    });
  } catch (e) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(tick, 0); });
  } else {
    setTimeout(tick, 0);
  }
})();
