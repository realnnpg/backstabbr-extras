(function () {
  "use strict";

  var base = null, gameName = "game", gameId = null, isSandbox = false;
  var enabled = true, iconsOn = false, injected = false, loaded = false, loading = false;
  var HISTORY = null;

  var POWERS = ["Austria", "England", "France", "Germany", "Italy", "Russia", "Turkey"];
  var COLORS = {
    Austria: "#d43a3a", England: "#2456a0", France: "#12b6d4", Germany: "#111111",
    Italy: "#2e8b57", Russia: "#8a8a8a", Turkey: "#e2c541"
  };
  var SEASONS = ["spring", "fall", "winter"];

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function swatch(power) {
    return el("span", { class: "bse-st-sq", style: "background:" + (COLORS[power] || "#999") });
  }
  function parseVar(html, name) {
    var m = html.match(new RegExp("var\\s+" + name + "\\s*=\\s*(\\{[\\s\\S]*?\\});"));
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  }
  function scOf(terr) {
    var c = {}; POWERS.forEach(function (p) { c[p] = 0; });
    if (terr) Object.keys(terr).forEach(function (prov) { var o = terr[prov]; if (c[o] != null) c[o]++; });
    var owned = POWERS.reduce(function (a, p) { return a + c[p]; }, 0);
    c.Neutrals = 34 - owned;
    return c;
  }

  function curPhase() {
    var el = document.getElementById("map-season");
    var t = (el && el.textContent) || document.body.textContent || "";
    var m = t.match(/(spring|summer|fall|autumn|winter)\s+(\d{4})/i);
    if (m) return { season: m[1].toLowerCase(), year: parseInt(m[2], 10) };
    return { season: window.season || "fall", year: 1901 };
  }

  function phaseOf(html) {
    var sk = (html.match(/name="state_key"\s+value="([^"]+)"/) || [])[1];
    if (!sk) return null;
    var dec = "";
    try { dec = atob(sk.replace(/-/g, "+").replace(/_/g, "/")); } catch (e) { return null; }
    var m = dec.match(/(spring|summer|fall|autumn|winter)\/(\d{4})/i);
    return m ? { season: m[1].toLowerCase(), year: parseInt(m[2], 10) } : null;
  }

  var CACHE_KEY = null;

  function loadCache() {
    return new Promise(function (res) {
      try {
        chrome.storage.local.get([CACHE_KEY], function (r) {
          var v = r && r[CACHE_KEY];
          res(v && v.phases ? v.phases : {});
        });
      } catch (e) { res({}); }
    });
  }
  function saveCache(phases, curKey) {
    try {
      var store = {};
      phases.forEach(function (p) {
        var k = p.year + "/" + p.season;
        if (k !== curKey) store[k] = p;
      });
      var o = {}; o[CACHE_KEY] = { v: 1, phases: store };
      chrome.storage.local.set(o);
    } catch (e) {}
  }

  async function fetchHistory(onProgress, force) {
    if (HISTORY && !force) return HISTORY;
    var cp = curPhase(), cy = cp.year, cs = cp.season;
    var startYear = 1901;
    var curKey = cy + "/" + cs;
    CACHE_KEY = "bse_stats_" + (isSandbox ? "sb_" : "") + (gameId || base);

    var jobs = [];
    for (var y = startYear; y <= cy; y++) {
      SEASONS.forEach(function (s) { jobs.push({ year: y, season: s }); });
    }
    var cached = force ? {} : await loadCache();
    var done = 0, total = jobs.length;
    if (onProgress) onProgress(0, total);
    var phases = await Promise.all(jobs.map(async function (job) {
      var key = job.year + "/" + job.season;
      if (key !== curKey && cached[key]) {
        done++; if (onProgress) onProgress(done, total);
        return cached[key];
      }
      var html = await fetch(base + "/" + job.year + "/" + job.season).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; });
      done++; if (onProgress) onProgress(done, total);
      var ph = phaseOf(html);

      if (!ph || ph.year !== job.year || ph.season !== job.season) return null;
      return {
        year: job.year, season: job.season,
        territories: parseVar(html, "territories"),
        unitsByPlayer: parseVar(html, "unitsByPlayer"),
        orders: parseVar(html, "orders")
      };
    }));
    phases = phases.filter(Boolean);
    saveCache(phases, curKey);

    var validYears = [];
    phases.forEach(function (p) { if (validYears.indexOf(p.year) < 0) validYears.push(p.year); });
    validYears.sort(function (a, b) { return a - b; });
    if (!validYears.length) validYears = [cy];

    var scByYear = {};
    validYears.forEach(function (y) {
      var yphases = phases.filter(function (p) { return p.year === y; });
      var pick = yphases.filter(function (p) { return p.season === "winter"; })[0] ||
                 phases.filter(function (p) { return p.year === y + 1 && p.season === "spring"; })[0] ||
                 yphases[yphases.length - 1];
      if (pick) scByYear[y] = scOf(pick.territories);
    });

    HISTORY = {
      meta: { name: gameName, id: gameId, base: base, startYear: validYears[0] || startYear, currentYear: cy, currentSeason: cs, powers: POWERS },
      years: validYears, scByYear: scByYear, phases: phases
    };
    return HISTORY;
  }

  function peakSC(hist) {
    var top = 0;
    (hist.years || []).forEach(function (y) {
      var sc = hist.scByYear[y] || {};
      POWERS.forEach(function (p) { top = Math.max(top, sc[p] || 0); });
    });
    return top;
  }

  function chartMax(hist) {
    var top = peakSC(hist);
    var m = Math.ceil((top + 1) / 2) * 2;
    if (m < 6) m = 6;
    if (top <= 18 && m > 18) m = 18;
    return m;
  }

  function gridStep(maxSC) { return maxSC > 20 ? 4 : 2; }

  function buildChart(hist) {
    var W = 640, H = 340, pad = { l: 34, r: 12, t: 12, b: 26 };
    var years = hist.years;
    var maxSC = chartMax(hist);
    var x = function (i) { return pad.l + (years.length <= 1 ? 0 : i * (W - pad.l - pad.r) / (years.length - 1)); };
    var yv = function (v) { return H - pad.b - v * (H - pad.t - pad.b) / maxSC; };
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "bse-st-chart");
    function line(x1, y1, x2, y2, cls) { var l = document.createElementNS(NS, "line"); l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); l.setAttribute("class", cls); svg.appendChild(l); }
    function txt(xx, yy, s, cls) { var t = document.createElementNS(NS, "text"); t.setAttribute("x", xx); t.setAttribute("y", yy); t.setAttribute("class", cls); t.textContent = s; svg.appendChild(t); }

    var step = gridStep(maxSC);
    for (var v = 0; v <= maxSC; v += step) { line(pad.l, yv(v), W - pad.r, yv(v), "bse-st-grid"); txt(pad.l - 6, yv(v) + 3, String(v), "bse-st-axis bse-st-axis-y"); }

    years.forEach(function (y, i) { txt(x(i), H - pad.b + 15, String(y), "bse-st-axis bse-st-axis-x"); });

    POWERS.forEach(function (p) {
      var pts = years.map(function (y, i) { return x(i) + "," + yv(hist.scByYear[y] ? hist.scByYear[y][p] : 0); }).join(" ");
      var pl = document.createElementNS(NS, "polyline");
      pl.setAttribute("points", pts);
      pl.setAttribute("fill", "none");
      pl.setAttribute("stroke", COLORS[p]);
      pl.setAttribute("stroke-width", "2.5");
      pl.setAttribute("stroke-linejoin", "round");
      svg.appendChild(pl);
    });
    svg.__geo = { W: W, H: H, pad: pad, years: years, maxSC: maxSC, x: x, yv: yv };
    return svg;
  }

  function buildChartBlock(hist) {
    var svg = buildChart(hist);
    var g = svg.__geo;
    var NS = "http://www.w3.org/2000/svg";
    var wrap = el("div", { class: "bse-st-chartwrap" }, [svg]);
    var tip = el("div", { class: "bse-st-tip" });
    wrap.appendChild(tip);

    var guide = document.createElementNS(NS, "line");
    guide.setAttribute("class", "bse-st-guide");
    guide.setAttribute("y1", g.pad.t); guide.setAttribute("y2", g.H - g.pad.b);
    guide.style.display = "none";
    svg.appendChild(guide);
    var dots = POWERS.map(function (p) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("r", "3.5"); c.setAttribute("fill", COLORS[p]);
      c.setAttribute("stroke", "rgba(0,0,0,.4)"); c.setAttribute("stroke-width", "1");
      c.style.display = "none";
      svg.appendChild(c);
      return c;
    });

    function hide() {
      guide.style.display = "none";
      dots.forEach(function (d) { d.style.display = "none"; });
      tip.classList.remove("bse-open");
    }

    function move(ev) {
      if (!g.years.length) return;
      var r = svg.getBoundingClientRect();
      if (!r.width) return;
      var vx = (ev.clientX - r.left) * (g.W / r.width);

      var i = 0, best = Infinity;
      g.years.forEach(function (y, idx) { var d = Math.abs(g.x(idx) - vx); if (d < best) { best = d; i = idx; } });
      var year = g.years[i], sc = hist.scByYear[year] || {};

      guide.setAttribute("x1", g.x(i)); guide.setAttribute("x2", g.x(i));
      guide.style.display = "";
      POWERS.forEach(function (p, n) {
        dots[n].setAttribute("cx", g.x(i));
        dots[n].setAttribute("cy", g.yv(sc[p] || 0));
        dots[n].style.display = "";
      });

      tip.textContent = "";
      tip.appendChild(el("div", { class: "bse-st-tip-yr", text: String(year) }));
      POWERS.slice().sort(function (a, b) { return (sc[b] || 0) - (sc[a] || 0); }).forEach(function (p) {
        tip.appendChild(el("div", { class: "bse-st-tip-row" }, [
          swatch(p), document.createTextNode(" " + p + " "), el("b", { text: String(sc[p] || 0) })
        ]));
      });
      tip.classList.add("bse-open");

      var leftPx = (g.x(i) / g.W) * r.width;
      tip.style.left = (leftPx > r.width / 2 ? leftPx - tip.offsetWidth - 12 : leftPx + 12) + "px";
      tip.style.top = "8px";
    }

    svg.addEventListener("mousemove", move);
    svg.addEventListener("mouseleave", hide);
    return wrap;
  }

  function playerNames() {
    var res = document.getElementById("results");
    if (!res) return {};
    var map = {};
    res.querySelectorAll("tr").forEach(function (tr) {
      var ic = tr.querySelector(".country-icon");
      var a = tr.querySelector('a[href*="/member/"]');
      if (!ic || !a) return;
      var power = Array.prototype.slice.call(ic.classList).find(function (c) { return c !== "country-icon"; });
      if (power) map[power] = a.textContent.trim();
    });
    return map;
  }

  function buildTable(hist) {

    var head = el("tr", null, [el("th", { text: "Year" })].concat(
      POWERS.map(function (p) { return el("th", null, [swatch(p), document.createTextNode(" " + p)]); })
    ).concat([el("th", { text: "Neut." })]));
    var rows = hist.years.slice().reverse().map(function (y) {
      var sc = hist.scByYear[y] || {};
      return el("tr", null, [el("td", { class: "bse-st-yr", text: String(y) })].concat(
        POWERS.map(function (p) { return el("td", { class: "bse-st-num", text: String(sc[p] || 0) }); })
      ).concat([el("td", { class: "bse-st-num bse-st-neut", text: String(sc.Neutrals != null ? sc.Neutrals : "") })]));
    });
    return el("table", { class: "table table-sm bse-st-table" }, [el("thead", null, [head]), el("tbody", null, rows)]);
  }

  function buildStandings(hist) {
    var cur = hist.scByYear[hist.currentYear] || hist.scByYear[hist.years[hist.years.length - 1]] || {};
    var sorted = POWERS.slice().sort(function (a, b) { return (cur[b] || 0) - (cur[a] || 0); });
    var chips = sorted.map(function (p) {
      return el("span", { class: "bse-st-standing" }, [swatch(p), document.createTextNode(" " + p + " "), el("b", { text: String(cur[p] || 0) })]);
    });
    return el("div", { class: "bse-st-standings" }, chips);
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 100);
  }

  function safeName() { return (gameName || "game").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "game"; }

  function exportHTML(hist) {
    var names = playerNames();
    var esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); };

    var players = POWERS.filter(function (p) { return names[p]; }).map(function (p) {
      return '<li><span class="sq" style="background:' + COLORS[p] + '"></span>' + p + " — " + esc(names[p]) + "</li>";
    }).join("");

    var thead = "<tr><th>Year</th>" + POWERS.map(function (p) {
      return '<th style="background:' + COLORS[p] + ';color:#fff">' + p + "</th>";
    }).join("") + "<th>Neutrals</th></tr>";
    var tbody = hist.years.slice().reverse().map(function (y) {
      var sc = hist.scByYear[y] || {};
      return "<tr><td><b>" + y + "</b></td>" + POWERS.map(function (p) { return "<td>" + (sc[p] || 0) + "</td>"; }).join("") + "<td>" + (sc.Neutrals || 0) + "</td></tr>";
    }).join("");

    var chart = buildChart(hist).outerHTML;

    var log = hist.phases.slice().sort(function (a, b) {
      return a.year - b.year || SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season);
    }).map(function (ph) {
      var body = POWERS.map(function (p) {
        var po = (ph.orders || {})[p]; if (!po) return "";
        var lines = Object.keys(po).map(function (prov) { return orderToText(prov, po[prov]); }).filter(Boolean);
        if (!lines.length) return "";
        return '<div class="pw"><span class="pn" style="color:' + COLORS[p] + '">' + p + "</span><ul>" +
          lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></div>";
      }).join("");
      if (!body) return "";
      return '<section><h3>' + ph.season + " " + ph.year + "</h3>" + body + "</section>";
    }).join("");

    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(hist.meta.name) + ' — Backstabbr export</title>' +
      '<style>body{font-family:system-ui,Arial,sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#1c1c1e}' +
      'h1{font-size:1.4rem}h2{margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:4px}' +
      '.sq{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:6px;vertical-align:-1px}' +
      'ul.players{list-style:none;padding:0}ul.players li{margin:2px 0}' +
      'table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #ccc;padding:3px 8px;text-align:center}td:first-child{text-align:left}' +
      '.bse-st-chart{width:100%;height:auto;background:#fff;border:1px solid #ddd}.bse-st-grid{stroke:#eee}.bse-st-axis{font-size:10px;fill:#555}.bse-st-axis-y{text-anchor:end}.bse-st-axis-x{text-anchor:middle}' +
      'section{margin:10px 0;padding:8px 0;border-bottom:1px solid #eee}section h3{margin:0 0 6px;text-transform:capitalize}.pw{margin:4px 0}.pn{font-weight:700}section ul{margin:2px 0 8px 18px;padding:0}section li{font-size:13px}' +
      '</style></head><body>' +
      "<h1>" + esc(hist.meta.name) + "</h1>" +
      "<p>Supply centres " + hist.meta.startYear + "–" + hist.meta.currentYear + " · exported from Backstabbr Extras</p>" +
      (players ? "<h2>Players</h2><ul class=\"players\">" + players + "</ul>" : "") +
      "<h2>Supply centres over time</h2>" + chart +
      "<h2>Score table</h2><table>" + thead + tbody + "</table>" +
      "<h2>Every order, every turn</h2>" + log +
      "</body></html>";
    download(safeName() + ".backstabbr.html", html, "text/html");
  }

  function orderToText(prov, o) {
    if (!o || !o.type) return null;
    var s = prov + " " + o.type;
    if (o.to) s += " → " + o.to + (o.to_coast ? "/" + o.to_coast : "");
    if (o.from) s += " (from " + o.from + ")";
    if (o.result) s += "  [" + o.result + (o.result_reason ? ": " + o.result_reason : "") + "]";

    if (o.retreat) {
      var r = o.retreat;
      s += "  · retreat " + (typeof r === "object" ? (r.to || JSON.stringify(r)) : r);
    }
    return s;
  }

  function pdfEsc(s) {
    var map = { "→": "->", "—": "-", "–": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "·": "-", "⚔": "", "…": "..." };
    return String(s)
      .replace(/[→—–’‘“”·⚔…]/g, function (c) { return map[c]; })
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
      .replace(/[\\()]/g, "\\$&");
  }
  function hexRGB(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return [0, 0, 0];
    var n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  function textWidth(s, size) { return String(s).length * size * 0.52; }

  function PDFDoc() {
    this.W = 595; this.H = 842; this.M = 40;
    this.pages = []; this.buf = null; this.y = 0;
    this.newPage();
  }
  PDFDoc.prototype.newPage = function () {
    this.buf = []; this.pages.push(this.buf); this.y = this.M;
  };
  PDFDoc.prototype.space = function (h) {
    if (this.y + h > this.H - this.M) { this.newPage(); return true; }
    return false;
  };
  PDFDoc.prototype.text = function (s, x, size, opts) {
    opts = opts || {};
    var c = hexRGB(opts.color || "#000000");
    var font = opts.bold ? "/F2" : "/F1";
    var yy = this.H - (opts.y != null ? opts.y : this.y);
    this.buf.push(fmt(c[0]) + " " + fmt(c[1]) + " " + fmt(c[2]) + " rg");
    this.buf.push("BT " + font + " " + size + " Tf 1 0 0 1 " + fmt(x) + " " + fmt(yy - size) + " Tm (" + pdfEsc(s) + ") Tj ET");
  };
  PDFDoc.prototype.line = function (x1, y1, x2, y2, color, w) {
    var c = hexRGB(color || "#000000");
    this.buf.push(fmt(w || 0.6) + " w " + fmt(c[0]) + " " + fmt(c[1]) + " " + fmt(c[2]) + " RG");
    this.buf.push(fmt(x1) + " " + fmt(this.H - y1) + " m " + fmt(x2) + " " + fmt(this.H - y2) + " l S");
  };
  PDFDoc.prototype.rect = function (x, y, w, h, color) {
    var c = hexRGB(color);
    this.buf.push(fmt(c[0]) + " " + fmt(c[1]) + " " + fmt(c[2]) + " rg");
    this.buf.push(fmt(x) + " " + fmt(this.H - y - h) + " " + fmt(w) + " " + fmt(h) + " re f");
  };
  PDFDoc.prototype.polyline = function (pts, color, w) {
    if (!pts.length) return;
    var c = hexRGB(color);
    this.buf.push(fmt(w || 1.2) + " w " + fmt(c[0]) + " " + fmt(c[1]) + " " + fmt(c[2]) + " RG");
    var self = this;
    var d = pts.map(function (p, i) { return fmt(p[0]) + " " + fmt(self.H - p[1]) + (i ? " l" : " m"); }).join(" ");
    this.buf.push(d + " S");
  };
  PDFDoc.prototype.blob = function () {
    var out = "%PDF-1.4\n", offsets = [];
    var nPages = this.pages.length;
    var add = function (num, body) { offsets[num] = out.length; out += num + " 0 obj\n" + body + "\nendobj\n"; };
    var kids = [];
    for (var i = 0; i < nPages; i++) kids.push((5 + i * 2) + " 0 R");
    add(1, "<</Type/Catalog/Pages 2 0 R>>");
    add(2, "<</Type/Pages/Kids[" + kids.join(" ") + "]/Count " + nPages + ">>");
    add(3, "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>");
    add(4, "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>");
    for (i = 0; i < nPages; i++) {
      var pnum = 5 + i * 2, cnum = pnum + 1;
      add(pnum, "<</Type/Page/Parent 2 0 R/MediaBox[0 0 " + this.W + " " + this.H + "]" +
        "/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents " + cnum + " 0 R>>");
      var stream = this.pages[i].join("\n");
      add(cnum, "<</Length " + stream.length + ">>\nstream\n" + stream + "\nendstream");
    }
    var maxObj = 4 + nPages * 2;
    var xref = out.length;
    out += "xref\n0 " + (maxObj + 1) + "\n0000000000 65535 f \n";
    for (i = 1; i <= maxObj; i++) {
      out += ("0000000000" + offsets[i]).slice(-10) + " 00000 n \n";
    }
    out += "trailer\n<</Size " + (maxObj + 1) + "/Root 1 0 R>>\nstartxref\n" + xref + "\n%%EOF";
    var bytes = new Uint8Array(out.length);
    for (i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: "application/pdf" });
  };

  function exportPDF(hist) {
    var names = playerNames();
    var d = new PDFDoc();
    var L = d.M, RIGHT = d.W - d.M;

    d.text(hist.meta.name || "Backstabbr game", L, 17, { bold: true });
    d.y += 24;
    d.text("Supply centres " + hist.meta.startYear + "-" + hist.meta.currentYear +
      "  ·  exported from Backstabbr Extras", L, 9, { color: "#666666" });
    d.y += 22;

    var known = POWERS.filter(function (p) { return names[p]; });
    if (known.length) {
      d.text("Players", L, 12, { bold: true }); d.y += 16;
      known.forEach(function (p) {
        d.rect(L, d.y + 1, 7, 7, COLORS[p]);
        d.text(p + " — " + names[p], L + 12, 9.5);
        d.y += 13;
      });
      d.y += 10;
    }

    d.text("Supply centres over time", L, 12, { bold: true }); d.y += 16;
    var cx = L, cy = d.y, cw = RIGHT - L, ch = 210;
    var years = hist.years, maxSC = chartMax(hist);
    var px = function (i) { return cx + 26 + (years.length <= 1 ? 0 : i * (cw - 34) / (years.length - 1)); };
    var py = function (v) { return cy + ch - 16 - v * (ch - 26) / maxSC; };
    for (var v = 0; v <= maxSC; v += gridStep(maxSC)) {
      d.line(cx + 26, py(v), cx + cw, py(v), "#e0e0e0", 0.5);
      d.text(String(v), cx + 26 - textWidth(String(v), 7) - 4, 7, { y: py(v) + 3.5, color: "#666666" });
    }
    years.forEach(function (y, i) {
      d.text(String(y), px(i) - textWidth(String(y), 7) / 2, 7, { y: cy + ch, color: "#666666" });
    });
    POWERS.forEach(function (p) {
      d.polyline(years.map(function (y, i) { return [px(i), py((hist.scByYear[y] || {})[p] || 0)]; }), COLORS[p], 1.3);
    });
    d.y = cy + ch + 12;

    var lx = L;
    POWERS.forEach(function (p) {
      d.rect(lx, d.y + 1, 7, 7, COLORS[p]);
      d.text(p, lx + 10, 8);
      lx += 12 + textWidth(p, 8) + 12;
    });
    d.y += 24;

    d.text("Score table", L, 12, { bold: true }); d.y += 16;
    var colW = (RIGHT - L - 44) / (POWERS.length + 1);
    var colX = function (i) { return L + 44 + i * colW; };
    d.text("Year", L, 8.5, { bold: true });
    POWERS.forEach(function (p, i) {
      d.rect(colX(i), d.y + 1, 6, 6, COLORS[p]);
      d.text(p.slice(0, 7), colX(i) + 8, 7.5, { bold: true });
    });
    d.text("Neut.", colX(POWERS.length), 7.5, { bold: true });
    d.y += 12;
    d.line(L, d.y, RIGHT, d.y, "#999999", 0.7);
    d.y += 4;
    hist.years.slice().reverse().forEach(function (y) {
      if (d.space(14)) { d.y = d.M; }
      var sc = hist.scByYear[y] || {};
      d.text(String(y), L, 8.5, { bold: true });
      POWERS.forEach(function (p, i) { d.text(String(sc[p] || 0), colX(i) + 8, 8.5); });
      d.text(String(sc.Neutrals != null ? sc.Neutrals : ""), colX(POWERS.length) + 8, 8.5, { color: "#666666" });
      d.y += 13;
    });

    d.newPage();
    d.text("Every order, every turn", L, 13, { bold: true }); d.y += 20;
    hist.phases.slice().sort(function (a, b) {
      return a.year - b.year || SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season);
    }).forEach(function (ph) {
      var any = POWERS.some(function (p) { return ph.orders && ph.orders[p] && Object.keys(ph.orders[p]).length; });
      if (!any) return;
      d.space(30);
      d.text(ph.season.charAt(0).toUpperCase() + ph.season.slice(1) + " " + ph.year, L, 11, { bold: true });
      d.y += 15;
      POWERS.forEach(function (p) {
        var po = (ph.orders || {})[p];
        if (!po || !Object.keys(po).length) return;
        d.space(16);
        d.rect(L, d.y + 1, 6, 6, COLORS[p]);
        d.text(p, L + 10, 9, { bold: true });
        d.y += 12;
        Object.keys(po).forEach(function (prov) {
          var t = orderToText(prov, po[prov]);
          if (!t) return;
          d.space(11);

          var max = 118;
          while (t.length > max) {
            d.text(t.slice(0, max), L + 14, 8);
            t = "    " + t.slice(max);
            d.y += 10;
            d.space(11);
          }
          d.text(t, L + 14, 8);
          d.y += 10;
        });
        d.y += 3;
      });
      d.y += 6;
    });

    var blob = d.blob();
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: safeName() + ".backstabbr.pdf" });
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 100);
  }

  function renderInto(pane, hist) {
    pane.textContent = "";
    var bar = el("div", { class: "bse-st-actions" }, [
      el("button", { class: "btn btn-sm btn-primary", id: "bse-st-html" }, [el("i", { class: "fas fa-file-lines me-1" }), document.createTextNode("Export HTML")]),
      el("button", { class: "btn btn-sm btn-primary", id: "bse-st-pdf" }, [el("i", { class: "fas fa-file-pdf me-1" }), document.createTextNode("Export PDF")]),
      el("button", { class: "btn btn-sm btn-outline-primary", id: "bse-st-refresh", title: "Re-read every phase from Backstabbr" }, [el("i", { class: "fas fa-rotate me-1" }), document.createTextNode("Refresh")])
    ]);
    pane.appendChild(bar);
    pane.appendChild(el("div", { class: "bse-st-sub", text: "Current standings" }));
    pane.appendChild(buildStandings(hist));
    pane.appendChild(el("div", { class: "bse-st-sub", text: "Supply centres over time" }));
    pane.appendChild(buildChartBlock(hist));
    pane.appendChild(el("div", { class: "bse-st-sub", text: "Score table" }));
    var wrap = el("div", { class: "bse-st-tablewrap" }, [buildTable(hist)]);
    pane.appendChild(wrap);

    bar.querySelector("#bse-st-html").addEventListener("click", function () { exportHTML(hist); });
    bar.querySelector("#bse-st-pdf").addEventListener("click", function () { exportPDF(hist); });
    bar.querySelector("#bse-st-refresh").addEventListener("click", function () {
      HISTORY = null; loaded = false;
      ensureLoaded(pane, true);
    });
  }

  async function ensureLoaded(pane, force) {
    if ((loaded && !force) || loading) return;
    loading = true;
    pane.textContent = "";
    var status = el("div", { class: "bse-st-loading" }, [el("i", { class: "fas fa-spinner fa-spin me-2" }), document.createTextNode("Loading game history… ")]);
    var count = el("span"); status.appendChild(count);
    pane.appendChild(status);
    try {
      var hist = await fetchHistory(function (d, t) { count.textContent = d + "/" + t + " phases"; }, force);
      loaded = true;
      renderInto(pane, hist);
    } catch (e) {
      status.textContent = "Couldn't load game history (" + (e && e.message) + ").";
    }
    loading = false;
  }

  function inject() {
    if (injected) return;
    var tabs = document.getElementById("game-tabs");
    if (!tabs) return;
    var sandboxLi = document.getElementById("sandboxes-tab");
    sandboxLi = sandboxLi ? sandboxLi.closest("li") : null;

    var tab = el("a", { href: "#stats", id: "bse-stats-tab", class: "nav-link", "data-bs-toggle": "tab", role: "tab" },
      [document.createTextNode("Stats")]);
    var li = el("li", { class: "nav-item", role: "presentation" }, [tab]);
    if (sandboxLi && sandboxLi.parentNode) sandboxLi.parentNode.insertBefore(li, sandboxLi.nextSibling);
    else tabs.appendChild(li);

    var content = document.querySelector(".tab-content");
    var pane = el("div", { id: "stats", class: "tab-pane fade bse-st-pane", role: "tabpanel" });
    if (content) content.appendChild(pane);
    else if (tabs.parentNode) tabs.parentNode.appendChild(pane);

    tab.addEventListener("click", function () {
      try { history.replaceState(null, "", "#stats"); } catch (e) { location.hash = "#stats"; }
      setTimeout(function () { ensureLoaded(pane); }, 0);
    });
    injected = true;

    if (location.hash === "#stats") setTimeout(function () { tab.click(); }, 60);
  }

  function remove() {
    ["#bse-stats-tab", "#stats"].forEach(function (s) { var n = document.querySelector(s); if (n) { var li = n.closest && n.closest("li"); (li || n).remove(); } });
    injected = false;
  }

  var TAB_ICONS = {
    "results-tab": "fa-trophy",
    "orders-tab": "fa-scroll",
    "press-tab": "fa-comments",
    "info-tab": "fa-circle-info",
    "sandboxes-tab": "fa-flask",
    "bse-stats-tab": "fa-chart-line"
  };

  function applyTabIcons(on) {
    Object.keys(TAB_ICONS).forEach(function (id) {
      var a = document.getElementById(id);
      if (!a) return;
      var existing = a.querySelector(".bse-tab-ico");
      if (on) {
        if (!existing) a.insertBefore(el("i", { class: "fas " + TAB_ICONS[id] + " me-1 bse-tab-ico" }), a.firstChild);
      } else if (existing) {
        existing.remove();
      }
    });
  }

  function apply() {
    if (enabled) inject(); else remove();
    applyTabIcons(iconsOn);
  }

  base = window.base_url || (location.pathname.match(/^(\/(?:game|sandbox)\/[^/]+\/\d+)/) || [])[1];
  if (!base) return;
  isSandbox = /^\/sandbox\//.test(base);
  gameId = (base.match(/\/(\d+)$/) || [])[1];
  gameName = (document.title.replace(/^(?:Game|Sandbox):\s*/, "").replace(/\s*\|.*$/, "") || "game").trim();

  function tryInject() { if (document.getElementById("game-tabs")) { apply(); return true; } return false; }
  if (!tryInject()) {
    var mo = new MutationObserver(function () { if (tryInject()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  try {
    chrome.storage.sync.get({ gameStats: true, tabIcons: false }, function (cfg) {
      enabled = cfg.gameStats !== false;
      iconsOn = cfg.tabIcons === true;
      apply();
    });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "sync") return;
      if (ch.gameStats) enabled = ch.gameStats.newValue !== false;
      if (ch.tabIcons) iconsOn = ch.tabIcons.newValue === true;
      if (ch.gameStats || ch.tabIcons) apply();
    });
  } catch (e) {}
})();
