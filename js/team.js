// js/team.js – non-module version that works with existing app.js globals

// ---------- tiny utils ----------
const Q = (s) => document.querySelector(s);
const QA = (s) => Array.from(document.querySelectorAll(s));
const fmt = (v) => (v == null || v === "" ? "—" : v);
const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ---------- hook into existing helpers or provide fallbacks ----------
const initThemeToggleSafe =
  typeof window.initThemeToggle === "function"
    ? window.initThemeToggle
    : () => {};

const loadJSONSafe =
  typeof window.loadJSON === "function"
    ? window.loadJSON
    : async function (path) {
        const res = await fetch(path, { cache: "no-store" });
        return res.json();
      };

const fetchCsvSafe =
  typeof window.fetchCsv === "function"
    ? window.fetchCsv
    : async function (url) {
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const cols = line.split(",").map((c) => c.trim());
          const obj = {};
          headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
          rows.push(obj);
        }
        return rows;
      };

const computePlayerAveragesSafe =
  typeof window.computePlayerAverages === "function"
    ? window.computePlayerAverages
    : function (rows) {
        if (!rows.length) {
          return {
            pts: 0,
            reb: 0,
            ast: 0,
            stl: 0,
            blk: 0,
            fg_pct: 0,
            tp_pct: 0,
            ft_pct: 0,
          };
        }
        let pts = 0,
          reb = 0,
          ast = 0,
          stl = 0,
          blk = 0,
          fgm = 0,
          fga = 0,
          tpm = 0,
          tpa = 0,
          ftm = 0,
          fta = 0;
        rows.forEach((r) => {
          const n = (k) => Number(r[k] || 0);
          pts += n("pts");
          reb += Number(r.totrb || n("or") + n("dr"));
          ast += n("ass");
          stl += n("st");
          blk += n("bs");
          fgm += n("fg");
          fga += n("fga");
          tpm += n("3p");
          tpa += n("3pa");
          ftm += n("ft");
          fta += n("fta");
        });
        const g = rows.length || 1;
        const fg_pct = fga ? (fgm / fga) * 100 : 0;
        const tp_pct = tpa ? (tpm / tpa) * 100 : 0;
        const ft_pct = fta ? (ftm / fta) * 100 : 0;
        return {
          pts: pts / g,
          reb: reb / g,
          ast: ast / g,
          stl: stl / g,
          blk: blk / g,
          fg_pct,
          tp_pct,
          ft_pct,
        };
      };

// ---------- index CSV (for games + boxscore links) ----------
const INDEX_CSV =
  "https://docs.google.com/spreadsheets/d/15zxpQZJamQfEz07qFtZAI_738cI2rjc2qrrz-q-8Bo0/export?format=csv&gid=0";

function parseIndexRows(text) {
  const lines = text.trim().split(/\r?\n/);
  const heads = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cols = row.split(",").map((s) => s.trim());
    const obj = {};
    heads.forEach((h, ix) => (obj[h] = cols[ix] ?? ""));
    out.push(obj);
  }
  return out;
}

async function loadIndex() {
  const res = await fetch(INDEX_CSV, { cache: "no-store" });
  const txt = await res.text();
  return parseIndexRows(txt);
}

// ---------- tabs / view ----------
function getInitialView() {
  const p = new URL(location.href).searchParams.get("view");
  return p || "roster";
}

function setView(view) {
  QA(".team-view").forEach((sec) => {
    sec.hidden = sec.id !== `view-${view}`;
  });
  QA(".team-tab").forEach((a) => {
    if (a.dataset.view === view) a.classList.add("active");
    else a.classList.remove("active");
  });
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  history.replaceState({}, "", url.toString());
}

function initTabs() {
  const initial = getInitialView();
  setView(initial);
  const tabs = Q("#team-tabs");
  if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const link = e.target.closest(".team-tab");
    if (!link) return;
    e.preventDefault();
    setView(link.dataset.view);
  });
}

// ---------- logo / header ----------
function setTeamLogo(team) {
  const el = document.getElementById("team-logo");
  if (!el) return;
  const src =
    team.logo || team.logoUrl || team.image || `assets/logos/${team.slug}.png`;
  el.alt = `${team.name} logo`;
  el.src = src;
  el.onerror = () => {
    el.onerror = null;
    el.src = "assets/logo-placeholder.png";
  };
}

