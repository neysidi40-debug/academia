const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

export function listStudentItems(items = [], studentId) {
  return items.filter((item) => item.alunoId === studentId || item.usuarioId === studentId);
}

export function getStudentTrainings(data, studentId) {
  const sessions = data.sessoesTreino || [];
  return (data.treinos || []).filter((item) => item.alunoId === studentId && ["disponivel", "publicado", "ativo"].includes(item.status)).map((plan) => {
    const session = sessions.find((item) => item.alunoId === studentId && item.treinoId === plan.id && item.status !== "concluido");
    const history = sessions.filter((item) => item.alunoId === studentId && item.treinoId === plan.id && item.status === "concluido");
    return { ...plan, andamento: session, sessoesConcluidas: history.length, estado: session ? "em andamento" : plan.status || "disponivel" };
  });
}

export function getStudentTrainingHistory(data, studentId) {
  return (data.sessoesTreino || [])
    .filter((item) => item.alunoId === studentId && item.status === "concluido")
    .sort((a, b) => (b.concluidaEm || "").localeCompare(a.concluidaEm || ""));
}

export function getStudentExercises(data, studentId) {
  const planExerciseIds = new Set((data.treinos || [])
    .filter((plan) => plan.alunoId === studentId && ["disponivel", "publicado", "ativo"].includes(plan.status))
    .flatMap((plan) => plan.exercicios));
  return (data.exercicios || []).filter((item) => planExerciseIds.has(item.id));
}

export function getStudentProfile(data, studentId) {
  return data.perfisAluno?.[studentId] || { telefone: "", foto: "", preferencias: {} };
}

export function getStudentNotificationPreferences(data, studentId) {
  const legacyKey = studentId === "aluno-1" ? "aluno1" : "aluno2";
  return getStudentProfile(data, studentId).preferencias
    || data.preferenciasNotificacao?.[legacyKey]
    || {};
}

export function getTrainingDetail(data, studentId, trainingId) {
  const plan = (data.treinos || []).find((item) => item.id === trainingId && item.alunoId === studentId);
  if (!plan || !["disponivel", "publicado", "ativo"].includes(plan.status)) return null;
  const andamento = (data.sessoesTreino || []).find((item) => item.treinoId === plan.id && item.alunoId === studentId && item.status !== "concluido");
  const sessaoConcluida = (data.sessoesTreino || []).filter((item) => item.treinoId === plan.id && item.alunoId === studentId && item.status === "concluido").sort((a, b) => (b.concluidaEm || "").localeCompare(a.concluidaEm || ""))[0] || null;
  const exercicios = plan.exercicios.map((id, index) => {
    const exercise = data.exercicios.find((item) => item.id === id);
    const prescription = plan.parametrosExercicios?.[index] || {};
    return exercise && {
      ...exercise,
      ordem: index + 1,
      series: Number(prescription.series || 3),
      repeticoes: prescription.repeticoes || (index === 2 ? "30 segundos" : "10–12"),
      descanso: prescription.descanso || "60 segundos",
      carga: prescription.carga || (index < 2 ? "Peso corporal" : "Confortável"),
      instrucoes: prescription.instrucoes || exercise.instrucoes || "Faça o movimento com controle e respeite seus limites.",
      videoUrl: prescription.videoUrl || exercise.videoUrl || "",
    };
  }).filter(Boolean);
  return { ...plan, exercicios, andamento, sessaoConcluida };
}

export function getStudentLessons(data, studentId) {
  const today = new Date().toISOString().slice(0, 10);
  return (data.aulasGravadas || []).filter((lesson) => (lesson.alunoIds || []).includes(studentId) && (lesson.status || "publicado") === "publicado" && (!lesson.publicarEm || lesson.publicarEm.slice(0, 10) <= today))
    .map((lesson) => ({ ...lesson, concluida: (data.aulasConcluidas || []).some((item) => item.alunoId === studentId && item.aulaId === lesson.id), favorita: (data.favoritosAula || []).some((item) => item.alunoId === studentId && item.aulaId === lesson.id) }));
}

