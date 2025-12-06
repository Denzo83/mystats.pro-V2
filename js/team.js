// js/team.js

import {
  toNum,
  fmtNumber,
  fmtPct,
  parseCsv,
  getYearAndSeasonLabel
} from "./app.js";

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

async function loadCsv(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load CSV ${path}`);
  const text = await res.text();
  return parseCsv(text);
}

function createPlayerCard(id, player) {
  const img = player.image
    ? `assets/${player.image}`
    : "assets/placeholder-player.png";

  const number = player.number ? `#${player.number} · ` : "";
  const pos = player.position || "";

  return `
    <a class="card" href="player.html?player=${encodeURIComponent(id)}">
      <div class="card__media">
        <img src="${img}" alt="${player.name}">
      </div>
      <div class="card__body">
        <div class="card__title">${player.name}</div>
        <div class="card__meta">${number}${pos}</div>
      </div>
    </a>
  `;
}

// Build a map from season label -> numeric weight for sorting
function seasonWeight(label) {
  if (!label) return 0;
  const parts = label.split(" ");
  if (parts.length < 2) return 0;
  const year = parseInt(parts[0], 10) || 0;
  const season = parts[1];
  const orderMap = { Summer: 1, Autumn: 2, Winter: 3, Spring: 4 };
  const ord = orderMap[season] || 0;
  return year * 10 + ord;
}

function renderHero(teamHeroEl, team) {
  const logo = team.logo ? `assets/${team.logo}` : "assets/placeholder-team.png";
  teamHeroEl.innerHTML = `
    <div class="team-hero__card">
      <div class="team-hero__media">
        <img src="${logo}" alt="${team.name}">
      </div>
      <div class="team-hero__body">
        <h1 class="team-hero__name">${team.name}</h1>
        <div class="team-hero__meta">${team.league || ""}</div>
      </div>
    </div>
  `;
}

function renderRoster(rosterEl, teamPlayers) {
  rosterEl.innerHTML = teamPlayers
    .map(([id, player]) => createPlayerCard(id, player))
    .join("");
}

function buildGameRecords(allGamesRaw) {
  const games = [];

  for (const entry of allGamesRaw) {
    const { playerId, playerName, row } = entry;
    const { year, seasonLabel } = getYearAndSeasonLabel(row.date);
    const phase = row.phase || "regular";

    const game = {
      playerId,
      playerName,
      date: row.date,
      opponent: row.opponent || "",
      result: row.result || "",
      seasonLabel,
      year,
      phase,
      min: toNum(row.min),
      pts: toNum(row.pts),
      reb: toNum(row.totrb || row.reb),
      ast: toNum(row.ass),
      stl: toNum(row.st),
      blk: toNum(row.bs),
      fgMade: toNum(row.fg),
      fgAtt: toNum(row.fga),
      threeMade: toNum(row["3p"]),
      threeAtt: toNum(row["3pa"]),
      ftMade: toNum(row.ft),
      ftAtt: toNum(row.fta)
    };

    games.push(game);
  }

  return games;
}

function getSeasonOptions(games) {
  const labels = new Set();
  for (const g of games) {
    if (g.seasonLabel) labels.add(g.seasonLabel);
  }
  const arr = Array.from(labels);
  arr.sort((a, b) => seasonWeight(a) - seasonWeight(b));
  return arr;
}

function filterGamesBySeason(games, seasonLabel) {
  if (!seasonLabel || seasonLabel === "all") return games;
  return games.filter((g) => g.seasonLabel === seasonLabel);
}

function renderGamesTable(tbody, games) {
  // group by date/season/opponent/result
  const gameMap = new Map();

  for (const g of games) {
    const key = `${g.date}|${g.seasonLabel}|${g.opponent}|${g.result}`;
    if (!gameMap.has(key)) {
      gameMap.set(key, {
        date: g.date,
        seasonLabel: g.seasonLabel,
        opponent: g.opponent,
        result: g.result,
        scores: []
      });
    }
    const entry = gameMap.get(key);
    entry.scores.push(`${g.playerName} ${g.pts}`);
  }

  const grouped = Array.from(gameMap.values());
  grouped.sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    return da - db;
  });

  tbody.innerHTML = grouped
    .map(
      (g) => `
      <tr>
        <td>${g.date}</td>
        <td>${g.seasonLabel || ""}</td>
        <td>${g.opponent}</td>
        <td>${g.result}</td>
        <td>${g.scores.join(", ")}</td>
      </tr>
    `
    )
    .join("");
}

