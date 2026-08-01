(function () {
  "use strict";

  if (window.chrome && window.chrome.storage && window.chrome.storage.sync) return;

  var PREFIX = "bse:";
  var listeners = [];

  function keyFor(area, k) { return PREFIX + area + ":" + k; }

  function readOne(area, k) {
    try {
      var raw = localStorage.getItem(keyFor(area, k));
      return raw === null ? undefined : JSON.parse(raw);
    } catch (e) { return undefined; }
  }

  function writeOne(area, k, v) {
    try { localStorage.setItem(keyFor(area, k), JSON.stringify(v)); } catch (e) {}
  }

  function fireChanges(changes, area) {
    setTimeout(function () {
      listeners.forEach(function (fn) { try { fn(changes, area); } catch (e) {} });
    }, 0);
  }

  function makeArea(area) {
    return {
      get: function (query, cb) {
        if (typeof query === "function") { cb = query; query = null; }
        var out = {};
        if (query == null) {
          var p = PREFIX + area + ":";
          try {
            for (var i = 0; i < localStorage.length; i++) {
              var full = localStorage.key(i);
              if (full && full.indexOf(p) === 0) {
                var k = full.slice(p.length);
                out[k] = readOne(area, k);
              }
            }
          } catch (e) {}
        } else if (Array.isArray(query)) {
          query.forEach(function (k) {
            var v = readOne(area, k);
            if (v !== undefined) out[k] = v;
          });
        } else if (typeof query === "string") {
          var v = readOne(area, query);
          if (v !== undefined) out[query] = v;
        } else {
          Object.keys(query).forEach(function (k) {
            var v = readOne(area, k);
            out[k] = (v === undefined) ? query[k] : v;
          });
        }
        if (cb) setTimeout(function () { cb(out); }, 0);
      },

      set: function (obj, cb) {
        var changes = {};
        Object.keys(obj).forEach(function (k) {
          var oldValue = readOne(area, k);
          writeOne(area, k, obj[k]);
          changes[k] = { oldValue: oldValue, newValue: obj[k] };
        });
        if (cb) setTimeout(cb, 0);
        fireChanges(changes, area);
      },

      remove: function (keys, cb) {
        var arr = Array.isArray(keys) ? keys : [keys];
        var changes = {};
        arr.forEach(function (k) {
          var oldValue = readOne(area, k);
          try { localStorage.removeItem(keyFor(area, k)); } catch (e) {}
          changes[k] = { oldValue: oldValue, newValue: undefined };
        });
        if (cb) setTimeout(cb, 0);
        fireChanges(changes, area);
      },

      clear: function (cb) {
        var p = PREFIX + area + ":";
        var doomed = [];
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var full = localStorage.key(i);
            if (full && full.indexOf(p) === 0) doomed.push(full);
          }
          doomed.forEach(function (f) { localStorage.removeItem(f); });
        } catch (e) {}
        if (cb) setTimeout(cb, 0);
      }
    };
  }

  var storage = {
    sync: makeArea("sync"),
    local: makeArea("local"),
    onChanged: {
      addListener: function (fn) { if (typeof fn === "function") listeners.push(fn); },
      removeListener: function (fn) {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      },
      hasListener: function (fn) { return listeners.indexOf(fn) >= 0; }
    }
  };

  var runtime = {
    id: "backstabbr-extras-android",
    getManifest: function () { return { version: "__BSE_VERSION__" }; },
    getURL: function (p) { return p; },
    onMessage: { addListener: function () {}, removeListener: function () {} },
    sendMessage: function () {},
    lastError: null
  };

  window.chrome = window.chrome || {};
  window.chrome.storage = storage;
  window.chrome.runtime = runtime;
})();
