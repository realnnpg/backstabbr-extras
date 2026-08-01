(function () {
  "use strict";

  const POWERS = ["England", "France", "Germany", "Italy", "Austria", "Russia", "Turkey"];

  const POWER_COLORS = {
    England: "#2456a0",
    France: "#4fb3c9",
    Germany: "#4a4a4a",
    Italy: "#3aa856",
    Austria: "#d43a3a",
    Russia: "#8e5ea8",
    Turkey: "#e2c541"
  };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function pct(n, d) {
    if (!d) return "—";
    return Math.round((n / d) * 100) + "%";
  }

  function swatch(country) {
    return el("span", {
      class: "bse-sq",
      title: country || "",
      style: "background:" + (POWER_COLORS[country] || "#999")
    });
  }

  const urlId = (location.pathname.match(/\/member\/([0-9a-fA-F]+)/) || [])[1] || null;
  const navLink = document.querySelector('.dropdown-menu a[href*="/member/"]');
  const myId = navLink
    ? (navLink.getAttribute("href").match(/\/member\/([0-9a-fA-F]+)/) || [])[1]
    : null;
  const isOwnProfile = !!(urlId && myId && urlId === myId);

  function readAggregate() {
    const card = document.querySelector("#content .card-body") || document.body;
    const txt = card.innerText || "";
    const num = function (label) {
      const m = txt.match(new RegExp(label + "\\s*:?\\s*(\\d+)", "i"));
      return m ? parseInt(m[1], 10) : null;
    };
    const turns = txt.match(/Turns Made:\s*\d+\s*\(([\d.]+)%\)/i);
    return {
      completed: num("Games Completed"),
      won: num("Games Won"),
      drawn: num("Games Drawn"),
      lost: num("Games Lost"),
      reliability: turns ? turns[1] : null
    };
  }

  async function fetchPlayed() {
    const res = await fetch("/api/member/games/played", {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return (data.rows || []).map(parseRow).filter(Boolean);
  }

  function parseRow(rowHtml) {
    const doc = new DOMParser().parseFromString(
      "<table><tbody><tr>" + rowHtml + "</tr></tbody></table>",
      "text/html"
    );
    const tr = doc.querySelector("tr");
    if (!tr) return null;
    const tds = Array.prototype.slice.call(tr.querySelectorAll("td"));

    const link = tr.querySelector("a.player_game_link") || tr.querySelector("a");

    const icon = tr.querySelector(".country-icon");
    let country = null;
    if (icon) {
      country = Array.prototype.slice
        .call(icon.classList)
        .find(function (c) { return c !== "country-icon"; }) || null;
    }

    const resultTd = tds.find(function (td) {
      return /bg-(success|danger|secondary|warning|info)/.test(td.className);
    });
    let result = "other";
    if (resultTd) {
      if (/bg-success/.test(resultTd.className)) result = "win";
      else if (/bg-danger/.test(resultTd.className)) result = "loss";
      else result = "draw";
    }

    const seasonTd = tds.find(function (td) {
      return /\b(spring|summer|fall|autumn|winter)\b/i.test(td.textContent);
    });
    let year = null;
    if (seasonTd) {
      const ym = seasonTd.textContent.match(/(\d{4})/);
      if (ym) year = parseInt(ym[1], 10);
    }

    const dateTd = tds.find(function (td) { return td.hasAttribute("data-order"); });
    const ts = dateTd ? parseFloat(dateTd.getAttribute("data-order")) : null;

    return {
      game: link ? link.textContent.trim() : "?",
      href: link ? link.getAttribute("href") : null,
      country: country,
      result: result,
      resultText: resultTd ? resultTd.textContent.trim() : "",
      year: year,
      ts: ts
    };
  }

  function summarise(rows) {
    const byCountry = {};
    POWERS.forEach(function (p) {
      byCountry[p] = { country: p, played: 0, win: 0, draw: 0, loss: 0 };
    });
    let years = [];
    rows.forEach(function (r) {
      const c = byCountry[r.country];
      if (c) {
        c.played++;
        if (r.result === "win") c.win++;
        else if (r.result === "draw") c.draw++;
        else if (r.result === "loss") c.loss++;
      }
      if (r.year) years.push(r.year);
    });

    const played = POWERS.map(function (p) { return byCountry[p]; });
    const usedPlayed = played.filter(function (c) { return c.played > 0; });

    const favourite = usedPlayed.slice().sort(function (a, b) { return b.played - a.played; })[0] || null;

    const scoreOf = function (c) { return (c.win + 0.5 * c.draw) / c.played; };
    const strongest = usedPlayed.slice().sort(function (a, b) {
      return scoreOf(b) - scoreOf(a) || b.win - a.win || (b.win + b.draw) - (a.win + a.draw);
    })[0] || null;
    const weakest = usedPlayed.slice().sort(function (a, b) {
      return scoreOf(a) - scoreOf(b) || b.loss - a.loss || b.played - a.played;
    })[0] || null;
    const untried = POWERS.filter(function (p) { return byCountry[p].played === 0; });

    const avgYear = years.length
      ? Math.round(years.reduce(function (a, b) { return a + b; }, 0) / years.length)
      : null;

    return {
      byCountry: byCountry,
      rows: played,
      totalPlayed: rows.length,
      favourite: favourite,
      strongest: strongest && strongest.played ? strongest : null,
      weakest: weakest && weakest.played ? weakest : null,
      untried: untried,
      avgYear: avgYear
    };
  }

  function tile(value, label, cls, title) {
    const t = el("div", { class: "bse-tile" }, [
      el("div", { class: "bse-tile-val " + (cls || ""), text: value }),
      el("div", { class: "bse-tile-lbl", text: label })
    ]);
    if (title) t.title = title;
    return t;
  }

  function renderRatesTiles(agg) {
    const done = agg.completed;
    return el("div", { class: "bse-tiles" }, [
      tile(done != null ? String(done) : "—", "Completed"),
      tile(agg.won != null ? pct(agg.won, done) : "—", "Win rate", "bse-win", "Games soloed (outright win)"),
      tile(agg.drawn != null ? pct(agg.drawn, done) : "—", "Draw rate", "bse-draw", "Games ending in a draw"),
      tile(agg.lost != null ? pct(agg.lost, done) : "—", "Loss rate", "bse-loss", "Games eliminated or resigned"),
      tile(
        agg.won != null ? pct(agg.won + agg.drawn, done) : "—",
        "Survival",
        "bse-surv",
        "Games you were not eliminated in (win or draw)"
      ),
      tile(agg.reliability != null ? agg.reliability + "%" : "—", "Reliability", null,
        "Share of turns you submitted on time (didn't miss / NMR)")
    ]);
  }

  function renderCountryTable(sum) {
    const head = el("tr", null, [
      el("th", { text: "Power" }),
      el("th", { class: "bse-num", text: "Played" }),
      el("th", { class: "bse-num", text: "W" }),
      el("th", { class: "bse-num", text: "D" }),
      el("th", { class: "bse-num", text: "L" }),
      el("th", { class: "bse-num", text: "Win %" }),
      el("th", { class: "bse-num", text: "Survival %" })
    ]);

    const body = sum.rows.map(function (c) {
      const idle = c.played === 0;
      return el("tr", { class: idle ? "bse-idle" : "" }, [
        el("td", null, [swatch(c.country), document.createTextNode(" " + c.country)]),
        el("td", { class: "bse-num", text: String(c.played) }),
        el("td", { class: "bse-num", text: String(c.win) }),
        el("td", { class: "bse-num", text: String(c.draw) }),
        el("td", { class: "bse-num", text: String(c.loss) }),
        el("td", { class: "bse-num", text: idle ? "—" : pct(c.win, c.played) }),
        el("td", { class: "bse-num", text: idle ? "—" : pct(c.win + c.draw, c.played) })
      ]);
    });

    return el("table", { class: "table table-sm bse-table" }, [
      el("thead", null, [head]),
      el("tbody", null, body)
    ]);
  }

  function renderHighlights(sum) {
    const items = [];
    const line = function (label, node) {
      items.push(el("li", null, [el("b", { text: label + ": " }), node]));
    };
    const powerSpan = function (c) {
      if (!c) return document.createTextNode("—");
      return el("span", null, [
        swatch(c.country),
        document.createTextNode(" " + c.country + " (" + c.played + " game" + (c.played === 1 ? "" : "s") + ")")
      ]);
    };

    line("Most played", powerSpan(sum.favourite));
    line("Strongest power", powerSpan(sum.strongest));
    line("Weakest power", powerSpan(sum.weakest));

    if (sum.untried.length) {
      const frag = el("span");
      sum.untried.forEach(function (p, i) {
        if (i) frag.appendChild(document.createTextNode("  "));
        frag.appendChild(swatch(p));
        frag.appendChild(document.createTextNode(" " + p));
      });
      line("Never played", frag);
    }

    if (sum.avgYear) {
      line("Average game ends", document.createTextNode("~" + sum.avgYear));
    }

    return el("ul", { class: "bse-highlights" }, items);
  }

  function section(title, node) {
    if (!node) return null;
    return el("div", { class: "bse-section" }, [
      el("div", { class: "bse-sub", text: title }),
      node
    ]);
  }

  function buildCard(children) {
    const card = el("div", { class: "card bse-card", id: "bse-root" }, [
      el("div", { class: "card-header bse-header", text: "Backstabbr Extras" }),
      el("div", { class: "card-body" }, children)
    ]);
    return el("div", { class: "bse-wrap" }, [card]);
  }

  function mount(node) {
    const content = document.querySelector("#content") || document.body;
    content.appendChild(node);
  }

  async function run() {
    if (document.getElementById("bse-root")) return;
    const agg = readAggregate();

    const children = [renderRatesTiles(agg)];

    if (!isOwnProfile) {
      children.push(
        el("div", { class: "bse-note", text:
          "Per-country breakdown and highlights appear on your own profile (they need your logged-in game history)." })
      );
      mount(buildCard(children));
      return;
    }

    const loading = el("div", { class: "bse-note", text: "Loading your game history…" });
    children.push(loading);
    const cardWrap = buildCard(children);
    mount(cardWrap);

    try {
      const rows = await fetchPlayed();
      const sum = summarise(rows);
      loading.remove();

      const body = cardWrap.querySelector(".card-body");
      body.appendChild(section("Per-country record", renderCountryTable(sum)));
      body.appendChild(section("Highlights", renderHighlights(sum)));
    } catch (err) {
      loading.textContent = "Couldn't load game history (" + err.message + ").";
      loading.classList.add("bse-err");
    }
  }

  function remove() {
    const wrap = document.querySelector(".bse-wrap");
    if (wrap) wrap.remove();
  }

  function boot() {
    try {
      chrome.storage.sync.get({ profileStats: true }, function (cfg) {
        if (cfg.profileStats !== false) run();
      });
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "sync" && changes.profileStats) {
          if (changes.profileStats.newValue !== false) run();
          else remove();
        }
      });
    } catch (e) {
      run();
    }
  }

  boot();
})();
