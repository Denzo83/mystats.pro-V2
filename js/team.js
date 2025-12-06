// =================== CONFIG ===================

// Base for all published CSV docs
const CSV_BASE = "https://docs.google.com/spreadsheets/d/e";

// Sheet IDs from "Publish to web" (Entire document, CSV)
const SHEETS = {
  players: "2PACX-1vQs0O8Qs1fcS3bth-xMxcjqAX0CchbqLYOpQbfOQvf8xJdpSkNl3I09OEwuvfWYehtQX5a6LUqelFdsg",
  games:   "2PACX-1vR7JWjsxi4ZtJtf6PTOR6_adf9pdbtFlglN8aX2_3QynveLtg427bYcDO0zlFpxEoNaMFYwaIFj12T",
  box:     "2PACX-1vSGdu88uH_BwBwrBtCZdnvGR1CNDWiazKjW_slOjBAvOMH7kOqJxNtWivNY1I3PfLLZhOyaPH43bZyb2"
};

// GIDs for player tabs (from your meta rows)
const PLAYER_GIDS = {
  "kyle-denzin":        0,
  "levi-denzin":        2091114860,
  "findlay-wendtman":   863688176,
  "jackson-neaves":     699860431,
  "ethan-todd":         450610169,
  "josh-todd":          2116571222,
  "callan-beamish":     430866216,
  "jarren-owen":        1191745424,
  "rhys-ogle":          298458955
};

// GIDs for team tabs in Mystats.pro_Games
const TEAM_GIDS = {
  "pretty-good":      0,        // Pretty Good tab
  "chuckers-chuckers": 26509490 // Chuckers Chuckers tab
};

// Team / boxscore config
const BOXSCORE_INDEX_GID = 0;

// URL helper
function getCsvUrl(sheetKey, gid) {
  const id = SHEETS[sheetKey];
  if (!id) throw new Error(`Unknown sheet key: ${sheetKey}`);
  return `${CSV_BASE}/${id}/pub?gid=${gid}&single=true&output=csv`;
}

// Basic CSV fetch
async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) {
    console.error("CSV fetch failed", url, res.status, res.statusText);
    throw new Error(`Failed to fetch CSV: ${res.status}`);
  }
  const text = await res.text();
  return parseCSV(text);
}

// Safe wrapper (returns [] on failure)
async function fetchCsvSafe(url) {
  try {
    return await fetchCSV(url);
  } catch (err) {
    console.error("fetchCsvSafe error for", url, err);
    return [];
  }
}

// Very small CSV parser (no quoted commas support needed here)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (parts[i] ?? "").trim();
    });
    return obj;
  });
}

// =================== TEAM LOOKUP ===================

// This should match your teams.json structure
const TEAM_DEFS = {
  "pretty-good": {
    slug: "pretty-good",
    name: "Pretty Good Basketball Team",
    logo: "assets/teams/pretty-good.png",
    roster: [
      "kyle-denzin",
      "levi-denzin",
      "findlay-wendtman",
      "jackson-neaves",
      "ethan-todd",
      "josh-todd",
      "callan-beamish",
      "jarren-owen",
      "rhys-ogle"
    ]
  },
  "chuckers-chuckers": {
    slug: "chuckers-chuckers",
    name: "Chuckers Chuckers",
    logo: "assets/teams/chuckers-logo.png",
    roster: [
      "findlay-wendtman",
      "jackson-neaves"
    ]
  }
};

// Basic query param helper
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// =================== DATA LOADERS ===================

// ---- Player stats (tab-per-player CSV) ----
async function loadRosterPlayerRows(team) {
  const rosterWithUrls = team.roster
    .map((slug) => {
      const gid = PLAYER_GIDS[slug];
      if (gid === undefined) {
        console.warn("No PLAYER_GID for slug", slug);
        return null;
      }
      const url = getCsvUrl("players", gid);
      return { slug, url };
    })
    .filter(Boolean);

  if (!rosterWithUrls.length) return {};

  const results = await Promise.all(
    rosterWithUrls.map((p) => fetchCsvSafe(p.url))
  );

  const byPlayer = {};
  rosterWithUrls.forEach((p, idx) => {
    byPlayer[p.slug] = results[idx] || [];
  });
  return byPlayer;
}

// ---- Games (tab-per-team CSV) ----
async function loadGamesForTeam(slug) {
  const gid = TEAM_GIDS[slug];
  if (gid === undefined) {
    console.warn("No TEAM_GID for slug", slug);
    return [];
  }
  const url = getCsvUrl("games", gid);
  return await fetchCsvSafe(url);
}

// ---- Boxscore index (single sheet) ----
async function loadBoxscoreIndex() {
  const url = getCsvUrl("box", BOXSCORE_INDEX_GID);
  return await fetchCsvSafe(url);
}

// =================== RENDER HELPERS ===================

// Safely get an element
function $(id) {
  return document.getElementById(id);
}

