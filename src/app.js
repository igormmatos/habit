import "./style.css";

const STORAGE_KEY = "habit:v1";
const DEFAULT_COLOR = "#4f46e5";

const elements = {
  form: document.getElementById("habitForm"),
  nameInput: document.getElementById("habitName"),
  colorInput: document.getElementById("habitColor"),
  list: document.getElementById("habitList"),
  emptyState: document.getElementById("emptyState"),
  error: document.getElementById("formError"),
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

function render(state) {
  const todayKey = getTodayKey();
  elements.list.innerHTML = "";

  if (!state.habits.length) {
    elements.emptyState.style.display = "block";
  } else {
    elements.emptyState.style.display = "none";
  }

  state.habits.forEach((habit) => {
    const isChecked = isCheckedToday(state, habit.id, todayKey);

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
    action.addEventListener("click", () => {
      state = toggleCheckin(state, habit.id, todayKey);
      saveState(state);
      render(state);
    });

    const meta = document.createElement("div");
    meta.className = "habit-meta";
    meta.appendChild(dot);
    meta.appendChild(name);

    card.appendChild(meta);
    card.appendChild(status);
    card.appendChild(action);

    elements.list.appendChild(card);
  });
}

function setError(message) {
  elements.error.textContent = message;
  elements.error.style.visibility = message ? "visible" : "hidden";
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

render(state);

if (elements.year) {
  elements.year.textContent = new Date().getFullYear();
}
