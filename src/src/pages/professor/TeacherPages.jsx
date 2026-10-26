import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, Clock3, Dumbbell, Edit3, FileText, Flag, HeartPulse, MessageCircle,
  Phone, Plus, Search, Settings2, ShieldAlert, SlidersHorizontal, UserPlus, Users, Video,
} from "lucide-react";
import Button from "../../components/Button";
import Cartao from "../../components/Card";
import Carregando from "../../components/Loading";
import EstadoVazio from "../../components/EmptyState";
import MensagemErro from "../../components/ErrorMessage";
import CampoFormulario from "../../components/FormField";
import EtiquetaStatus from "../../components/StatusTag";
import ModalConfirmacao from "../../components/ConfirmModal";
import Toast from "../../components/Toast";
import { useApp } from "../../context/AppContext";
import { getPageContent } from "../../services/dataService";
import { addAuditEvent, updateStudentGoal } from "../../services/trackingService";
import { teacherAttentionConfig } from "../../config/teacherAttention";
import {
  addStudentHistory, archiveExercise, archiveTraining,
  createStudentNotification, getDoubtPriority, getScheduleConflicts,
  getTeacherStudentSummary, markDoubtResolved, replyToStudentDoubt, saveEvaluation,
  saveExercise, saveGoal, saveLesson, savePrivateNote, saveStudent, saveTrainingPlan,
  updateBooking,
} from "../../services/teacherService";

function useTeacherLoad() {
  const [state, setState] = useState({ loading: true, error: false });
  const retry = useCallback(() => {
    setState({ loading: true, error: false });
    getPageContent("painel-professor")
      .then(() => setState({ loading: false, error: false }))
      .catch(() => setState({ loading: false, error: true }));
  }, []);
  useEffect(() => retry(), [retry]);
  return { ...state, retry };
}

function TeacherScreen({ title, description, children, empty, actions, load }) {
  const ownLoad = useTeacherLoad();
  const state = load || ownLoad;
  return <div className="page-content teacher-page">
    <header className="page-heading"><div><span className="eyebrow">MOVIMENTO / PAINEL DO PROFESSOR</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-heading__actions">{actions}</div>}</header>
    {state.loading ? <Carregando /> : state.error ? <MensagemErro mensagem="Não foi possível carregar esta tela. Tente novamente." tentarNovamente={state.retry} /> : empty ? <EstadoVazio mensagem={empty.mensagem} proximoPasso={empty.proximoPasso} acao={empty.acao} /> : children}
  </div>;
}

function useTeacherData() {
  const context = useApp();
  return { ...context, teacher: context.usuario };
}

function replaceById(items, id, transform) {
  return items.map((item) => item.id === id ? transform(item) : item);
}

function dateText(value, options = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(from, to = new Date()) {
  const start = dateFromKey(from);
  const end = dateFromKey(localDateKey(to));
  if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function getLastCompletedSession(data, studentId) {
  return (data.sessoesTreino || [])
    .filter((session) => session.alunoId === studentId && session.status === "concluido")
    .sort((a, b) => (b.concluidaEm || b.iniciadaEm || "").localeCompare(a.concluidaEm || a.iniciadaEm || ""))[0] || null;
}

function getStudentSituation(data, student) {
  if (student.status === "convite_pendente") return { key: "convite", label: "Convite pendente", lastText: "Ainda não entrou" };
  if (student.status !== "ativo") return { key: "inativo", label: student.status === "suspenso" ? "Suspenso" : "Encerrado", lastText: "Acompanhamento encerrado" };
  const hasPendingQuestion = (data.duvidas || []).some((item) => item.alunoId === student.id && item.status === "pendente");
  const expiryDays = student.vencimentoPlano ? -daysBetween(student.vencimentoPlano) : null;
  const planNeedsAttention = expiryDays !== null && expiryDays >= 0 && expiryDays <= teacherAttentionConfig.planoVenceAteDias;
  const latest = getLastCompletedSession(data, student.id);
  if (!latest) return { key: "atencao", label: "Atenção", lastText: "Sem treino registrado", days: null };
  const days = daysBetween(latest.concluidaEm || latest.iniciadaEm);
  if (days === null) return { key: "atencao", label: "Atenção", lastText: "Sem treino registrado", days: null };
  if (days > teacherAttentionConfig.atencaoAteDias) return { key: "sumidos", label: "Sumido", lastText: `há ${days} dias`, days };
  if (days > teacherAttentionConfig.emDiaAteDias || hasPendingQuestion || planNeedsAttention) return { key: "atencao", label: "Atenção", lastText: `há ${days} ${days === 1 ? "dia" : "dias"}`, days };
  return { key: "em-dia", label: "Em dia", lastText: days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`, days };
}

function getAttentionItems(data, limit = teacherAttentionConfig.maximoAlertasInicio) {
  const items = [];
  const add = (student, reason, action, to, priority) => {
    if (student) items.push({ id: `${student.id}-${reason}`, student, reason, action, to: to || `/professor/alunos/${student.id}`, priority });
  };
  (data.alunos || []).filter((student) => student.status === "ativo").forEach((student) => {
    const situation = getStudentSituation(data, student);
    if (situation.key === "sumidos") add(student, `Não treina há ${situation.days} dias`, "Ver aluno", `/professor/alunos/${student.id}`, 5);
    else if (situation.key === "atencao") add(student, situation.days === null ? "Sem treino registrado" : `Não treina há ${situation.days} dias`, "Ver aluno", `/professor/alunos/${student.id}`, 3);

    const pendingDoubt = (data.duvidas || [])
      .filter((item) => item.alunoId === student.id && item.status === "pendente")
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""))[0];
    if (pendingDoubt) {
      const sentOn = pendingDoubt.mensagens?.[0]?.data || pendingDoubt.data;
      const age = daysBetween(sentOn);
      add(student, `Pergunta sem resposta há ${Math.max(0, age ?? 0)} ${age === 1 ? "dia" : "dias"}`, "Responder", `/professor/duvidas/${pendingDoubt.id}`, 6);
    }

    const daysToExpiry = student.vencimentoPlano ? daysBetween(localDateKey(new Date(new Date(`${student.vencimentoPlano}T12:00:00`).getTime())), new Date()) * -1 : null;
    if (daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= teacherAttentionConfig.planoVenceAteDias) {
      add(student, `Plano vence em ${daysToExpiry} ${daysToExpiry === 1 ? "dia" : "dias"}`, "Renovar plano", `/professor/alunos/${student.id}`, 4);
    }

    const pendingPayment = (data.pagamentos || []).some((item) => item.alunoId === student.id && ["pendente", "falho"].includes(item.status))
      || (data.agendamentos || []).some((booking) => booking.alunoId === student.id && booking.status !== "cancelado" && /aguardando pagamento|pendente/i.test(booking.pagamento || ""));
    if (pendingPayment) add(student, "Pagamento pendente (simulado)", "Ver aluno", `/professor/alunos/${student.id}`, 2);

    const overdueEvaluation = (data.avaliacoes || []).find((item) => item.alunoId === student.id && (
      (item.proximaAvaliacao && daysBetween(item.proximaAvaliacao) > 0)
      || (item.status === "pendente" && daysBetween(item.data) >= teacherAttentionConfig.avaliacaoAtrasadaAposDias)
    ));
    if (overdueEvaluation || (student.proximaAvaliacao && daysBetween(student.proximaAvaliacao) > 0)) {
      add(student, "Avaliação física atrasada", "Ver aluno", `/professor/alunos/${student.id}`, 1);
    }
  });
  return items.sort((a, b) => b.priority - a.priority || a.student.nome.localeCompare(b.student.nome)).slice(0, limit);
}

function dateTimeText(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function minutesSince(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3600000);
  const days = Math.floor(hours / 24);
  if (days) return `${days} ${days === 1 ? "dia" : "dias"}`;
  if (hours) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  return "menos de 1 hora";
}

function applyTeacherNotification(updateData, notification) {
  updateData("notificacoes", (items) => items.some((item) => item.id === notification.id) ? items : [...items, notification]);
}

function recordTeacherActivity(updateData, teacher, type, summary, relatedTo, studentId = "") {
  updateData("historicoAtividades", (items) => addAuditEvent(items || [], {
    usuarioId: teacher.id,
    usuarioNome: teacher.nome,
    perfil: "professor",
    tipo,
    resumo: summary,
    relatedTo,
    alunoId: studentId,
  }));
}

function ErrorNotice({ children }) {
  return children ? <div className="inline-notice inline-notice--error" role="alert">{children}</div> : null;
}

export function ProfessorInicioPage() {
  const { dados } = useTeacherData();
  const load = useTeacherLoad();
  const activeStudents = dados.alunos.filter((student) => student.status === "ativo");
  const today = localDateKey();
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const availableBookings = (dados.agendamentos || [])
    .filter((booking) => ["confirmado", "pendente"].includes(booking.status))
    .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
  const todayBookings = availableBookings.filter((booking) => booking.data === today);
  const showingWeek = todayBookings.length === 0;
  const appointments = showingWeek
    ? availableBookings.filter((booking) => booking.data > today && booking.data <= localDateKey(endOfWeek))
    : todayBookings;
  const pendingDoubts = (dados.duvidas || []).filter((item) => item.status === "pendente");
  const allAttentionItems = getAttentionItems(dados, Number.POSITIVE_INFINITY);
  const attentionItems = allAttentionItems.slice(0, teacherAttentionConfig.maximoAlertasInicio);
  const attentionCount = new Set(allAttentionItems.map((item) => item.student.id)).size;
  const recentPlans = [...(dados.treinos || [])]
    .filter((item) => item.status !== "arquivado")
    .sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""))
    .slice(0, 5);

  return <TeacherScreen title="Início" description="O essencial para acompanhar seus alunos e organizar o dia." load={load} actions={<div className="teacher-quick-actions"><Link className="button button--secondary" to="/professor/alunos?novo=1"><UserPlus size={17} /> Novo aluno</Link><Link className="button button--secondary" to="/professor/treinos/novo"><Plus size={17} /> Criar treino</Link><Link className="button button--primary" to="/professor/agenda"><CalendarDays size={17} /> Ver agenda</Link></div>}>
    <div className="teacher-dashboard">
      <div className="teacher-metrics teacher-metrics--home" aria-label="Resumo do acompanhamento">
        <Link to="/professor/alunos?status=ativo" className="teacher-metric"><span><strong>{activeStudents.length}</strong><small>Alunos ativos</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/professor/agenda" className="teacher-metric"><span><strong>{appointments.length}</strong><small>{showingWeek ? "Consultas nos próximos 7 dias" : "Consultas hoje"}</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/professor/duvidas?status=pendente" className="teacher-metric"><span><strong>{pendingDoubts.length}</strong><small>Perguntas para responder</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
        <Link to="/professor/alunos?situacao=atencao" className="teacher-metric"><span><strong>{attentionCount}</strong><small>Alunos para acompanhar</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
      </div>

      <Cartao className="teacher-dashboard-card">
        <div className="section-title-row"><div><span className="eyebrow">AGENDA</span><h2>{showingWeek ? "Próximos atendimentos" : "Hoje"}</h2><p className="teacher-period-copy">{showingWeek ? "Hoje está livre. Mostrando os próximos 7 dias." : new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${today}T12:00:00`))}</p></div><Link className="text-link" to="/professor/agenda">Abrir agenda <ArrowRight size={16} /></Link></div>
        {appointments.length ? appointments.map((booking) => {
          const student = dados.alunos.find((entry) => entry.id === booking.alunoId);
          return <Link className="teacher-list-row" key={booking.id} to={`/professor/agendamentos/${booking.id}`}>
            <span className="teacher-list-time">{booking.horario}</span>
            <span className="teacher-list-copy"><strong>{student?.nome || "Aluno"}</strong><small>{booking.modalidade || booking.tipo} · {booking.motivo || "Atendimento"}{showingWeek ? ` · ${dateText(booking.data, { weekday: "long", day: "numeric", month: "long" })}` : ""}</small></span>
            <EtiquetaStatus status={booking.status} />
          </Link>;
        }) : <EstadoVazio mensagem="Nenhum atendimento hoje." proximoPasso="Veja os horários livres ou organize sua semana." acao={<Link className="button button--secondary" to="/professor/agenda">Abrir agenda</Link>} />}
      </Cartao>

      <Cartao className="teacher-dashboard-card">
        <div className="section-title-row"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Alunos que precisam de atenção</h2><p className="teacher-period-copy">Atividade e registros dos últimos {teacherAttentionConfig.periodoAtividadeDias} dias, além de perguntas e vencimentos próximos.</p></div><Link className="text-link" to="/professor/alunos">Ver alunos <ArrowRight size={16} /></Link></div>
        {attentionItems.length ? <div className="teacher-list">{attentionItems.map((item) => <div className="teacher-list-row teacher-attention-row" key={item.id}><span className="teacher-list-copy"><strong>{item.student.nome}</strong><small>{item.reason}</small></span><Link className="button button--secondary teacher-row-action" to={item.to}>{item.action}</Link></div>)}</div> : <div className="teacher-positive-state"><CheckCircle2 size={20} /><p>Tudo em dia por aqui.</p></div>}
      </Cartao>

      <Cartao className="teacher-dashboard-card">
        <div className="section-title-row"><div><span className="eyebrow">PLANOS DE TREINO</span><h2>Treinos recentes</h2></div><Link className="text-link" to="/professor/treinos">Ver treinos <ArrowRight size={16} /></Link></div>
        {recentPlans.length ? recentPlans.map((plan) => {
          const student = dados.alunos.find((entry) => entry.id === plan.alunoId);
          return <Link className="teacher-list-row" key={`${plan.id}-${plan.alunoId}`} to={`/professor/treinos/${plan.id}/editar`}><span className="teacher-list-icon"><Dumbbell size={17} /></span><span className="teacher-list-copy"><strong>{plan.nome}</strong><small>{student?.nome || "Aluno não vinculado"} · atualizado em {dateText(plan.atualizadoEm)}</small></span><EtiquetaStatus status={plan.status || "rascunho"} /></Link>;
        }) : <EstadoVazio mensagem="Ainda não há treinos cadastrados." proximoPasso="Crie um treino para organizar a próxima etapa." acao={<Link className="button button--primary" to="/professor/treinos/novo">Criar treino</Link>} />}
      </Cartao>
    </div>
  </TeacherScreen>;
}

