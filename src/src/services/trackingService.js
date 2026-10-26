const createId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

export function addAuditEvent(events, { usuarioId, usuarioNome, perfil, tipo, resumo, relatedTo = "", alunoId = "" }) {
  return [...events, {
    id: createId("evento"),
    usuarioId,
    usuarioNome,
    perfil,
    alunoId,
    tipo,
    resumo,
    relatedTo,
    data: new Date().toISOString(),
  }];
}

export function saveGoalForStudent(goal, studentId) {
  return {
    id: createId("meta"),
    alunoId: studentId,
    nome: goal.nome.trim(),
    descricao: goal.descricao.trim(),
    indicador: goal.indicador.trim(),
    progresso: 0,
    inicio: goal.inicio,
    prazo: goal.prazo,
    status: "ativa",
    comentariosProfessor: "",
    historico: [],
  };
}

export function updateStudentGoal(goal, changes, actor) {
  const next = { ...goal, ...changes };
  if ((Number(next.progresso) >= 100 || next.status === "concluida") && goal.status !== "concluida") {
    next.status = "concluida";
    next.concluidaEm = new Date().toISOString();
    next.historico = [...(goal.historico || []), {
      tipo: "conclusao",
      descricao: "Meta concluída ao atingir 100% de progresso.",
      autor: actor,
      data: next.concluidaEm,
    }];
  } else if (Number(next.progresso) < 100 && goal.status === "concluida") {
    next.status = changes.status || "ativa";
  }
  return next;
}

export function submitQuestionnaireResponse(questionnaire, answers, student) {
  const errors = questionnaire.campos
    .filter((field) => field.obrigatorio && !String(answers[field.id] || "").trim())
    .map((field) => field.rotulo);
  if (errors.length) return { error: `Preencha os campos obrigatórios: ${errors.join(", ")}.` };
  const response = {
    id: createId("resposta"),
    questionarioId: questionnaire.id,
    alunoId: student.id,
    alunoNome: student.nome,
    respostas: answers,
    enviadoEm: new Date().toISOString(),
  };
  return { response };
}

export function createQuestionnaire(input, teacher) {
  return {
    id: createId("formulario"),
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    prazo: input.prazo,
    campos: input.campos.map((field, index) => ({
      id: field.id || `campo-${index + 1}`,
      rotulo: field.rotulo.trim(),
      tipo: field.tipo,
      obrigatorio: Boolean(field.obrigatorio),
    })),
    alunoIds: input.alunoIds,
    status: "publicado",
    criadoEm: new Date().toISOString(),
    criadoPor: teacher.id,
  };
}

export function createPayment(studentId, booking) {
  return {
    id: createId("pagamento"),
    alunoId: studentId,
    agendamentoId: booking.id,
    valor: Number(booking.preco || 0),
    data: new Date().toISOString(),
    servico: booking.modalidade || booking.tipo || "Atendimento",
    status: "pendente",
    comprovante: "",
  };
}

export function simulatePayment(payment, result = "aprovado") {
  return {
    ...payment,
    status: result,
    pagoEm: result === "aprovado" ? new Date().toISOString() : "",
    comprovante: result === "aprovado" ? `MOV-${payment.id.toUpperCase()}` : "",
  };
}

export function createServicePlan(input) {
  return {
    id: createId("plano"),
    nome: input.nome.trim(),
    descricao: input.descricao.trim(),
    servicos: input.servicos.split(",").map((item) => item.trim()).filter(Boolean),
    preco: Number(input.preco),
    vigencia: input.vigencia.trim(),
    modalidades: input.modalidades,
    regras: input.regras.trim(),
    alunoIds: input.alunoIds,
    criadoEm: new Date().toISOString(),
  };
}

export function summarizeReport(data, filters = {}) {
  const from = filters.inicio ? new Date(`${filters.inicio}T00:00:00`) : new Date("1970-01-01T00:00:00");
  const through = filters.fim ? new Date(`${filters.fim}T23:59:59`) : new Date("2999-12-31T23:59:59");
  const studentMatches = (item) => !filters.alunoId || item.alunoId === filters.alunoId;
  const inRange = (value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= from && date <= through;
  };
  const sessions = (data.sessoesTreino || []).filter((item) => studentMatches(item) && inRange(item.concluidaEm || item.iniciadaEm));
  const doubts = (data.duvidas || []).filter((item) => studentMatches(item) && inRange(item.data || item.mensagens?.[0]?.data));
  const bookings = (data.agendamentos || []).filter((item) => studentMatches(item) && inRange(item.data));
  return {
    sessions,
    completedSessions: sessions.filter((item) => item.status === "concluido").length,
    startedSessions: sessions.length,
    doubtsReceived: doubts.length,
    doubtsAnswered: doubts.filter((item) => (item.mensagens || []).some((message) => message.autorId === "prof-1")).length,
    appointmentsCompleted: bookings.filter((item) => item.status === "concluido").length,
    appointmentsCancelled: bookings.filter((item) => item.status === "cancelado").length,
    lowActivity: data.alunos.filter((student) => (!filters.alunoId || student.id === filters.alunoId) && student.status === "ativo")
      .filter((student) => !(data.sessoesTreino || []).some((session) => session.alunoId === student.id && session.status === "concluido" && inRange(session.concluidaEm || session.iniciadaEm))),
  };
}

export function toCsv(rows) {
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
}
