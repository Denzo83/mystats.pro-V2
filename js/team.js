/* --------------------------------------------------
   mystats.pro V2.5 — TEAM PAGE ENGINE
   Handles roster, games, leaders, and records tabs.
-------------------------------------------------- */

// ========== CONFIGURATION ==========

// Google Sheets CSV URLs
const PLAYERS_SHEET =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsO8Qs1fcSc3bth-xMxcjAXOCchbqLYQpObfOQvf8xJdpSkNl3I09OEwuvfWYehtQX5a6LQIeIFdsg/pub";

const GAMES_SHEET =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7JWjsx4iztJtf6PTOR6_adf9pdbtFlgIN8aX2_3QynveLtg427bYcDOOzIFpxEoNaMFYwaIFj12T/pub";

const BOXSCORE_SHEET =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGdu88uH_BwBwrBtCzDnVGR1CNDWiazKjW_sIOjBAvOMH7kOqJxNtWtNiYl3IPfLZhOyaPH43bZyb2/pub";

// Player tab gid mapping
const PLAYER_GIDS = {
  "kyle-denzin": 0,
  "levi-denzin": 2091114860,
  "findlay-wendtman": 863688176,
  "jackson-neaves": 699060431,
  "ethan-todd": 450610169,
  "josh-todd": 2116571222,
  "callan-beamish": 430866216,
  "jarren-owen": 1191745424,
  "rhys-ogle": 298458955,
};

// Team tab gIDs from Games sheet
const TEAM_GIDS = {
  "pretty-good": 0,
  "chuckers-chuckers": 26509490,
};

// ========== CSV LOADER ==========

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(raw) {
  const lines = raw.split("\n").map((l) => l.trim());
  const headers = lines.shift().split(",");

  return lines
    .filter((l) => l.length > 0)
    .map((line) => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = cols[i]));
      return obj;
    });
}

// ========== TAB SWITCHING ==========

function initTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const sections = document.querySelectorAll(".tab-section");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;

      sections.forEach((sec) => sec.classList.add("hidden"));
      document.querySelector(`#tab-${tab}`).classList.remove("hidden");

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Default tab
  buttons[0].click();
}

// ========== TEAM METADATA FROM URL ==========

function getTeamSlug() {
  const url = new URL(window.location.href);
  return url.searchParams.get("team");
}

// ========== LOAD teams.json FILE ==========

async function loadTeamsJSON() {
  const res = await fetch("data/teams.json");
  return res.json();
}

// ========== ROSTER SECTION ==========

function renderRoster(team, players) {
  const container = document.getElementById("roster-grid");
  container.innerHTML = "";

  team.roster.forEach((slug) => {
    const p = players.find((x) => x.slug === slug);
    if (!p) return;

    const tile = document.createElement("a");
    tile.className = "player-tile";
    tile.href = `player.html?player=${p.slug}`;
    tile.innerHTML = `
      <img src="${p.image}" class="player-face">
      <div class="player-name">${p.name}</div>
    `;
    container.appendChild(tile);
  });
}

// ========== LOAD PLAYER STATS (MULTI-TAB) ==========

async function loadPlayerStatsForTeam(team) {
  const results = [];

  for (const slug of team.roster) {
    const gid = PLAYER_GIDS[slug];
    if (gid === undefined) continue;

    const url = `${PLAYERS_SHEET}&gid=${gid}`;
    const rows = await fetchCSV(url);
    results.push({ slug, rows });
  }

  return results;
}

// ========== LOAD GAMES FOR TEAM (TAB-BASED) ==========

async function loadGamesForTeam(slug) {
  const gid = TEAM_GIDS[slug];
  if (gid === undefined) return [];

  const url = `${GAMES_SHEET}&gid=${gid}`;
  return await fetchCSV(url);
}

// ========== GAMES TABLE RENDER ==========