const statusOptions = [["convite_pendente", "Convite pendente"], ["ativo", "Ativo"], ["suspenso", "Suspenso"], ["encerrado", "Encerrado"]];

export function AlunosPage() {
  const { dados, atualizarDados, teacher } = useTeacherData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(searchParams.get("situacao") || "todos");
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ nome: "", email: "", objetivo: "", status: "convite_pendente" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const load = useTeacherLoad();
  const filtered = dados.alunos
    .filter((student) => {
      const situation = getStudentSituation(dados, student);
      const matchesFilter = filter === "todos" || situation.key === filter || (filter === "convite" && situation.key === "convite");
      const matchesQuery = `${student.nome} ${student.email} ${student.objetivo || ""}`.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    })
    .sort((a, b) => {
      const weight = { sumidos: 5, atencao: 4, "em-dia": 3, convite: 2, inativo: 1 };
      return weight[getStudentSituation(dados, b).key] - weight[getStudentSituation(dados, a).key] || a.nome.localeCompare(b.nome);
    });

  function openStudent(student = null) {
    setEdit(student);
    setForm(student ? { nome: student.nome, email: student.email, objetivo: student.objetivo || "", status: student.status } : { nome: "", email: "", objetivo: "", status: "convite_pendente" });
    setError("");
    setModal(true);
  }
  useEffect(() => {
    const editId = searchParams.get("editar");
    if (editId) {
      const selected = dados.alunos.find((student) => student.id === editId);
      if (selected) openStudent(selected);
      setSearchParams(filter === "todos" ? {} : { situacao: filter }, { replace: true });
    } else if (searchParams.get("novo") === "1") {
      openStudent();
      setSearchParams(filter === "todos" ? {} : { situacao: filter }, { replace: true });
    }
  }, []);
  function save(event) {
    event.preventDefault();
    if (form.nome.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Confira o nome e informe um e-mail válido."); return; }
    const result = saveStudent(dados, form, edit?.id);
    if (result.error) { setError(result.error); return; }
    atualizarDados("alunos", result.alunos);
    if (result.notificacoes !== dados.notificacoes) atualizarDados("notificacoes", result.notificacoes);
    if (edit && edit.status !== form.status) atualizarDados("historicoAlunos", (items) => addStudentHistory(items, edit.id, "status", `Status alterado de ${edit.status} para ${form.status}.`));
    recordTeacherActivity(atualizarDados, teacher, edit ? "Cadastro de aluno atualizado" : "Convite de aluno criado", `${edit ? "Cadastro de" : "Convite para"} ${result.student.nome} ${edit ? "atualizado" : "criado"}; status ${result.student.status}.`, `/professor/alunos/${result.student.id}`);
    setModal(false);
    setToast(edit ? "Dados do aluno atualizados." : "Convite de demonstração criado. Nenhum e-mail foi enviado.");
  }
  return <TeacherScreen title="Alunos" description="Veja quem está em dia e quem precisa de um contato." load={load} empty={!dados.alunos.length ? { mensagem: "Sua lista ainda está vazia.", proximoPasso: "Adicione um aluno para começar a organizar o acompanhamento.", acao: <Button onClick={() => openStudent()}><UserPlus size={17} /> Novo aluno</Button> } : null} actions={<Button onClick={() => openStudent()}><UserPlus size={17} /> Novo aluno</Button>}>
    <div className="filter-bar student-filter-bar"><label className="search-control"><Search size={18} /><input aria-label="Buscar alunos" placeholder="Buscar aluno por nome, e-mail ou objetivo" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={17} /><span className="sr-only">Filtrar alunos por situação</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setSearchParams(event.target.value === "todos" ? {} : { situacao: event.target.value }); }}><option value="todos">Todos</option><option value="em-dia">Em dia</option><option value="atencao">Atenção</option><option value="sumidos">Sumidos</option><option value="convite">Convite pendente</option></select></label></div>
    {filtered.length ? <div className="student-list">{filtered.map((student) => {
      const activePlan = dados.treinos.find((item) => item.alunoId === student.id && ["publicado", "disponivel", "ativo"].includes(item.status));
      const latestSession = getLastCompletedSession(dados, student.id);
      const situation = getStudentSituation(dados, student);
      return <article className="student-list-card" key={student.id}>
        <div className="student-list-card__identity"><span className="avatar">{student.nome.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><Link className="student-list-card__name" to={`/professor/alunos/${student.id}`}>{student.nome}</Link><span className={`student-situation student-situation--${situation.key}`}>{situation.label}</span></div></div>
        <div className="student-list-card__detail"><small>Plano</small><strong>{activePlan?.nome || <span className="muted-copy">Sem plano ativo</span>}</strong></div>
        <div className="student-list-card__detail"><small>Último treino</small><strong>{latestSession ? situation.lastText : "Sem registro"}</strong></div>
        <div className="student-list-card__detail"><small>Vencimento do plano</small><strong>{student.vencimentoPlano ? dateText(student.vencimentoPlano, { day: "numeric", month: "long" }) : "Não informado"}</strong></div>
        <div className="student-list-card__actions"><Link className="button button--secondary" to={`/professor/alunos/${student.id}`}>Ver aluno</Link><button className="button button--ghost" onClick={() => openStudent(student)}>Editar</button></div>
      </article>;
    })}</div> : <EstadoVazio mensagem="Nenhum aluno encontrado." proximoPasso="Tente outra busca ou escolha outra situação." />}
    <ModalConfirmacao aberto={modal} titulo={edit ? "Editar aluno" : "Adicionar aluno"} mensagem={edit ? "Atualize os dados e o status do vínculo." : "Crie um convite simulado. Nenhum e-mail será enviado."} confirmarTexto={edit ? "Salvar alterações" : "Criar convite"} aoFechar={() => setModal(false)} aoConfirmar={() => {}} ocultarAcoes><form className="teacher-modal-form" onSubmit={save} noValidate><CampoFormulario label="Nome completo" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /><CampoFormulario label="E-mail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><CampoFormulario label="Objetivo" value={form.objetivo} onChange={(event) => setForm({ ...form, objetivo: event.target.value })} /><div className="form-field"><label htmlFor="student-status">Status do vínculo</label><select id="student-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><ErrorNotice>{error}</ErrorNotice><div className="form-actions"><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button type="submit">{edit ? "Salvar alterações" : "Criar convite"}</Button></div></form></ModalConfirmacao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

export function AlunoProfessorDetalhePage() {
  const { alunoId } = useParams();
  const { dados, atualizarDados, teacher } = useTeacherData();
  const student = dados.alunos.find((item) => item.id === alunoId);
  const summary = student ? getTeacherStudentSummary(dados, student) : null;
  const currentServicePlan = student?.planoVigenteId ? (dados.planosServicos || []).find((item) => item.id === student.planoVigenteId) : null;
  const [note, setNote] = useState("");
  const [goal, setGoal] = useState("");
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [evaluation, setEvaluation] = useState({ data: new Date().toISOString().slice(0, 10), medida: "", observacao: "" });
  const [toast, setToast] = useState("");
  const load = useTeacherLoad();
  if (!student) return <TeacherScreen title="Perfil do aluno" load={load} empty={{ mensagem: "Não encontramos este aluno.", proximoPasso: "Volte à lista para abrir um cadastro disponível.", acao: <Link className="button button--secondary" to="/professor/alunos">Ver alunos</Link> }} />;
  function saveNote(event) {
    event.preventDefault();
    if (note.trim().length < 3) return;
    const entry = savePrivateNote(student.id, teacher.nome, note);
    atualizarDados("notasPrivadas", (items) => [...items, entry]);
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "nota privada", "Nota privada adicionada pelo professor.", true));
    recordTeacherActivity(atualizarDados, teacher, "Nota privada registrada", `Nota privada adicionada ao acompanhamento de ${student.nome}.`, `/professor/alunos/${student.id}`);
    setNote("");
    setToast("Nota privada salva no perfil do aluno.");
  }
  function saveGoalEvent(event) {
    event.preventDefault();
    if (goal.trim().length < 3) return;
    atualizarDados("metas", (items) => [...items, saveGoal(student.id, goal)]);
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "meta", `Meta registrada: ${goal.trim()}.`));
    recordTeacherActivity(atualizarDados, teacher, "Meta criada", `Meta criada para ${student.nome}.`, "/aluno/metas", student.id);
    setGoal("");
    setToast("Meta adicionada ao acompanhamento.");
  }
  function saveEvaluationEvent(event) {
    event.preventDefault();
    if (evaluation.medida.trim().length < 2) return;
    atualizarDados("avaliacoes", (items) => [...items, saveEvaluation(student.id, evaluation)]);
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "avaliação", `Avaliação registrada: ${evaluation.medida.trim()}.`));
    setEvaluationOpen(false);
    setToast("Avaliação registrada.");
  }
  return <TeacherScreen title={student.nome} description={`${student.email} · Perfil individual do aluno`} load={load} actions={<><Link className="button button--secondary" to="/professor/alunos"><ArrowLeft size={15} /> Alunos</Link><Link className="button button--primary" to={`/professor/treinos/novo?aluno=${student.id}`}>Criar treino</Link></>}>
    <div className="student-profile">
      <Cartao className="student-profile__hero"><span className="avatar avatar--large">{student.nome.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><span className="eyebrow">CADASTRO E STATUS</span><h2>{student.nome}</h2><p>{student.objetivo || "Objetivo ainda não cadastrado."}</p><EtiquetaStatus status={student.status} /></div><Link className="text-link" to={`/professor/alunos?editar=${student.id}`}>Editar cadastro <Edit3 size={14} /></Link></Cartao>
      <div className="teacher-metrics teacher-metrics--compact"><div className="teacher-metric"><span className="teacher-metric__icon"><Dumbbell size={17} /></span><span><small>TREINOS</small><strong>{summary.plans.length}</strong><em>{summary.plans.filter((item) => item.status === "publicado").length} publicados</em></span></div><div className="teacher-metric"><span className="teacher-metric__icon teacher-metric__icon--blue"><CheckCircle2 size={17} /></span><span><small>SESSÕES CONCLUÍDAS</small><strong>{summary.completed}</strong><em>Frequência: {summary.frequency}%</em></span></div><div className="teacher-metric"><span className="teacher-metric__icon teacher-metric__icon--gold"><CalendarDays size={17} /></span><span><small>CONSULTAS</small><strong>{summary.bookings.length}</strong><em>{summary.doubts.length} dúvidas registradas</em></span></div></div>
      <div className="student-profile-grid"><div className="student-profile-main">
        <Cartao><div className="section-title-row"><div><span className="eyebrow">PLANO E HISTÓRICO DE TREINOS</span><h2>Treinos</h2></div><Link className="text-link" to={`/professor/treinos/novo?aluno=${student.id}`}>Criar plano <Plus size={14} /></Link></div>{summary.plans.length ? summary.plans.map((plan) => <Link className="teacher-list-row" key={plan.id} to={`/professor/treinos/${plan.id}/editar`}><span className="teacher-list-icon"><Dumbbell size={15} /></span><span><strong>{plan.nome}</strong><small>{plan.status} · {plan.frequencia || "Frequência a combinar"}</small></span><EtiquetaStatus status={plan.status} /></Link>) : <p className="muted-copy">Nenhum treino cadastrado.</p>}{summary.sessions.length > 0 && <div className="mini-history"><strong>Execuções recentes</strong>{summary.sessions.slice(0, 4).map((session) => <p key={session.id}>{dateText(session.concluidaEm || session.iniciadaEm)} · {session.status} · {session.planoSnapshot?.nome || "Treino"}</p>)}</div>}</Cartao>
        <Cartao><div className="section-title-row"><div><span className="eyebrow">AVALIAÇÕES E METAS</span><h2>Evolução</h2></div><Button variant="secondary" onClick={() => setEvaluationOpen(true)}>Registrar avaliação</Button></div><div className="goal-form"><form onSubmit={saveGoalEvent}><label className="sr-only" htmlFor="student-goal">Nova meta</label><input id="student-goal" placeholder="Registrar uma meta de acompanhamento" value={goal} onChange={(event) => setGoal(event.target.value)} /><Button type="submit"><Plus size={14} /> Adicionar meta</Button></form></div>{summary.evaluations.length ? summary.evaluations.map((item) => <div className="student-record" key={item.id}><span><FileText size={15} /></span><p><strong>{item.medida || Object.keys(item.indicadores || {}).join(", ")}</strong><small>{dateText(item.data)} · {item.observacao || "Sem observação"} · {item.compartilhada ? "Compartilhada" : "Privada"}</small></p></div>) : <p className="muted-copy">Ainda não há avaliações registradas.</p>}{summary.goals.map((item) => <form className="goal-row tracking-teacher-goal" key={item.id} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); atualizarDados("metas", (items) => items.map((current) => current.id === item.id ? updateStudentGoal(current, { progresso: Number(form.get("progresso")), status: form.get("status"), comentariosProfessor: String(form.get("comentario") || "").trim() }, teacher.nome) : current)); atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "meta atualizada", `Meta “${item.nome || item.descricao}” atualizada pelo professor.`)); setToast("Meta e comentário atualizados."); }}><Flag size={15} /><span><strong>{item.nome || item.descricao}</strong><small>{item.descricao}</small><span className="teacher-goal-controls"><label>Progresso<input name="progresso" type="number" min="0" max="100" defaultValue={item.progresso || 0} aria-label={`Progresso da meta ${item.nome || item.descricao}`} /></label><label>Status<select name="status" defaultValue={item.status}><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option></select></label><label>Comentário<input name="comentario" defaultValue={item.comentariosProfessor || ""} aria-label={`Comentário da meta ${item.nome || item.descricao}`} /></label><Button type="submit">Salvar</Button></span></span><EtiquetaStatus status={item.status} /></form>)}</Cartao>
        <Cartao><span className="eyebrow">DÚVIDAS E CONSULTAS</span><h2>Atividade recente</h2>{summary.doubts.slice(0, 4).map((item) => <Link className="teacher-list-row" key={item.id} to={`/professor/duvidas/${item.id}`}><span className="teacher-list-icon teacher-list-icon--gold"><MessageCircle size={15} /></span><span><strong>{item.assunto}</strong><small>{item.categoria} · {dateText(item.data)}</small></span><EtiquetaStatus status={item.status} /></Link>)}{summary.bookings.slice(0, 4).map((item) => <Link className="teacher-list-row" key={item.id} to={`/professor/agendamentos/${item.id}`}><span className="teacher-list-icon"><CalendarDays size={15} /></span><span><strong>{item.motivo || item.modalidade}</strong><small>{dateText(item.data)} · {item.horario}</small></span><EtiquetaStatus status={item.status} /></Link>)}{!summary.doubts.length && !summary.bookings.length && <p className="muted-copy">Ainda não há dúvidas ou consultas registradas.</p>}</Cartao>
        <Cartao><span className="eyebrow">FORMULÁRIOS E QUESTIONÁRIOS</span><h2>Respostas do aluno</h2>{(dados.respostasQuestionarios || []).filter((response) => response.alunoId === student.id).length ? (dados.respostasQuestionarios || []).filter((response) => response.alunoId === student.id).map((response) => { const questionnaire = (dados.questionarios || []).find((item) => item.id === response.questionarioId); return <details className="tracking-record" key={response.id}><summary><strong>{questionnaire?.titulo || "Questionário"}</strong><span>{dateTimeText(response.enviadoEm)}</span></summary>{Object.entries(response.respostas).map(([key, value]) => <p key={key}><strong>{questionnaire?.campos.find((field) => field.id === key)?.rotulo || key}:</strong> {value}</p>)}</details>; }) : <p className="muted-copy">Este aluno ainda não enviou respostas de questionários.</p>}</Cartao>
        <Cartao><span className="eyebrow">HISTÓRICO DE ALTERAÇÕES</span><h2>Registros do acompanhamento</h2>{summary.history.length ? summary.history.map((item) => <p className="student-history-row" key={item.id}><strong>{item.tipo}</strong><span>{item.descricao}</span><small>{dateTimeText(item.data)}</small></p>) : <p className="muted-copy">Alterações importantes no cadastro serão registradas aqui.</p>}</Cartao>
      </div><div className="student-profile-side">
        <Cartao><span className="eyebrow">PLANO DE SERVIÇO VIGENTE</span><h2>{currentServicePlan?.nome || "Sem plano vinculado"}</h2>{currentServicePlan ? <><p>{currentServicePlan.servicos.join(" · ")} · {currentServicePlan.modalidades.join(" / ")}</p><p>R$ {currentServicePlan.preco.toFixed(2).replace(".", ",")} · {currentServicePlan.vigencia}</p><small>{currentServicePlan.regras}</small></> : <p className="muted-copy">Nenhum plano de serviço foi vinculado a este aluno.</p>}</Cartao>
        <Cartao className="private-notes"><span className="eyebrow">PRIVADO · SÓ VOCÊ VÊ</span><h2>Notas do professor</h2><p>Estas anotações não aparecem para o aluno.</p><form onSubmit={saveNote}><label className="sr-only" htmlFor="private-note">Nota privada</label><textarea id="private-note" rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anote observações internas..." /><Button type="submit">Salvar nota</Button></form>{summary.privateNotes.map((item) => <div className="private-note-row" key={item.id}><p>{item.texto}</p><small>{dateTimeText(item.data)}</small></div>)}</Cartao>
        <Cartao><span className="eyebrow">ACOMPANHAMENTO</span><h2>Frequência</h2><div className="progress-number">{summary.frequency}<span>% de sessões concluídas</span></div><div className="progress-track" role="progressbar" aria-label="Frequência do aluno" aria-valuenow={summary.frequency} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${summary.frequency}%` }} /></div><p className="muted-copy">{summary.completed} sessões concluídas em {summary.sessions.length} iniciadas.</p></Cartao>
      </div></div>
    </div>
    <ModalConfirmacao aberto={evaluationOpen} titulo="Registrar avaliação" mensagem="O registro ficará disponível no perfil de acompanhamento deste aluno." confirmarTexto="Salvar avaliação" aoFechar={() => setEvaluationOpen(false)} aoConfirmar={() => {}} ocultarAcoes><form className="teacher-modal-form" onSubmit={saveEvaluationEvent}><CampoFormulario label="Data" type="date" value={evaluation.data} onChange={(event) => setEvaluation({ ...evaluation, data: event.target.value })} /><CampoFormulario label="Medida ou avaliação" value={evaluation.medida} onChange={(event) => setEvaluation({ ...evaluation, medida: event.target.value })} /><div className="form-field"><label htmlFor="evaluation-note">Observações</label><textarea id="evaluation-note" rows="3" value={evaluation.observacao} onChange={(event) => setEvaluation({ ...evaluation, observacao: event.target.value })} /></div><div className="form-actions"><Button variant="secondary" onClick={() => setEvaluationOpen(false)}>Cancelar</Button><Button type="submit">Salvar avaliação</Button></div></form></ModalConfirmacao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

const weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const newExerciseRow = () => ({ exercicioId: "", series: 3, repeticoes: "10–12", descanso: "60 s", carga: "", instrucoes: "" });

function defaultTrainingForm(data, queryStudent, plan) {
  return {
    nome: plan?.nome || "",
    objetivo: plan?.objetivo || "",
    frequenciaSemanal: String(plan?.frequenciaSemanal || 3),
    dias: plan?.dia && plan.dia !== "Dias a combinar" ? plan.dia.split(" · ") : [],
    duracao: String(plan?.duracao || 45),
    alunoIds: plan ? [plan.alunoId] : queryStudent ? [queryStudent] : [],
    dataInicio: plan?.dataInicio || new Date().toISOString().slice(0, 10),
    dataFim: plan?.dataFim || "",
    exercicios: plan?.parametrosExercicios || plan?.exercicios?.map((exercicioId) => ({ ...newExerciseRow(), exercicioId })) || [],
  };
}

export function TreinosProfessorPage() {
  const { dados, atualizarDados } = useTeacherData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [toast, setToast] = useState("");
  const load = useTeacherLoad();
  const plans = dados.treinos.filter((plan) => (filter === "todos" || plan.status === filter) && `${plan.nome} ${dados.alunos.find((student) => student.id === plan.alunoId)?.nome || ""}`.toLowerCase().includes(query.toLowerCase()));
  function archive(plan) {
    atualizarDados("treinos", archiveTraining(dados, plan.id));
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, plan.alunoId, "treino arquivado", `Treino “${plan.nome}” arquivado pelo professor.`));
    setConfirmPlan(null);
    setToast("Treino arquivado. As sessões anteriores permanecem no histórico.");
  }
  return <TeacherScreen title="Treinos" description="Crie planos, publique para seus alunos e consulte rascunhos e histórico." load={load} empty={!dados.treinos.length ? { mensagem: "Você ainda não criou planos de treino.", proximoPasso: "Monte o primeiro plano e escolha os alunos que poderão acessá-lo.", acao: <Link className="button button--primary" to="/professor/treinos/novo">Criar treino</Link> } : null} actions={<Link className="button button--primary" to="/professor/treinos/novo"><Plus size={15} /> Criar treino</Link>}>
    <div className="filter-bar"><label className="search-control"><Search size={16} /><input aria-label="Buscar treinos" placeholder="Buscar treino ou aluno" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={15} /><span className="sr-only">Filtrar planos</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="todos">Todos os estados</option><option value="rascunho">Rascunhos</option><option value="publicado">Publicados</option><option value="arquivado">Arquivados</option></select></label></div>
    {plans.length ? <div className="teacher-plan-list">{plans.map((plan) => <Cartao className="teacher-plan-card" key={`${plan.id}-${plan.alunoId}`}><div className="teacher-list-icon"><Dumbbell size={17} /></div><div className="teacher-plan-card__body"><div className="teacher-plan-title"><h2>{plan.nome}</h2><EtiquetaStatus status={plan.status || "rascunho"} /></div><p>{dados.alunos.find((item) => item.id === plan.alunoId)?.nome || "Aluno removido"} · {plan.objetivo}</p><div className="meta-line"><span>{plan.frequencia || plan.frequenciaSemanal} </span><span>{plan.exercicios.length} exercícios</span><span>{plan.duracao || 45} min</span><span>Atualizado {dateText(plan.atualizadoEm)}</span></div></div><Link className="button button--secondary" to={`/professor/treinos/${plan.id}/editar`}>{plan.status === "publicado" ? "Editar plano" : "Continuar edição"} <Edit3 size={14} /></Link>{plan.status !== "arquivado" && <Button variant="ghost" onClick={() => setConfirmPlan(plan)}>Arquivar</Button>}</Cartao>)}</div> : <EstadoVazio mensagem="Nenhum plano encontrado." proximoPasso="Tente outro termo ou estado, ou crie um novo plano." />}
    <ModalConfirmacao aberto={Boolean(confirmPlan)} titulo="Arquivar este treino?" mensagem="O aluno não poderá iniciar novas sessões deste plano. Histórico e registros já feitos serão preservados." confirmarTexto="Arquivar treino" aoFechar={() => setConfirmPlan(null)} aoConfirmar={() => archive(confirmPlan)} />
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

export function EditorTreinoPage() {
  const { treinoId } = useParams();
  const [searchParams] = useSearchParams();
  const queryStudent = searchParams.get("aluno");
  const { dados, atualizarDados, teacher } = useTeacherData();
  const navigate = useNavigate();
  const plan = dados.treinos.find((item) => item.id === treinoId);
  const [editingId, setEditingId] = useState(treinoId || "");
  const [form, setForm] = useState(() => defaultTrainingForm(dados, queryStudent, plan));
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const load = useTeacherLoad();
  useEffect(() => { setForm(defaultTrainingForm(dados, queryStudent, plan)); setEditingId(treinoId || ""); }, [treinoId]);
  const eligibleStudents = dados.alunos.filter((student) => ["ativo", "convite_pendente"].includes(student.status));
  const activeExercises = dados.exercicios.filter((exercise) => !exercise.arquivado);

  function validate() {
    const next = {};
    if (form.nome.trim().length < 3) next.nome = "Informe o nome do plano.";
    if (form.objetivo.trim().length < 5) next.objetivo = "Descreva o objetivo do plano.";
    if (!form.alunoIds.length) next.alunoIds = "Selecione ao menos um aluno.";
    if (!form.exercicios.length || form.exercicios.some((item) => !item.exercicioId)) next.exercicios = "Adicione pelo menos um exercício válido.";
    if (form.exercicios.some((item) => Number(item.series) < 1 || Number(item.series) > 20 || !item.repeticoes.trim() || Number(item.descanso.replace(/\D/g, "")) < 0)) next.exercicios = "Confira séries, repetições e descanso dos exercícios.";
    if (Number(form.frequenciaSemanal) < 1 || Number(form.frequenciaSemanal) > 7) next.frequenciaSemanal = "A frequência deve ser de 1 a 7 dias por semana.";
    if (Number(form.duracao) < 10 || Number(form.duracao) > 240) next.duracao = "A duração deve ficar entre 10 e 240 minutos.";
    if (form.dataFim && form.dataFim < form.dataInicio) next.dataFim = "A data final não pode ser anterior ao início.";
    setErrors(next);
    return !Object.keys(next).length;
  }
  function save(action) {
    if (!validate()) return;
    setSaving(true);
    try {
      const result = saveTrainingPlan(dados, form, editingId, action);
      setEditingId(result.planId);
      atualizarDados("treinos", result.treinos);
      atualizarDados("versoesTreino", result.versoesTreino);
      atualizarDados("notificacoes", result.notificacoes);
      form.alunoIds.forEach((studentId) => atualizarDados("historicoAlunos", (items) => addStudentHistory(items, studentId, action === "publicado" ? "treino publicado" : "treino atualizado", `Treino “${form.nome.trim()}” ${action === "publicado" ? "publicado" : "salvo como rascunho"}.`)));
      if (action === "publicado") form.alunoIds.forEach((studentId) => recordTeacherActivity(atualizarDados, teacher, "Treino publicado", `Treino “${form.nome.trim()}” publicado.`, "/aluno/treinos", studentId));
      else recordTeacherActivity(atualizarDados, teacher, "Rascunho de treino salvo", `Rascunho “${form.nome.trim()}” salvo.`, "/professor/treinos");
      setSaving(false);
      if (action === "publicado") {
        setToast("Treino publicado e alunos notificados.");
        window.setTimeout(() => navigate("/professor/treinos"), 650);
      } else {
        setToast("Rascunho salvo.");
        if (result.planId !== treinoId) navigate(`/professor/treinos/${result.planId}/editar`, { replace: true });
      }
    } catch {
      setErrors((current) => ({ ...current, save: "Não foi possível salvar este plano. Suas alterações foram mantidas." }));
      setSaving(false);
    }
  }
  function updateExercise(index, key, value) {
    setForm((current) => ({ ...current, exercicios: current.exercicios.map((item, row) => row === index ? { ...item, [key]: value } : item) }));
  }
  return <TeacherScreen title={plan ? "Editar treino" : "Criar treino"} description="Monte um plano de treino e escolha entre salvar ou publicar." load={load} actions={<Link className="button button--secondary" to="/professor/treinos"><ArrowLeft size={14} /> Treinos</Link>}>
    <form className="teacher-editor" onSubmit={(event) => event.preventDefault()} noValidate>
      <Cartao className="editor-section"><span className="eyebrow">01 · INFORMAÇÕES DO PLANO</span><div className="editor-grid"><CampoFormulario label="Nome do treino" placeholder="Ex.: Força e mobilidade" value={form.nome} erro={errors.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /><CampoFormulario label="Objetivo" placeholder="O que o aluno vai desenvolver?" value={form.objetivo} erro={errors.objetivo} onChange={(event) => setForm({ ...form, objetivo: event.target.value })} /><div className="form-field"><label htmlFor="plan-frequency">Frequência semanal</label><select id="plan-frequency" value={form.frequenciaSemanal} onChange={(event) => setForm({ ...form, frequenciaSemanal: event.target.value })}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? "vez por semana" : "vezes por semana"}</option>)}</select>{errors.frequenciaSemanal && <span className="form-field__error">{errors.frequenciaSemanal}</span>}</div><CampoFormulario label="Duração estimada (minutos)" type="number" min="10" max="240" value={form.duracao} erro={errors.duracao} onChange={(event) => setForm({ ...form, duracao: event.target.value })} /><CampoFormulario label="Início" type="date" value={form.dataInicio} onChange={(event) => setForm({ ...form, dataInicio: event.target.value })} /><CampoFormulario label="Término (opcional)" type="date" value={form.dataFim} erro={errors.dataFim} onChange={(event) => setForm({ ...form, dataFim: event.target.value })} /></div><fieldset className="days-fieldset"><legend>Dias da semana sugeridos</legend>{weekdays.map((day) => <label className="check-pill" key={day}><input type="checkbox" checked={form.dias.includes(day)} onChange={(event) => setForm({ ...form, dias: event.target.checked ? [...form.dias, day] : form.dias.filter((item) => item !== day) })} /><span>{day}</span></label>)}</fieldset></Cartao>
      <Cartao className="editor-section"><div className="section-title-row"><div><span className="eyebrow">02 · EXERCÍCIOS</span><h2>Monte a sequência do treino</h2></div><Button variant="secondary" onClick={() => setForm({ ...form, exercicios: [...form.exercicios, newExerciseRow()] })}><Plus size={14} /> Adicionar exercício</Button></div><p className="muted-copy">Defina os parâmetros planejados. Eles não são substituídos pelos registros realizados pelo aluno.</p>{form.exercicios.map((item, index) => { const selected = activeExercises.find((exercise) => exercise.id === item.exercicioId); return <div className="exercise-editor-row" key={`${index}-${item.exercicioId}`}><div className="exercise-editor-row__top"><strong>{String(index + 1).padStart(2, "0")} · Exercício</strong><button type="button" className="text-button" onClick={() => setForm({ ...form, exercicios: form.exercicios.filter((_, row) => row !== index) })}>Remover</button></div><div className="form-field"><label htmlFor={`plan-exercise-${index}`}>Biblioteca de exercícios</label><select id={`plan-exercise-${index}`} value={item.exercicioId} onChange={(event) => updateExercise(index, "exercicioId", event.target.value)}><option value="">Escolha um exercício</option>{activeExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.nome} · {exercise.grupo}</option>)}</select></div>{selected && <p className="muted-copy">{selected.instrucoes}</p>}<div className="editor-grid editor-grid--compact"><CampoFormulario label="Séries" type="number" min="1" max="20" value={item.series} onChange={(event) => updateExercise(index, "series", event.target.value)} /><CampoFormulario label="Repetições / tempo" value={item.repeticoes} onChange={(event) => updateExercise(index, "repeticoes", event.target.value)} /><CampoFormulario label="Descanso" value={item.descanso} onChange={(event) => updateExercise(index, "descanso", event.target.value)} /><CampoFormulario label="Carga sugerida" value={item.carga} onChange={(event) => updateExercise(index, "carga", event.target.value)} /><CampoFormulario label="Instruções específicas" value={item.instrucoes} onChange={(event) => updateExercise(index, "instrucoes", event.target.value)} /><CampoFormulario label="Link demonstrativo" type="url" value={item.videoUrl || ""} onChange={(event) => updateExercise(index, "videoUrl", event.target.value)} /></div></div>; })}{errors.exercicios && <span className="form-field__error">{errors.exercicios}</span>}</Cartao>
      <Cartao className="editor-section"><span className="eyebrow">03 · ATRIBUIR E PUBLICAR</span><h2>Quem poderá acessar?</h2><div className="student-selector">{eligibleStudents.map((student) => <label className="student-select-row" key={student.id}><input type="checkbox" checked={form.alunoIds.includes(student.id)} onChange={(event) => setForm({ ...form, alunoIds: event.target.checked ? [...form.alunoIds, student.id] : form.alunoIds.filter((id) => id !== student.id) })} /><span><strong>{student.nome}</strong><small>{student.email}</small></span><EtiquetaStatus status={student.status} /></label>)}</div>{errors.alunoIds && <span className="form-field__error">{errors.alunoIds}</span>}{errors.save && <MensagemErro mensagem={errors.save} />}<div className="form-actions editor-actions"><Button variant="secondary" type="button" onClick={() => setPreview((value) => !value)}>{preview ? "Fechar prévia" : "Pré-visualizar"}</Button><span className="form-spacer" /><Button variant="secondary" type="button" disabled={saving} onClick={() => save("rascunho")}>Salvar rascunho</Button><Button type="button" disabled={saving} onClick={() => save("publicado")}>{saving ? "Salvando..." : "Publicar treino"}</Button></div>{preview && <div className="plan-preview"><span className="eyebrow">PRÉVIA DO ALUNO</span><h2>{form.nome || "Nome do treino"}</h2><p>{form.objetivo || "Objetivo do plano"} · {form.duracao} min · {form.frequenciaSemanal} vezes/semana</p><ol>{form.exercicios.map((item, index) => <li key={index}>{activeExercises.find((exercise) => exercise.id === item.exercicioId)?.nome || "Exercício a escolher"} · {item.series} × {item.repeticoes}</li>)}</ol></div>}</Cartao>
    </form><Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

export function BibliotecaExerciciosPage() {
  const { dados, atualizarDados } = useTeacherData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ativos");
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmExercise, setConfirmExercise] = useState(null);
  const [toast, setToast] = useState("");
  const load = useTeacherLoad();
  const filtered = dados.exercicios.filter((item) => (filter === "todos" || (filter === "arquivados" ? item.arquivado : !item.arquivado)) && `${item.nome} ${item.grupo} ${item.categoria} ${item.equipamento}`.toLowerCase().includes(query.toLowerCase()));
  const defaults = { nome: "", categoria: "", grupo: "", equipamento: "", instrucoes: "", videoUrl: "" };
  function save(event) {
    event.preventDefault();
    const next = {};
    if (form.nome.trim().length < 3) next.nome = "Informe o nome do exercício.";
    if (!form.grupo.trim()) next.grupo = "Informe o grupo muscular.";
    if (!form.categoria.trim()) next.categoria = "Informe a categoria.";
    if (form.videoUrl && !/^https?:\/\/.+/i.test(form.videoUrl)) next.videoUrl = "Informe um link válido, começando com http:// ou https://.";
    setErrors(next);
    if (Object.keys(next).length) return;
    atualizarDados("exercicios", saveExercise(dados, form, form.id));
    setForm(null);
    setToast("Exercício salvo na biblioteca.");
  }
  return <TeacherScreen title="Biblioteca de exercícios" description="Organize movimentos reutilizáveis para montar planos." load={load} empty={!dados.exercicios.length ? { mensagem: "A biblioteca ainda não tem exercícios.", proximoPasso: "Cadastre um movimento para começar a montar os treinos." } : null} actions={<Button onClick={() => { setForm({ ...defaults }); setErrors({}); }}><Plus size={15} /> Novo exercício</Button>}>
    <div className="filter-bar"><label className="search-control"><Search size={16} /><input aria-label="Buscar exercícios" placeholder="Buscar nome, grupo, equipamento" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={15} /><span className="sr-only">Filtro de exercícios</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ativos">Ativos</option><option value="arquivados">Arquivados</option><option value="todos">Todos</option></select></label></div>
    {filtered.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Exercício</th><th>Categoria</th><th>Grupo muscular</th><th>Equipamento</th><th>Ações</th></tr></thead><tbody>{filtered.map((item) => { const used = dados.treinos.some((plan) => plan.exercicios.includes(item.id)) || dados.sessoesTreino.some((session) => session.planoSnapshot?.exercicios?.includes(item.id)); return <tr key={item.id}><td><strong>{item.nome}</strong><small className="table-subtext">{item.instrucoes}</small></td><td>{item.categoria || "—"}</td><td>{item.grupo}</td><td>{item.equipamento}</td><td><div className="table-actions"><button className="text-button" onClick={() => { setForm({ ...defaults, ...item }); setErrors({}); }}>Editar</button>{!item.arquivado && <button className="text-button text-button--danger" onClick={() => setConfirmExercise({ ...item, used })}>Arquivar</button>}</div></td></tr>; })}</tbody></table></div> : <EstadoVazio mensagem="Nenhum exercício encontrado." proximoPasso="Ajuste a busca ou o filtro de arquivamento." />}
    <ModalConfirmacao aberto={Boolean(form)} titulo={form?.id ? "Editar exercício" : "Novo exercício"} mensagem="Os exercícios arquivados não podem ser selecionados em novos planos. Registros históricos permanecem preservados." confirmarTexto="Salvar exercício" aoFechar={() => setForm(null)} aoConfirmar={() => {}} ocultarAcoes><form className="teacher-modal-form" onSubmit={save}><CampoFormulario label="Nome" value={form?.nome || ""} erro={errors.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /><CampoFormulario label="Categoria" value={form?.categoria || ""} erro={errors.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} /><CampoFormulario label="Grupo muscular" value={form?.grupo || ""} erro={errors.grupo} onChange={(event) => setForm({ ...form, grupo: event.target.value })} /><CampoFormulario label="Equipamento" value={form?.equipamento || ""} onChange={(event) => setForm({ ...form, equipamento: event.target.value })} /><div className="form-field"><label htmlFor="exercise-instructions">Instruções</label><textarea id="exercise-instructions" rows="3" value={form?.instrucoes || ""} onChange={(event) => setForm({ ...form, instrucoes: event.target.value })} /></div><CampoFormulario label="Link demonstrativo (opcional)" type="url" value={form?.videoUrl || ""} erro={errors.videoUrl} onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} /><ErrorNotice>{errors.save}</ErrorNotice><div className="form-actions"><Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit">Salvar exercício</Button></div></form></ModalConfirmacao>
    <ModalConfirmacao aberto={Boolean(confirmExercise)} titulo="Arquivar exercício?" mensagem={confirmExercise?.used ? "Este exercício está associado a planos. Ele deixa de aparecer em novos planos, mas permanece nos treinos e sessões já existentes." : "O exercício ficará arquivado e poderá ser consultado pelo filtro de arquivados."} confirmarTexto="Arquivar exercício" aoFechar={() => setConfirmExercise(null)} aoConfirmar={() => { atualizarDados("exercicios", archiveExercise(dados, confirmExercise.id)); setConfirmExercise(null); setToast("Exercício arquivado sem apagar seu histórico."); }} />
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

function defaultLessonForm(data, lesson) {
  return {
    titulo: lesson?.titulo || "",
    descricao: lesson?.descricao || "",
    categoria: lesson?.categoria || "",
    objetivo: lesson?.objetivo || "",
    duracao: String(lesson?.duracao || 10),
    materiais: lesson?.materiais?.join(", ") || "",
    alunoIds: lesson?.alunoIds || [],
    videoUrl: lesson?.videoUrl || "",
    miniaturaUrl: lesson?.miniaturaUrl || "",
    status: lesson?.status || "rascunho",
    publicarEm: lesson?.publicarEm || "",
  };
}

export function AulasProfessorPage() {
  const { dados, atualizarDados } = useTeacherData();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [preview, setPreview] = useState(null);
  const load = useTeacherLoad();
  const lessons = dados.aulasGravadas.filter((lesson) => (filter === "todos" || lesson.status === filter) && `${lesson.titulo} ${lesson.categoria}`.toLowerCase().includes(query.toLowerCase()));
  function validate(publishNow) {
    const next = {};
    if (form.titulo.trim().length < 3) next.titulo = "Informe um título.";
    if (form.descricao.trim().length < 10) next.descricao = "Escreva uma descrição com pelo menos 10 caracteres.";
    if (!form.categoria.trim()) next.categoria = "Informe a categoria.";
    if (!/^https?:\/\/.+/i.test(form.videoUrl)) next.videoUrl = "Informe um link http:// ou https:// válido.";
    if (!form.alunoIds.length) next.alunoIds = "Selecione o público autorizado.";
    if (!publishNow && form.status === "publicado" && !form.publicarEm) next.publicarEm = "Defina quando a aula será publicada.";
    setErrors(next);
    return !Object.keys(next).length;
  }
  function save(event, publishNow = false) {
    event?.preventDefault();
    if (!validate(publishNow)) return;
    const scheduled = !publishNow && form.status === "publicado" && form.publicarEm;
    const result = saveLesson(dados, { ...form, status: scheduled ? "programado" : form.status }, form.id, publishNow && !scheduled);
    atualizarDados("aulasGravadas", result.aulasGravadas);
    atualizarDados("notificacoes", result.notificacoes);
    setForm(null);
    setToast(scheduled ? "Aula salva e programada. Ela será liberada na data escolhida." : publishNow ? "Aula publicada e alunos notificados." : form.status === "arquivado" ? "Aula arquivada. Não aparecerá como nova para os alunos." : "Aula salva como rascunho.");
  }
  function changeState(lesson, status) {
    atualizarDados("aulasGravadas", (items) => replaceById(items, lesson.id, (current) => ({ ...current, status, nova: status === "publicado", arquivadaEm: status === "arquivado" ? new Date().toISOString() : "" })));
    if (status === "publicado") {
      lesson.alunoIds.forEach((id) => applyTeacherNotification(atualizarDados, createStudentNotification(id, "Nova aula gravada", `A aula ${lesson.titulo} está disponível.`, `/aluno/aulas/${lesson.id}`, "aulas")));
    }
    setToast(status === "arquivado" ? "Aula arquivada." : "Aula publicada.");
  }
  return <TeacherScreen title="Aulas gravadas" description="Gerencie links, conteúdo e acesso dos alunos." load={load} empty={!dados.aulasGravadas.length ? { mensagem: "Ainda não há aulas gravadas cadastradas.", proximoPasso: "Adicione um link de vídeo para compartilhar conteúdo com seus alunos." } : null} actions={<Button onClick={() => { setForm(defaultLessonForm(dados)); setErrors({}); }}><Plus size={15} /> Nova aula</Button>}>
    <div className="filter-bar"><label className="search-control"><Search size={16} /><input aria-label="Buscar aulas" placeholder="Buscar por título ou categoria" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={15} /><span className="sr-only">Filtrar aulas</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="todos">Todos os estados</option><option value="rascunho">Rascunhos</option><option value="publicado">Publicadas</option><option value="arquivado">Arquivadas</option></select></label></div>
    {lessons.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Aula</th><th>Categoria</th><th>Acesso</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{lessons.map((lesson) => <tr key={lesson.id}><td><strong>{lesson.titulo}</strong><small className="table-subtext">{lesson.duracao} min · {lesson.videoUrl}</small></td><td>{lesson.categoria}</td><td>{lesson.alunoIds.length} alunos</td><td><EtiquetaStatus status={lesson.status || "publicado"} /></td><td><div className="table-actions"><button className="text-button" onClick={() => setPreview(lesson)}>Prévia</button><button className="text-button" onClick={() => { setForm({ ...defaultLessonForm(dados, lesson), id: lesson.id }); setErrors({}); }}>Editar</button>{lesson.status !== "arquivado" && <button className="text-button" onClick={() => changeState(lesson, lesson.status === "publicado" ? "arquivado" : "publicado")}>{lesson.status === "publicado" ? "Arquivar" : "Publicar"}</button>}</div></td></tr>)}</tbody></table></div> : <EstadoVazio mensagem="Nenhuma aula encontrada." proximoPasso="Altere a busca ou escolha outro estado." />}
    <ModalConfirmacao aberto={Boolean(form)} titulo={form?.id ? "Editar aula gravada" : "Nova aula gravada"} mensagem="Cadastre o link do vídeo e escolha quais alunos poderão acessar." aoFechar={() => setForm(null)} aoConfirmar={() => {}} ocultarAcoes><form className="teacher-modal-form teacher-modal-form--wide" onSubmit={(event) => save(event)}><CampoFormulario label="Título" value={form?.titulo || ""} erro={errors.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} /><CampoFormulario label="Categoria" value={form?.categoria || ""} erro={errors.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} /><div className="form-field"><label htmlFor="lesson-description">Descrição curta</label><textarea id="lesson-description" rows="3" value={form?.descricao || ""} onChange={(event) => setForm({ ...form, descricao: event.target.value })} />{errors.descricao && <span className="form-field__error">{errors.descricao}</span>}</div><CampoFormulario label="Objetivos" value={form?.objetivo || ""} onChange={(event) => setForm({ ...form, objetivo: event.target.value })} /><CampoFormulario label="URL do vídeo" type="url" value={form?.videoUrl || ""} erro={errors.videoUrl} placeholder="https://..." onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} /><CampoFormulario label="URL da miniatura (opcional)" type="url" value={form?.miniaturaUrl || ""} onChange={(event) => setForm({ ...form, miniaturaUrl: event.target.value })} /><CampoFormulario label="Duração (minutos)" type="number" min="1" max="300" value={form?.duracao || ""} onChange={(event) => setForm({ ...form, duracao: event.target.value })} /><CampoFormulario label="Materiais complementares (separados por vírgula)" value={form?.materiais || ""} onChange={(event) => setForm({ ...form, materiais: event.target.value })} /><fieldset className="days-fieldset"><legend>Público autorizado</legend>{dados.alunos.filter((student) => student.status === "ativo").map((student) => <label className="student-select-row" key={student.id}><input type="checkbox" checked={form?.alunoIds.includes(student.id)} onChange={(event) => setForm({ ...form, alunoIds: event.target.checked ? [...form.alunoIds, student.id] : form.alunoIds.filter((id) => id !== student.id) })} /><span><strong>{student.nome}</strong><small>{student.email}</small></span></label>)}</fieldset>{errors.alunoIds && <span className="form-field__error">{errors.alunoIds}</span>}<div className="form-field"><label htmlFor="lesson-status">Estado</label><select id="lesson-status" value={form?.status || "rascunho"} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="rascunho">Rascunho</option><option value="publicado">Publicado</option><option value="arquivado">Arquivado</option></select></div>{form?.status === "publicado" && <CampoFormulario label="Programar publicação (opcional)" type="datetime-local" value={form.publicarEm} erro={errors.publicarEm} onChange={(event) => setForm({ ...form, publicarEm: event.target.value })} />}<ErrorNotice>{errors.save}</ErrorNotice><div className="form-actions"><Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button variant="secondary" type="button" onClick={() => setPreview({ ...form, titulo: form.titulo || "Pré-visualização", materiais: form.materiais.split(",").filter(Boolean) })}>Pré-visualizar</Button><Button type="submit">{form?.status === "publicado" ? "Salvar alterações" : "Salvar rascunho"}</Button><Button type="button" onClick={(event) => save(event, true)}>Publicar agora</Button></div></form></ModalConfirmacao>
    <ModalConfirmacao aberto={Boolean(preview)} titulo={preview?.titulo || "Pré-visualização"} mensagem={`${preview?.categoria || "Categoria"} · ${preview?.duracao || 0} min · ${preview?.alunoIds?.length || 0} alunos autorizados.`} confirmarTexto="Fechar" aoFechar={() => setPreview(null)} aoConfirmar={() => setPreview(null)}><p>{preview?.descricao}</p><p>Objetivo: {preview?.objetivo || "A definir"}</p><a href={preview?.videoUrl} target="_blank" rel="noreferrer">Abrir link do vídeo</a></ModalConfirmacao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

export function DuvidasProfessorPage() {
  const { dados } = useTeacherData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(searchParams.get("status") || "todas");
  const [sort, setSort] = useState("prioridade");
  const [follow, setFollow] = useState(false);
  const load = useTeacherLoad();
  const filtered = dados.duvidas.filter((item) => (filter === "todas" || item.status === filter) && (!follow || item.acompanhar) && `${item.assunto} ${item.categoria} ${dados.alunos.find((student) => student.id === item.alunoId)?.nome || ""}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "antiguidade" ? new Date(a.data) - new Date(b.data) : getDoubtPriority(a) - getDoubtPriority(b) || new Date(a.data) - new Date(b.data));
  return <TeacherScreen title="Perguntas dos alunos" description="Responda mensagens e acompanhe as conversas." load={load}>
    <div className="filter-bar"><label className="search-control"><Search size={16} /><input aria-label="Buscar dúvidas" placeholder="Buscar assunto, categoria ou aluno" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={15} /><span className="sr-only">Filtrar dúvidas por status</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setSearchParams(event.target.value === "todas" ? {} : { status: event.target.value }); }}><option value="todas">Todas</option><option value="pendente">Sem resposta</option><option value="em_atendimento">Em atendimento</option><option value="respondida">Respondidas</option><option value="resolvida">Resolvidas</option></select></label><label className="select-control"><span className="sr-only">Ordenar dúvidas</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="prioridade">Prioridade</option><option value="antiguidade">Mais antigas</option></select></label><Button variant={follow ? "primary" : "secondary"} onClick={() => setFollow((value) => !value)}><Flag size={14} /> Acompanhar</Button></div>
    {filtered.length ? <div className="doubt-list">{filtered.map((item) => { const student = dados.alunos.find((entry) => entry.id === item.alunoId); const unanswered = item.status === "pendente"; const sentAt = item.mensagens?.[0]?.data || item.data; return <Link className={`teacher-doubt-row${unanswered ? " is-pending" : ""}`} to={`/professor/duvidas/${item.id}`} key={item.id}><span className="teacher-list-icon teacher-list-icon--gold"><MessageCircle size={17} /></span><span><strong>{item.assunto}</strong><small>{student?.nome || "Aluno"} · {item.categoria} · enviada há {minutesSince(sentAt)}</small><small>{item.mensagens?.length || 0} mensagens</small></span><span className="teacher-doubt-row__actions">{unanswered && <b>Sem resposta</b>}<EtiquetaStatus status={item.status} /></span><ArrowRight size={16} /></Link>; })}</div> : <EstadoVazio mensagem="Nenhuma dúvida nesta lista." proximoPasso="As novas mensagens enviadas pelos alunos aparecerão aqui." />}
  </TeacherScreen>;
}

