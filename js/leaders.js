import {
  getYearAndSeasonLabel,
  parseCsv,
  fmtNumber,
  fmtPct,
  toNum,
} from './app.js';

(async function initLeadersPage() {
  const seasonSelect = document.getElementById('leaders-season-select');
  const tableBody = document.querySelector('#leaders-table tbody');
  if (!seasonSelect || !tableBody) return;

  const res = await fetch('data/players.json');
  const players = await res.json();

  const allGames = [];

  for (const [slug, p] of Object.entries(players)) {
    if (!p.csv) continue;
    try {
      const csvRes = await fetch(p.csv);
      const text = await csvRes.text();
      const rows = parseCsv(text);
      rows.forEach((r) => {
        const { seasonLabel } = getYearAndSeasonLabel(r.date);
        allGames.push({
          playerSlug: slug,
          playerName: p.name,
          seasonLabel,
          pts: toNum(r.pts),
          reb: toNum(r.totrb || (toNum(r.or) + toNum(r.dr))),
          ast: toNum(r.ass ?? r.ast),
          stl: toNum(r.st ?? r.stl),
          blk: toNum(r.bs ?? r.blk),
          fgMade: toNum(r.fg),
          fgAtt: toNum(r.fga),
          threeMade: toNum(r['3p'] ?? r.three),
          threeAtt: toNum(r['3pa'] ?? r.threeAtt),
          ftMade: toNum(r.ft),
          ftAtt: toNum(r.fta),
        });
      });
    } catch (e) {
      console.error('Error loading CSV for', p.name, e);
    }
  }

  const allSeasonLabels = Array.from(
    new Set(allGames.map((g) => g.seasonLabel).filter((s) => !!s)),
  ).sort();

  setupSeasonDropdown(seasonSelect, allSeasonLabels);

  let currentSeasonLabel = allSeasonLabels[allSeasonLabels.length - 1] || null;

  seasonSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    currentSeasonLabel = val === 'all' ? null : val;
    syncUI();
  });

  function syncUI() {
    const filtered = currentSeasonLabel
      ? allGames.filter((g) => g.seasonLabel === currentSeasonLabel)
      : allGames;
    renderLeadersTable(filtered, tableBody);
  }

  syncUI();
})();

function setupSeasonDropdown(select, seasonLabels) {
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

function renderLeadersTable(games, tbody) {
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