function renderGames(games) {
  const tbody = document.getElementById("games-table-body");
  tbody.innerHTML = "";

  games.forEach((g) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.date}</td>
      <td>${g.opponent}</td>
      <td>${g.result}</td>
      <td>${g.score_team} - ${g.score_opponent}</td>
      <td>${g.season}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ========== LEADERS ==========

function computeLeaders(playerStats) {
  const stats = {};

  playerStats.forEach((p) => {
    const total = {
      gp: 0, pts: 0, reb: 0, oreb: 0, dreb: 0,
      ast: 0, stl: 0, blk: 0, to: 0, fg_pct: 0, tp_pct: 0,
    };

    p.rows.forEach((r) => {
      total.gp++;
      total.pts += Number(r.pts || 0);
      total.reb += Number(r.totrb || 0);
      total.oreb += Number(r.or || 0);
      total.dreb += Number(r.dr || 0);
      total.ast += Number(r.ass || 0);
      total.stl += Number(r.st || 0);
      total.blk += Number(r.bs || 0);
      total.to += Number(r.to || 0);
    });

    stats[p.slug] = total;
  });

  return stats;
}

function renderLeaders(stats, players) {
  const tbody = document.getElementById("leaders-body");
  tbody.innerHTML = "";

  for (const slug in stats) {
    const p = players.find((x) => x.slug === slug);
    if (!p) continue;

    const s = stats[slug];
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${s.gp}</td>
      <td>${s.pts}</td>
      <td>${s.reb}</td>
      <td>${s.oreb}</td>
      <td>${s.dreb}</td>
      <td>${s.ast}</td>
      <td>${s.stl}</td>
      <td>${s.blk}</td>
      <td>${s.to}</td>
      <td>${((s.fg_pct) || 0).toFixed(1)}%</td>
      <td>${((s.tp_pct) || 0).toFixed(1)}%</td>
    `;

    tbody.appendChild(tr);
  }
}

// ========== RECORDS (SEASON HIGHS) ==========

function computeRecords(playerStats) {
  const highest = {
    pts: null, reb: null, oreb: null, dreb: null,
    ast: null, stl: null, blk: null, threes: null,
  };

  playerStats.forEach((p) => {
    p.rows.forEach((g) => {
      const stats = {
        pts: Number(g.pts || 0),
        reb: Number(g.totrb || 0),
        oreb: Number(g.or || 0),
        dreb: Number(g.dr || 0),
        ast: Number(g.ass || 0),
        stl: Number(g.st || 0),
        blk: Number(g.bs || 0),
        threes: Number(g["3p"] || 0),
      };

      for (const k in stats) {
        if (!highest[k] || stats[k] > highest[k].value) {
          highest[k] = { value: stats[k], slug: p.slug };
        }
      }
    });
  });

  return highest;
}

function renderRecords(records, players) {
  const grid = document.getElementById("records-grid");
  grid.innerHTML = "";

  for (const k in records) {
    const r = records[k];
    const p = players.find((x) => x.slug === r.slug);

    const div = document.createElement("div");
    div.className = "record-tile";
    div.innerHTML = `
      <div class="record-stat">${k.toUpperCase()}</div>
      <div class="record-value">${r.value}</div>
      <div class="record-player">${p.name}</div>
    `;
    grid.appendChild(div);
  }
}

// ========== INIT PAGE ==========

async function initTeamPage() {
  initTabs();

  const slug = getTeamSlug();
  const teams = await loadTeamsJSON();
  const team = teams.find((t) => t.slug === slug);

  if (!team) {
    console.error("Team not found:", slug);
    return;
  }

  // Fill team header
  document.getElementById("team-logo").src = team.logo;
  document.getElementById("team-name").textContent = team.name;

  // Load roster
  const playersRes = await fetch("data/players.json");
  const players = await playersRes.json();
  renderRoster(team, players);

  // Load player stats
  const playerStats = await loadPlayerStatsForTeam(team);

  // Leaders
  const leaders = computeLeaders(playerStats);
  renderLeaders(leaders, players);

  // Records
  const records = computeRecords(playerStats);
  renderRecords(records, players);

  // Games
  const games = await loadGamesForTeam(slug);
  renderGames(games);
}

// Initialize
initTeamPage();