function fillTeamHeader(team, gamesForTeam) {
  const title = Q("#team-name");
  if (title) title.textContent = team.name;

  setTeamLogo(team);

  const league = Q("#team-league");
  if (league) league.textContent = team.league || team.subtitle || "";

  const rec = gamesForTeam.reduce(
    (acc, g) => {
      const tSlug = team.slug.toLowerCase();
      const s1 = Number(g.score_team1 || 0);
      const s2 = Number(g.score_team2 || 0);
      const t1 = (g.team1_slug || g.team1 || "").toLowerCase();
      const t2 = (g.team2_slug || g.team2 || "").toLowerCase();
      const is1 = t1.includes(tSlug);
      const is2 = t2.includes(tSlug);
      if (!(is1 || is2)) return acc;
      const win = is1 ? s1 > s2 : s2 > s1;
      if (win) acc.w++;
      else acc.l++;
      return acc;
    },
    { w: 0, l: 0 }
  );

  const recEl = Q("#team-record");
  if (recEl) recEl.textContent = `Record: ${rec.w}-${rec.l}`;
}

// ---------- roster ----------
async function renderRoster(team, players) {
  const grid = Q("#roster-grid");
  if (!grid) return;
  grid.innerHTML = "";

  (team.roster || []).forEach((slug) => {
    const p = players.find((x) => x.slug === slug);
    if (!p) return;

    const a = document.createElement("a");
    a.className = "player-tile";
    a.href = `player.html?player=${p.slug}`;
    a.innerHTML = `
      <div class="player-tile-image-wrap">
        <img src="${p.image || `assets/players/${p.slug}.png`}"
             alt="${p.name}"
             class="player-tile-image" />
      </div>
      <div class="player-tile-meta">
        <div class="player-tile-name">${p.name}</div>
        <div class="player-tile-sub">#${p.number || "?"} · ${p.position || ""}</div>
      </div>
    `;
    grid.appendChild(a);
  });
}

// ---------- games (from index) ----------
function isTeamInRow(team, g) {
  const tSlug = slugify(team.slug);
  const tName = norm(team.name);
  const t1 = slugify(g.team1_slug || g.team1 || "");
  const t2 = slugify(g.team2_slug || g.team2 || "");
  const n1 = norm(g.team1 || g.team1_name || "");
  const n2 = norm(g.team2 || g.team2_name || "");
  return (
    tSlug === t1 ||
    tSlug === t2 ||
    tName === n1 ||
    tName === n2 ||
    n1.includes(tName) ||
    n2.includes(tName)
  );
}

function opponentForTeam(team, g) {
  const tSlug = slugify(team.slug);
  const t1 = slugify(g.team1_slug || g.team1 || "");
  const t2 = slugify(g.team2_slug || g.team2 || "");
  if (tSlug === t1) return g.team2 || g.team2_slug || "";
  if (tSlug === t2) return g.team1 || g.team1_slug || "";
  return g.team1 || g.team2 || "";
}

function phaseFromRow(g) {
  const p = (g.phase || g.phasetype || "").toLowerCase();
  if (p === "playoff" || p === "playoffs") return "playoff";
  if (p === "regular" || p === "rs") return "regular";
  return "regular";
}

function buildSeasonListFromIndex(team, gamesForTeam) {
  const set = new Set();
  gamesForTeam.forEach((g) => {
    if (g.season) set.add(g.season);
  });
  const arr = Array.from(set).sort();
  if (!arr.length) return ["All seasons"];
  return arr;
}

function populateSeasonSelect(selectEl, seasons, includeAll = true) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  if (includeAll) {
    const o = document.createElement("option");
    o.value = "all";
    o.textContent = "All seasons";
    selectEl.appendChild(o);
  }
  seasons.forEach((s) => {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s;
    selectEl.appendChild(o);
  });
}

