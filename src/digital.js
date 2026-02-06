import { getTodayKeyLocal, isChecked, loadCheckins, toggleChecked } from "./checkins.js";

const STORAGE_KEY = "habit:digital:v1";
const STACK_KEY = "habit:stack:v1";
const LEGACY_KEY = "habitStack_v33";

const palette = ["#111111", "#ff6b35", "#3b63ff", "#00a896", "#f59e0b"];

const elements = {
  habitList: document.getElementById("habitList"),
  status: document.getElementById("status"),
  todayLabel: document.getElementById("todayLabel"),
  progressSummary: document.getElementById("progressSummary"),
  habitCount: document.getElementById("habitCount"),
  doneCount: document.getElementById("doneCount"),
  totalCount: document.getElementById("totalCount"),
  progressFill: document.getElementById("progressFill"),
  dayComplete: document.getElementById("dayComplete"),
};

const defaultState = {
  version: 1,
  habits: [],
};

function setStatus(message, tone = "info") {
  if (!elements.status) return;
  elements.status.textContent = message;
  if (tone === "info") {
    elements.status.removeAttribute("data-tone");
  } else {
    elements.status.dataset.tone = tone;
  }
}

function updateTodayLabel() {
  if (!elements.todayLabel) return;
  const todayKey = getTodayKeyLocal();
  const [year, month, day] = todayKey.split("-");
  elements.todayLabel.textContent = `${day}/${month}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(laterDate, earlierDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((laterDate - earlierDate) / msPerDay));
}

function getLastStatus(habitId, todayKey, checkinsState) {
  const entries = checkinsState?.checkins?.[habitId] || {};
  let lastDateKey = null;

  Object.entries(entries).forEach(([dateKey, checked]) => {
    if (!checked) return;
    if (dateKey > todayKey) return;
    if (!lastDateKey || dateKey > lastDateKey) {
      lastDateKey = dateKey;
    }
  });

  if (!lastDateKey) {
    return "Ainda não realizado";
  }
  if (lastDateKey === todayKey) {
    return "Feito hoje";
  }

  const diffDays = daysBetween(dateFromKey(todayKey), dateFromKey(lastDateKey));
  if (diffDays === 1) {
    return "Última vez: ontem";
  }
  return `Última vez: há ${diffDays} dias`;
}

function getRecentHistory(habitId, todayKey, checkinsState) {
  const entries = checkinsState?.checkins?.[habitId] || {};
  const history = [];
  const todayDate = dateFromKey(todayKey);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(todayDate);
    date.setDate(todayDate.getDate() - offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const checked = Boolean(entries?.[dateKey]);
    history.push({
      dateKey,
      checked,
      isToday: dateKey === todayKey,
      label: `${day}/${month}`,
    });
  }

  return history;
}

function getStreaks(habitId, todayKey, checkinsState) {
  const entries = checkinsState?.checkins?.[habitId] || {};
  const todayDate = dateFromKey(todayKey);

  const dateKeys = Object.entries(entries)
    .filter(([, checked]) => Boolean(checked))
    .map(([dateKey]) => dateKey)
    .filter((dateKey) => dateKey <= todayKey)
    .sort();

  if (!dateKeys.length) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let bestStreak = 0;
  let run = 0;
  let prev = null;

  dateKeys.forEach((dateKey) => {
    if (!prev) {
      run = 1;
    } else {
      const diff = daysBetween(dateFromKey(dateKey), dateFromKey(prev));
      run = diff === 1 ? run + 1 : 1;
    }
    if (run > bestStreak) bestStreak = run;
    prev = dateKey;
  });

  let currentStreak = 0;
  for (let offset = 0; offset <= 366; offset += 1) {
    const date = new Date(todayDate);
    date.setDate(todayDate.getDate() - offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    if (entries?.[dateKey]) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return { currentStreak, bestStreak };
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `digital_${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
}

function normalizeHabit(raw, index = 0) {
  const name =
    typeof raw?.name === "string"
      ? raw.name.trim()
      : typeof raw?.nome === "string"
      ? raw.nome.trim()
      : "";
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : generateId(),
    name: name || `Hábito ${index + 1}`,
    color: typeof raw?.color === "string" && raw.color ? raw.color : palette[index % palette.length],
    createdAt:
      typeof raw?.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

function normalizeState(raw) {
  const habits = Array.isArray(raw?.habits)
    ? raw.habits.map((habit, index) => normalizeHabit(habit, index))
    : [];
  return {
    version: 1,
    habits,
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...defaultState };
  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return { ...defaultState };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


function importFromStack() {
  const raw = localStorage.getItem(STACK_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.habits)) return [];
    return parsed.habits.map((habit, index) =>
      normalizeHabit(
        {
          id: habit.id,
          nome: habit.nome,
          color:
            habit.dif === "facil"
              ? "#16a34a"
              : habit.dif === "dificil"
              ? "#dc2626"
              : "#f59e0b",
        },
        index
      )
    );
  } catch {
    return [];
  }
}

function importFromLegacy() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((habit, index) =>
      normalizeHabit({ nome: habit.nome }, index)
    );
  } catch {
    return [];
  }
}

function mergeHabits(stateHabits, incomingHabits) {
  const byId = new Set(stateHabits.map((habit) => habit.id));
  const byName = new Set(
    stateHabits.map((habit) => habit.name.trim().toLowerCase())
  );
  const merged = [...stateHabits];
  incomingHabits.forEach((habit) => {
    const nameKey = habit.name.trim().toLowerCase();
    if (byId.has(habit.id) || byName.has(nameKey)) return;
    merged.push(habit);
    byId.add(habit.id);
    byName.add(nameKey);
  });
  return merged;
}

