/**************************************************************
 * Simple helpers
 **************************************************************/
const Q = (s) => document.querySelector(s);
const QA = (s) => [...document.querySelectorAll(s)];
const norm = (s) => (s || "").toLowerCase().trim();
const slugify = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**************************************************************
 * Safe loaders
 **************************************************************/
async function loadJSONSafe(url) {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch (err) {
    console.error("JSON load error", url, err);
    return [];
  }
}

async function fetchCsvSafe(url) {
  try {
    const txt = await fetch(url).then((r) => r.text());
    return parseCsv(txt);
  } catch (err) {
    console.warn("Could not load CSV:", url, err);
    return [];
  }
}

/**************************************************************
 * CSV parser
 **************************************************************/
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i] || ""));
    return row;
  });
}

/**************************************************************
 * Index loader (games index)
 **************************************************************/
async function loadIndex() {
  return fetchCsvSafe(
    "https://docs.google.com/spreadsheets/d/15zxpQZJamQfEz07qFtZAI_738cI2rjc2qrrz-q-8Bo0/export?format=csv"
  );
}

/**************************************************************
 * Determine if this row belongs to team
 **************************************************************/
function isTeamInRow(team, row) {
  const tSlug = slugify(team.slug);
  const fields = [row.teamA, row.teamB, row.teamName, row.team].map(norm);
  return fields.some((f) => f.includes(tSlug));
}

/**************************************************************
 * Determine which players belong to a team
 **************************************************************/
function getTeamPlayers(team, players) {
  const tSlug = norm(team.slug);
  const tName = norm(team.name);

  // Prefer explicit roster array
  if (Array.isArray(team.roster) && team.roster.length) {
    return team.roster
      .map((sl) => players.find((p) => p.slug === sl))
      .filter(Boolean);
  }

  // Otherwise infer roster by matching team fields
  return players.filter((p) => {
    const fields = [p.team, p.teamSlug, p.teamName].map(norm);
    return fields.some((f) => f.includes(tSlug) || f.includes(tName));
  });
}

/**************************************************************
 * TEAM HEADER
 **************************************************************/
function fillTeamHeader(team, games) {
  Q("#team-logo").src = team.logo || `assets/teams/${team.slug}.png`;
  Q("#team-name").textContent = team.name;

  const meta = Q("#team-meta");
  meta.textContent = `${games.length} games found`;
}

/**************************************************************
 * ROSTER RENDER
 **************************************************************/
async function renderRoster(team, players) {
  const grid = Q("#roster-grid");
  grid.innerHTML = "";

  const roster = getTeamPlayers(team, players);
  if (!roster.length) {
    grid.textContent = "No players found.";
    return;
  }

  roster.forEach((p) => {
    const a = document.createElement("a");
    a.className = "player-tile";
    a.href = `player.html?player=${p.slug}`;

    a.innerHTML = `
      <div class="player-tile-image-wrap">
        <img src="${p.image || `assets/players/${p.slug}.png`}" class="player-tile-image">
      </div>
      <div class="player-tile-meta">
        <div class="player-tile-name">${p.name}</div>
        <div class="player-tile-sub">#${p.number || "?"} · ${p.position || ""}</div>
      </div>
    `;

    grid.appendChild(a);
  });
}

/**************************************************************
 * Load player CSV rows for leaders & records
 **************************************************************/
async function loadRosterPlayerRows(team, players) {
  const roster = getTeamPlayers(team, players);
  const csvs = await Promise.all(
    roster.map((p) => fetchCsvSafe(p.csvUrl || ""))
  );

  return roster.map((p, i) => ({ player: p, rows: csvs[i] || [] }));
}

/**************************************************************
 * GAMES TABLE
 **************************************************************/
