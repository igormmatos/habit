import "./style.css";
import "./nav.js";

const STORAGE_KEY = "habit:stack:v1";

const elements = {
  metaOperador: document.getElementById("metaOperador"),
  metaPeriodo: document.getElementById("metaPeriodo"),
  metaObjetivo: document.getElementById("metaObjetivo"),
  metaFrase: document.getElementById("metaFrase"),
  addCount: document.getElementById("addCount"),
  addBtn: document.getElementById("addBtn"),
  habitList: document.getElementById("habitList"),
  emptyState: document.getElementById("emptyState"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  exportBtn: document.getElementById("exportBtn"),
  openTrackerBtn: document.getElementById("openTrackerBtn"),
  stackActions: document.querySelector(".stack-actions"),
  demoBtn: document.getElementById("demoBtn"),
  status: document.getElementById("stackStatus"),
  year: document.querySelector("[data-year]"),
};

const defaultMetadata = {
  operador: "Seu Nome",
  periodo: "Mês/Ano",
  objetivo: "Seu Objetivo",
  frase: "Sua frase motivacional",
};

const initialState = {
  metadata: { ...defaultMetadata },
  habits: [],
};

const expanded = new Set();
let movedHabitId = null;

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `habit_${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
}

function normalizeDifficulty(value) {
  if (value === "facil" || value === "medio" || value === "dificil") {
    return value;
  }
  return "medio";
}

function sanitizeName(value) {
  if (typeof value !== "string") return "Novo hábito";
  const cleaned = value.trim().replace(/^\d+\.\s*/, "");
  return cleaned.slice(0, 60) || "Novo hábito";
}

function sanitizeField(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function formatPeriodInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function createHabit() {
  return {
    id: generateId(),
    nome: "Novo hábito",
    dif: "medio",
    gatilho: "",
    desejo: "",
    acao: "",
    recompensa: "",
    consequencia: "",
  };
}

function createDemoHabits() {
  return [
    {
      id: generateId(),
      nome: "Beber água",
      dif: "facil",
      gatilho: "Ao acordar",
      desejo: "Energia e foco",
      acao: "Tomar 2 copos",
      recompensa: "Sensação de disposição",
      consequencia: "Começar o dia lento",
    },
    {
      id: generateId(),
      nome: "Caminhar 20 min",
      dif: "medio",
      gatilho: "Depois do almoço",
      desejo: "Leveza no corpo",
      acao: "Volta no quarteirão",
      recompensa: "Mente mais clara",
      consequencia: "Sedentarismo",
    },
    {
      id: generateId(),
      nome: "Ler 10 páginas",
      dif: "medio",
      gatilho: "Antes de dormir",
      desejo: "Calma e aprendizado",
      acao: "Leitura sem celular",
      recompensa: "Sono melhor",
      consequencia: "Dispersão",
    },
    {
      id: generateId(),
      nome: "Organizar mesa",
      dif: "facil",
      gatilho: "Antes de trabalhar",
      desejo: "Clareza mental",
      acao: "5 min de arrumação",
      recompensa: "Foco",
      consequencia: "Início caótico",
    },
    {
      id: generateId(),
      nome: "Planejar amanhã",
      dif: "dificil",
      gatilho: "Fim do dia",
      desejo: "Controle do tempo",
      acao: "Listar 3 prioridades",
      recompensa: "Dia seguinte tranquilo",
      consequencia: "Acordar perdido",
    },
  ];
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...initialState };
  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return { ...initialState };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(raw) {
  const metadata = {
    operador: sanitizeField(raw?.metadata?.operador) || defaultMetadata.operador,
    periodo: sanitizeField(raw?.metadata?.periodo) || defaultMetadata.periodo,
    objetivo: sanitizeField(raw?.metadata?.objetivo) || defaultMetadata.objetivo,
    frase: sanitizeField(raw?.metadata?.frase) || defaultMetadata.frase,
  };

  const habits = Array.isArray(raw?.habits)
    ? raw.habits.map((habit) => ({
        id: typeof habit.id === "string" && habit.id ? habit.id : generateId(),
        nome: sanitizeName(habit.nome),
        dif: normalizeDifficulty(habit.dif),
        gatilho: sanitizeField(habit.gatilho),
        desejo: sanitizeField(habit.desejo),
        acao: sanitizeField(habit.acao),
        recompensa: sanitizeField(habit.recompensa),
        consequencia: sanitizeField(habit.consequencia),
      }))
    : [];

  return { metadata, habits };
}

function setStatus(message, tone = "info") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function clearStatus() {
  setStatus("");
  elements.status.removeAttribute("data-tone");
}

function updateMetadata(state) {
  state.metadata = {
    operador: sanitizeField(elements.metaOperador.value) || defaultMetadata.operador,
    periodo: sanitizeField(elements.metaPeriodo.value) || defaultMetadata.periodo,
    objetivo: sanitizeField(elements.metaObjetivo.value) || defaultMetadata.objetivo,
    frase: sanitizeField(elements.metaFrase.value) || defaultMetadata.frase,
  };
}

function moveHabit(state, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.habits.length) return;
  const next = [...state.habits];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  state.habits = next;
  movedHabitId = moved?.id || null;
}

function render(state) {
  elements.metaOperador.value = state.metadata.operador;
  elements.metaPeriodo.value = formatPeriodInput(state.metadata.periodo);
  elements.metaObjetivo.value = state.metadata.objetivo;
  elements.metaFrase.value = state.metadata.frase;

  elements.habitList.innerHTML = "";
  elements.emptyState.style.display = state.habits.length ? "none" : "block";

  state.habits.forEach((habit, index) => {
    const card = document.createElement("article");
    card.className = "habit-item";
    card.dataset.id = habit.id;
    if (movedHabitId && habit.id === movedHabitId) {
      card.classList.add("is-reordered");
    }
    if (expanded.has(habit.id)) {
      card.classList.add("is-expanded");
    } else {
      card.classList.add("is-collapsed");
    }

    const header = document.createElement("div");
    header.className = "habit-header";

    const title = document.createElement("label");
    title.className = "habit-title";
    title.innerHTML = `<span class="sr-only">Nome do hábito</span><strong>${index + 1}.</strong>`;
    const titleInput = document.createElement("input");
    titleInput.className = "input habit-title-input";
    titleInput.value = habit.nome;
    titleInput.dataset.field = "nome";
    title.appendChild(titleInput);

    const badge = document.createElement("select");
    badge.className = "badge";
    badge.dataset.action = "difficulty";
    badge.innerHTML = `
      <option value="facil">Fácil</option>
      <option value="medio">Médio</option>
      <option value="dificil">Difícil</option>
    `;
    badge.value = habit.dif;
    badge.addEventListener("mousedown", (event) => event.stopPropagation());
    badge.addEventListener("click", (event) => event.stopPropagation());

    const controls = document.createElement("div");
    controls.className = "habit-controls";
    controls.innerHTML = `
      <button class="btn btn-small" data-action="toggle">${
        expanded.has(habit.id) ? "Recolher" : "Expandir"
      }</button>
      <button class="btn btn-small" data-action="up" aria-label="Mover para cima">↑</button>
      <button class="btn btn-small" data-action="down" aria-label="Mover para baixo">↓</button>
      <button class="btn btn-small btn-danger" data-action="remove">Excluir</button>
    `;

    header.appendChild(title);
    header.appendChild(badge);
    header.appendChild(controls);

    const summary = document.createElement("div");
    summary.className = "habit-summary";
    const difficultyLabel =
      habit.dif === "facil" ? "Fácil" : habit.dif === "medio" ? "Médio" : "Difícil";
    const summaryLine = habit.gatilho
      ? `Gatilho: ${habit.gatilho}`
      : habit.acao
      ? `Ação: ${habit.acao}`
      : "";
    const filledFields = [
      habit.nome,
      habit.gatilho,
      habit.desejo,
      habit.acao,
      habit.recompensa,
      habit.consequencia,
    ].filter((value) => value && value.trim()).length;
    const totalFields = 6;
    const metaLine = document.createElement("div");
    metaLine.className = "habit-meta-line";
    metaLine.textContent = `Dificuldade: ${difficultyLabel}`;
    summary.appendChild(metaLine);
    if (summaryLine) {
      const summaryDetail = document.createElement("div");
      summaryDetail.textContent = summaryLine;
      summary.appendChild(summaryDetail);
    }
    const progress = document.createElement("div");
    progress.className = "habit-progress";
    progress.textContent = `${filledFields}/${totalFields} preenchidos`;
    summary.appendChild(progress);

    const body = document.createElement("div");
    body.className = "habit-body";

    const coreGroup = document.createElement("div");
    coreGroup.className = "habit-group habit-group--core";
    const coreTitle = document.createElement("p");
    coreTitle.className = "habit-group-title";
    coreTitle.textContent = "Núcleo";
    coreGroup.appendChild(coreTitle);

    const supportGroup = document.createElement("div");
    supportGroup.className = "habit-group habit-group--support";
    const supportTitle = document.createElement("p");
    supportTitle.className = "habit-group-title";
    supportTitle.textContent = "Suporte";
    supportGroup.appendChild(supportTitle);

    const createField = (labelText, field, isTextarea = false) => {
      const label = document.createElement("label");
      label.className = "field";
      label.textContent = labelText;

      const input = isTextarea
        ? document.createElement("textarea")
        : document.createElement("input");
      input.className = isTextarea ? "textarea" : "input";
      input.dataset.field = field;
      if (isTextarea) {
        input.value = habit[field];
        input.rows = 2;
      } else {
        input.type = "text";
        input.value = habit[field];
      }
      label.appendChild(input);
      return label;
    };

    coreGroup.appendChild(createField("Gatilho", "gatilho"));
    coreGroup.appendChild(createField("Ação", "acao"));
    coreGroup.appendChild(createField("Recompensa", "recompensa"));
    supportGroup.appendChild(createField("Desejo", "desejo"));
    supportGroup.appendChild(createField("Consequência", "consequencia", true));

    body.appendChild(coreGroup);
    body.appendChild(supportGroup);

    card.appendChild(header);
    card.appendChild(summary);
    card.appendChild(body);
    elements.habitList.appendChild(card);
  });
  if (movedHabitId) {
    const id = movedHabitId;
    movedHabitId = null;
    const movedEl = elements.habitList.querySelector(`[data-id="${id}"]`);
    if (movedEl) {
      setTimeout(() => {
        movedEl.classList.remove("is-reordered");
      }, 800);
    }
  }
}

let state = loadState();
function resetExpanded(nextState) {
  expanded.clear();
  nextState.habits.forEach((habit) => expanded.add(habit.id));
}

resetExpanded(state);
render(state);

["input", "change"].forEach((eventName) => {
  elements.metaOperador.addEventListener(eventName, () => {
    updateMetadata(state);
    saveState(state);
  });
  elements.metaPeriodo.addEventListener(eventName, () => {
    elements.metaPeriodo.value = formatPeriodInput(elements.metaPeriodo.value);
    updateMetadata(state);
    saveState(state);
  });
  elements.metaObjetivo.addEventListener(eventName, () => {
    updateMetadata(state);
    saveState(state);
  });
  elements.metaFrase.addEventListener(eventName, () => {
    updateMetadata(state);
    saveState(state);
  });
});

elements.addBtn.addEventListener("click", () => {
  clearStatus();
  const count = Math.min(
    10,
    Math.max(1, Number(elements.addCount.value) || 1)
  );
  for (let i = 0; i < count; i += 1) {
    const habit = createHabit();
    state.habits.push(habit);
    expanded.add(habit.id);
  }
  saveState(state);
  render(state);
  setStatus(`${count} hábito(s) adicionado(s).`, "success");
});

elements.habitList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (!action) return;
  if (action === "difficulty") return;
  const card = target.closest(".habit-item");
  if (!card) return;
  const habitId = card.dataset.id;
  const index = state.habits.findIndex((habit) => habit.id === habitId);
  if (index === -1) return;

  if (action === "toggle") {
    if (expanded.has(habitId)) {
      expanded.delete(habitId);
    } else {
      expanded.add(habitId);
    }
    render(state);
    return;
  }
  if (action === "up") {
    moveHabit(state, index, index - 1);
  }
  if (action === "down") {
    moveHabit(state, index, index + 1);
  }
  if (action === "remove") {
    if (
      !window.confirm(
        "Excluir este hábito? Essa ação não pode ser desfeita."
      )
    ) {
      return;
    }
    state.habits.splice(index, 1);
    expanded.delete(habitId);
  }
  saveState(state);
  render(state);
  if (action === "remove") {
    setStatus("Hábito excluído.", "success");
  }
});

elements.habitList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const card = target.closest(".habit-item");
  if (!card) return;
  const habitId = card.dataset.id;
  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit) return;

  if (target.matches(".badge")) {
    habit.dif = normalizeDifficulty(target.value);
  }
  if (target.matches("[data-field]")) {
    const field = target.dataset.field;
    habit[field] = sanitizeField(target.value);
  }
  saveState(state);
});

elements.habitList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches(".habit-title-input")) {
    const card = target.closest(".habit-item");
    if (!card) return;
    const habitId = card.dataset.id;
    const habit = state.habits.find((item) => item.id === habitId);
    if (!habit) return;
    habit.nome = sanitizeName(target.value);
    saveState(state);
    render(state);
  }
});

elements.importBtn.addEventListener("click", () => {
  elements.importFile.click();
});

elements.importFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.confirm("Importar substituirá todos os dados. Continuar?")) {
    event.target.value = "";
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const payload = Array.isArray(parsed)
      ? { metadata: { ...defaultMetadata }, habits: parsed }
      : parsed;
    state = normalizeState(payload);
    resetExpanded(state);
    saveState(state);
    render(state);
    setStatus("Importado com sucesso.", "success");
  } catch {
    setStatus("Falha ao importar JSON.", "error");
  } finally {
    event.target.value = "";
  }
});

elements.exportBtn.addEventListener("click", () => {
  clearStatus();
  const payload = {
    metadata: state.metadata,
    habits: state.habits,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "habitStack_legacy.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setStatus("Exportado com sucesso.", "success");
});

elements.openTrackerBtn.addEventListener("click", () => {
  updateMetadata(state);
  saveState(state);
  localStorage.setItem(
    "habitStack_transfer",
    JSON.stringify({ metadata: state.metadata, habits: state.habits })
  );
  window.open("tracker.html", "_blank");
});

if (elements.demoBtn) {
  elements.demoBtn.addEventListener("click", () => {
    state.habits = createDemoHabits();
    resetExpanded(state);
    saveState(state);
    render(state);
    setStatus("Demo carregada com 5 hábitos.", "success");
  });
}

if (elements.stackActions) {
  elements.stackActions.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== "demo") return;
    state.habits = createDemoHabits();
    resetExpanded(state);
    saveState(state);
    render(state);
    setStatus("Demo carregada com 5 hábitos.", "success");
  });
}

if (elements.year) {
  elements.year.textContent = new Date().getFullYear();
}