function renderGamesTable(team, gamesForTeam) {
  const seasonSel = Q("#games-season-filter");
  const phaseSel = Q("#games-phase-filter");
  const body = Q("#games-body");
  if (!body || !seasonSel || !phaseSel) return;

  const seasons = buildSeasonListFromIndex(team, gamesForTeam);
  populateSeasonSelect(seasonSel, seasons, true);

  function apply() {
    const seasonVal = seasonSel.value;
    const phaseVal = phaseSel.value;

    body.innerHTML = "";
    gamesForTeam.forEach((g) => {
      const phase = phaseFromRow(g);
      if (phaseVal !== "all" && phaseVal !== phase) return;
      if (seasonVal !== "all" && g.season !== seasonVal) return;

      const opp = opponentForTeam(team, g);
      const s1 = Number(g.score_team1 || 0);
      const s2 = Number(g.score_team2 || 0);
      const is1 = isTeamInRow(team, {
        ...g,
        team1_slug: g.team1_slug || g.team1,
      });
      const win = is1 ? s1 > s2 : s2 > s1;
      const result = `${win ? "W" : "L"} ${s1}-${s2}`;
      const phaseLabel = phase === "playoff" ? "Playoffs" : "Regular";

      const tr = document.createElement("tr");
      tr.className = "clickable-row";
      const gameId = (g.game_id || "").trim();

      if (gameId) {
        tr.addEventListener("click", () => {
          location.href = `game.html?game_id=${encodeURIComponent(gameId)}`;
        });
      }

      tr.innerHTML = `
        <td>${fmt(g.date)}</td>
        <td>${fmt(g.season)}</td>
        <td>${fmt(phaseLabel)}</td>
        <td>${fmt(opp)}</td>
        <td>${fmt(result)}</td>
      `;
      body.appendChild(tr);
    });
  }

  seasonSel.addEventListener("change", apply);
  phaseSel.addEventListener("change", apply);
  apply();
}

// ---------- leaders (player sheets) ----------
async function loadRosterPlayerRows(team, players) {
  const matchTeam = (cell) => {
    const cSlug = slugify(cell);
    const cNorm = norm(cell);
    const tSlug = slugify(team.slug);
    const tNorm = norm(team.name);
    return (
      cSlug === tSlug ||
      cSlug.includes(tSlug) ||
      cNorm === tNorm ||
      cNorm.includes(tNorm)
    );
  };

  const roster = (team.roster || [])
    .map((sl) => players.find((p) => p.slug === sl))
    .filter(Boolean);

  const csvs = await Promise.all(
    roster.map((p) => (p.csvUrl ? fetchCsvSafe(p.csvUrl) : Promise.resolve([])))
  );

  const data = roster.map((p, idx) => {
    const rows = (csvs[idx] || []).filter((r) => matchTeam(r.team || ""));
    return { player: p, rows };
  });

  return data;
}

function buildSeasonListFromRows(playerData) {
  const set = new Set();
  playerData.forEach((entry) => {
    entry.rows.forEach((r) => {
      if (r.season) set.add(r.season);
    });
  });
  const arr = Array.from(set).sort();
  if (!arr.length) return ["All seasons"];
  return arr;
}

function aggregateForLeaders(playerData, seasonVal, phaseVal) {
  return playerData.map(({ player, rows }) => {
    const filtered = rows.filter((r) => {
      if (seasonVal !== "all" && r.season !== seasonVal) return false;
      const phase = (r.phase || "").toLowerCase();
      if (phaseVal === "regular" && phase !== "regular") return false;
      if (phaseVal === "playoff" && phase !== "playoff") return false;
      return true;
    });

    const gp = filtered.length;
    const totals = filtered.reduce(
      (acc, r) => {
        const n = (k) => Number(r[k] || 0);
        acc.pts += n("pts");
        acc.reb += Number(r.totrb || n("or") + n("dr"));
        acc.oreb += n("or");
        acc.dreb += n("dr");
        acc.ast += n("ass") || n("hock ass");
        acc.stl += n("st");
        acc.blk += n("bs");
        acc.tov += n("to");
        acc.fgm += n("fg");
        acc.fga += n("fga");
        acc.tpm += n("3p");
        acc.tpa += n("3pa");
        acc.ftm += n("ft");
        acc.fta += n("fta");
        return acc;
      },
      {
        pts: 0,
        reb: 0,
        oreb: 0,
        dreb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0,
      }
    );

    const avgs = computePlayerAveragesSafe(filtered);
    const games = gp || 1;
    const avgOreb = totals.oreb / games;
    const avgDreb = totals.dreb / games;
    const avgTov = totals.tov / games;

    const fg_pct = totals.fga ? (totals.fgm / totals.fga) * 100 : 0;
    const tp_pct = totals.tpa ? (totals.tpm / totals.tpa) * 100 : 0;
    const ft_pct = totals.fta ? (totals.ftm / totals.fta) * 100 : 0;

    return {
      name: player.name,
      gp,
      totals,
      avgs: {
        ...avgs,
        oreb: avgOreb,
        dreb: avgDreb,
        tov: avgTov,
        fg_pct,
        tp_pct,
        ft_pct,
      },
    };
  });
}

