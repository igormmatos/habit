const STORAGE_KEY = "habit:checkins:v1";

const defaultState = {
  version: 1,
  checkins: {},
};

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return { ...defaultState };
  const checkins =
    raw.checkins && typeof raw.checkins === "object" ? raw.checkins : {};
  return {
    version: 1,
    checkins,
  };
}

export function loadCheckins() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...defaultState };
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...defaultState };
  }
}

export function saveCheckins(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getTodayKeyLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isChecked(habitId, dateKey) {
  const state = loadCheckins();
  return Boolean(state.checkins?.[habitId]?.[dateKey]);
}

export function toggleChecked(habitId, dateKey) {
  const state = loadCheckins();
  if (!state.checkins[habitId]) {
    state.checkins[habitId] = {};
  }
  state.checkins[habitId][dateKey] = !state.checkins[habitId][dateKey];
  saveCheckins(state);
  return state.checkins[habitId][dateKey];
}