function renderLeadersTable(tbody, games) {
  const byPlayer = new Map();

  for (const g of games) {
    if (!byPlayer.has(g.playerId)) {
      byPlayer.set(g.playerId, {
        playerId: g.playerId,
        name: g.playerName,
        gp: 0,
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        fgMade: 0,
        fgAtt: 0,
        threeMade: 0,
        threeAtt: 0,
        ftMade: 0,
        ftAtt: 0
      });
    }
    const p = byPlayer.get(g.playerId);
    p.gp += 1;
    p.pts += g.pts;
    p.reb += g.reb;
    p.ast += g.ast;
    p.stl += g.stl;
    p.blk += g.blk;
    p.fgMade += g.fgMade;
    p.fgAtt += g.fgAtt;
    p.threeMade += g.threeMade;
    p.threeAtt += g.threeAtt;
    p.ftMade += g.ftMade;
    p.ftAtt += g.ftAtt;
  }

  const rows = Array.from(byPlayer.values());

  rows.sort((a, b) => b.pts / (b.gp || 1) - a.pts / (a.gp || 1));

  tbody.innerHTML = rows
    .map((p) => {
      const gp = p.gp || 1;
      const pts = p.pts / gp;
      const reb = p.reb / gp;
      const ast = p.ast / gp;
      const stl = p.stl / gp;
      const blk = p.blk / gp;
      const fgPct = fmtPct(p.fgMade, p.fgAtt);
      const threePct = fmtPct(p.threeMade, p.threeAtt);
      const ftPct = fmtPct(p.ftMade, p.ftAtt);

      return `
        <tr>
          <td>${p.name}</td>
          <td>${fmtNumber(pts, 1)}</td>
          <td>${fmtNumber(reb, 1)}</td>
          <td>${fmtNumber(ast, 1)}</td>
          <td>${fmtNumber(stl, 1)}</td>
          <td>${fmtNumber(blk, 1)}</td>
          <td>${fgPct}</td>
          <td>${threePct}</td>
          <td>${ftPct}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSeasonHighs(container, games) {
  const categories = {
    pts: { label: "Points" },
    reb: { label: "Rebounds" },
    ast: { label: "Assists" },
    stl: { label: "Steals" },
    blk: { label: "Blocks" }
  };

  const highs = {};
  for (const key of Object.keys(categories)) {
    highs[key] = null;
  }

  for (const g of games) {
    const vals = {
      pts: g.pts,
      reb: g.reb,
      ast: g.ast,
      stl: g.stl,
      blk: g.blk
    };
    for (const [cat, v] of Object.entries(vals)) {
      if (!v && v !== 0) continue;
      const current = highs[cat];
      if (!current || v > current.value) {
        highs[cat] = {
          value: v,
          playerName: g.playerName,
          playerId: g.playerId,
          opponent: g.opponent,
          date: g.date
        };
      }
    }
  }

  container.innerHTML = Object.entries(categories)
    .map(([key, meta]) => {
      const high = highs[key];
      if (!high) return "";
      const desc = `${high.value} — ${high.playerName} vs ${high.opponent}`;
      return `
        <a class="season-high-card" href="player.html?player=${encodeURIComponent(
          high.playerId
        )}">
          <div class="season-high-card__body">
            <div class="season-high-card__label">${meta.label}</div>
            <div class="season-high-card__detail">${desc}</div>
          </div>
        </a>
      `;
    })
    .join("");
}

async function initTeamPage() {
  const teamId = getQueryParam("team");
  const teamHeroEl = document.getElementById("team-hero");
  const rosterEl = document.getElementById("team-roster");
  const gamesBody = document.querySelector("#team-games-table tbody");
  const leadersBody = document.querySelector("#team-leaders-table tbody");
  const highsContainer = document.getElementById("season-highs-grid");
  const seasonSelect = document.getElementById("team-season-select");

  if (!teamId || !teamHeroEl) return;

  const teams = await loadJSON("data/teams.json");
  const players = await loadJSON("data/players.json");

  const team = teams[teamId];
  if (!team) {
    teamHeroEl.innerHTML = `<p>Team not found.</p>`;
    return;
  }

  // Render hero
  renderHero(teamHeroEl, team);

  // Find players on this team
  const teamPlayersEntries = Object.entries(players).filter(([id, p]) => {
    if (Array.isArray(p.teams)) return p.teams.includes(teamId);
    return p.team === teamId;
  });

  // Render roster
  renderRoster(rosterEl, teamPlayersEntries);

  // Load all player CSVs for this team
  const allGamesRaw = [];
  await Promise.all(
    teamPlayersEntries.map(async ([playerId, player]) => {
      if (!player.csv) return;
      try {
        const rows = await loadCsv(player.csv);
        for (const row of rows) {
          allGamesRaw.push({
            playerId,
            playerName: player.name,
            row
          });
        }
      } catch (err) {
        console.error("Error loading CSV for", playerId, err);
      }
    })
  );

  const allGames = buildGameRecords(allGamesRaw);
  const seasonOptions = getSeasonOptions(allGames);

  // Populate season select
  seasonSelect.innerHTML =
    `<option value="all">All seasons</option>` +
    seasonOptions
      .map((label) => `<option value="${label}">${label}</option>`)
      .join("");

  function refreshForSeason() {
    const selected = seasonSelect.value || "all";
    const filtered = filterGamesBySeason(allGames, selected);
    renderGamesTable(gamesBody, filtered);
    renderLeadersTable(leadersBody, filtered);
    renderSeasonHighs(highsContainer, filtered);
  }

  seasonSelect.addEventListener("change", refreshForSeason);

  // Initial render
  refreshForSeason();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTeamPage);
} else {
  initTeamPage();
}