function renderGamesTable(team, games) {
  const body = Q("#games-table-body");
  body.innerHTML = "";

  games.forEach((g) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.date || ""}</td>
      <td>${g.season || ""}</td>
      <td>${g.phase || ""}</td>
      <td>${g.teamA === team.name ? g.teamB : g.teamA}</td>
      <td>${g.result || ""}</td>
    `;
    body.appendChild(tr);
  });
}

/**************************************************************
 * LEADERS TABLE
 **************************************************************/
function renderLeadersSection(playerData) {
  const body = Q("#leaders-body");
  body.innerHTML = "";

  const rows = [];

  playerData.forEach(({ player, rows: stats }) => {
    if (!stats.length) return;

    let totals = {
      gp: 0,
      pts: 0,
      reb: 0,
      oreb: 0,
      dreb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fgM: 0,
      fgA: 0,
      tpM: 0,
      tpA: 0,
      ftM: 0,
      ftA: 0,
    };

    stats.forEach((r) => {
      totals.gp++;
      totals.pts += +r.pts || 0;
      totals.reb += +r.totrb || 0;
      totals.oreb += +r.or || 0;
      totals.dreb += +r.dr || 0;
      totals.ast += +r.ass || 0;
      totals.stl += +r.st || 0;
      totals.blk += +r.bs || 0;
      totals.tov += +r.to || 0;

      totals.fgM += +r.fg || 0;
      totals.fgA += +r.fga || 0;
      totals.tpM += +r["3p"] || 0;
      totals.tpA += +r["3pa"] || 0;
      totals.ftM += +r.ft || 0;
      totals.ftA += +r.fta || 0;
    });

    const avg = (v) => (totals.gp ? (v / totals.gp).toFixed(1) : "0.0");
    const pct = (m, a) => (a ? ((m / a) * 100).toFixed(1) : "--");

    rows.push({
      name: player.name,
      gp: totals.gp,
      pts: avg(totals.pts),
      reb: avg(totals.reb),
      oreb: avg(totals.oreb),
      dreb: avg(totals.dreb),
      ast: avg(totals.ast),
      stl: avg(totals.stl),
      blk: avg(totals.blk),
      tov: avg(totals.tov),
      fg: pct(totals.fgM, totals.fgA),
      tp: pct(totals.tpM, totals.tpA),
      ft: pct(totals.ftM, totals.ftA),
    });
  });

  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.gp}</td>
      <td>${r.pts}</td>
      <td>${r.reb}</td>
      <td>${r.oreb}</td>
      <td>${r.dreb}</td>
      <td>${r.ast}</td>
      <td>${r.stl}</td>
      <td>${r.blk}</td>
      <td>${r.tov}</td>
      <td>${r.fg}</td>
      <td>${r.tp}</td>
      <td>${r.ft}</td>
    `;
    body.appendChild(tr);
  });
}

/**************************************************************
 * RECORDS SECTION (simplified version)
 **************************************************************/
function renderRecordsSection(team, playerData, games) {
  const grid = Q("#records-grid");
  grid.innerHTML = "";

  grid.innerHTML = `<div style="opacity:0.5;padding:20px;">Records engine placeholder (requires full data model)</div>`;
}

/**************************************************************
 * TAB SWITCHING
 **************************************************************/
function initTabs() {
  const tabs = QA(".team-tabs .tab");
  const views = QA(".team-view");

  tabs.forEach((tab) =>
    tab.addEventListener("click", (e) => {
      e.preventDefault();

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const view = tab.dataset.view;
      views.forEach((v) => (v.hidden = true));
      Q(`#view-${view}`).hidden = false;
    })
  );
}

/**************************************************************
 * MAIN INIT
 **************************************************************/
async function initTeamPage() {
  initTabs();

  const url = new URL(location.href);
  const slug = url.searchParams.get("team");

  const [teams, players] = await Promise.all([
    loadJSONSafe("data/teams.json"),
    loadJSONSafe("data/players.json"),
  ]);

  const team = teams.find((t) => t.slug === slug);
  if (!team) return;

  let indexRows = [];
  try {
    indexRows = await loadIndex();
  } catch (err) {
    console.warn("Index CSV failed");
  }

  const gamesForTeam = indexRows.filter((g) => isTeamInRow(team, g));

  fillTeamHeader(team, gamesForTeam);
  await renderRoster(team, players);

  const playerData = await loadRosterPlayerRows(team, players);

  renderGamesTable(team, gamesForTeam);
  renderLeadersSection(playerData);
  renderRecordsSection(team, playerData, gamesForTeam);
}

initTeamPage();
