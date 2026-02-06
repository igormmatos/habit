import "./style.css";
import "./nav.js";

const STORAGE_KEY = "habit:v1";
const DEFAULT_COLOR = "#4f46e5";
const STORAGE_SCHEMA = "habit:v1";
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const elements = {
  form: document.getElementById("habitForm"),
  nameInput: document.getElementById("habitName"),
  colorInput: document.getElementById("habitColor"),
  list: document.getElementById("habitList"),
  emptyState: document.getElementById("emptyState"),
  error: document.getElementById("formError"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  demoBtn: document.getElementById("demoBtn"),
  clearBtn: document.getElementById("clearBtn"),
  status: document.getElementById("statusMessage"),
  year: document.querySelector("[data-year]"),
};

const initialState = {
  version: 1,
  habits: [],
  checkins: {},
};

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, delta) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

function compareDateKeys(a, b) {
  return a.localeCompare(b);
}

function getMonthMatrix(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let day = 1; day <= lastDay; day += 1) {
    dates.push(toDateKey(new Date(year, month, day)));
  }
  return dates;
}

function isValidHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeColor(value) {
  if (typeof value !== "string") {
    return DEFAULT_COLOR;
  }
  const trimmed = value.trim();
  return isValidHexColor(trimmed) ? trimmed : DEFAULT_COLOR;
}

function sanitizeName(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 40);
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function validateAndNormalizeState(raw) {
  const normalized = {
    version: 1,
    habits: [],
    checkins: {},
  };

  if (!raw || typeof raw !== "object") {
    return normalized;
  }

  if (Array.isArray(raw.habits)) {
    normalized.habits = raw.habits
      .filter((habit) => habit && typeof habit === "object")
      .map((habit) => {
        const name = sanitizeName(habit.name);
        return {
          id: typeof habit.id === "string" && habit.id ? habit.id : generateId(),
          name,
          color: normalizeColor(habit.color),
          createdAt:
            typeof habit.createdAt === "string" && habit.createdAt
              ? habit.createdAt
              : new Date().toISOString(),
          archivedAt:
            typeof habit.archivedAt === "string" && habit.archivedAt
              ? habit.archivedAt
              : undefined,
        };
      })
      .filter((habit) => habit.name.length > 0);
  }

  if (raw.checkins && typeof raw.checkins === "object") {
    Object.entries(raw.checkins).forEach(([habitId, dates]) => {
      if (typeof habitId !== "string" || !dates || typeof dates !== "object") {
        return;
      }
      normalized.checkins[habitId] = {};
      Object.entries(dates).forEach(([dateKey, value]) => {
        if (value === true && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          normalized.checkins[habitId][dateKey] = true;
        }
      });
    });
  }

  return normalized;
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Arquivo invalido." };
  }
  if (payload.schema !== STORAGE_SCHEMA) {
    return { ok: false, message: "Schema invalido." };
  }
  const state = payload.state;
  if (!state || typeof state !== "object") {
    return { ok: false, message: "Estado ausente." };
  }
  if (state.version !== 1) {
    return { ok: false, message: "Versao invalida." };
  }
  if (!Array.isArray(state.habits)) {
    return { ok: false, message: "Habitos invalidos." };
  }
  if (!state.checkins || typeof state.checkins !== "object") {
    return { ok: false, message: "Check-ins invalidos." };
  }
  return { ok: true, message: "" };
}

function normalizeImportedState(state) {
  const seen = new Set();
  const habits = [];

  state.habits.forEach((habit) => {
    if (!habit || typeof habit !== "object") {
      return;
    }
    if (typeof habit.id !== "string" || !habit.id.trim()) {
      return;
    }
    if (seen.has(habit.id)) {
      return;
    }
    const name = sanitizeName(habit.name);
    if (!name) {
      return;
    }
    habits.push({
      id: habit.id.trim(),
      name,
      color: normalizeColor(habit.color),
      createdAt:
        typeof habit.createdAt === "string" && habit.createdAt
          ? habit.createdAt
          : new Date().toISOString(),
      archivedAt:
        typeof habit.archivedAt === "string" && habit.archivedAt
          ? habit.archivedAt
          : undefined,
    });
    seen.add(habit.id);
  });

  const habitIds = new Set(habits.map((habit) => habit.id));
  const checkins = {};
  Object.entries(state.checkins).forEach(([habitId, dates]) => {
    if (!habitIds.has(habitId)) {
      return;
    }
    if (!dates || typeof dates !== "object") {
      return;
    }
    const normalizedDates = {};
    Object.entries(dates).forEach(([dateKey, value]) => {
      if (value === true && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        normalizedDates[dateKey] = true;
      }
    });
    if (Object.keys(normalizedDates).length) {
      checkins[habitId] = normalizedDates;
    }
  });

  return {
    version: 1,
    habits,
    checkins,
  };
}

