import {
  getYearAndSeasonLabel,
  parseCsv,
  fmtNumber,
  fmtPct,
  toNum,
} from './app.js';

(async function initTeamPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('team');
  if (!slug) return;

  const [teamsRes, playersRes] = await Promise.all([
    fetch('data/teams.json'),
    fetch('data/players.json'),
  ]);

  const teams = await teamsRes.json();
  const players = await playersRes.json();
  const team = teams[slug];
  if (!team) return;

  renderTeamHero(team);

  const relevantPlayers = Object.entries(players).filter(([_, p]) => {
    if (Array.isArray(p.teams)) return p.teams.includes(slug);
    return p.team === slug;
  });

  const allGames = [];

  for (const [playerSlug, p] of relevantPlayers) {
    if (!p.csv) continue;
    try {
      const res = await fetch(p.csv);
      const text = await res.text();
      const rows = parseCsv(text);
      rows.forEach((r) => {
        const { seasonLabel } = getYearAndSeasonLabel(r.date);
        const pts = toNum(r.pts);
        const reb = toNum(r.totrb || (toNum(r.or) + toNum(r.dr)));
        const ast = toNum(r.ass ?? r.ast);
        const stl = toNum(r.st ?? r.stl);
        const blk = toNum(r.bs ?? r.blk);
        const fgMade = toNum(r.fg);
        const fgAtt = toNum(r.fga);
        const threeMade = toNum(r['3p'] ?? r.three);
        const threeAtt = toNum(r['3pa'] ?? r.threeAtt);
        const ftMade = toNum(r.ft);
        const ftAtt = toNum(r.fta);

        allGames.push({
          playerSlug,
          playerName: p.name,
          seasonLabel,
          date: r.date,
          opponent: r.opponent,
          result: r.result || '',
          pts,
          reb,
          ast,
          stl,
          blk,
          fgMade,
          fgAtt,
          threeMade,
          threeAtt,
          ftMade,
          ftAtt,
        });
      });
    } catch (e) {
      console.error('Error loading CSV for', p.name, e);
    }
  }

  const allSeasonLabels = Array.from(
    new Set(allGames.map((g) => g.seasonLabel).filter((s) => !!s)),
  ).sort();

  setupSeasonDropdown(allSeasonLabels);

  let currentSeasonLabel = allSeasonLabels[allSeasonLabels.length - 1] || null;

  const seasonSelect = document.getElementById('team-season-select');
  seasonSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    currentSeasonLabel = val === 'all' ? null : val;
    syncUI();
  });

  renderRoster(slug, team, players);

  function syncUI() {
    const filtered = currentSeasonLabel
      ? allGames.filter((g) => g.seasonLabel === currentSeasonLabel)
      : allGames;

    renderTeamGamesTable(filtered);
    renderTeamLeadersTable(filtered);
    renderSeasonHighs(computeSeasonHighs(filtered), players);
  }

  syncUI();
})();

function renderTeamHero(team) {
  const heroEl = document.getElementById('team-hero');
  if (!heroEl) return;

  const logoSrc = team.logo ? `assets/${team.logo}` : 'assets/placeholder-team.png';

  heroEl.innerHTML = `
    <div class="team-hero__card">
      <div class="team-hero__media">
        <img src="${logoSrc}" alt="${team.name}" />
      </div>
      <div class="team-hero__body">
        <h1 class="team-hero__name">${team.name}</h1>
        <div class="team-hero__meta">
          ${team.league || ''}
        </div>
      </div>
    </div>
  `;
}