// Render roster cards
function renderRoster(team, playerRowsBySlug) {
  const container = $("roster-container");
  if (!container) return;

  container.innerHTML = "";

  team.roster.forEach((slug) => {
    const rows = playerRowsBySlug[slug] || [];
    const playerName = slug
      .split("-")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(" ");

    const card = document.createElement("div");
    card.className = "player-card";

    const img = document.createElement("img");
    img.src = `assets/players/${slug}.png`;
    img.alt = playerName;
    img.className = "player-card__image";

    const nameLink = document.createElement("a");
    nameLink.href = `player.html?player=${slug}`;
    nameLink.textContent = playerName;
    nameLink.className = "player-card__name";

    card.appendChild(img);
    card.appendChild(nameLink);

    container.appendChild(card);
  });
}

// Simple games table
function renderGames(games, teamSlug) {
  const tbody = $("games-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!games.length) return;

  games.forEach((g) => {
    const tr = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = g.date || "";
    tr.appendChild(dateCell);

    const oppCell = document.createElement("td");
    const isTeam1 = g.team1_slug === teamSlug;
    const opponent = isTeam1 ? g.team2 : g.team1;
    oppCell.textContent = opponent || "";
    tr.appendChild(oppCell);

    const resultCell = document.createElement("td");
    const score1 = parseInt(g.score_team1 || "0", 10);
    const score2 = parseInt(g.score_team2 || "0", 10);
    const isWin =
      (isTeam1 && score1 > score2) || (!isTeam1 && score2 > score1);
    const isLoss =
      (isTeam1 && score1 < score2) || (!isTeam1 && score2 < score1);

    if (isWin) resultCell.textContent = "W";
    else if (isLoss) resultCell.textContent = "L";
    else resultCell.textContent = "-";

    tr.appendChild(resultCell);

    const scoreCell = document.createElement("td");
    scoreCell.textContent = `${score1} - ${score2}`;
    tr.appendChild(scoreCell);

    const seasonCell = document.createElement("td");
    seasonCell.textContent = g.season || "";
    tr.appendChild(seasonCell);

    tbody.appendChild(tr);
  });
}

// Very simple leaders table (totals only for now)
function renderLeaders(playerRowsBySlug, team) {
  const tbody = $("leaders-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const stats = team.roster.map((slug) => {
    const rows = playerRowsBySlug[slug] || [];
    const totals = rows.reduce(
      (acc, r) => {
        acc.gp += 1;
        acc.pts += Number(r.pts || 0);
        acc.reb += Number(r.totrb || 0);
        acc.oreb += Number(r.or || 0);
        acc.dreb += Number(r.dr || 0);
        acc.ast += Number(r.ass || 0);
        acc.stl += Number(r.stl || 0);
        acc.blk += Number(r.blk || 0);
        acc.to += Number(r.to || 0);
        acc.fgm += Number(r.fg || 0);
        acc.fga += Number(r.fga || 0);
        acc.tpm += Number(r.threep || 0);
        acc.tpa += Number(r.threepa || 0);
        acc.ftm += Number(r.ft || 0);
        acc.fta += Number(r.fta || 0);
        return acc;
      },
      {
        slug,
        gp: 0,
        pts: 0,
        reb: 0,
        oreb: 0,
        dreb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        to: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0
      }
    );

    totals.fgPct = totals.fga ? (totals.fgm / totals.fga) * 100 : 0;
    totals.tpPct = totals.tpa ? (totals.tpm / totals.tpa) * 100 : 0;
    return totals;
  });

  stats.forEach((p) => {
    const tr = document.createElement("tr");
    const name = p.slug
      .split("-")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(" ");

    function td(val) {
      const cell = document.createElement("td");
      cell.textContent = val;
      tr.appendChild(cell);
    }

    td(name);
    td(p.gp);
    td(p.pts);
    td(p.reb);
    td(p.oreb);
    td(p.dreb);
    td(p.ast);
    td(p.stl);
    td(p.blk);
    td(p.to);
    td(p.fgPct.toFixed(1) + "%");
    td(p.tpPct.toFixed(1) + "%");

    tbody.appendChild(tr);
  });
}

// Records (season highs etc.) – placeholder for now
function renderRecords() {
  const container = $("records-container");
  if (!container) return;
  // You can plug in your season-high logic here later
}

// =================== INIT ===================

async function initTeamPage() {
  const slug = getQueryParam("team") || "pretty-good";
  const team = TEAM_DEFS[slug];

  if (!team) {
    console.error("Team not found", slug);
    return;
  }

  // Header
  const nameEl = $("team-name");
  if (nameEl) nameEl.textContent = team.name;

  const logoEl = $("team-logo");
  if (logoEl) {
    logoEl.src = team.logo;
    logoEl.alt = team.name;
  }

  // Load data
  const [playerRowsBySlug, games, boxIndex] = await Promise.all([
    loadRosterPlayerRows(team),
    loadGamesForTeam(slug),
    loadBoxscoreIndex()
  ]);

  // Render sections
  renderRoster(team, playerRowsBySlug);
  renderGames(games, slug);
  renderLeaders(playerRowsBySlug, team);
  renderRecords(boxIndex);
}

// Run on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initTeamPage().catch((err) => console.error("initTeamPage error", err));
});
