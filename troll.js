(function () {
  "use strict";

  var active = false;
  var layer = null;
  var daggers = [];
  var targets = [];
  var raf = null;
  var mouse = { x: -999, y: -999 };
  var score = 0;
  var badge = null;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }

  function makeLayer() {
    layer = document.createElement("div");
    layer.id = "bse-troll-layer";
    layer.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden";
    document.body.appendChild(layer);
    badge = document.createElement("div");
    badge.id = "bse-troll-badge";
    badge.style.cssText = "position:fixed;top:64px;right:14px;z-index:2147483001;pointer-events:none;" +
      "background:#000;color:#0f0;font:700 15px/1 'Comic Sans MS',cursive;padding:8px 12px;border-radius:10px;" +
      "border:3px solid #ff00cc;box-shadow:0 0 14px #00e5ff;transform:rotate(-4deg)";
    updateBadge();
    document.body.appendChild(badge);
  }

  function updateBadge() {
    if (badge) badge.textContent = "🗡️ caught: " + score;
  }

  function spawnDagger() {
    var e = document.createElement("div");
    var glyphs = ["🗡️", "⚔️", "🔪", "💀", "🩸"];
    e.textContent = glyphs[Math.floor(rand(0, glyphs.length))];
    e.style.cssText = "position:absolute;font-size:" + rand(20, 46) + "px;will-change:transform;filter:drop-shadow(0 0 4px #000)";
    layer.appendChild(e);
    daggers.push({ el: e, x: rand(0, vw()), y: rand(0, vh()), vx: rand(-2.2, 2.2) || 1.4, vy: rand(-2.2, 2.2) || 1.2, r: rand(0, 360), vr: rand(-4, 4) });
  }

  function spawnTarget() {
    var e = document.createElement("button");
    e.type = "button";
    e.className = "bse-troll-target";
    e.textContent = "🗡️";
    e.style.cssText = "position:absolute;pointer-events:auto;cursor:pointer;border:none;border-radius:50%;" +
      "width:44px;height:44px;font-size:22px;background:radial-gradient(circle at 30% 30%,#fff,#ff00cc);" +
      "box-shadow:0 0 12px #00e5ff;transition:transform .05s";
    var t = { el: e, x: rand(40, vw() - 80), y: rand(80, vh() - 80), vx: rand(-1, 1), vy: rand(-1, 1) };
    e.addEventListener("click", function (ev) {
      ev.stopPropagation();
      score++;
      updateBadge();
      confetti(t.x + 22, t.y + 22);
      t.x = rand(40, vw() - 80);
      t.y = rand(80, vh() - 80);
    });
    layer.appendChild(e);
    targets.push(t);
  }

  function confetti(x, y) {
    var cols = ["#ff00cc", "#00e5ff", "#00ffa2", "#ffe600", "#ff6a00", "#a259ff"];
    for (var i = 0; i < 16; i++) {
      var p = document.createElement("div");
      p.style.cssText = "position:absolute;width:8px;height:8px;border-radius:2px;left:" + x + "px;top:" + y + "px;" +
        "background:" + cols[Math.floor(rand(0, cols.length))] + ";will-change:transform,opacity";
      layer.appendChild(p);
      (function (p) {
        var ang = rand(0, Math.PI * 2), sp = rand(3, 9), dx = Math.cos(ang) * sp, dy = Math.sin(ang) * sp, life = 0;
        function step() {
          life += 1;
          dy += 0.35;
          var cx = parseFloat(p.style.left) + dx, cy = parseFloat(p.style.top) + dy;
          p.style.left = cx + "px";
          p.style.top = cy + "px";
          p.style.opacity = String(1 - life / 40);
          p.style.transform = "rotate(" + (life * 20) + "deg)";
          if (life < 40) requestAnimationFrame(step); else p.remove();
        }
        requestAnimationFrame(step);
      })(p);
    }
  }

  function tick() {
    if (!active) return;
    var W = vw(), H = vh();
    daggers.forEach(function (d) {
      d.x += d.vx; d.y += d.vy; d.r += d.vr;
      if (d.x < -40) d.x = W + 40; if (d.x > W + 40) d.x = -40;
      if (d.y < -40) d.y = H + 40; if (d.y > H + 40) d.y = -40;
      d.el.style.transform = "translate(" + d.x + "px," + d.y + "px) rotate(" + d.r + "deg)";
    });
    targets.forEach(function (t) {
      var dx = t.x + 22 - mouse.x, dy = t.y + 22 - mouse.y, dist = Math.hypot(dx, dy);
      if (dist < 120 && dist > 0.1) {
        var push = (120 - dist) / 120 * 9;
        t.x += (dx / dist) * push;
        t.y += (dy / dist) * push;
      }
      t.x += t.vx; t.y += t.vy;
      if (t.x < 10) { t.x = 10; t.vx = Math.abs(t.vx); }
      if (t.x > W - 54) { t.x = W - 54; t.vx = -Math.abs(t.vx); }
      if (t.y < 60) { t.y = 60; t.vy = Math.abs(t.vy); }
      if (t.y > H - 54) { t.y = H - 54; t.vy = -Math.abs(t.vy); }
      t.el.style.transform = "translate(" + t.x + "px," + t.y + "px)";
    });
    raf = requestAnimationFrame(tick);
  }

  function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }

  function start() {
    if (active) return;
    active = true;
    score = 0;
    makeLayer();
    for (var i = 0; i < 10; i++) spawnDagger();
    for (var j = 0; j < 5; j++) spawnTarget();
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    window.removeEventListener("mousemove", onMove);
    if (layer) layer.remove();
    if (badge) badge.remove();
    layer = null; badge = null; daggers = []; targets = [];
  }

  function reflect(theme) {
    if (theme === "troll") start(); else stop();
  }

  try {
    chrome.storage.sync.get({ theme: "default" }, function (cfg) { reflect(cfg.theme); });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === "sync" && ch.theme) reflect(ch.theme.newValue);
    });
  } catch (e) {}
})();
