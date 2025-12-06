/* --------------------------------------------------
   mystats.pro V2.5 — BOXSCORE PAGE
-------------------------------------------------- */

// Index of all games + boxscore CSV URLs
// Uses your existing sheet: mystats.pro_Boxscore
// Headers: game_id, date, team1_slug, team2_slug, score_team1, score_team2, csv_url, season, phase
const BOXSCORE_INDEX_CSV =
  "https://docs.google.com/spreadsheets/d/15zxpQZJamQfEz07qFtZAI_738cI2rjc2qrrz-q-8Bo0/export?format=csv&gid=0";

// Expected per-game boxscore CSV headers (one tab per game):
// player, team, fg, fga, 3p, 3pa, ft, fta, or, dr, totrb, ass, pf, st, bs, to, pts
// (If your header names differ slightly, we still try to map gracefully.)

// ---------- CSV HELPERS ----------

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(raw) {
  const lines = raw.replace(/\r/g, "").split("\n");
  const headers = lines.shift().split(",");

  return lines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const cols = line.split(",");
      const row = {};
      headers.forEach((h, i) => (row[h] = cols[i]));
      return row;
    });
}

// ---------- URL & DATA LOADING ----------

function getGameId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("game_id");
}

async function loadTeamsJSON() {
  const res = await fetch("data/teams.json");
  return res.json();
}

async function loadGameMeta(gameId) {
  const rows = await fetchCSV(BOXSCORE_INDEX_CSV);
  return rows.find((r) => r.game_id === gameId);
}

async function loadGameBoxCSV(csvUrl) {
  if (!csvUrl || csvUrl.toLowerCase() === "n/a") return [];
  return fetchCSV(csvUrl);
}

// ---------- RENDERING ----------

function resolveTeamName(slug, teams) {
  const t = teams.find((team) => team.slug === slug);
  return t ? t.name : slug;
}

function renderHeader(meta, teams) {
  const titleEl = document.getElementById("boxscore-title");
  const metaEl = document.getElementById("boxscore-meta");

  const t1Name = resolveTeamName(meta.team1_slug, teams);
  const t2Name = resolveTeamName(meta.team2_slug, teams);

  titleEl.textContent = `${t1Name} ${meta.score_team1} – ${meta.score_team2} ${t2Name}`;

  const bits = [];
  if (meta.date) bits.push(meta.date);
  if (meta.season) bits.push(meta.season);
  if (meta.phase) bits.push(capitalize(meta.phase));
  metaEl.textContent = bits.join(" • ");

  document.getElementById("team1-name").textContent = t1Name;
  document.getElementById("team2-name").textContent = t2Name;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderTeamTable(tbodyId, rows, teamSlug) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";

  const teamRows = rows.filter((r) => (r.team || "").toLowerCase() === (teamSlug || "").toLowerCase());

  if (teamRows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="14">No boxscore data for this team.</td>`;
    tbody.appendChild(tr);
    return;
  }

  teamRows.forEach((r) => {
    const tr = document.createElement("tr");

    const playerName = r.player || r.Player || r.name || "";
    const teamName = r.team || "";

    const fg = `${safe(r.fg)}/${safe(r.fga)}`;
    const tp = `${safe(r["3p"])}/${safe(r["3pa"])}`;
    const ft = `${safe(r.ft)}/${safe(r.fta)}`;

    tr.innerHTML = `
      <td>${playerName}</td>
      <td>${teamName}</td>
      <td>${fg}</td>
      <td>${tp}</td>
      <td>${ft}</td>
      <td>${safe(r.or)}</td>
      <td>${safe(r.dr)}</td>
      <td>${safe(r.totrb)}</td>
      <td>${safe(r.ass)}</td>
      <td>${safe(r.st)}</td>
      <td>${safe(r.bs)}</td>
      <td>${safe(r.to)}</td>
      <td>${safe(r.pf)}</td>
      <td>${safe(r.pts)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function safe(v) {
  if (v === undefined || v === null || v === "") return 0;
  return v;
}

// ---------- INIT ----------

async function initBoxscorePage() {
  const gameId = getGameId();
  if (!gameId) {
    console.error("No game_id in URL");
    document.getElementById("boxscore-title").textContent = "Boxscore not found";
    document.getElementById("boxscore-meta").textContent = "Missing game_id parameter.";
    return;
  }

  const teams = await loadTeamsJSON();
  const meta = await loadGameMeta(gameId);

  if (!meta) {
    console.error("Game not found:", gameId);
    document.getElementById("boxscore-title").textContent = "Boxscore not found";
    document.getElementById("boxscore-meta").textContent = "Game ID not found in index.";
    return;
  }

  renderHeader(meta, teams);

  const rows = await loadGameBoxCSV(meta.csv_url);

  if (!rows || rows.length === 0) {
    document.getElementById("team1-body").innerHTML =
      "<tr><td colspan='14'>No boxscore CSV available for this game.</td></tr>";
    document.getElementById("team2-body").innerHTML =
      "<tr><td colspan='14'>No boxscore CSV available for this game.</td></tr>";
    return;
  }

  // Render team tables by slug from index
  renderTeamTable("team1-body", rows, meta.team1_slug);
  renderTeamTable("team2-body", rows, meta.team2_slug);
}

initBoxscorePage();
