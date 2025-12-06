/**************************************************************
 * Basic helpers
 **************************************************************/
const Q = (s) => document.querySelector(s);
const QA = (s) => [...document.querySelectorAll(s)];
const norm = (s) => (s || "").toLowerCase().trim();
const slugify = (s) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**************************************************************
 * Safe JSON + CSV loading
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
    console.warn("CSV load error", url, err);
    return [];
  }
}

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
 * Load games from your GAMES sheet
 *
 * Sheet: 1NkI00kl3h11DwE3_kpslz2pWecEewv14NYoXA9nPEGE
 * Expected headers (can be tweaked later):
 *   date, season, phase, team, opponent, result
 **************************************************************/
async function loadGamesSheet() {
  const url =
    "https://docs.google.com/spreadsheets/d/1NkI00kl3h11DwE3_kpslz2pWecEewv14NYoXA9nPEGE/export?format=csv";
  return fetchCsvSafe(url);
}

/**************************************************************
 * Which players belong to this team?
 * - Try to match teamSlug / team / teamName
 * - If nothing matches, show ALL players so the page is never empty
 **************************************************************/
function getTeamPlayers(team, players) {
  const tSlug = norm(team.slug);
  const tName = norm(team.name);

  let roster = players.filter((p) => {
    const fields = [p.teamSlug, p.team, p.teamName]
      .map(norm)
      .filter(Boolean);
    return fields.some(
      (f) => f.includes(tSlug) || f.includes(tName)
    );
  });

  if (!roster.length) {
    console.warn(
      "No players matched team",
      team.slug,
      "— falling back to ALL players"
    );
    roster = players.slice();
  }

  return roster;
}

/**************************************************************
 * TEAM HEADER
 **************************************************************/
function fillTeamHeader(team, games) {
  const logo = Q("#team-logo");
  if (logo) {
    logo.src = team.logo || `assets/teams/${team.slug}.png`;
    logo.alt = `${team.name} logo`;
  }

  const nameEl = Q("#team-name");
  if (nameEl) nameEl.textContent = team.name;

  const meta = Q("#team-meta");
  if (meta) meta.textContent = `${games.length} games`;
}

/**************************************************************
 * ROSTER VIEW
 **************************************************************/
async function renderRoster(team, players) {
  const grid = Q("#roster-grid");
  if (!grid) return;

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
        <img src="${p.image || `assets/players/${p.slug}.png`}" 
             class="player-tile-image" 
             alt="${p.name}">
      </div>
      <div class="player-tile-meta">
        <div class="player-tile-name">${p.name}</div>
        <div class="player-tile-sub">#${p.number || "?"} · ${
      p.position || ""
    }</div>
      </div>
    `;

    grid.appendChild(a);
  });
}

/**************************************************************
 * Load stats rows for each player (for leaders)
 **************************************************************/
async function loadRosterPlayerRows(team, players) {
  const roster = getTeamPlayers(team, players);

  const csvs = await Promise.all(
    roster.map((p) =>
      p.csvUrl ? fetchCsvSafe(p.csvUrl) : Promise.resolve([])
    )
  );

  return roster.map((p, i) => ({
    player: p,
    rows: csvs[i] || [],
  }));
}

/**************************************************************
 * GAMES VIEW
 **************************************************************/
function filterGamesForTeam(team, games) {
  const tSlug = norm(team.slug);
  const tName = norm(team.name);

  let filtered = games.filter((g) => {
    const tField = norm(g.team);
    const home = norm(g.teamA);
    const away = norm(g.teamB);

    return (
      tField.includes(tSlug) ||
      tField.includes(tName) ||
      home.includes(tSlug) ||
      home.includes(tName) ||
      away.includes(tSlug) ||
      away.includes(tName)
    );
  });

  if (!filtered.length) {
    console.warn(
      "No games matched this team — showing ALL games as fallback."
    );
    filtered = games.slice();
  }

  return filtered;
}

function renderGamesTable(team, gamesRaw) {
  const body = Q("#games-table-body");
  if (!body) return;

  body.innerHTML = "";

  const games = filterGamesForTeam(team, gamesRaw);

  if (!games.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="5" style="text-align:center; opacity:0.7;">No games found.</td>';
    body.appendChild(tr);
    return;
  }

  games.forEach((g) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.date || ""}</td>
      <td>${g.season || ""}</td>
      <td>${g.phase || ""}</td>
      <td>${g.opponent || g.teamB || g.team || ""}</td>
      <td>${g.result || ""}</td>
    `;
    body.appendChild(tr);
  });
}

/**************************************************************
 * LEADERS VIEW
 **************************************************************/
function renderLeadersSection(playerData) {
  const body = Q("#leaders-body");
  if (!body) return;

  body.innerHTML = "";

  const rows = [];

  playerData.forEach(({ player, rows: stats }) => {
    if (!stats.length) return;

    const totals = {
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

    const avg = (v) =>
      totals.gp ? (v / totals.gp).toFixed(1) : "0.0";
    const pct = (m, a) =>
      a ? ((m / a) * 100).toFixed(1) : "--";

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

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="13" style="text-align:center; opacity:0.7;">No stats found yet.</td>';
    body.appendChild(tr);
    return;
  }

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
 * RECORDS VIEW (placeholder for now)
 **************************************************************/
function renderRecordsSection(team, playerData, games) {
  const grid = Q("#records-grid");
  if (!grid) return;

  grid.innerHTML =
    '<div style="opacity:0.7;padding:1rem 0;">Records / season-highs engine coming next – once we confirm your games & leaders are reading correctly from the sheets.</div>';
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
      const view = tab.dataset.view;

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      views.forEach((v) => (v.hidden = true));
      const activeView = Q(`#view-${view}`);
      if (activeView) activeView.hidden = false;
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

  const [teams, players, gamesSheet] = await Promise.all([
    loadJSONSafe("data/teams.json"),
    loadJSONSafe("data/players.json"),
    loadGamesSheet(),
  ]);

  const team = teams.find((t) => t.slug === slug);
  if (!team) {
    console.error("Unknown team slug:", slug);
    return;
  }

  const gamesForHeader = filterGamesForTeam(team, gamesSheet);
  fillTeamHeader(team, gamesForHeader);

  await renderRoster(team, players);

  const playerData = await loadRosterPlayerRows(team, players);
  renderGamesTable(team, gamesSheet);
  renderLeadersSection(playerData);
  renderRecordsSection(team, playerData, gamesSheet);
}

initTeamPage();
