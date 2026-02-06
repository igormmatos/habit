import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { getTodayKeyLocal, isChecked } from "./checkins.js";

const STORAGE_KEY = "habit:tracker:v1";
const TRANSFER_KEY = "habitStack_transfer";

const elements = {
  operator: document.getElementById("operator"),
  period: document.getElementById("period"),
  objective: document.getElementById("objective"),
  phrase: document.getElementById("phrase"),
  days: document.getElementById("days"),
  startDate: document.getElementById("startDate"),
  habitList: document.getElementById("habitList"),
  empty: document.getElementById("trackerEmpty"),
  optionalInput: document.getElementById("optionalInput"),
  addOptionalBtn: document.getElementById("addOptionalBtn"),
  optionalList: document.getElementById("optionalList"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  clearBtn: document.getElementById("clearBtn"),
  generatePreviewBtn: document.getElementById("generatePreviewBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  preview: document.getElementById("preview"),
  status: document.getElementById("status"),
};

const initialState = {
  metadata: {
    operador: "",
    periodo: "",
    objetivo: "",
    frase: "",
  },
  days: 30,
  startDate: "",
  habits: [],
  optionalHabits: [],
};

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tracker_${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
}

function sanitizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeDays(value) {
  return Math.min(31, Math.max(7, Number(value) || 30));
}

function normalizeDateKey(value) {
  if (typeof value !== "string" || !value) return getTodayKeyLocal();
  return value;
}

function formatPeriodInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return `h_${hash.toString(16)}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...initialState };
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...initialState };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(raw) {
  const metadata = {
    operador: sanitizeText(raw?.metadata?.operador),
    periodo: sanitizeText(raw?.metadata?.periodo),
    objetivo: sanitizeText(raw?.metadata?.objetivo),
    frase: sanitizeText(raw?.metadata?.frase),
  };
  const habits = Array.isArray(raw?.habits)
    ? raw.habits
        .map((habit) => ({
          id:
            typeof habit.id === "string" && habit.id
              ? habit.id
              : hashString(sanitizeText(habit.text)),
          text: sanitizeText(habit.text),
          priority: Boolean(habit.priority),
        }))
        .filter((habit) => habit.text)
    : [];
  const optionalHabits = Array.isArray(raw?.optionalHabits)
    ? raw.optionalHabits
        .map((habit) => ({
          text: sanitizeText(habit.text),
        }))
        .filter((habit) => habit.text)
    : [];
  return {
    metadata,
    days: normalizeDays(raw?.days),
    startDate: normalizeDateKey(raw?.startDate),
    habits,
    optionalHabits,
  };
}

function setStatus(message, tone = "info") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function clearStatus() {
  setStatus("");
  elements.status.removeAttribute("data-tone");
}

function syncExportState() {
  elements.exportPdfBtn.disabled = !elements.preview.childElementCount;
}

function applyMetadata(state) {
  state.metadata = {
    operador: sanitizeText(elements.operator.value),
    periodo: sanitizeText(elements.period.value),
    objetivo: sanitizeText(elements.objective.value),
    frase: sanitizeText(elements.phrase.value),
  };
  state.days = normalizeDays(elements.days.value);
  state.startDate = normalizeDateKey(elements.startDate.value);
}

function render(state) {
  elements.operator.value = state.metadata.operador;
  elements.period.value = formatPeriodInput(state.metadata.periodo);
  elements.objective.value = state.metadata.objetivo;
  elements.phrase.value = state.metadata.frase;
  elements.days.value = state.days;
  elements.startDate.value = normalizeDateKey(state.startDate);

  elements.habitList.innerHTML = "";
  elements.optionalList.innerHTML = "";
  elements.empty.style.display = state.habits.length ? "none" : "block";

  state.habits.forEach((habit, index) => {
    const row = document.createElement("div");
    row.className = "habit-item tracker-row";
    row.dataset.index = index;
    row.innerHTML = `
      <div class="habit-title"><strong>${index + 1}.</strong> ${habit.text}</div>
      <label class="priority-toggle">
        <input type="checkbox" ${habit.priority ? "checked" : ""} data-action="priority" aria-label="Marcar como prioridade" />
        Prioridade (!)
      </label>
      <div class="habit-controls">
        <button class="btn btn-small" data-action="up" aria-label="Mover para cima">↑</button>
        <button class="btn btn-small" data-action="down" aria-label="Mover para baixo">↓</button>
      </div>
    `;
    elements.habitList.appendChild(row);
  });

  state.optionalHabits.forEach((habit, index) => {
    const row = document.createElement("div");
    row.className = "habit-item tracker-row";
    row.dataset.index = index;
    row.innerHTML = `
      <div class="habit-title">### ${habit.text}</div>
      <button class="btn btn-small" data-action="remove-optional">Remover</button>
    `;
    elements.optionalList.appendChild(row);
  });

  syncExportState();
}

function buildPreviewTitle(days) {
  return `HABIT TRACKER - ${days} DIAS`;
}

function diffDaysLocal(startKey, endKey) {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function renderPreview(state) {
  elements.preview.innerHTML = "";
  const totalHabits = state.habits.length + state.optionalHabits.length;
  if (!totalHabits) {
    setStatus("Adicione hábitos antes de gerar o preview.", "error");
    syncExportState();
    return;
  }

  const days = normalizeDays(state.days);
  const todayKey = getTodayKeyLocal();
  const startKey = normalizeDateKey(state.startDate);
  const dayIndex = diffDaysLocal(startKey, todayKey) + 1;
  const trackerPage = document.createElement("div");
  trackerPage.className = "tracker-page";

  const titleRow = document.createElement("div");
  titleRow.className = "title-row";
  titleRow.innerHTML = `
    <span class="tracker-title">${buildPreviewTitle(days)}</span>
    <span class="page-info">OPERADOR: ${state.metadata.operador || "____"}  |  PERÍODO: ${state.metadata.periodo || "____"}  |  OBJETIVO: ${state.metadata.objetivo || "____"}</span>
  `;
  trackerPage.appendChild(titleRow);

  const combined = [
    ...state.habits.map((habit) => ({ ...habit, optional: false })),
    ...state.optionalHabits.map((habit) => ({
      text: habit.text,
      priority: false,
      optional: true,
    })),
  ];

  combined.forEach((habit) => {
    const row = document.createElement("div");
    row.className = "habit-row";
    const prefix = habit.optional ? "###" : habit.priority ? "!!!" : "";
    row.innerHTML = `
      <span class="habit-label-line">${prefix} ${habit.text}</span>
    `;

    const daysScroll = document.createElement("div");
    daysScroll.className = "days-row";
    for (let i = 1; i <= days; i += 1) {
      const box = document.createElement("div");
      box.className = "day-box";
      if (i === dayIndex && dayIndex >= 1 && dayIndex <= days) {
        box.classList.add("day-box--today");
      }
      if (
        i === dayIndex &&
        dayIndex >= 1 &&
        dayIndex <= days &&
        !habit.optional &&
        isChecked(habit.id, todayKey)
      ) {
        box.classList.add("day-box--checked");
        box.textContent = "X";
      } else {
        box.textContent = i;
      }
      daysScroll.appendChild(box);
    }
    row.appendChild(daysScroll);

    const obs = document.createElement("div");
    obs.className = "obs-field";
    obs.textContent = "Obs.";
    row.appendChild(obs);
    trackerPage.appendChild(row);
  });

  elements.preview.appendChild(trackerPage);
  trackerPage.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("Preview gerado.", "success");
  syncExportState();
}

function formatDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function exportPdf() {
  if (!elements.preview || !elements.preview.childElementCount) {
    setStatus("Gere o preview antes de exportar.", "error");
    syncExportState();
    return;
  }

  elements.exportPdfBtn.disabled = true;
  const originalText = elements.exportPdfBtn.textContent;
  elements.exportPdfBtn.textContent = "Gerando...";
  setStatus("Gerando PDF...", "info");

  try {
    const preview = elements.preview;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const imgWidth = pageWidth - margin * 2;
    const imgHeightMax = pageHeight - margin * 2;

    const scale = 2;
    const totalHeight = preview.scrollHeight;
    const totalWidth = preview.scrollWidth;
    const ratio = imgWidth / (totalWidth * scale);
    const sliceHeightPx = Math.floor(imgHeightMax / ratio);

    let offsetY = 0;
    while (offsetY < totalHeight) {
      const height = Math.min(sliceHeightPx, totalHeight - offsetY);
      const canvas = await html2canvas(preview, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: true,
        width: totalWidth,
        height,
        x: 0,
        y: offsetY,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
      });

      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgWidth, imgHeight);

      offsetY += height;
      if (offsetY < totalHeight) {
        pdf.addPage();
      }
    }

    pdf.save(`habit-tracker-${formatDateStamp()}.pdf`);
    setStatus("PDF baixado.", "success");
  } catch {
    setStatus("Falha ao exportar PDF.", "error");
  } finally {
    elements.exportPdfBtn.disabled = false;
    elements.exportPdfBtn.textContent = originalText;
  }
}

function loadTransfer(state) {
  const raw = localStorage.getItem(TRANSFER_KEY);
  if (!raw) return state;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.metadata) {
      state.metadata = {
        operador: sanitizeText(parsed.metadata.operador),
        periodo: sanitizeText(parsed.metadata.periodo),
        objetivo: sanitizeText(parsed.metadata.objetivo),
        frase: sanitizeText(parsed.metadata.frase),
      };
    }
    if (Array.isArray(parsed?.habits)) {
      state.habits = parsed.habits
        .map((habit) => ({
          id:
            typeof habit.id === "string" && habit.id
              ? habit.id
              : hashString(sanitizeText(habit.nome || "")),
          text: sanitizeText(habit.nome || ""),
          priority: false,
        }))
        .filter((habit) => habit.text);
    }
    localStorage.removeItem(TRANSFER_KEY);
    setStatus("Carregado do Stack com sucesso.", "success");
  } catch {
    setStatus("Falha ao carregar dados do Stack.", "error");
  }
  return state;
}

let state = loadState();
state = loadTransfer(state);
if (!state.startDate) {
  state.startDate = getTodayKeyLocal();
}
saveState(state);
render(state);

["input", "change"].forEach((eventName) => {
  elements.operator.addEventListener(eventName, () => {
    applyMetadata(state);
    saveState(state);
  });
  elements.period.addEventListener(eventName, () => {
    elements.period.value = formatPeriodInput(elements.period.value);
    applyMetadata(state);
    saveState(state);
  });
  elements.objective.addEventListener(eventName, () => {
    applyMetadata(state);
    saveState(state);
  });
  elements.phrase.addEventListener(eventName, () => {
    applyMetadata(state);
    saveState(state);
  });
  elements.days.addEventListener(eventName, () => {
    applyMetadata(state);
    saveState(state);
  });
  elements.startDate.addEventListener(eventName, () => {
    applyMetadata(state);
    saveState(state);
  });
});

elements.habitList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const row = target.closest(".habit-item");
  if (!row) return;
  const index = Number(row.dataset.index);
  if (Number.isNaN(index)) return;

  if (target.dataset.action === "up" && index > 0) {
    const [moved] = state.habits.splice(index, 1);
    state.habits.splice(index - 1, 0, moved);
  }
  if (target.dataset.action === "down" && index < state.habits.length - 1) {
    const [moved] = state.habits.splice(index, 1);
    state.habits.splice(index + 1, 0, moved);
  }
  if (target.dataset.action === "priority") {
    state.habits[index].priority = target.checked;
  }

  saveState(state);
  render(state);
});

elements.addOptionalBtn.addEventListener("click", () => {
  clearStatus();
  const text = sanitizeText(elements.optionalInput.value);
  if (!text) return;
  state.optionalHabits.push({ text });
  elements.optionalInput.value = "";
  saveState(state);
  render(state);
});

elements.optionalList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "remove-optional") return;
  const row = target.closest(".habit-item");
  if (!row) return;
  const index = Number(row.dataset.index);
  if (Number.isNaN(index)) return;
  state.optionalHabits.splice(index, 1);
  saveState(state);
  render(state);
});

elements.importBtn.addEventListener("click", () => {
  elements.importFile.click();
});

elements.importFile.addEventListener("change", async (event) => {
  clearStatus();
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
      ? { metadata: { ...initialState.metadata }, habits: parsed }
      : parsed;
    const next = {
      metadata: {
        operador: sanitizeText(payload?.metadata?.operador),
        periodo: sanitizeText(payload?.metadata?.periodo),
        objetivo: sanitizeText(payload?.metadata?.objetivo),
        frase: sanitizeText(payload?.metadata?.frase),
      },
      days: state.days,
      startDate: state.startDate,
      habits: Array.isArray(payload?.habits)
        ? payload.habits
            .map((habit) => ({
              text: sanitizeText(habit.nome || ""),
              id:
                typeof habit.id === "string" && habit.id
                  ? habit.id
                  : hashString(sanitizeText(habit.nome || "")),
              priority: false,
            }))
            .filter((habit) => habit.text)
        : [],
      optionalHabits: [],
    };
    state = normalizeState(next);
    saveState(state);
    render(state);
    setStatus("Importado com sucesso.", "success");
  } catch {
    setStatus("Falha ao importar JSON.", "error");
  } finally {
    event.target.value = "";
  }
});

elements.clearBtn.addEventListener("click", () => {
  clearStatus();
  if (!window.confirm("Isso removerá os dados do tracker. Continuar?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = { ...initialState };
  render(state);
  setStatus("Dados limpos.", "success");
});

elements.generatePreviewBtn.addEventListener("click", () => {
  clearStatus();
  applyMetadata(state);
  saveState(state);
  renderPreview(state);
});

elements.exportPdfBtn.addEventListener("click", exportPdf);
