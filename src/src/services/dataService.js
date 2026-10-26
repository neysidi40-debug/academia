import { mockData } from "../data/mockData";

const STORAGE_KEY = "movimento-prototipo-v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getInitialState() {
  return { usuario: null, dados: clone(mockData) };
}

export function readPersistedState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return getInitialState();
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !parsed.dados || !parsed.dados.alunos) {
    throw new Error("Não foi possível carregar os dados salvos.");
  }
  const defaults = clone(mockData);
  const savedData = parsed.dados;
  const datos = {
    ...defaults,
    ...savedData,
    perfisAluno: { ...defaults.perfisAluno, ...savedData.perfisAluno },
  };
  for (const key of ["treinos", "aulas", "duvidas", "agendamentos", "notificacoes", "sessoesTreino", "aulasGravadas", "aulasConcluidas", "favoritosAula", "avaliacoes", "notasPrivadas", "metas", "questionarios", "respostasQuestionarios", "checkinsTreino", "pagamentos", "historicoAtividades", "planosServicos"]) {
    if (!Array.isArray(savedData[key])) continue;
    const defaultItems = defaults[key] || [];
    datos[key] = savedData[key].map((item) => ({
      ...(defaultItems.find((defaultItem) => defaultItem.id === item.id) || {}),
      ...item,
      ...(key === "treinos" && item.status === "ativo" ? { status: "disponivel" } : {}),
      ...(key === "duvidas" && item.status === "concluido" ? { status: defaultItems.find((defaultItem) => defaultItem.id === item.id)?.status || "resolvida" } : {}),
    }));
  }
  return {
    usuario: parsed.usuario || null,
    dados: datos,
  };
}

export function savePersistedState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function restoreExampleData() {
  const initialState = getInitialState();
  savePersistedState(initialState);
  return initialState;
}

export function getDemoCredentials() {
  return [
    { email: "marina@movimento.com", senha: "treino123", usuario: mockData.professor },
    ...mockData.alunos.map((aluno) => ({ email: aluno.email, senha: "treino123", usuario: aluno })),
  ];
}

export function getPageContent(pageKey) {
  return Promise.resolve({ pageKey });
}