function renderEmpty() {
  if (!elements.habitList) return;
  elements.habitList.innerHTML = `
    <div class="empty-state">
      <h2>Nenhum habito no Digital</h2>
      <p>Vá ao Stack e crie hábitos para acompanhar aqui.</p>
      <div class="stack-actions">
        <a class="btn btn-primary" href="/stack.html">Abrir Stack</a>
        <button class="btn" id="loadDemo" type="button">Carregar exemplo</button>
      </div>
    </div>
  `;
}

function render(state) {
  if (!elements.habitList) return;
  if (!state.habits.length) {
    renderEmpty();
    updateProgress();
    return;
  }

  const todayKey = getTodayKeyLocal();
  const checkinsState = loadCheckins();
  elements.habitList.innerHTML = "";
  state.habits.forEach((habit) => {
    const checked = isChecked(habit.id, todayKey);
    const lastStatus = getLastStatus(habit.id, todayKey, checkinsState);
    const history = getRecentHistory(habit.id, todayKey, checkinsState);
    const streaks = getStreaks(habit.id, todayKey, checkinsState);
    const card = document.createElement("article");
    card.className = "digital-card";
    card.dataset.id = habit.id;
    card.dataset.checked = checked ? "true" : "false";
    const historyDots = history
      .map((item) => {
        const statusText = item.checked ? "feito" : "não feito";
        const todayClass = item.isToday ? " is-today" : "";
        const doneClass = item.checked ? " is-done" : "";
        return `
          <span
            class="history-dot${doneClass}${todayClass}"
            title="${item.label}: ${statusText}"
            aria-label="${item.label}: ${statusText}"
          ></span>
        `;
      })
      .join("");
    card.innerHTML = `
      <div class="digital-header">
        <span class="digital-badge" style="background:${habit.color}"></span>
        <h3>${habit.name}</h3>
      </div>
      <p class="digital-last">${lastStatus}</p>
      <div class="digital-history">
        <p class="digital-history-label">Últimos 7 dias</p>
        <div class="history-row">
          ${historyDots}
        </div>
      </div>
      ${
        streaks.currentStreak > 0 || streaks.bestStreak > 1
          ? `<div class="digital-streaks">
              ${
                streaks.currentStreak > 0
                  ? `<p>Sequência atual: ${streaks.currentStreak} dias</p>`
                  : ""
              }
              ${
                streaks.bestStreak > 1
                  ? `<p>Melhor sequência: ${streaks.bestStreak} dias</p>`
                  : ""
              }
            </div>`
          : ""
      }
      <div class="digital-actions">
        <button class="btn ${checked ? "btn-secondary" : "btn-primary"}" data-action="toggle" data-id="${habit.id}">
          ${checked ? "Desfazer" : "Feito hoje"}
        </button>
      </div>
    `;
    elements.habitList.appendChild(card);
  });

  updateProgress();
}

function bindEvents(state) {
  if (!elements.habitList) return;
  elements.habitList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const demoBtn = target.closest("#loadDemo");
    if (demoBtn) {
      state.habits = [
        normalizeHabit({ name: "Beber água", color: "#3b63ff" }, 0),
        normalizeHabit({ name: "Caminhar 20 min", color: "#00a896" }, 1),
        normalizeHabit({ name: "Ler 10 páginas", color: "#ff6b35" }, 2),
      ];
      saveState(state);
      render(state);
      setStatus("Exemplo carregado.", "success");
      return;
    }

    const actionBtn = target.closest("button[data-action='toggle']");
    if (!actionBtn) return;
    const habitId = actionBtn.getAttribute("data-id");
    if (!habitId) return;
    toggleChecked(habitId, getTodayKeyLocal());
    render(state);
  });
}

function updateProgress() {
  const cards = document.querySelectorAll(".digital-card");
  const total = cards.length;
  const done = Array.from(cards).filter(
    (card) => card.dataset.checked === "true"
  ).length;

  if (elements.habitCount) elements.habitCount.textContent = String(total);
  if (elements.doneCount) elements.doneCount.textContent = String(done);
  if (elements.totalCount) elements.totalCount.textContent = String(total);
  if (elements.progressSummary) {
    if (total === 0) {
      elements.progressSummary.textContent = "Nenhum hábito para hoje.";
    } else {
      const habitLabel = total === 1 ? "hábito" : "hábitos";
      elements.progressSummary.textContent = `Você já fez ${done} de ${total} ${habitLabel}.`;
    }
  }

  if (elements.progressFill) {
    const ratio = total ? done / total : 0;
    elements.progressFill.style.width = `${Math.round(ratio * 100)}%`;
  }

  if (elements.dayComplete) {
    elements.dayComplete.hidden = !(total > 0 && done === total);
  }
}

export function initDigital() {
  try {
    updateTodayLabel();
    let state = loadState();

    const fromStack = importFromStack();
    const fromLegacy = fromStack.length ? [] : importFromLegacy();
    const incoming = fromStack.length ? fromStack : fromLegacy;
    if (incoming.length) {
      const merged = mergeHabits(state.habits, incoming);
      if (merged.length !== state.habits.length) {
        state.habits = merged;
        saveState(state);
        setStatus("Hábitos sincronizados do Stack.", "success");
      }
    }

    render(state);
    bindEvents(state);
  } catch (error) {
    console.error("Erro ao iniciar Digital", error);
    setStatus("Erro ao iniciar o Digital. Veja console.", "error");
  }
}
