// js/home.js

// We only need app.js for its side-effects (theme). No named imports required.
import "./app.js";

async function loadJSON(path) {
  const res = await fetch(path);
  return await res.json();
}

function createTeamCard(id, team) {
  const logo = team.logo ? `assets/${team.logo}` : "assets/placeholder-team.png";

  return `
    <a class="card" href="team.html?team=${encodeURIComponent(id)}">
      <div class="card__media">
        <img src="${logo}" alt="${team.name}">
      </div>
      <div class="card__body">
        <div class="card__title">${team.name}</div>
        <div class="card__meta">${team.league || ""}</div>
      </div>
    </a>
  `;
}

function createPlayerCard(id, player) {
  const img = player.image
    ? `assets/${player.image}`
    : "assets/placeholder-player.png";

  const number = player.number ? `#${player.number} · ` : "";
  const pos = player.position || "";
  const team = player.teamName ? ` · ${player.teamName}` : "";

  return `
    <a class="card card--player" href="player.html?player=${encodeURIComponent(
      id
    )}">
      <div class="card__media">
        <img src="${img}" alt="${player.name}">
      </div>
      <div class="card__body">
        <div class="card__title">${player.name}</div>
        <div class="card__meta">${number}${pos}${team}</div>
      </div>
    </a>
  `;
}


async function initHomePage() {
  const teamsGrid = document.getElementById("teams-grid");
  const playersGrid = document.getElementById("players-grid");

  if (!teamsGrid || !playersGrid) return;

  const teams = await loadJSON("data/teams.json");
  const players = await loadJSON("data/players.json");

  // Render teams
  teamsGrid.innerHTML = Object.entries(teams)
    .map(([id, team]) => createTeamCard(id, team))
    .join("");

  // Render players
  playersGrid.innerHTML = Object.entries(players)
    .map(([id, player]) => createPlayerCard(id, player))
    .join("");
}

initHomePage();
