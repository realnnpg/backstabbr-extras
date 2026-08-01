(function () {
  "use strict";

  if (window.__bseMobileLayout) return;
  window.__bseMobileLayout = true;

  var SKIP_CLOSEST = "#map, #bse-overlay-host, .table-responsive, .bse-xscroll, .modal, .navbar";

  var CSS = [
    ".bse-xscroll{max-width:100%;overflow-x:auto;overflow-y:hidden;",
    "-webkit-overflow-scrolling:touch;}",
    ".bse-xscroll>table{min-width:100%;margin-bottom:0;}",

    ".bse-xclip{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;}",

    ".btn-toolbar,.nav,.navbar-nav,.card-header-tabs{flex-wrap:wrap;}",
    ".btn{white-space:normal;}",

    ".btn-group,.btn-group-sm,.btn-group-lg{flex-wrap:nowrap;}",

    "@media (max-width:640px){",
    ".container,.container-fluid,.container-sm,.container-md,.container-lg,",
    ".container-xl{max-width:100%;padding-left:.5rem;padding-right:.5rem;}",
    ".card-body{padding-left:.5rem;padding-right:.5rem;}",

    "table.table,table.playerlist{font-size:12px;}",
    "table.table>:not(caption)>*>*{padding:.3rem .35rem;}",
    "table.playerlist td,table.playerlist th{padding:2px 4px;}",

    ".btn-group>.btn,.order-buttons .btn{padding-left:.4rem;padding-right:.4rem;",
    "font-size:12px;}",

    "table.table th,table.table td{white-space:normal !important;}",
    "table.table a,table.table code{overflow-wrap:anywhere;}",
    "}"
  ].join("");

  function injectStyle() {
    if (document.querySelector('style[data-bse="mobile.js"]')) return;
    var head = document.head || document.documentElement;
    if (!head) return;
    var s = document.createElement("style");
    s.setAttribute("data-bse", "mobile.js");
    s.textContent = CSS;
    head.appendChild(s);
  }

  function skip(node) {
    return !!(node.closest && node.closest(SKIP_CLOSEST));
  }

  function wrapTables() {
    var tables = document.getElementsByTagName("table");
    var todo = [];
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      var parent = t.parentNode;
      if (!parent || parent.nodeType !== 1) continue;
      if (skip(t)) continue;
      todo.push(t);
    }
    todo.forEach(function (t) {
      var box = document.createElement("div");
      box.className = "bse-xscroll";
      t.parentNode.insertBefore(box, t);
      box.appendChild(t);
    });
    return todo.length;
  }

  function tameOverflow() {
    var docEl = document.documentElement;
    if (docEl.scrollWidth <= docEl.clientWidth + 1) return;
    if (!document.body) return;

    var nodes = document.body.querySelectorAll("div,section,ul,ol,form,fieldset,pre");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.classList.contains("bse-xclip") || n.classList.contains("bse-xscroll")) continue;
      if (skip(n)) continue;
      var cw = n.clientWidth;
      if (!cw) continue;
      var kids = n.children;
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].getBoundingClientRect().width > cw + 1) {
          n.classList.add("bse-xclip");
          break;
        }
      }
    }
  }

  var pending = null;

  function schedule() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = null;
      injectStyle();
      wrapTables();
      tameOverflow();
    }, 120);
  }

  injectStyle();
  schedule();

  [0, 400, 1200, 2500].forEach(function (ms) { setTimeout(schedule, ms); });
  ["load", "resize", "orientationchange"].forEach(function (ev) {
    window.addEventListener(ev, schedule);
  });
  ["click", "transitionend", "shown.bs.collapse", "hidden.bs.collapse"].forEach(function (ev) {
    document.addEventListener(ev, schedule, true);
  });

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (e) {}
})();
