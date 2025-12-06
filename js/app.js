// js/app.js

// ---------- Number + CSV helpers ----------

export function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtNumber(v, decimals = 1) {
  if (!Number.isFinite(v)) return "0.0";
  return v.toFixed(decimals);
}

export function fmtPct(made, att) {
  const m = toNum(made);
  const a = toNum(att);
  if (!a) return "—";
  return (100 * m / a).toFixed(1);
}

// Very small CSV parser for our simple, comma-separated data
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];

  // Header row
  const rawHeaders = lines[0].split(",");
  const normalise = (h) => h.trim().toLowerCase().replace(/\s+/g, "");
  const headers = rawHeaders.map((h) => normalise(h));

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(",").map((c) => c.trim());
    const row = {};

    headers.forEach((key, idx) => {
      row[key] = cols[idx] ?? "";
    });

    return rows;
  }

  return rows;
}


// Map date string -> year + "Season" label (Summer / Autumn / Winter / Spring)
export function getYearAndSeasonLabel(dateStr) {
  if (!dateStr) return { year: null, seasonLabel: null };
  let d;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    d = new Date(dateStr + "T00:00:00");
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split("/").map(Number);
    d = new Date(yyyy, mm - 1, dd);
  } else {
    d = new Date(dateStr);
  }

  if (Number.isNaN(d.getTime())) {
    return { year: null, seasonLabel: null };
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  let season = "Summer";
  if (month >= 3 && month <= 5) season = "Autumn";
  else if (month >= 6 && month <= 8) season = "Winter";
  else if (month >= 9 && month <= 11) season = "Spring";

  return { year, seasonLabel: `${year} ${season}` };
}

// ---------- Theme handling ----------

function applyTheme() {
  const stored = localStorage.getItem("mystats_theme");
  const theme = stored === "light" ? "light" : "dark"; // default dark

  document.documentElement.dataset.theme = theme;

  const btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    btn.textContent = theme === "light" ? "☾" : "☀";
  }
}

function initThemeToggle() {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const current =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem("mystats_theme", current);
    applyTheme();
  });
}

// Automatically wire theme on every page that includes app.js
function bootTheme() {
  applyTheme();
  initThemeToggle();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTheme);
} else {
  bootTheme();
}
