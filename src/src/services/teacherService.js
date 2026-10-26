const createId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

export function buildTeacherDashboard(data) {
  const activeStudents = data.alunos.filter((student) => student.status === "ativo");
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming = data.agendamentos
    .filter((booking) => {
      const startsAt = new Date(`${booking.data}T${booking.horario}:00`);
      return ["confirmado", "pendente"].includes(booking.status) && startsAt >= now && startsAt <= periodEnd;
    })
    .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
  const pendingDoubts = data.duvidas.filter((item) => item.status === "pendente" || item.status === "em_atendimento");
  const pendingEvaluations = (data.avaliacoes || []).filter((item) => item.status === "pendente");
  const recentPlans = data.treinos.filter((item) => item.status !== "arquivado").sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || "")).slice(0, 4);
  const lowFrequency = activeStudents.filter((student) => {
    const sessions = data.sessoesTreino
      .filter((item) => item.alunoId === student.id && new Date(item.iniciadaEm) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
      .sort((a, b) => (b.iniciadaEm || "").localeCompare(a.iniciadaEm || ""))
      .slice(0, 3);
    const completed = sessions.filter((item) => item.status === "concluido").length;
    return sessions.length >= 3 && completed / sessions.length < 0.5;
  });
  return { activeStudents: activeStudents.length, upcoming, pendingDoubts, pendingEvaluations, recentPlans, lowFrequency, period: "Consultas nos próximos 30 dias · frequência nas 3 sessões mais recentes" };
}