function renderLeadersSection(playerData) {
  const seasonSel = Q("#leaders-season-filter");
  const phaseSel = Q("#leaders-phase-filter");
  const statSel = Q("#leaders-stat-filter");
  const modeBtn = Q("#leaders-mode-btn");
  const list = Q("#leaders-list");
  if (!seasonSel || !phaseSel || !statSel || !modeBtn || !list) return;

  const seasons = buildSeasonListFromRows(playerData);
  populateSeasonSelect(seasonSel, seasons, true);

  function computeRows() {
    const seasonVal = seasonSel.value;
    const phaseVal = phaseSel.value;
    const mode = modeBtn.dataset.mode || "avg";
    const statKey = statSel.value;

    const aggregated = aggregateForLeaders(playerData, seasonVal, phaseVal);

    const rows = aggregated.map((item) => {
      let value;
      if (statKey === "gp") {
        value = item.gp;
      } else if (mode === "avg") {
        value = item.avgs[statKey] || 0;
      } else {
        if (statKey === "fg_pct" || statKey === "tp_pct" || statKey === "ft_pct") {
          value = item.avgs[statKey] || 0;
        } else {
          value = item.totals[statKey] || 0;
        }
      }
      return { name: item.name, value };
    });

    rows.sort((a, b) => b.value - a.value);
    return rows;
  }

  function render() {
    const rows = computeRows();
    list.innerHTML = "";

    if (!rows.length) {
      list.textContent = "No games for this filter yet.";
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "leaders-list-inner";

    rows.slice(0, 10).forEach((r, idx) => {
      const li = document.createElement("li");
      li.className = "leaders-row";
      const val =
        statSel.value === "fg_pct" ||
        statSel.value === "tp_pct" ||
        statSel.value === "ft_pct"
          ? r.value.toFixed(1)
          : r.value.toFixed(1);
      li.innerHTML = `
        <span class="leaders-rank">${idx + 1}</span>
        <span class="leaders-name">${r.name}</span>
        <span class="leaders-value">${val}</span>
      `;
      ul.appendChild(li);
    });

    list.appendChild(ul);
  }

  seasonSel.addEventListener("change", render);
  phaseSel.addEventListener("change", render);
  statSel.addEventListener("change", render);
  modeBtn.addEventListener("click", () => {
    modeBtn.dataset.mode = modeBtn.dataset.mode === "avg" ? "tot" : "avg";
    modeBtn.textContent =
      modeBtn.dataset.mode === "avg" ? "Averages" : "Totals";
    render();
  });

  render();
}

// ---------- records / season highs ----------
const RECORD_STATS = [
  ["pts", "Points"],
  ["reb", "Rebounds"],
  ["oreb", "Offensive rebounds"],
  ["dreb", "Defensive rebounds"],
  ["ast", "Assists"],
  ["stl", "Steals"],
  ["blk", "Blocks"],
  ["tpm", "3P made"],
  ["fgm", "FG made"],
  ["ftm", "FT made"],
  ["tov", "Turnovers"],
  ["fg_pct", "FG%"],
  ["tp_pct", "3P%"],
  ["gp", "Games played"],
];

function aggregateForRecords(team, playerData, gamesForTeam, seasonVal, phaseVal) {
  const gameIndexMap = new Map();
  gamesForTeam.forEach((g) => {
    const key = `${g.date}__${opponentForTeam(team, g)}`.toLowerCase();
    gameIndexMap.set(key, g);
  });

  const records = {};

  playerData.forEach(({ player, rows }) => {
    const filteredRows = rows.filter((r) => {
      if (seasonVal !== "all" && r.season !== seasonVal) return false;
      const phase = (r.phase || "").toLowerCase();
      if (phaseVal === "regular" && phase !== "regular") return false;
      if (phaseVal === "playoff" && phase !== "playoff") return false;
      return true;
    });

    filteredRows.forEach((r) => {
      const n = (k) => Number(r[k] || 0);
      const gameKey = `${r.date}__${r.opponent || ""}`.toLowerCase();
      const gIdx = gameIndexMap.get(gameKey);

      const base = {
        player: player.name,
        date: r.date,
        opponent: r.opponent || "",
        gameId: gIdx ? (gIdx.game_id || "").trim() : "",
        season: r.season,
      };

      const stats = {
        pts: n("pts"),
        reb: Number(r.totrb || n("or") + n("dr")),
        oreb: n("or"),
        dreb: n("dr"),
        ast: n("ass") || n("hock ass"),
        stl: n("st"),
        blk: n("bs"),
        tpm: n("3p"),
        fgm: n("fg"),
        ftm: n("ft"),
        tov: n("to"),
      };

      Object.entries(stats).forEach(([k, v]) => {
        const cur = records[k];
        if (!cur || v > cur.value) {
          records[k] = { ...base, statKey: k, value: v };
        }
      });

      const fga = n("fga");
      const tpa = n("3pa");
      const fg_pct = fga ? (n("fg") / fga) * 100 : 0;
      const tp_pct = tpa ? (n("3p") / tpa) * 100 : 0;

      if (!records.fg_pct || fg_pct > records.fg_pct.value) {
        records.fg_pct = { ...base, statKey: "fg_pct", value: fg_pct };
      }
      if (!records.tp_pct || tp_pct > records.tp_pct.value) {
        records.tp_pct = { ...base, statKey: "tp_pct", value: tp_pct };
      }
    });

    const gp = filteredRows.length;
    if (!records.gp || gp > records.gp.value) {
      records.gp = {
        player: player.name,
        value: gp,
        gameId: "",
        statKey: "gp",
      };
    }
  });

  return records;
}

function renderRecordsSection(team, playerData, gamesForTeam) {
  const seasonSel = Q("#records-season-filter");
  const phaseSel = Q("#records-phase-filter");
  const grid = Q("#records-grid");
  if (!seasonSel || !phaseSel || !grid) return;

  const seasons = buildSeasonListFromRows(playerData);
  populateSeasonSelect(seasonSel, seasons, true);

  function render() {
    const seasonVal = seasonSel.value;
    const phaseVal = phaseSel.value;
    const records = aggregateForRecords(
      team,
      playerData,
      gamesForTeam,
      seasonVal,
      phaseVal
    );

    grid.innerHTML = "";

    RECORD_STATS.forEach(([key, label]) => {
      const rec = records[key];
      if (!rec || rec.value == null || isNaN(rec.value)) return;

      const displayVal =
        key === "fg_pct" || key === "tp_pct"
          ? rec.value.toFixed(1)
          : rec.value.toString();

      const tile = document.createElement("div");
      tile.className = "record-tile";

      const clickable = key !== "gp" && rec.gameId;

      tile.innerHTML = `
        <div class="record-stat-label">${label}</div>
        <div class="record-stat-value">${displayVal}</div>
        <div class="record-player">${rec.player}</div>
      `;

      if (clickable) {
        tile.classList.add("record-tile-clickable");
        tile.addEventListener("click", () => {
          location.href = `game.html?game_id=${encodeURIComponent(rec.gameId)}`;
        });
      }

      grid.appendChild(tile);
    });
  }

  seasonSel.addEventListener("change", render);
  phaseSel.addEventListener("change", render);
  render();
}

// ---------- boot ----------
async function initTeamPage() {
  initThemeToggleSafe();
  initTabs();

  const [teams, players, indexRows] = await Promise.all([
    loadJSONSafe("data/teams.json"),
    loadJSONSafe("data/players.json"),
    loadIndex(),
  ]);

  const slug = new URL(location.href).searchParams.get("team");
  const team = teams.find((t) => t.slug === slug);
  if (!team) return;

  const gamesForTeam = indexRows.filter((g) => isTeamInRow(team, g));

  fillTeamHeader(team, gamesForTeam);
  await renderRoster(team, players);

  const playerData = await loadRosterPlayerRows(team, players);

  renderGamesTable(team, gamesForTeam);
  renderLeadersSection(playerData);
  renderRecordsSection(team, playerData, gamesForTeam);
}

window.addEventListener("DOMContentLoaded", initTeamPage);