export function ResponderDuvidaPage() {
  const { duvidaId } = useParams();
  const { dados, atualizarDados, teacher } = useTeacherData();
  const doubt = dados.duvidas.find((item) => item.id === duvidaId);
  const student = dados.alunos.find((item) => item.id === doubt?.alunoId);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("respondida");
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [resolveConfirmation, setResolveConfirmation] = useState(false);
  const load = useTeacherLoad();
  function send(event) {
    event.preventDefault();
    if (text.trim().length < 5) { setError("Escreva uma resposta com pelo menos 5 caracteres."); return; }
    if (attachment && (!["image/jpeg", "image/png", "application/pdf"].includes(attachment.type) || attachment.size > 5 * 1024 * 1024)) { setError("Anexe uma imagem JPG ou PNG, ou um PDF de até 5 MB."); return; }
    const result = replyToStudentDoubt(doubt, text, status, attachment);
    atualizarDados("duvidas", (items) => replaceById(items, doubt.id, () => result.doubt));
    applyTeacherNotification(atualizarDados, result.notification);
    recordTeacherActivity(atualizarDados, teacher, "Dúvida respondida", `A professora respondeu à dúvida “${doubt.assunto}”.`, `/aluno/duvidas/${doubt.id}`, doubt.alunoId);
    setText("");
    setAttachment(null);
    setError("");
    setToast(`Resposta enviada para ${student?.nome || "o aluno"}.`);
  }
  function resolve() {
    const resolved = markDoubtResolved(doubt);
    atualizarDados("duvidas", (items) => replaceById(items, doubt.id, () => resolved));
    applyTeacherNotification(atualizarDados, createStudentNotification(doubt.alunoId, "Dúvida marcada como resolvida", `A conversa sobre “${doubt.assunto}” foi marcada como resolvida.`, `/aluno/duvidas/${doubt.id}`, "respostas"));
    recordTeacherActivity(atualizarDados, teacher, "Dúvida resolvida", `A dúvida “${doubt.assunto}” foi marcada como resolvida.`, `/aluno/duvidas/${doubt.id}`, doubt.alunoId);
    setToast("Conversa marcada como resolvida.");
  }
  if (!doubt) return <TeacherScreen title="Conversa" load={load} empty={{ mensagem: "Não encontramos esta dúvida.", proximoPasso: "Volte à caixa para escolher uma conversa disponível.", acao: <Link className="button button--secondary" to="/professor/duvidas">Abrir dúvidas</Link> }} />;
  return <TeacherScreen title={doubt.assunto} description={`${student?.nome || "Aluno"} · ${doubt.categoria} · enviada em ${dateText(doubt.data)}`} load={load} actions={<Link className="button button--secondary" to="/professor/duvidas"><ArrowLeft size={17} /> Perguntas dos alunos</Link>}>
    <div className="teacher-conversation"><div className="teacher-conversation__head"><span><EtiquetaStatus status={doubt.status} /></span><button className={`text-button${doubt.acompanhar ? " text-button--active" : ""}`} onClick={() => atualizarDados("duvidas", (items) => replaceById(items, doubt.id, (item) => ({ ...item, acompanhar: !item.acompanhar })))}><Flag size={14} />{doubt.acompanhar ? "Acompanhando" : "Acompanhar"}</button></div><div className="conversation-messages">{(doubt.mensagens || []).map((message) => <article className={`message-bubble${message.autorId === teacher.id ? " message-bubble--own" : ""}`} key={message.id}><div className="message-meta"><strong>{message.autorId === teacher.id ? "Você" : message.autor}</strong><time>{dateTimeText(message.data)}</time></div><p>{message.texto}</p>{message.anexos?.map((file) => <a className="message-attachment" href={file.url || "#"} target={file.url ? "_blank" : undefined} rel="noreferrer" key={`${file.nome}-${message.id}`}><FileText size={14} />{file.nome} · {(file.tamanho / 1024 / 1024).toFixed(1)} MB</a>)}</article>)}</div><div className="notice-banner notice-banner--warm"><ShieldAlert size={16} /><p>Quando houver relato de dor ou sintomas importantes, recomende interromper a atividade e buscar avaliação profissional adequada.</p></div>
      {doubt.status !== "resolvida" && <form className="teacher-reply-form" onSubmit={send}><div className="form-field"><label htmlFor="teacher-reply">Sua resposta</label><textarea id="teacher-reply" rows="5" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma orientação para o aluno..." /></div><div className="form-field"><label htmlFor="reply-attachment">Anexo opcional · JPG, PNG ou PDF · até 5 MB</label><input id="reply-attachment" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />{attachment && <span className="muted-copy">{attachment.name} <button type="button" className="text-button" onClick={() => setAttachment(null)}>Remover</button></span>}</div><div className="form-field"><label htmlFor="reply-status">Após enviar, status</label><select id="reply-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="respondida">Respondida</option><option value="em_atendimento">Em atendimento</option></select></div>{error && <MensagemErro mensagem={error} />}<div className="form-actions"><Button variant="secondary" type="button" onClick={() => setResolveConfirmation(true)}>Marcar como resolvida</Button><Button type="submit">Enviar resposta <ArrowRight size={14} /></Button></div></form>}
      {doubt.status === "resolvida" && <div className="inline-notice">Esta conversa está resolvida. Uma nova resposta reabrirá o acompanhamento.</div>}
    </div><ModalConfirmacao aberto={resolveConfirmation} titulo="Marcar dúvida como resolvida?" mensagem="O aluno receberá uma notificação e a conversa ficará disponível no histórico como resolvida." confirmarTexto="Marcar como resolvida" aoFechar={() => setResolveConfirmation(false)} aoConfirmar={() => { resolve(); setResolveConfirmation(false); }} /><Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AgendaProfessorPage() {
  const { dados, atualizarDados } = useTeacherData();
  const [view, setView] = useState("semana");
  const [offset, setOffset] = useState(0);
  const [blockDate, setBlockDate] = useState("");
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const load = useTeacherLoad();
  const dates = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    if (view === "dia") start.setDate(start.getDate() + offset);
    else if (view === "semana") {
      const weekday = start.getDay() || 7;
      start.setDate(start.getDate() - weekday + 1 + offset * 7);
    } else {
      start.setDate(1);
      start.setMonth(start.getMonth() + offset);
    }
    const count = view === "dia" ? 1 : view === "semana" ? 7 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return localDate(date);
    });
  }, [view, offset]);
  const appointments = dados.agendamentos.filter((item) => dates.includes(item.data)).sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
  const availability = dados.disponibilidade || {};
  const existingOnBlockedDate = blockDate ? dados.agendamentos.filter((item) => item.data === blockDate && !["cancelado", "recusado"].includes(item.status)) : [];
  function confirmBlockDate() {
    if (existingOnBlockedDate.length && !blockConfirm) return;
    atualizarDados("disponibilidade", { ...availability, datasBloqueadas: [...new Set([...(availability.datasBloqueadas || []), blockDate])].sort() });
    setBlockConfirm(false);
    setToast(existingOnBlockedDate.length ? "Data bloqueada. Reservas existentes foram preservadas e sinalizadas para contato." : "Data bloqueada para novos agendamentos.");
    setBlockDate("");
  }
  function updateAvailability(key, value) {
    atualizarDados("disponibilidade", { ...availability, [key]: value });
  }
  return <TeacherScreen title="Agenda e disponibilidade" description="Consulte consultas e ajuste os horários que os alunos podem reservar." load={load}>
    <div className="availability-card card"><div className="section-title-row"><div><span className="eyebrow">HORÁRIOS DE TRABALHO</span><h2>Disponibilidade</h2></div><Settings2 size={19} /></div><fieldset className="days-fieldset"><legend>Dias de atendimento</legend>{weekdays.map((day, index) => { const dayNumber = (index + 1) % 7; return <label className="check-pill" key={day}><input type="checkbox" checked={(availability.diasSemana || []).includes(dayNumber)} onChange={(event) => updateAvailability("diasSemana", event.target.checked ? [...availability.diasSemana, dayNumber].sort() : availability.diasSemana.filter((item) => item !== dayNumber))} /><span>{day}</span></label>; })}</fieldset><div className="availability-fields"><CampoFormulario label="Início" type="time" value={availability.inicio || "09:00"} onChange={(event) => updateAvailability("inicio", event.target.value)} /><CampoFormulario label="Fim" type="time" value={availability.fim || "17:00"} onChange={(event) => updateAvailability("fim", event.target.value)} /><CampoFormulario label="Pausa — início" type="time" value={availability.intervaloInicio || ""} onChange={(event) => updateAvailability("intervaloInicio", event.target.value)} /><CampoFormulario label="Pausa — fim" type="time" value={availability.intervaloFim || ""} onChange={(event) => updateAvailability("intervaloFim", event.target.value)} /></div><p className="muted-copy">Os horários reservados são preservados mesmo quando a disponibilidade muda. Eles não serão exibidos para novas reservas.</p><div className="block-date-form"><CampoFormulario label="Bloquear uma data" type="date" value={blockDate} onChange={(event) => setBlockDate(event.target.value)} /><Button variant="secondary" disabled={!blockDate} onClick={() => setBlockConfirm(true)}>Adicionar bloqueio</Button></div>{availability.datasBloqueadas?.length > 0 && <div className="blocked-dates">{availability.datasBloqueadas.map((date) => <span key={date}>{dateText(date)}<button aria-label={`Remover bloqueio de ${date}`} onClick={() => updateAvailability("datasBloqueadas", availability.datasBloqueadas.filter((item) => item !== date))}>×</button></span>)}</div>}</div>
    <Cartao className="calendar-card"><div className="section-title-row"><div><span className="eyebrow">CONSULTAS</span><h2>Agenda</h2></div><div className="calendar-view-tabs" role="group" aria-label="Visualização da agenda">{["dia", "semana", "mês"].map((item) => <button className={view === item ? "is-active" : ""} key={item} onClick={() => { setView(item); setOffset(0); }}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div><div className="calendar-range"><Button variant="secondary" aria-label="Período anterior" onClick={() => setOffset((value) => value - 1)}><ChevronLeft size={16} /></Button><strong>{view === "mês" ? dateText(dates[0], { month: "long", year: "numeric" }) : `${dateText(dates[0])} – ${dateText(dates[dates.length - 1])}`}</strong><Button variant="secondary" aria-label="Próximo período" onClick={() => setOffset((value) => value + 1)}><ChevronRight size={16} /></Button></div>
      <div className={`calendar-days calendar-days--${view}`}>{dates.map((date) => { const dayBookings = appointments.filter((item) => item.data === date); return <section className={`calendar-day${(availability.datasBloqueadas || []).includes(date) ? " calendar-day--blocked" : ""}`} key={date}><header><small>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${date}T12:00:00`))}</small><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(`${date}T12:00:00`))}</strong></header>{(availability.datasBloqueadas || []).includes(date) && <span className="blocked-label">Bloqueado</span>}{dayBookings.map((item) => <Link className={`calendar-booking calendar-booking--${item.status}`} to={`/professor/agendamentos/${item.id}`} key={item.id}><strong>{item.horario} · {dados.alunos.find((student) => student.id === item.alunoId)?.nome || "Aluno"}</strong><small>{item.modalidade || item.tipo} · {item.motivo}</small><EtiquetaStatus status={item.status} /></Link>)}{!dayBookings.length && !(availability.datasBloqueadas || []).includes(date) && <span className="calendar-free">Sem consultas</span>}</section>; })}</div>
    </Cartao>
    <ModalConfirmacao aberto={Boolean(blockDate && blockConfirm)} titulo="Bloquear esta data?" mensagem={existingOnBlockedDate.length ? `Há ${existingOnBlockedDate.length} consulta(s) já reservada(s). Elas serão mantidas. Confirme para bloquear novas reservas e manter as consultas atuais.` : "Os alunos não poderão selecionar esta data para novos agendamentos."} confirmarTexto={existingOnBlockedDate.length ? "Bloquear e manter reservas" : "Confirmar bloqueio"} aoFechar={() => setBlockConfirm(false)} aoConfirmar={confirmBlockDate} />
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

export function ConsultasProfessorPage() {
  const { dados, atualizarDados, teacher } = useTeacherData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todas");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ status: "", data: "", horario: "", motivo: "", observacoes: "" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const load = useTeacherLoad();
  const list = dados.agendamentos.filter((item) => (filter === "todas" || item.status === filter) && `${dados.alunos.find((student) => student.id === item.alunoId)?.nome || ""} ${item.motivo || ""} ${item.modalidade || item.tipo}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
  function open(booking, action) {
    setModal({ booking, action });
    setForm({ status: action === "confirmar" ? "confirmado" : action === "cancelar" ? "cancelado" : action === "concluir" ? "concluido" : "reagendado", data: booking.data, horario: booking.horario, motivo: "", observacoes: booking.observacoes || "" });
    setError("");
  }
  function save(event) {
    event.preventDefault();
    if (!form.motivo.trim() && modal.action !== "confirmar" && modal.action !== "concluir") { setError("Informe o motivo da alteração."); return; }
    const booking = modal.booking;
    const changes = { status: form.status, observacoes: form.observacoes };
    if (modal.action === "reagendar") {
      if (!form.data || !form.horario) { setError("Informe uma nova data e horário."); return; }
      const conflicts = getScheduleConflicts(dados, { data: form.data, horario: form.horario, duracao: booking.duracao }, booking.id);
      if (conflicts.length) { setError(conflicts.join(" ")); return; }
      changes.data = form.data;
      changes.horario = form.horario;
    }
    const updated = updateBooking(booking, changes, form.motivo || "Atualização pelo professor.", teacher.nome);
    atualizarDados("agendamentos", (items) => replaceById(items, booking.id, () => updated));
    const title = form.status === "cancelado" ? "Consulta cancelada" : modal.action === "reagendar" ? "Consulta reagendada" : modal.action === "concluir" ? "Consulta concluída" : "Consulta confirmada";
    applyTeacherNotification(atualizarDados, createStudentNotification(booking.alunoId, title, `${title}: ${updated.modalidade || updated.tipo} em ${dateText(updated.data)} às ${updated.horario}.`, `/aluno/agendamentos/${booking.id}`));
    recordTeacherActivity(atualizarDados, teacher, title, `${title} para ${dados.alunos.find((item) => item.id === booking.alunoId)?.nome || "aluno"}: ${dateText(updated.data)} às ${updated.horario}.`, `/aluno/agendamentos/${booking.id}`, booking.alunoId);
    if (modal.action === "concluir" && form.observacoes.trim()) atualizarDados("historicoAlunos", (items) => addStudentHistory(items, booking.alunoId, "orientação pós-consulta", form.observacoes.trim()));
    setModal(null);
    setToast("Alteração salva e aluno notificado.");
  }
  return <TeacherScreen title="Atendimentos" description="Confirme, altere ou registre o resultado dos atendimentos." load={load}>
    <div className="filter-bar"><label className="search-control"><Search size={16} /><input aria-label="Buscar consultas" placeholder="Buscar aluno, motivo ou modalidade" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={15} /><span className="sr-only">Filtrar consultas</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="todas">Todos os estados</option><option value="pendente">Pendentes</option><option value="confirmado">Confirmadas</option><option value="cancelado">Canceladas</option><option value="concluido">Concluídas</option></select></label><Link to="/professor/agendamentos" className="button button--secondary"><CalendarDays size={14} /> Agenda</Link></div>
    {list.length ? <div className="teacher-consult-list">{list.map((item) => <Cartao className="teacher-consult-card" key={item.id}><div className="booking-datebox"><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(`${item.data}T12:00:00`))}</strong><small>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${item.data}T12:00:00`))}</small></div><div className="teacher-consult-main"><div><h2>{dados.alunos.find((student) => student.id === item.alunoId)?.nome || "Aluno"}</h2><EtiquetaStatus status={item.status} /></div><p>{item.motivo || "Sem motivo informado"} · {item.modalidade || item.tipo}</p><small>{item.horario} · {item.duracao || 45} min · R$ {Number(item.preco || 0).toFixed(2).replace(".", ",")}</small></div><div className="teacher-consult-actions"><Link className="text-link" to={`/professor/agendamentos/${item.id}`}>Detalhes</Link>{item.status === "pendente" && <Button variant="secondary" onClick={() => open(item, "confirmar")}>Confirmar</Button>}{["pendente", "confirmado"].includes(item.status) && <Button variant="secondary" onClick={() => open(item, "reagendar")}>Reagendar</Button>}{["pendente", "confirmado"].includes(item.status) && <Button variant="ghost" onClick={() => open(item, "cancelar")}>Cancelar</Button>}{item.status === "confirmado" && <Button variant="secondary" onClick={() => open(item, "concluir")}>Concluir</Button>}</div></Cartao>)}</div> : <EstadoVazio mensagem="Nenhuma consulta corresponde aos filtros." proximoPasso="Novas solicitações dos alunos aparecerão nesta tela." />}
    <ModalConfirmacao aberto={Boolean(modal)} titulo={modal?.action === "reagendar" ? "Reagendar consulta" : modal?.action === "cancelar" ? "Cancelar consulta?" : modal?.action === "concluir" ? "Registrar consulta concluída" : "Confirmar consulta"} mensagem={modal?.action === "cancelar" ? "A consulta será cancelada e o aluno receberá uma notificação." : "O aluno será avisado sobre a atualização da consulta."} aoFechar={() => setModal(null)} aoConfirmar={() => {}} ocultarAcoes><form className="teacher-modal-form" onSubmit={save}>{modal?.action === "reagendar" && <><CampoFormulario label="Nova data" type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} /><CampoFormulario label="Novo horário" type="time" value={form.horario} onChange={(event) => setForm({ ...form, horario: event.target.value })} /></>}{modal?.action !== "confirmar" && <CampoFormulario label="Motivo" value={form.motivo} onChange={(event) => setForm({ ...form, motivo: event.target.value })} />}{(modal?.action === "concluir" || modal?.action === "reagendar") && <div className="form-field"><label htmlFor="consult-notes">{modal.action === "concluir" ? "Notas e orientações pós-atendimento" : "Observações"}</label><textarea id="consult-notes" rows="3" value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} /></div>}{error && <MensagemErro mensagem={error} />}<div className="form-actions"><Button variant="secondary" onClick={() => setModal(null)}>Voltar</Button><Button type="submit">Confirmar alteração</Button></div></form></ModalConfirmacao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

export function ConsultaDetalheProfessorPage() {
  const { agendamentoId } = useParams();
  const { dados } = useTeacherData();
  const booking = dados.agendamentos.find((item) => item.id === agendamentoId);
  const load = useTeacherLoad();
  if (!booking) return <TeacherScreen title="Consulta" load={load} empty={{ mensagem: "Não encontramos esta consulta.", proximoPasso: "Volte à lista para selecionar uma reserva disponível.", acao: <Link className="button button--secondary" to="/professor/consultas">Ver consultas</Link> }} />;
  const student = dados.alunos.find((item) => item.id === booking.alunoId);
  return <TeacherScreen title="Detalhe da consulta" description="Dados da reserva e histórico de alterações." load={load} actions={<Link className="button button--secondary" to="/professor/consultas"><ArrowLeft size={14} /> Consultas</Link>}>
    <div className="booking-detail"><Cartao className="booking-detail__hero"><span className="eyebrow">ALUNO</span><div className="booking-detail__title"><h2>{student?.nome || "Aluno"}</h2><EtiquetaStatus status={booking.status} /></div><p><CalendarDays size={17} />{dateText(booking.data, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {booking.horario}</p><p>{booking.modalidade || booking.tipo} · {booking.duracao || 45} min</p></Cartao><div className="booking-detail__grid"><Cartao><span className="eyebrow">MOTIVO DO ATENDIMENTO</span><p>{booking.motivo || "Não informado"}</p></Cartao><Cartao><span className="eyebrow">LOCAL OU LINK</span><p>{booking.local || "A combinar"}</p></Cartao><Cartao><span className="eyebrow">VALOR</span><h2>R$ {Number(booking.preco || 0).toFixed(2).replace(".", ",")}</h2><p>{booking.pagamento || "Pagamento simulado"}</p></Cartao><Cartao><span className="eyebrow">NOTAS E ORIENTAÇÕES</span><p>{booking.observacoes || "Ainda não há orientações registradas."}</p></Cartao></div>{booking.historicoStatus?.length ? <Cartao className="status-history"><span className="eyebrow">HISTÓRICO DE MUDANÇAS</span>{booking.historicoStatus.map((item, index) => <p key={`${item.data}-${index}`}><strong>{item.status}</strong> · {item.autor} · {dateTimeText(item.data)}{item.horarioNovo && <><br />De {item.horarioAnterior} para {item.horarioNovo}</>}<br /><small>{item.motivo}</small></p>)}</Cartao> : <EstadoVazio mensagem="Esta consulta ainda não tem mudanças registradas." proximoPasso="Alterações futuras aparecerão no histórico." />}</div>
  </TeacherScreen>;
}

export function ConfiguracoesProfessorPage() {
  const { dados, atualizarDados, teacher, entrar } = useTeacherData();
  const settings = dados.configuracoesProfessor || {};
  const availability = dados.disponibilidade || {};
  const [form, setForm] = useState({ nome: teacher.nome, email: teacher.email, especialidade: teacher.especialidade || "", telefone: settings.telefone || "", local: settings.local || "", onlineValue: availability.valores?.online || 75, presencialValue: availability.valores?.presencial || 95, onlineDuration: availability.duracoes?.online || 45, presencialDuration: availability.duracoes?.presencial || 50, rules: availability.regrasCancelamento || "" });
  const [modal, setModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [load, setLoad] = useState({ loading: true, error: false });
  const [preferences, setPreferences] = useState({ duvidas: true, agendamentos: true, alteracoes: true, ...settings.preferencias });
  useEffect(() => { getPageContent("configuracoes-professor").then(() => setLoad({ loading: false, error: false })).catch(() => setLoad({ loading: false, error: true })); }, []);
  const activeBookings = dados.agendamentos.filter((item) => ["confirmado", "pendente"].includes(item.status));
  function save(event) {
    event?.preventDefault();
    const next = {};
    if (form.nome.trim().length < 3) next.nome = "Informe seu nome profissional.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Informe um e-mail válido.";
    if (Number(form.onlineDuration) < 15 || Number(form.onlineDuration) > 180) next.onlineDuration = "Use uma duração entre 15 e 180 minutos.";
    if (Number(form.presencialDuration) < 15 || Number(form.presencialDuration) > 180) next.presencialDuration = "Use uma duração entre 15 e 180 minutos.";
    if (Number(form.onlineValue) < 0 || Number(form.presencialValue) < 0) next.value = "Os valores não podem ser negativos.";
    if (!form.rules.trim()) next.rules = "Informe as regras de cancelamento.";
    setErrors(next);
    if (Object.keys(next).length) { setModal(false); return; }
    const updatedTeacher = { ...dados.professor, nome: form.nome.trim(), email: form.email.trim(), especialidade: form.especialidade.trim() };
    atualizarDados("professor", updatedTeacher);
    entrar({ ...teacher, nome: updatedTeacher.nome, email: updatedTeacher.email, especialidade: updatedTeacher.especialidade });
    atualizarDados("configuracoesProfessor", { ...settings, telefone: form.telefone, local: form.local, preferencias: preferences });
    atualizarDados("disponibilidade", { ...availability, valores: { online: Number(form.onlineValue), presencial: Number(form.presencialValue) }, duracoes: { online: Number(form.onlineDuration), presencial: Number(form.presencialDuration) }, regrasCancelamento: form.rules });
    setModal(false);
    setToast(activeBookings.length ? "Configurações salvas. Reservas existentes foram preservadas com seus valores e durações anteriores." : "Configurações profissionais salvas.");
  }
  const hasCriticalChanges = Number(form.onlineValue) !== Number(availability.valores?.online || 75) || Number(form.presencialValue) !== Number(availability.valores?.presencial || 95) || Number(form.onlineDuration) !== Number(availability.duracoes?.online || 45) || Number(form.presencialDuration) !== Number(availability.duracoes?.presencial || 50);
  return <TeacherScreen title="Configurações" description="Gerencie seus dados profissionais e as condições de atendimento." load={load.loading || load.error ? load : undefined}>
    <form className="teacher-settings-layout" onSubmit={(event) => { event.preventDefault(); setErrors({}); setModal(true); }}>
      <Cartao className="settings-panel"><span className="eyebrow">PERFIL PROFISSIONAL</span><h2>Dados e contato</h2><div className="form-field"><label htmlFor="teacher-name">Nome profissional</label><input id="teacher-name" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} />{errors.nome && <span className="form-field__error">{errors.nome}</span>}</div><div className="form-field"><label htmlFor="teacher-email">E-mail</label><input id="teacher-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />{errors.email && <span className="form-field__error">{errors.email}</span>}</div><CampoFormulario label="Especialidade" value={form.especialidade} onChange={(event) => setForm({ ...form, especialidade: event.target.value })} /><CampoFormulario label="Telefone" type="tel" value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} /><div className="form-field"><label htmlFor="teacher-location">Local de atendimento presencial</label><input id="teacher-location" value={form.local} onChange={(event) => setForm({ ...form, local: event.target.value })} /></div></Cartao>
      <Cartao className="settings-panel"><span className="eyebrow">SERVIÇOS E REGRAS</span><h2>Valores e duração</h2><div className="editor-grid editor-grid--compact"><CampoFormulario label="Online · valor (R$)" type="number" min="0" step="0.01" value={form.onlineValue} erro={errors.value} onChange={(event) => setForm({ ...form, onlineValue: event.target.value })} /><CampoFormulario label="Online · duração (min)" type="number" min="15" max="180" value={form.onlineDuration} erro={errors.onlineDuration} onChange={(event) => setForm({ ...form, onlineDuration: event.target.value })} /><CampoFormulario label="Presencial · valor (R$)" type="number" min="0" step="0.01" value={form.presencialValue} erro={errors.value} onChange={(event) => setForm({ ...form, presencialValue: event.target.value })} /><CampoFormulario label="Presencial · duração (min)" type="number" min="15" max="180" value={form.presencialDuration} erro={errors.presencialDuration} onChange={(event) => setForm({ ...form, presencialDuration: event.target.value })} /></div><div className="form-field"><label htmlFor="cancellation-rules">Regras de cancelamento</label><textarea id="cancellation-rules" rows="4" value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} />{errors.rules && <span className="form-field__error">{errors.rules}</span>}</div><p className="muted-copy">Valores e durações novos se aplicam a agendamentos futuros. Reservas já confirmadas permanecem como foram combinadas.</p></Cartao>
      <Cartao className="settings-panel"><span className="eyebrow">PREFERÊNCIAS</span><h2>Notificações do painel</h2>{[["duvidas", "Novas dúvidas"], ["agendamentos", "Novos agendamentos"], ["alteracoes", "Cancelamentos e mudanças"]].map(([key, label]) => <label className="switch-row" key={key}><span>{label}{(key === "duvidas" || key === "agendamentos") && <small>Essencial</small>}</span><input type="checkbox" checked={preferences[key] || key === "duvidas" || key === "agendamentos"} disabled={key === "duvidas" || key === "agendamentos"} onChange={() => setPreferences({ ...preferences, [key]: !preferences[key] })} /><span className="switch-ui" /></label>)}</Cartao>
      <div className="form-actions settings-save"><Button type="submit">Salvar configurações</Button></div>
    </form>
    <ModalConfirmacao aberto={modal} titulo={hasCriticalChanges ? "Confirmar alteração de serviços?" : "Salvar configurações?"} mensagem={hasCriticalChanges && activeBookings.length ? `Esta alteração muda condições para novos agendamentos. ${activeBookings.length} reservas existentes serão mantidas com duração, valor e regras anteriores.` : hasCriticalChanges ? "Novos valores e durações serão usados nos próximos agendamentos. Reservas já existentes não serão alteradas." : "Confira seus dados e preferências antes de salvar."} confirmarTexto="Confirmar e salvar" aoFechar={() => setModal(false)} aoConfirmar={save}><p className="muted-copy">As alterações serão armazenadas apenas neste protótipo.</p></ModalConfirmacao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TeacherScreen>;
}

export function NotificacoesProfessorPage() {
  const { dados, atualizarDados, teacher } = useTeacherData();
  const [filter, setFilter] = useState("todas");
  const load = useTeacherLoad();
  const items = dados.notificacoes.filter((item) => item.usuarioId === teacher.id && (filter === "todas" || (filter === "nao_lidas" ? !item.lida : item.categoria === filter))).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  function pathFor(item) {
    if (item.relatedTo?.startsWith("/professor")) return item.relatedTo;
    if (item.categoria === "respostas") return "/professor/duvidas";
    if (item.categoria === "agendamentos" || item.categoria === "aulas") return "/professor/consultas";
    if (item.categoria === "alunos") return "/professor/alunos";
    return "/professor/notificacoes";
  }
  return <TeacherScreen title="Notificações" description="Acompanhe dúvidas, reservas e atualizações recentes." load={load}>
    <div className="tab-filters" role="group" aria-label="Filtrar notificações do professor">{[["todas", "Todas"], ["nao_lidas", "Não lidas"], ["respostas", "Dúvidas"], ["agendamentos", "Agendamentos"]].map(([key, label]) => <button className={filter === key ? "is-active" : ""} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div>
    {items.length ? <div className="notification-list">{items.map((item) => <Link className={`notification-row${item.lida ? "" : " is-unread"}`} to={pathFor(item)} key={item.id} onClick={() => atualizarDados("notificacoes", (entries) => replaceById(entries, item.id, (current) => ({ ...current, lida: true })))}><span className="notification-icon"><Bell size={17} /></span><span className="notification-copy"><strong>{item.titulo}</strong><span>{item.mensagem}</span><small>{dateTimeText(item.data)}</small></span>{!item.lida && <span className="unread-dot" aria-label="Não lida" />}<ArrowRight size={15} /></Link>)}</div> : <EstadoVazio mensagem="Nenhuma notificação nesta categoria." proximoPasso="Novas dúvidas e agendamentos aparecerão aqui sem duplicações." />}
  </TeacherScreen>;
}