function migrate(raw) {
  if (!raw || typeof raw !== "object") {
    return initialState;
  }
  if (raw.version === 1) {
    return validateAndNormalizeState(raw);
  }
  return validateAndNormalizeState(raw);
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { ...initialState };
  }
  try {
    const parsed = JSON.parse(stored);
    return migrate(parsed);
  } catch {
    return { ...initialState };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createHabit(state, { name, color }) {
  const normalizedName = sanitizeName(name);
  const normalizedColor = normalizeColor(color);
  if (!normalizedName) {
    return state;
  }
  const habit = {
    id: generateId(),
    name: normalizedName,
    color: normalizedColor,
    createdAt: new Date().toISOString(),
  };
  return {
    ...state,
    habits: [habit, ...state.habits],
  };
}

function toggleCheckin(state, habitId, dateKey) {
  const existing = state.checkins[habitId] || {};
  const nextHabitCheckins = { ...existing };
  if (nextHabitCheckins[dateKey]) {
    delete nextHabitCheckins[dateKey];
  } else {
    nextHabitCheckins[dateKey] = true;
  }
  return {
    ...state,
    checkins: {
      ...state.checkins,
      [habitId]: nextHabitCheckins,
    },
  };
}

function isCheckedToday(state, habitId, dateKey) {
  return Boolean(state.checkins[habitId]?.[dateKey]);
}

function getCheckinsForHabit(state, habitId) {
  const dates = state.checkins[habitId];
  if (!dates || typeof dates !== "object") {
    return new Set();
  }
  return new Set(
    Object.keys(dates).filter((dateKey) => dates[dateKey] === true)
  );
}

function computeCurrentStreak(dateKeysSet, todayKey) {
  let streak = 0;
  let cursor = todayKey;
  while (dateKeysSet.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function computeBestStreak(dateKeysSet) {
  const sorted = Array.from(dateKeysSet).sort(compareDateKeys);
  if (!sorted.length) {
    return 0;
  }
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const expected = addDays(previous, 1);
    if (sorted[i] === expected) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

function computeCompletionRate(dateKeysSet, todayKey, windowDays) {
  let completed = 0;
  for (let i = 0; i < windowDays; i += 1) {
    const dateKey = addDays(todayKey, -i);
    if (dateKeysSet.has(dateKey)) {
      completed += 1;
    }
  }
  return Math.round((completed / windowDays) * 100);
}

let monthOffset = 0;

function render(state) {
  const todayKey = getTodayKey();
  elements.list.innerHTML = "";

  if (!state.habits.length) {
    elements.emptyState.style.display = "block";
  } else {
    elements.emptyState.style.display = "none";
  }

  const todayDate = parseDateKey(todayKey);
  const viewDate = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth() + monthOffset,
    1
  );
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const monthDates = getMonthMatrix(viewYear, viewMonth);
  const monthLabel = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  state.habits.forEach((habit) => {
    const checkinsSet = getCheckinsForHabit(state, habit.id);
    const isChecked = isCheckedToday(state, habit.id, todayKey);
    const currentStreak = computeCurrentStreak(checkinsSet, todayKey);
    const bestStreak = computeBestStreak(checkinsSet);
    const rate7 = computeCompletionRate(checkinsSet, todayKey, 7);
    const rate30 = computeCompletionRate(checkinsSet, todayKey, 30);

    const card = document.createElement("article");
    card.className = "habit-card";

    const dot = document.createElement("span");
    dot.className = "habit-dot";
    dot.style.background = habit.color;
    dot.setAttribute("aria-hidden", "true");

    const name = document.createElement("div");
    name.className = "habit-name";
    name.textContent = habit.name;

    const status = document.createElement("p");
    status.className = "habit-status";
    status.textContent = isChecked ? "Feito hoje ✅" : "Ainda nao feito";

    const action = document.createElement("button");
    action.className = "btn btn-primary btn-small";
    action.type = "button";
    action.textContent = isChecked ? "Desfazer" : "Feito hoje";
    action.dataset.action = "toggle";
    action.dataset.habitId = habit.id;

    const metrics = document.createElement("p");
    metrics.className = "habit-metrics";
    metrics.textContent = `Streak: ${currentStreak} • Best: ${bestStreak} • 7d: ${rate7}% • 30d: ${rate30}%`;

    const heatmap = document.createElement("div");
    heatmap.className = "heatmap";

    const heatmapHeader = document.createElement("div");
    heatmapHeader.className = "heatmap-header";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "heatmap-nav";
    prev.textContent = "←";
    prev.dataset.action = "month-prev";

    const next = document.createElement("button");
    next.type = "button";
    next.className = "heatmap-nav";
    next.textContent = "→";
    next.dataset.action = "month-next";

    const title = document.createElement("span");
    title.className = "heatmap-title";
    title.textContent = monthLabel;

    heatmapHeader.appendChild(prev);
    heatmapHeader.appendChild(title);
    heatmapHeader.appendChild(next);

    const grid = document.createElement("div");
    grid.className = "heatmap-grid";

    monthDates.forEach((dateKey) => {
      const date = parseDateKey(dateKey);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const isDone = checkinsSet.has(dateKey);
      const dayCell = document.createElement("div");
      dayCell.className = "day";
      if (isDone) {
        dayCell.classList.add("done");
      }
      if (dateKey === todayKey) {
        dayCell.classList.add("today");
      }
      dayCell.textContent = date.getDate().toString();
      dayCell.setAttribute(
        "aria-label",
        `${day}/${month}: ${isDone ? "feito" : "nao feito"}`
      );
      grid.appendChild(dayCell);
    });

    heatmap.appendChild(heatmapHeader);
    heatmap.appendChild(grid);

    const meta = document.createElement("div");
    meta.className = "habit-meta";
    meta.appendChild(dot);
    meta.appendChild(name);

    card.appendChild(meta);
    card.appendChild(metrics);
    card.appendChild(status);
    card.appendChild(action);
    card.appendChild(heatmap);

    elements.list.appendChild(card);
  });
}

function setError(message) {
  elements.error.textContent = message;
  elements.error.style.visibility = message ? "visible" : "hidden";
}

function setStatus(message, tone = "info") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function clearStatus() {
  setStatus("");
  elements.status.removeAttribute("data-tone");
}

function confirmReplace() {
  return window.confirm("Isso substituira seus dados atuais. Continuar?");
}

function buildExportPayload(state) {
  return {
    app: "habit",
    schema: STORAGE_SCHEMA,
    exportedAt: new Date().toISOString(),
    state,
  };
}

function downloadJson(payload) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}-${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `habit-export-${stamp}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildDemoState() {
  const todayKey = getTodayKey();
  const habits = [
    { name: "Ler 20 paginas", color: "#4f46e5" },
    { name: "Treino", color: "#f97316" },
    { name: "Meditar 5 min", color: "#10b981" },
  ].map((habit) => ({
    id: generateId(),
    name: habit.name,
    color: habit.color,
    createdAt: new Date().toISOString(),
  }));

  const patterns = [10, 6, 12];
  const checkins = {};

  habits.forEach((habit, idx) => {
    const total = patterns[idx];
    const dates = new Set();
    dates.add(todayKey);
    for (let i = 1; dates.size < total && i < 14; i += 1) {
      if (idx === 0 && i % 3 !== 0) {
        dates.add(addDays(todayKey, -i));
      }
      if (idx === 1 && i % 2 === 0) {
        dates.add(addDays(todayKey, -i));
      }
      if (idx === 2 && i % 4 !== 0) {
        dates.add(addDays(todayKey, -i));
      }
    }
    checkins[habit.id] = {};
    Array.from(dates).forEach((dateKey) => {
      checkins[habit.id][dateKey] = true;
    });
  });

  return {
    version: 1,
    habits,
    checkins,
  };
}

let state = loadState();

elements.colorInput.value = DEFAULT_COLOR;

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.nameInput.value;
  const color = elements.colorInput.value;

  const normalizedName = sanitizeName(name);
  if (!normalizedName) {
    setError("Informe um nome.");
    elements.nameInput.focus();
    return;
  }

  state = createHabit(state, { name: normalizedName, color });
  saveState(state);
  render(state);
  setError("");
  elements.nameInput.value = "";
  elements.nameInput.focus();
});

elements.exportBtn.addEventListener("click", () => {
  clearStatus();
  const payload = buildExportPayload(loadState());
  downloadJson(payload);
  setStatus("Exportado com sucesso.", "success");
});

elements.importBtn.addEventListener("click", () => {
  elements.importFile.click();
});

elements.importFile.addEventListener("change", async (event) => {
  clearStatus();
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const validation = validateImportPayload(payload);
    if (!validation.ok) {
      setStatus(validation.message, "error");
      return;
    }
    if (!confirmReplace()) {
      setStatus("Importacao cancelada.", "info");
      return;
    }
    const normalized = normalizeImportedState(payload.state);
    state = normalized;
    saveState(state);
    render(state);
    setStatus("Importado com sucesso.", "success");
  } catch {
    setStatus("Falha ao importar arquivo.", "error");
  } finally {
    event.target.value = "";
  }
});

elements.demoBtn.addEventListener("click", () => {
  clearStatus();
  if (!confirmReplace()) {
    setStatus("Carregamento cancelado.", "info");
    return;
  }
  state = buildDemoState();
  saveState(state);
  render(state);
  setStatus("Exemplo carregado com sucesso.", "success");
});

elements.clearBtn.addEventListener("click", () => {
  clearStatus();
  if (!window.confirm("Isso removera todos os dados salvos. Continuar?")) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  state = { ...initialState };
  render(state);
  setStatus("Dados limpos.", "success");
});

elements.list.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  if (action === "toggle") {
    const habitId = target.dataset.habitId;
    if (!habitId) {
      return;
    }
    state = toggleCheckin(state, habitId, getTodayKey());
    saveState(state);
    render(state);
    return;
  }
  if (action === "month-prev") {
    monthOffset -= 1;
    render(state);
  }
  if (action === "month-next") {
    monthOffset += 1;
    render(state);
  }
});

render(state);

if (elements.year) {
  elements.year.textContent = new Date().getFullYear();
}
