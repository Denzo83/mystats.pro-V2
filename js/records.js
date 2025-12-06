/* --------------------------------------------------
   mystats.pro V2.5 — RECORDS (SEASON HIGHS) PAGE
-------------------------------------------------- */

const PLAYER_GIDS_REC = {
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

const PLAYER_SHEET_REC =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsO8Qs1fcSc3bth-xMxcjAXOCchbqLYQpObfOQvf8xJdpSkNl3I09OEwuvfWYehtQX5a6LQIeIFdsg/pub?output=csv";

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

function getTeamSlug() {
  const url = new URL(window.location.href);
  return url.searchParams.get("team");
}

async function loadTeamsJSON() {
  const res = await fetch("data/teams.json");
  return res.json();
}

async function loadPlayersJSON() {
  const res = await fetch("data/players.json");
  return res.json();
}

async function loadPlayerRowsForTeam(team) {
  const results = [];

  for (const slug of team.roster) {
    const gid = PLAYER_GIDS_REC[slug];
    if (gid === undefined) continue;

    const url = `${PLAYER_SHEET_REC}&gid=${gid}`;
    const rows = await fetchCSV(url);
    results.push({ slug, rows });
  }

  return results;
}

function extractSeasonsFromStats(playerStats) {
  const set = new Set();
  playerStats.forEach((p) => {
    p.rows.forEach((r) => {
      if (r.season) set.add(r.season);
    });
  });
  return Array.from(set).sort();
}

function filterRowsBySeasonPhase(rows, season, phase) {
  return rows.filter((r) => {
    const okS = season === "all" || r.season === season;
    const okP = phase === "all" || r.phase === phase;
    return okS && okP;
  });
}

// Define which stats we track records for
const RECORD_DEFS = [
  { key: "pts",    label: "Points",      field: "pts"   },
  { key: "reb",    label: "Rebounds",    field: "totrb" },
  { key: "oreb",   label: "Off. Rebounds", field: "or"  },
  { key: "dreb",   label: "Def. Rebounds", field: "dr"  },
  { key: "ast",    label: "Assists",     field: "ass"   },
  { key: "stl",    label: "Steals",      field: "st"    },
  { key: "blk",    label: "Blocks",      field: "bs"    },
  { key: "threes", label: "3P Made",     field: "3p"    },
  { key: "fgm",    label: "FG Made",     field: "fg"    },
  { key: "ftm",    label: "FT Made",     field: "ft"    },
  { key: "tov",    label: "Turnovers",   field: "to"    }
  // Percentages and GP could be added later as season records rather than single-game
];

function computeRecords(playerStats) {
  const records = {};
  RECORD_DEFS.forEach((def) => {
    records[def.key] = null;
  });

  playerStats.forEach((p) => {
    const rows = p.filteredRows || p.rows;
    rows.forEach((g) => {
      RECORD_DEFS.forEach((def) => {
        const value = Number(g[def.field] || 0);
        if (!records[def.key] || value > records[def.key].value) {
          records[def.key] = {
            key: def.key,
            label: def.label,
            value,
            slug: p.slug,
            game_id: g.game_id,
            date: g.date,
            opponent: g.opponent
          };
        }
      });
    });
  });

  return records;
}

function renderRecords(records, playersMeta) {
  const grid = document.getElementById("records-grid");
  grid.innerHTML = "";

  Object.keys(records).forEach((k) => {
    const rec = records[k];
    if (!rec) return;

    const player = playersMeta.find((p) => p.slug === rec.slug);
    const playerName = player ? player.name : rec.slug;

    const tile = document.createElement("div");
    tile.className = "record-tile";

    tile.innerHTML = `
      <div class="record-label">${rec.label}</div>
      <div class="record-value">${rec.value}</div>
      <div class="record-player">${playerName}</div>
      <div class="record-meta">${rec.date || ""} ${rec.opponent ? "vs " + rec.opponent : ""}</div>
    `;

    if (rec.game_id) {
      tile.classList.add("clickable");
      tile.addEventListener("click", () => {
        window.location.href = `boxscore.html?game_id=${rec.game_id}`;
      });
    }

    grid.appendChild(tile);
  });
}

async function initRecordsPage() {
  const slug = getTeamSlug();
  const teams = await loadTeamsJSON();
  const playersMeta = await loadPlayersJSON();

  const team = teams.find((t) => t.slug === slug);
  if (!team) {
    console.error("Team not found:", slug);
    return;
  }

  document.getElementById("records-team-name").textContent = team.name;

  // Load stats for all players on the roster
  let playerStats = await loadPlayerRowsForTeam(team);

  // Build season filter
  const seasons = extractSeasonsFromStats(playerStats);
  const seasonFilter = document.getElementById("records-season-filter");
  seasonFilter.innerHTML = `<option value="all">All</option>`;
  seasons.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    seasonFilter.appendChild(opt);
  });

  function applyFilters() {
    const season = seasonFilter.value;
    const phase = document.getElementById("records-phase-filter").value;

    // Filter each player's rows
    playerStats.forEach((p) => {
      p.filteredRows = filterRowsBySeasonPhase(p.rows, season, phase);
    });

    const recs = computeRecords(playerStats);
    renderRecords(recs, playersMeta);
  }

  seasonFilter.addEventListener("change", applyFilters);
  document
    .getElementById("records-phase-filter")
    .addEventListener("change", applyFilters);

  applyFilters();
}

initRecordsPage();