export function getStudentLesson(data, studentId, lessonId) {
  return getStudentLessons(data, studentId).find((lesson) => lesson.id === lessonId) || null;
}

export function getStudentDoubts(data, studentId) {
  return (data.duvidas || []).filter((item) => item.alunoId === studentId);
}

export function getStudentDoubt(data, studentId, doubtId) {
  return getStudentDoubts(data, studentId).find((item) => item.id === doubtId) || null;
}

export function getStudentBookings(data, studentId) {
  return (data.agendamentos || []).filter((item) => item.alunoId === studentId);
}

export function getStudentNotifications(data, studentId) {
  return listStudentItems(data.notificacoes, studentId).sort((a, b) => `${b.data} ${b.horario || ""}`.localeCompare(`${a.data} ${a.horario || ""}`));
}

export function createTrainingSession(plan, studentId, existing) {
  const current = existing || {
    id: makeId("sessao"),
    treinoId: plan.id,
    alunoId: studentId,
    status: "em andamento",
    iniciadaEm: new Date().toISOString(),
    planoSnapshot: JSON.parse(JSON.stringify(plan)),
    registros: {},
    observacao: "",
    avaliacao: "",
  };
  return current;
}

export function completeTrainingSession(session, updates = {}) {
  return { ...session, ...updates, status: "concluido", concluidaEm: new Date().toISOString() };
}

export function createDoubt(student, draft) {
  const doubtId = makeId("duvida");
  const messageId = makeId("mensagem");
  const createdAt = new Date().toISOString();
  const doubt = {
    id: doubtId,
    alunoId: student.id,
    assunto: draft.assunto.trim(),
    categoria: draft.categoria,
    status: "pendente",
    data: createdAt.slice(0, 10),
    respostaNova: false,
    anexos: draft.anexos.map(({ nome, tipo, tamanho }) => ({ nome, tipo, tamanho })),
    mensagens: [{ id: messageId, autorId: student.id, autor: student.nome, texto: draft.descricao.trim(), data: createdAt, anexos: draft.anexos.map(({ nome, tipo, tamanho }) => ({ nome, tipo, tamanho })) }],
  };
  const notification = {
    id: makeId("notificacao"),
    usuarioId: "prof-1",
    titulo: "Nova dúvida de aluno",
    mensagem: `${student.nome} enviou uma dúvida: ${doubt.assunto}.`,
    categoria: "respostas",
    relatedTo: `/professor/duvidas/${doubt.id}`,
    lida: false,
    data: createdAt,
  };
  return { doubt, notification };
}

export function replyToDoubt(doubt, student, text) {
  const createdAt = new Date().toISOString();
  return {
    ...doubt,
    status: doubt.status === "resolvida" ? "pendente" : doubt.status,
    mensagens: [...(doubt.mensagens || []), { id: makeId("mensagem"), autorId: student.id, autor: student.nome, texto: text.trim(), data: createdAt, anexos: [] }],
  };
}

