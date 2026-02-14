/* Fitness Tracker - app.js (v2)
   - Accepts comma or dot decimals (e.g., 82,4 or 82.4)
   - Dark theme styling handled in style.css
*/

const STORAGE_KEY = "ft_entries_v2";

const el = (id) => document.getElementById(id);

const btnAdd = el("btnAdd");
const modal = el("modal");
const modalBackdrop = el("modalBackdrop");
const btnClose = el("btnClose");

const entryForm = el("entryForm");
const fDate = el("fDate");
const fCalories = el("fCalories");
const fWeight = el("fWeight");
const fSteps = el("fSteps");
const fCardio = el("fCardio");
const fWorkout = el("fWorkout");
const fComments = el("fComments");
const btnDeleteDay = el("btnDeleteDay");

const rangeSelect = el("rangeSelect");

const mWeight = el("mWeight");
const mCalories = el("mCalories");
const mSteps = el("mSteps");
const mCardio = el("mCardio");

const canvas = el("chart");
const ctx = canvas.getContext("2d");

const emptyState = el("emptyState");
const latest = el("latest");

const btnExport = el("btnExport");
const btnImport = el("btnImport");
const btnClear = el("btnClear");
const filePicker = el("filePicker");

/* -------- Utilities -------- */

function todayISO() {
  const d = new Date();
  return isoDate(d);
}

function isoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Accepts:
//  - "82,4" or "82.4"
//  - "12 345" -> 12345
//  - "12.345,6" (common EU) -> 12345.6 (best-effort)
//  - returns null if not parseable
function toNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;

  let s = String(v).trim();
  if (!s) return null;

  // Remove spaces (including non-breaking)
  s = s.replace(/\s+/g, "");

  // If both comma and dot exist, assume the LAST one is the decimal separator
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";

    s = s.split(thouSep).join(""); // remove thousands separators
    s = s.replace(decSep, ".");    // normalize decimal separator to dot
  } else {
    // If only comma exists, treat comma as decimal separator
    if (hasComma) s = s.replace(",", ".");
    // If only dot exists, leave it as decimal separator
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -------- Storage -------- */

function loadEntries() {
  // Migrate old key if present
  const rawOld = localStorage.getItem("ft_entries_v1");
  const raw = localStorage.getItem(STORAGE_KEY);

  try {
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }
  } catch {}

  // If v2 not present, try v1 once
  if (rawOld && !raw) {
    try {
      const arr = JSON.parse(rawOld);
      if (Array.isArray(arr)) {
        const cleaned = normalizeEntries(arr);
        saveEntries(cleaned);
        return cleaned;
      }
    } catch {}
  }

  return [];
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function normalizeEntries(arr) {
  return arr
    .filter((e) => e && typeof e.date === "string")
    .map((e) => ({
      date: e.date,
      calories: toNumOrNull(e.calories),
      weight: toNumOrNull(e.weight),
      steps: toNumOrNull(e.steps),
      cardio: toNumOrNull(e.cardio),
      workout: (e.workout || "").toString().trim(),
      comments: (e.comments || "").toString().trim(),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function upsertEntry(entries, entry) {
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

function deleteEntry(entries, date) {
  return entries.filter((e) => e.date !== date);
}

/* -------- Modal -------- */

function openModalForDate(dateStr) {
  const entries = loadEntries();
  const existing = entries.find((e) => e.date === dateStr);

  fDate.value = dateStr;

  fCalories.value = existing?.calories ?? "";
  fWeight.value = existing?.weight ?? "";
  fSteps.value = existing?.steps ?? "";
  fCardio.value = existing?.cardio ?? "";
  fWorkout.value = existing?.workout ?? "";
  fComments.value = existing?.comments ?? "";

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

btnAdd.addEventListener("click", () => openModalForDate(todayISO()));
btnClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);

entryForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const entry = {
    date: fDate.value,
    calories: toNumOrNull(fCalories.value),
    weight: toNumOrNull(fWeight.value),
    steps: toNumOrNull(fSteps.value),
    cardio: toNumOrNull(fCardio.value),
    workout: (fWorkout.value || "").trim(),
    comments: (fComments.value || "").trim(),
  };

  let entries = loadEntries();
  entries = upsertEntry(entries, entry);
  saveEntries(entries);

  closeModal();
  render();
});

btnDeleteDay.addEventListener("click", () => {
  const date = fDate.value;
  if (!date) return;
  const ok = confirm(`Delete entry for ${date}?`);
  if (!ok) return;

  let entries = loadEntries();
  entries = deleteEntry(entries, date);
  saveEntries(entries);

  closeModal();
  render();
});

/* -------- Metrics & Range -------- */

function selectedMetrics() {
  const metrics = [];
  if (mWeight.checked) metrics.push("weight");
  if (mCalories.checked) metrics.push("calories");
  if (mSteps.checked) metrics.push("steps");
  if (mCardio.checked) metrics.push("cardio");
  return metrics;
}

[mWeight, mCalories, mSteps, mCardio, rangeSelect].forEach((x) =>
  x.addEventListener("change", renderChart)
);

function getVisibleEntries(entries) {
  const r = rangeSelect.value;
  if (r === "all") return entries;

  const days = Number(r);
  if (!Number.isFinite(days)) return entries;

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  const startISO = isoDate(start);
  const endISO = isoDate(end);

  return entries.filter((e) => e.date >= startISO && e.date <= endISO);
}

/* -------- Latest Panel -------- */

function renderLatest(entries) {
  latest.innerHTML = "";

  if (entries.length === 0) {
    latest.innerHTML = `<div class="emptyState">No entries yet.</div>`;
    return;
  }

  const last = entries[entries.length - 1];

  const rows = [
    ["Date", last.date],
    ["Weight (kg)", last.weight ?? "—"],
    ["Calories", last.calories ?? "—"],
    ["Steps", last.steps ?? "—"],
    ["Cardio (min)", last.cardio ?? "—"],
    ["Workout", last.workout || "—"],
    ["Comments", last.comments || "—"],
  ];

  for (const [k, v] of rows) {
    const row = document.createElement("div");
    row.className = "latestRow";
    row.innerHTML = `<div class="latestKey">${escapeHtml(k)}</div><div class="latestVal">${escapeHtml(String(v))}</div>`;
    latest.appendChild(row);
  }
}

/* -------- Export / Import / Clear -------- */

btnClear.addEventListener("click", () => {
  const ok = confirm("This will delete all your data on this iPhone. Continue?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
});

btnExport.addEventListener("click", () => {
  const entries = loadEntries();
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fitness-tracker-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

btnImport.addEventListener("click", () => {
  filePicker.value = "";
  filePicker.click();
});

filePicker.addEventListener("change", async () => {
  const file = filePicker.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Invalid format");
    const cleaned = normalizeEntries(data);
    saveEntries(cleaned);
    render();
    alert("Import complete.");
  } catch {
    alert("Import failed. Make sure you selected a valid export JSON file.");
  }
});

/* -------- Chart (Canvas) -------- */

function fmtRangeValue(x) {
  if (!Number.isFinite(x)) return "—";
  // Keep one decimal if it looks like a decimal; otherwise integer
  const rounded = Math.round(x * 10) / 10;
  const isInt = Math.abs(rounded - Math.round(rounded)) < 1e-9;
  return isInt ? String(Math.round(rounded)) : String(rounded);
}

function renderChart() {
  const entriesAll = loadEntries();
  const entries = getVisibleEntries(entriesAll);
  const metrics = selectedMetrics();

  const hasAnyData = entriesAll.length > 0;
  emptyState.classList.toggle("hidden", hasAnyData);

  // If user unchecks everything, force weight on
  if (metrics.length === 0) {
    mWeight.checked = true;
    metrics.push("weight");
  }

  const labels = entries.map((e) => e.date);
  const series = {
    weight: entries.map((e) => e.weight),
    calories: entries.map((e) => e.calories),
    steps: entries.map((e) => e.steps),
    cardio: entries.map((e) => e.cardio),
  };

  // Determine y-range per metric and normalize each series to 0..1
  const scaled = {};
  const ranges = {};

  for (const m of metrics) {
    const vals = series[m].filter((v) => v !== null && Number.isFinite(v));
    if (vals.length === 0) {
      ranges[m] = { min: 0, max: 1 };
    } else {
      let min = Math.min(...vals);
      let max = Math.max(...vals);
      if (min === max) { min -= 1; max += 1; }
      ranges[m] = { min, max };
    }

    scaled[m] = series[m].map((v) => {
      if (v === null || !Number.isFinite(v)) return null;
      const { min, max } = ranges[m];
      return (v - min) / (max - min);
    });
  }

  // Canvas sizing with DPR
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 1000;
  const cssH = Math.round(cssW * 0.52);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssW;
  const H = cssH;

  const padL = 44;
  const padR = 14;
  const padT = 14;
  const padB = 32;

  // background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  const gridY = 5;
  for (let i = 0; i <= gridY; i++) {
    const y = padT + (i / gridY) * (H - padT - padB);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
  }

  // x labels
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px -apple-system, system-ui, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";

  const n = labels.length;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const tickCount = Math.min(6, Math.max(2, n));
  for (let i = 0; i < tickCount; i++) {
    const idx = tickCount === 1 ? 0 : Math.round((i / (tickCount - 1)) * (n - 1));
    const x = padL + (idx / Math.max(1, n - 1)) * plotW;
    const label = labels[idx] ? labels[idx].slice(5) : "";
    ctx.fillText(label, x, H - 10);
  }

  // series colors (weight is primary)
  const colors = {
    weight: "#2f81f7",   // primary blue
    calories: "#2ee59d", // fitness green
    steps: "#ffd166",
    cardio: "#ff4d6d",
  };
  const names = {
    weight: "Weight",
    calories: "Calories",
    steps: "Steps",
    cardio: "Cardio",
  };

  // legend
  let lx = padL;
  const ly = 18;
  ctx.textAlign = "left";

  for (const m of metrics) {
    ctx.fillStyle = colors[m];
    ctx.fillRect(lx, ly - 10, 10, 10);
    lx += 14;

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const r = ranges[m];
    const label = `${names[m]} (${fmtRangeValue(r.min)}–${fmtRangeValue(r.max)})`;
    ctx.fillText(label, lx, ly);
    lx += ctx.measureText(label).width + 16;
  }

  // draw each line
  for (const m of metrics) {
    const arr = scaled[m];
    ctx.strokeStyle = colors[m];
    ctx.lineWidth = m === "weight" ? 2.6 : 2.0;
    ctx.beginPath();

    let started = false;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (v === null) { started = false; continue; }
      const x = padL + (i / Math.max(1, n - 1)) * plotW;
      const y = padT + (1 - v) * plotH;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // points
    ctx.fillStyle = colors[m];
    const radius = m === "weight" ? 3.2 : 2.8;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (v === null) continue;
      const x = padL + (i / Math.max(1, n - 1)) * plotW;
      const y = padT + (1 - v) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(padL, padT, plotW, plotH);
}

/* -------- Render -------- */

function render() {
  const entries = loadEntries();
  renderLatest(entries);
  renderChart();
}

/* -------- Init -------- */

(function init() {
  fDate.value = todayISO();
  render();
	})();