(function () {
  "use strict";

  var gameId = (location.pathname.match(/\/game\/[^/]+\/(\d+)/) || [])[1];
  if (!gameId) return;
  var KEY = "bse_press_" + gameId;

  var state = { personalNotes: "", pinned: [], threadNotes: {} };
  var enabled = true;
  var currentThread = null;

  function persist() {
    try { var o = {}; o[KEY] = state; chrome.storage.local.set(o); } catch (e) {}
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms || 300); };
  }

  function threadIdOf(a) { return (a.id || "").replace(/^thread_/, ""); }

  function icon(cls) { return el("i", { class: cls }); }

  function injectPersonalNotes(container) {
    if (container.querySelector("#bse-personal-notes")) return;

    var editor = el("div", { class: "bse-notes-editor", id: "bse-pn-editor" });
    var ta = el("textarea", {
      class: "form-control bse-notes-ta",
      rows: "5",
      placeholder: "Private notes for this game — only you can see these."
    });
    ta.value = state.personalNotes || "";
    ta.addEventListener("input", debounce(function () {
      state.personalNotes = ta.value; persist();
    }, 300));
    editor.appendChild(ta);

    var item = el("a", {
      href: "#", id: "bse-personal-notes",
      class: "list-group-item list-group-item-action d-flex bse-press-item"
    }, [
      el("span", null, [icon("fas fa-book me-2"), document.createTextNode("Personal Notes")]),
      el("span", { class: "ms-auto bse-chevron" }, [icon("fas fa-chevron-down")])
    ]);
    item.addEventListener("click", function (e) {
      e.preventDefault();
      var open = editor.classList.toggle("bse-open");
      item.classList.toggle("bse-open", open);
      if (open) ta.focus();
    });

    container.insertBefore(editor, container.firstChild);
    container.insertBefore(item, container.firstChild);
  }

  function decoratePins(container) {
    var headers = container.querySelectorAll(".press-thread-header");
    headers.forEach(function (a) {
      if (a.querySelector(".bse-pin")) return;
      var tid = threadIdOf(a);
      var pin = el("button", {
        type: "button", class: "bse-pin", title: "Pin this chat",
        "aria-label": "Pin this chat"
      }, [icon("fas fa-thumbtack")]);
      if (state.pinned.indexOf(tid) >= 0) pin.classList.add("bse-pinned");
      pin.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        togglePin(tid, container);
      });
      a.insertBefore(pin, a.firstChild);
    });
  }

  function togglePin(tid, container) {
    var i = state.pinned.indexOf(tid);
    if (i >= 0) state.pinned.splice(i, 1);
    else state.pinned.push(tid);
    persist();
    container.querySelectorAll(".press-thread-header").forEach(function (a) {
      var pin = a.querySelector(".bse-pin");
      if (pin) pin.classList.toggle("bse-pinned", state.pinned.indexOf(threadIdOf(a)) >= 0);
    });
    reorder(container);
  }

  function reorder(container) {
    var anchor = container.querySelector("#bse-pn-editor") ||
                 container.querySelector("#bse-personal-notes");
    state.pinned.slice().reverse().forEach(function (tid) {
      var a = container.querySelector("#thread_" + tid);
      if (!a) return;
      if (anchor) container.insertBefore(a, anchor.nextSibling);
      else container.insertBefore(a, container.firstChild);
    });
  }

  function injectThreadNotes() {
    var threads = document.querySelector("#press-threads");
    if (!threads || threads.querySelector("#bse-thread-notes")) return;

    var box = el("div", { id: "bse-thread-notes", class: "card bse-thread-notes" });
    var head = el("div", { class: "card-header bse-tn-head" }, [
      icon("fas fa-user-pen me-2"), document.createTextNode("Your notes on this chat")
    ]);
    var body = el("div", { class: "card-body p-2" });
    var ta = el("textarea", {
      class: "form-control bse-notes-ta", rows: "3",
      placeholder: "Private notes about this conversation / player…"
    });
    ta.addEventListener("input", debounce(function () {
      if (currentThread) { state.threadNotes[currentThread] = ta.value; persist(); }
    }, 300));
    body.appendChild(ta);
    box.appendChild(head);
    box.appendChild(body);

    var msgs = threads.querySelector("#press-messages");
    if (msgs) threads.insertBefore(box, msgs);
    else threads.appendChild(box);
  }

  function loadThreadNotes(tid) {
    currentThread = tid;
    var ta = document.querySelector("#bse-thread-notes .bse-notes-ta");
    if (ta) ta.value = state.threadNotes[tid] || "";
  }

  function wireHeaderClicks(container) {
    if (container.__bseWired) return;
    container.__bseWired = true;
    container.addEventListener("click", function (e) {
      if (e.target.closest(".bse-pin")) return;
      var a = e.target.closest(".press-thread-header");
      if (a) loadThreadNotes(threadIdOf(a));
    });
  }

  function apply() {
    if (!enabled) { removeAll(); return; }
    var mh = document.querySelector("#message_headers");
    if (mh) {
      injectPersonalNotes(mh);
      decoratePins(mh);
      reorder(mh);
      wireHeaderClicks(mh);
    }
    injectThreadNotes();
  }

  function removeAll() {
    ["#bse-personal-notes", "#bse-pn-editor", "#bse-thread-notes"].forEach(function (s) {
      var n = document.querySelector(s);
      if (n) n.remove();
    });
    document.querySelectorAll(".bse-pin").forEach(function (n) { n.remove(); });
  }

  var run = debounce(apply, 200);
  var target = document.getElementById("press") || document.body;
  new MutationObserver(run).observe(target, { childList: true, subtree: true });

  try {
    chrome.storage.local.get([KEY], function (r) {
      if (r && r[KEY]) {
        state.personalNotes = r[KEY].personalNotes || "";
        state.pinned = Array.isArray(r[KEY].pinned) ? r[KEY].pinned : [];
        state.threadNotes = r[KEY].threadNotes || {};
      }
      chrome.storage.sync.get({ pressNotes: true }, function (cfg) {
        enabled = cfg.pressNotes !== false;
        apply();
      });
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "sync" && changes.pressNotes) {
        enabled = changes.pressNotes.newValue !== false;
        apply();
      }
    });
  } catch (e) {
    apply();
  }
})();