export function getTeacherStudentSummary(data, student) {
  const plans = data.treinos.filter((item) => item.alunoId === student.id);
  const sessions = data.sessoesTreino.filter((item) => item.alunoId === student.id);
  const completed = sessions.filter((item) => item.status === "concluido");
  const bookings = data.agendamentos.filter((item) => item.alunoId === student.id).sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`));
  const doubts = data.duvidas.filter((item) => item.alunoId === student.id);
  return {
    plans,
    sessions: sessions.sort((a, b) => (b.iniciadaEm || "").localeCompare(a.iniciadaEm || "")),
    completed: completed.length,
    frequency: sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0,
    bookings,
    doubts: doubts.sort((a, b) => (b.data || "").localeCompare(a.data || "")),
    evaluations: (data.avaliacoes || []).filter((item) => item.alunoId === student.id),
    goals: (data.metas || []).filter((item) => item.alunoId === student.id),
    privateNotes: (data.notasPrivadas || []).filter((item) => item.alunoId === student.id),
    history: (data.historicoAlunos || []).filter((item) => item.alunoId === student.id).sort((a, b) => b.data.localeCompare(a.data)),
  };
}

export function saveStudent(data, input, existingId) {
  const duplicate = data.alunos.some((student) => student.email.toLowerCase() === input.email.trim().toLowerCase() && student.id !== existingId);
  if (duplicate) return { error: "Já existe um aluno cadastrado com este e-mail." };
  const current = data.alunos.find((student) => student.id === existingId);
  const student = {
    ...(current || {}),
    id: existingId || createId("aluno"),
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    perfil: "aluno",
    status: input.status || "convite_pendente",
    objetivo: input.objetivo?.trim() || "",
  };
  const students = existingId ? data.alunos.map((item) => item.id === existingId ? student : item) : [...data.alunos, student];
  const notices = !existingId && student.status === "convite_pendente" ? [{
    id: createId("notificacao"),
    usuarioId: "prof-1",
    titulo: "Convite de demonstração criado",
    mensagem: `Convite simulado para ${student.nome}. Nenhum e-mail foi enviado.`,
    categoria: "alunos",
    relatedTo: `/professor/alunos/${student.id}`,
    lida: false,
    data: new Date().toISOString(),
  }] : [];
  return { student, alunos: students, notificacoes: [...data.notificacoes, ...notices] };
}

export function addStudentHistory(data, studentId, tipo, descricao, privateEntry = false) {
  const history = Array.isArray(data) ? data : data?.historicoAlunos || [];
  return [...history, { id: createId("historico"), alunoId: studentId, tipo, descricao, privado: privateEntry, data: new Date().toISOString() }];
}

export function savePrivateNote(studentId, author, text) {
  return { id: createId("nota"), alunoId: studentId, autorId: "prof-1", autor: author, texto: text.trim(), data: new Date().toISOString() };
}

export function saveEvaluation(studentId, input) {
  return { id: createId("avaliacao"), alunoId: studentId, data: input.data, medida: input.medida.trim(), observacao: input.observacao.trim(), status: "concluida", createdAt: new Date().toISOString() };
}

export function saveGoal(studentId, text) {
  const start = new Date();
  const deadline = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    id: createId("meta"),
    alunoId: studentId,
    nome: text.trim(),
    descricao: text.trim(),
    indicador: "",
    progresso: 0,
    inicio: start.toISOString().slice(0, 10),
    prazo: deadline.toISOString().slice(0, 10),
    status: "ativa",
    comentariosProfessor: "",
    criadaEm: start.toISOString(),
    historico: [],
  };
}

export function saveTrainingPlan(data, input, planId, action) {
  const previous = data.treinos.find((item) => item.id === planId);
  const keepPublishedAsIs = action === "rascunho" && previous?.status === "publicado";
  const planIdValue = keepPublishedAsIs ? createId("treino") : planId || createId("treino");
  const basePlan = keepPublishedAsIs ? null : previous;
  let versions = data.versoesTreino || [];
  if (previous && action === "publicado" && data.sessoesTreino.some((item) => item.treinoId === previous.id)) {
    versions = [...versions, { id: createId("versao"), treinoId: previous.id, versao: (previous.versao || 1), snapshot: JSON.parse(JSON.stringify(previous)), guardadaEm: new Date().toISOString() }];
  }
  const plans = input.alunoIds.map((alunoId) => ({
    ...(basePlan || {}),
    id: planIdValue,
    alunoId,
    nome: input.nome.trim(),
    objetivo: input.objetivo.trim(),
    frequenciaSemanal: Number(input.frequenciaSemanal),
    frequencia: `${input.frequenciaSemanal} ${Number(input.frequenciaSemanal) === 1 ? "vez" : "vezes"} por semana`,
    dia: input.dias.join(" · ") || "Dias a combinar",
    duracao: Number(input.duracao),
    equipamentos: [...new Set(input.exercicios.map((item) => data.exercicios.find((exercise) => exercise.id === item.exercicioId)?.equipamento).filter(Boolean))],
    exercicios: input.exercicios.map((item) => item.exercicioId),
    parametrosExercicios: input.exercicios,
    dataInicio: input.dataInicio,
    dataFim: input.dataFim,
    status: action,
    atualizadoEm: new Date().toISOString().slice(0, 10),
    versao: basePlan ? (basePlan.versao || 1) + (action === "publicado" ? 1 : 0) : 1,
  }));
  const allPlans = basePlan ? data.treinos.filter((item) => item.id !== planIdValue).concat(plans) : [...data.treinos, ...plans];
  const notices = action === "publicado" ? input.alunoIds.map((alunoId) => ({
    id: createId("notificacao"),
    usuarioId: alunoId,
    titulo: "Novo treino disponível",
    mensagem: `A professora publicou o treino ${input.nome.trim()}.`,
    categoria: "treinos",
    relatedTo: `/aluno/treinos/${planIdValue}`,
    lida: false,
    data: new Date().toISOString(),
  })) : [];
  return { planId: planIdValue, treinos: allPlans, versoesTreino: versions, notificacoes: [...data.notificacoes, ...notices] };
}

export function archiveTraining(data, planId) {
  const plan = data.treinos.find((item) => item.id === planId);
  if (!plan) return data.treinos;
  return data.treinos.map((item) => item.id === planId ? { ...item, status: "arquivado" } : item);
}

export function saveExercise(data, input, exerciseId) {
  const current = data.exercicios.find((item) => item.id === exerciseId);
  const exercise = { ...(current || {}), id: exerciseId || createId("exercicio"), ...input, nome: input.nome.trim(), grupo: input.grupo.trim(), categoria: input.categoria.trim(), equipamento: input.equipamento.trim(), instrucoes: input.instrucoes.trim(), videoUrl: input.videoUrl.trim(), arquivado: false };
  return exerciseId ? data.exercicios.map((item) => item.id === exerciseId ? exercise : item) : [...data.exercicios, exercise];
}

export function archiveExercise(data, exerciseId) {
  return data.exercicios.map((item) => item.id === exerciseId ? { ...item, arquivado: true } : item);
}

export function saveLesson(data, input, lessonId, publishNow) {
  const existing = data.aulasGravadas.find((item) => item.id === lessonId);
  const id = lessonId || createId("aula-gravada");
  const status = publishNow ? "publicado" : input.status;
  const lesson = {
    ...(existing || {}),
    id,
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    categoria: input.categoria.trim(),
    objetivo: input.objetivo.trim(),
    duracao: Number(input.duracao),
    materiais: input.materiais.split(",").map((item) => item.trim()).filter(Boolean),
    alunoIds: input.alunoIds,
    videoUrl: input.videoUrl.trim(),
    miniaturaUrl: input.miniaturaUrl.trim(),
    status: input.status === "programado" && input.publicarEm ? "programado" : status,
    publicarEm: input.publicarEm || "",
    nova: publishNow,
    arquivadaEm: status === "arquivado" ? new Date().toISOString() : "",
  };
  const lessons = existing ? data.aulasGravadas.map((item) => item.id === id ? lesson : item) : [...data.aulasGravadas, lesson];
  const notices = publishNow ? input.alunoIds.map((alunoId) => ({
    id: createId("notificacao"),
    usuarioId: alunoId,
    titulo: "Nova aula gravada",
    mensagem: `A aula ${lesson.titulo} está disponível.`,
    categoria: "aulas",
    relatedTo: `/aluno/aulas/${id}`,
    lida: false,
    data: new Date().toISOString(),
  })) : [];
  return { lesson, aulasGravadas: lessons, notificacoes: [...data.notificacoes, ...notices] };
}

export function getDoubtPriority(item) {
  return item.prioridade ? 0 : item.status === "pendente" ? 1 : item.status === "em_atendimento" ? 2 : 3;
}

export function replyToStudentDoubt(doubt, text, status, attachment) {
  const now = new Date().toISOString();
  const updated = {
    ...doubt,
    status,
    respostaNova: true,
    mensagens: [...(doubt.mensagens || []), {
      id: createId("mensagem"),
      autorId: "prof-1",
      autor: "Marina Costa",
      texto: text.trim(),
      data: now,
      anexos: attachment ? [{ nome: attachment.name, tipo: attachment.type, tamanho: attachment.size, url: URL.createObjectURL(attachment) }] : [],
    }],
  };
  const notification = {
    id: createId("notificacao"),
    usuarioId: doubt.alunoId,
    titulo: "Nova resposta da professora",
    mensagem: `Marina respondeu à dúvida: ${doubt.assunto}.`,
    categoria: "respostas",
    relatedTo: `/aluno/duvidas/${doubt.id}`,
    lida: false,
    data: now,
  };
  return { doubt: updated, notification };
}

export function markDoubtResolved(doubt) {
  return { ...doubt, status: "resolvida", resolvidaEm: new Date().toISOString() };
}

export function getScheduleConflicts(data, candidate, ignoreId) {
  if ((data.disponibilidade?.datasBloqueadas || []).includes(candidate.data)) return ["Este dia está bloqueado na disponibilidade."];
  const availability = data.disponibilidade || {};
  const day = new Date(`${candidate.data}T12:00:00`).getDay();
  if (availability.diasSemana && !availability.diasSemana.includes(day)) return ["Este dia não está configurado como dia de atendimento."];
  const start = toMinutes(candidate.horario);
  const end = start + Number(candidate.duracao || 45);
  const from = toMinutes(availability.inicio || "09:00");
  const to = toMinutes(availability.fim || "17:00");
  if (start < from || end > to) return ["O horário está fora do expediente configurado."];
  if (availability.intervaloInicio && availability.intervaloFim && start < toMinutes(availability.intervaloFim) && end > toMinutes(availability.intervaloInicio)) return ["O horário conflita com o intervalo da agenda."];
  const conflicts = data.agendamentos.filter((item) => item.id !== ignoreId && item.data === candidate.data && !["cancelado", "recusado", "reagendamento solicitado"].includes(item.status))
    .filter((item) => {
      const otherStart = toMinutes(item.horario);
      const otherEnd = otherStart + Number(item.duracao || 45);
      return start < otherEnd && end > otherStart;
    });
  return conflicts.map((item) => `Há uma reserva para ${item.horario} (${item.modalidade || item.tipo}).`);
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function updateBooking(booking, changes, reason, professorName) {
  const next = { ...booking, ...changes };
  const changed = Object.keys(changes).some((key) => booking[key] !== changes[key]);
  if (!changed) return next;
  next.historicoStatus = [...(booking.historicoStatus || []), {
    status: changes.status || booking.status,
    autor: professorName,
    motivo: reason.trim(),
    data: new Date().toISOString(),
    horarioAnterior: `${booking.data} ${booking.horario}`,
    horarioNovo: changes.data || changes.horario ? `${changes.data || booking.data} ${changes.horario || booking.horario}` : "",
  }];
  return next;
}

export function createStudentNotification(studentId, title, message, path, category = "aulas") {
  return { id: createId("notificacao"), usuarioId: studentId, titulo: title, mensagem: message, categoria: category, relatedTo: path, lida: false, data: new Date().toISOString() };
}
