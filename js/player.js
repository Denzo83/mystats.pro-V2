/* --------------------------------------------------
   mystats.pro V2.5 — PLAYER PAGE ENGINE
-------------------------------------------------- */

// Uses the global utility functions attached to MYSTATS in app.js (e.g., MYSTATS.toNumber, MYSTATS.sumBy, MYSTATS.parseCsv)

const PLAYER_SHEET =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsO8Qs1fcSc3bth-xMxcjAXOCchbqLYQpObfOQvf8xJdpSkNl3I09OEwuvfWYehtQX5a6LQIeIFdsg/pub?output=csv";

// Maps player slug to the gid of their stats sheet tab
const PLAYER_GIDS = {
  "kyle-denzin": 0,
  "levi-denzin": 2091114860,
  "findlay-wendtman": 863688176,
  "jackson-neaves": 699060431,
  "ethan-todd": 450610169,
  "josh-todd": 2116571222,
  "callan-beamish": 430866216,
  "jarren-owen": 1191745424,
  "rhys-ogle": 298458955
};

function getPlayerSlug() {
  const url = new URL(window.location.href);
  return url.searchParams.get("player_slug");
}

async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  // Use the global utility defined in app.js
  if (typeof MYSTATS === 'object' && MYSTATS.parseCsv) {
    return MYSTATS.parseCsv(text);
  }
  // Basic CSV Fallback (if MYSTATS is not loaded yet/correctly)
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines.length === 0) return [];
  const headers = lines.shift().split(",").map(h => h.trim());
  
  return lines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const cols = line.split(",");
      const row = {};
      headers.forEach((h, i) => (row[h] = (cols[i] || "").trim()));
      return row;
    });
}

async function loadTeamsJSON() {
  const res = await fetch("data/teams.json");
  return res.json();
}

async function loadPlayersJSON() {
  const res = await fetch("data/players.json");
  return res.json();
}

async function loadPlayerStats(playerSlug) {
  const gid = PLAYER_GIDS[playerSlug];
  if (gid === undefined) return [];
  const url = `${PLAYER_SHEET}&gid=${gid}`;
  const rows = await fetchCSV(url);
  
  // Use MYSTATS.toNumber for safe parsing
  const toNumber = (typeof MYSTATS === 'object' && MYSTATS.toNumber) ? MYSTATS.toNumber : (v) => Number(v) || 0;

  return rows.map(r => ({
    ...r,
    gp: 1, 
    pts: toNumber(r.pts),
    trb: toNumber(r.totrb), // Total Rebounds
    ast: toNumber(r.ass), // Assists
    stl: toNumber(r.st), // Steals
    blk: toNumber(r.bs), // Blocks
    tov: toNumber(r.to), // Turnovers
    fgm: toNumber(r.fg),
    fga: toNumber(r.fga),
    '3pm': toNumber(r['3p']),
    '3pa': toNumber(r['3pa']),
    ftm: toNumber(r.ft),
    fta: toNumber(r.fta),
    oreb: toNumber(r.or),
    dreb: toNumber(r.dr),
    pf: toNumber(r.pf),
    // Assuming 'game_id' is present for boxscore links
    game_id: r.game_id || null, 
  }));
}

function renderHeader(player, team) {
  document.getElementById("player-name").textContent = player.name;
  document.getElementById("player-meta").innerHTML = `
    #${player.number} | ${player.position} | Team: <a href="team.html?team_slug=${team.slug}">${team.name}</a>
  `;
  document.getElementById("player-image").src = player.image;
  document.getElementById("player-image").alt = player.name;
}

function renderStatSummary(stats) {
  const sumBy = (typeof MYSTATS === 'object' && MYSTATS.sumBy) ? MYSTATS.sumBy : (arr, keyFn) => arr.reduce((acc, curr) => acc + keyFn(curr), 0);
  
  const statNames = [
    { key: 'gp', name: 'Games Played' },
    { key: 'pts', name: 'Points' },
    { key: 'trb', name: 'Rebounds' },
    { key: 'ast', name: 'Assists' },
    { key: 'stl', name: 'Steals' },
    { key: 'blk', name: 'Blocks' },
  ];

  const tableBody = document.getElementById("player-summary-body");
  tableBody.innerHTML = '';

  const totals = statNames.reduce((acc, stat) => {
    acc[stat.key] = sumBy(stats, (r) => r[stat.key]);
    return acc;
  }, {});
  
  const avg = statNames.reduce((acc, stat) => {
    acc[stat.key] = totals.gp > 0 ? (totals[stat.key] / totals.gp).toFixed(1) : 0;
    return acc;
  }, {});

  statNames.forEach(stat => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${stat.name}</td>
      <td class="numeric">${totals[stat.key]}</td>
      <td class="numeric">${avg[stat.key]}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function renderGameLog(stats, teams) {
  const tbody = document.getElementById("player-gamelog-body");
  tbody.innerHTML = '';
  
  // Reverse the order to show most recent games first
  [...stats].reverse().forEach(r => {
    const opponent = teams.find(t => t.slug === r.opponent_slug);
    const opponentName = opponent ? opponent.name : 'Unknown Opponent';
    
    const tr = document.createElement("tr");
    tr.className = r.game_id ? "clickable" : "";
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.season}</td>
      <td>${r.phase}</td>
      <td><a href="team.html?team_slug=${r.opponent_slug}">${opponentName}</a></td>
      <td>${r.result}</td>
      <td>${r.score_team} - ${r.score_opponent}</td>
      <td class="numeric">${r.pts}</td>
      <td class="numeric">${r.totrb}</td>
      <td class="numeric">${r.ass}</td>
      <td class="numeric">${r.stl}</td>
      <td class="numeric">${r.bs}</td>
      <td class="numeric">${r.to}</td>
      <td class="numeric">${r.fg}/${r.fga}</td>
      <td class="numeric">${r['3p']}/${r['3pa']}</td>
      <td class="numeric">${r.ft}/${r.fta}</td>
    `;

    if (r.game_id) {
        tr.addEventListener("click", () => {
            window.location.href = `boxscore.html?game_id=${r.game_id}`;
        });
    }

    tbody.appendChild(tr);
  });
}

// --- INIT ---

async function initPlayerPage() {
  const playerSlug = getPlayerSlug();
  const [playersMeta, teams] = await Promise.all([
    loadPlayersJSON(),
    loadTeamsJSON(),
  ]);
  
  const player = playersMeta.find(p => p.slug === playerSlug);

  if (!player) {
    document.getElementById("player-name").textContent = "Player Not Found";
    return;
  }
  
  const team = teams.find(t => t.roster.includes(playerSlug));

  const defaultTeam = { slug: '', name: 'No Team' };
  renderHeader(player, team || defaultTeam);

  const stats = await loadPlayerStats(playerSlug);

  if (stats.length === 0) {
    document.getElementById("player-summary-body").innerHTML = 
      '<tr><td colspan="3">No stats available.</td></tr>';
    document.getElementById("player-gamelog-body").innerHTML =
      '<tr><td colspan="15">No game log available.</td></tr>';
    return;
  }
  
  renderStatSummary(stats);
  renderGameLog(stats, teams);
}

document.addEventListener('DOMContentLoaded', initPlayerPage);