export function getAvailableSlots(data, date, serviceType) {
  const availability = data.disponibilidade || {};
  const day = new Date(`${date}T12:00:00`).getDay();
  if ((availability.datasBloqueadas || []).includes(date) || (availability.diasSemana && !availability.diasSemana.includes(day))) return [];
  const duration = Number(availability.duracoes?.[serviceType] || (serviceType === "online" ? 45 : 50));
  const [startHours, startMinutes] = (availability.inicio || "09:00").split(":").map(Number);
  const [endHours, endMinutes] = (availability.fim || "17:00").split(":").map(Number);
  const start = startHours * 60 + startMinutes;
  const end = endHours * 60 + endMinutes;
  const breakStart = availability.intervaloInicio ? availability.intervaloInicio.split(":").map(Number).reduce((h, m) => h * 60 + m) : -1;
  const breakEnd = availability.intervaloFim ? availability.intervaloFim.split(":").map(Number).reduce((h, m) => h * 60 + m) : -1;
  const slots = [];
  for (let minute = start; minute + duration <= end; minute += 60) {
    if (minute < breakEnd && minute + duration > breakStart) continue;
    slots.push(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
  }
  return slots.filter((slot) => {
    const slotStart = slot.split(":").map(Number).reduce((h, m) => h * 60 + m);
    const slotEnd = slotStart + duration;
    return !data.agendamentos.some((item) => {
      if (item.data !== date || ["cancelado", "recusado", "reagendamento solicitado"].includes(item.status)) return false;
      const otherStart = item.horario.split(":").map(Number).reduce((h, m) => h * 60 + m);
      const otherEnd = otherStart + Number(item.duracao || 45);
      return slotStart < otherEnd && slotEnd > otherStart;
    });
  });
}

export function createBooking(data, studentId, draft) {
  if (!getAvailableSlots(data, draft.data, draft.tipo).includes(draft.horario)) return null;
  const booking = {
    id: makeId("agendamento"),
    alunoId: studentId,
    tipo: draft.tipo,
    modalidade: draft.tipo === "online" ? "Online" : "Presencial",
    data: draft.data,
    horario: draft.horario,
    duracao: Number(data.disponibilidade?.duracoes?.[draft.tipo] || (draft.tipo === "online" ? 45 : 50)),
    preco: Number(data.disponibilidade?.valores?.[draft.tipo] || (draft.tipo === "online" ? 75 : 95)),
    motivo: draft.motivo.trim(),
    observacoes: draft.observacoes.trim(),
    local: draft.tipo === "presencial" ? data.configuracoesProfessor?.local || "Espaço Movimento" : "O link de acesso será enviado na confirmação.",
    status: "confirmado",
    pagamento: "Aguardando pagamento (simulado)",
    regrasAceitas: true,
    criadoEm: new Date().toISOString(),
  };
  return booking;
}

export function updateBookingStatus(booking, status, reason, studentName) {
  return {
    ...booking,
    status,
    historicoStatus: [...(booking.historicoStatus || []), { status, autor: studentName, motivo: reason.trim(), data: new Date().toISOString() }],
  };
}

export function buildDashboard(data, studentId) {
  const trainings = getStudentTrainings(data, studentId);
  const bookings = getStudentBookings(data, studentId).filter((item) => ["confirmado", "pendente"].includes(item.status) && new Date(`${item.data}T${item.horario}:00`) >= new Date()).sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
  const notifications = getStudentNotifications(data, studentId);
  const doubts = getStudentDoubts(data, studentId);
  const sessions = (data.sessoesTreino || []).filter((item) => item.alunoId === studentId);
  const completed = sessions.filter((item) => item.status === "concluido");
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date()).toLowerCase().replace("-feira", "");
  const plan = trainings.find((item) => item.andamento) || trainings.find((item) => item.estado === "disponivel" && item.dia?.toLowerCase().includes(weekday)) || trainings.find((item) => item.estado === "disponivel");
  return {
    training: plan,
    booking: bookings[0] || null,
    recentNotifications: notifications.slice(0, 3),
    recentReplies: doubts.filter((item) => item.respostaNova),
    attendance: { completed: completed.length, total: Math.max(4, sessions.length + 2) },
    progress: sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0,
  };
}

export function saveStudentProfile(data, student, profile) {
  const alumni = data.alunos.map((item) => item.id === student.id ? { ...item, nome: profile.nome.trim(), email: profile.email.trim() } : item);
  const user = { ...student, nome: profile.nome.trim(), email: profile.email.trim() };
  return {
    user,
    dados: {
      ...data,
      alunos: alumni,
      perfisAluno: { ...data.perfisAluno, [student.id]: { ...data.perfisAluno[student.id], telefone: profile.telefone, foto: profile.foto, preferencias: profile.preferencias } },
      notificacoes: data.notificacoes,
    },
  };
}