function setupSeasonDropdown(seasonLabels) {
  const select = document.getElementById('team-season-select');
  if (!select) return;

  select.innerHTML = '';

  if (seasonLabels.length > 1) {
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'All seasons';
    select.appendChild(optAll);
  }

  seasonLabels.forEach((label) => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

function renderTeamGamesTable(games) {
  const tbody = document.querySelector('#team-games-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const sorted = [...games].sort((a, b) => (a.date < b.date ? 1 : -1));

  sorted.forEach((g) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.date}</td>
      <td>${g.seasonLabel || ''}</td>
      <td>${g.opponent || ''}</td>
      <td>${g.result || ''}</td>
      <td>${g.pts}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTeamLeadersTable(games) {
  const tbody = document.querySelector('#team-leaders-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const byPlayer = new Map();

  games.forEach((g) => {
    if (!byPlayer.has(g.playerSlug)) {
      byPlayer.set(g.playerSlug, {
        playerSlug: g.playerSlug,
        playerName: g.playerName,
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
        ftAtt: 0,
      });
    }
    const agg = byPlayer.get(g.playerSlug);
    agg.gp += 1;
    agg.pts += g.pts;
    agg.reb += g.reb;
    agg.ast += g.ast;
    agg.stl += g.stl;
    agg.blk += g.blk;
    agg.fgMade += g.fgMade;
    agg.fgAtt += g.fgAtt;
    agg.threeMade += g.threeMade;
    agg.threeAtt += g.threeAtt;
    agg.ftMade += g.ftMade;
    agg.ftAtt += g.ftAtt;
  });

  const rows = Array.from(byPlayer.values()).map((p) => ({
    ...p,
    ptsPer: p.gp ? p.pts / p.gp : 0,
    rebPer: p.gp ? p.reb / p.gp : 0,
    astPer: p.gp ? p.ast / p.gp : 0,
    stlPer: p.gp ? p.stl / p.gp : 0,
    blkPer: p.gp ? p.blk / p.gp : 0,
    fgPct: p.fgAtt ? p.fgMade / p.fgAtt : 0,
    threePct: p.threeAtt ? p.threeMade / p.threeAtt : 0,
    ftPct: p.ftAtt ? p.ftMade / p.ftAtt : 0,
  }));

  rows.sort((a, b) => b.ptsPer - a.ptsPer);

  rows.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="player.html?player=${encodeURIComponent(p.playerSlug)}">${p.playerName}</a></td>
      <td>${fmtNumber(p.ptsPer, 1)}</td>
      <td>${fmtNumber(p.rebPer, 1)}</td>
      <td>${fmtNumber(p.astPer, 1)}</td>
      <td>${fmtNumber(p.stlPer, 1)}</td>
      <td>${fmtNumber(p.blkPer, 1)}</td>
      <td>${fmtPct(p.fgMade, p.fgAtt)}</td>
      <td>${fmtPct(p.threeMade, p.threeAtt)}</td>
      <td>${fmtPct(p.ftMade, p.ftAtt)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function computeSeasonHighs(games) {
  const categories = [
    { key: 'pts', label: 'Points', field: 'pts' },
    { key: 'reb', label: 'Rebounds', field: 'reb' },
    { key: 'ast', label: 'Assists', field: 'ast' },
    { key: 'stl', label: 'Steals', field: 'stl' },
    { key: 'blk', label: 'Blocks', field: 'blk' },
    { key: 'three', label: '3-pointers made', field: 'threeMade' },
  ];

  const highs = [];

  categories.forEach((cat) => {
    let best = null;
    games.forEach((g) => {
      const value = g[cat.field] || 0;
      if (value <= 0) return;
      if (!best || value > best.value) {
        best = {
          value,
          playerSlug: g.playerSlug,
          playerName: g.playerName,
          date: g.date,
          opponent: g.opponent,
          categoryLabel: cat.label,
        };
      }
    });
    if (best) highs.push(best);
  });

  return highs;
}

function renderSeasonHighs(highs, players) {
  const container = document.getElementById('season-highs-grid');
  if (!container) return;

  container.innerHTML = '';

  if (!highs.length) {
    container.innerHTML = '<p>No games recorded for this season yet.</p>';
    return;
  }

  highs.forEach((h) => {
    const player = players[h.playerSlug];
    const imgSrc =
      player && player.image
        ? `assets/${player.image}`
        : 'assets/placeholder-player.png';

    const card = document.createElement('a');
    card.href = `player.html?player=${encodeURIComponent(h.playerSlug)}`;
    card.className = 'season-high-card';

    card.innerHTML = `
      <div class="season-high-card__media">
        <img src="${imgSrc}" alt="${h.playerName}" />
      </div>
      <div class="season-high-card__body">
        <div class="season-high-card__label">${h.categoryLabel}: ${h.value}</div>
        <div class="season-high-card__detail">${h.playerName} vs ${h.opponent || ''} (${h.date})</div>
      </div>
    `;

    container.appendChild(card);
  });
}

async function renderRoster(slug, team, players) {
  const rosterEl = document.getElementById('team-roster');
  if (!rosterEl) return;

  const relevantPlayers = Object.entries(players).filter(([_, p]) => {
    if (Array.isArray(p.teams)) return p.teams.includes(slug);
    return p.team === slug;
  });

  rosterEl.innerHTML = '';

  relevantPlayers.forEach(([playerSlug, p]) => {
    const card = document.createElement('a');
    card.href = `player.html?player=${encodeURIComponent(playerSlug)}`;
    card.className = 'card card--player';

    const imgSrc = p.image ? `assets/${p.image}` : 'assets/placeholder-player.png';

    card.innerHTML = `
      <div class="card__media card__media--player">
        <img src="${imgSrc}" alt="${p.name}" />
      </div>
      <div class="card__body">
        <div class="card__title">${p.name}</div>
        <div class="card__meta">
          ${p.number ? `#${p.number} · ` : ''}${p.position || ''}
        </div>
      </div>
    `;

    rosterEl.appendChild(card);
  });
}
