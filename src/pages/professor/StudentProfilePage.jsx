import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Dumbbell, FileText, MessageCircle, Phone, Plus } from "lucide-react";
import Button from "../../components/Button";
import Cartao from "../../components/Card";
import Carregando from "../../components/Loading";
import EstadoVazio from "../../components/EmptyState";
import MensagemErro from "../../components/ErrorMessage";
import EtiquetaStatus from "../../components/StatusTag";
import Toast from "../../components/Toast";
import { useApp } from "../../context/AppContext";
import { getPageContent } from "../../services/dataService";
import { addAuditEvent } from "../../services/trackingService";
import {
  addStudentHistory, getTeacherStudentSummary, saveEvaluation, saveGoal, savePrivateNote as createPrivateNote,
} from "../../services/teacherService";
import { teacherAttentionConfig } from "../../config/teacherAttention";

const tabs = ["Resumo", "Treinos", "Evolução", "Perguntas", "Pagamentos", "Anotações"];

function dateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysAgo(value) {
  const date = parseDate(value);
  if (!date) return null;
  const today = parseDate(dateKey());
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", options).format(parseDate(value));
}

function situationFor(data, student) {
  if (student.status === "convite_pendente") return { label: "Convite pendente", key: "convite" };
  if (student.status !== "ativo") return { label: student.status === "suspenso" ? "Suspenso" : "Encerrado", key: "inativo" };
  const hasPendingQuestion = (data.duvidas || []).some((item) => item.alunoId === student.id && item.status === "pendente");
  const daysToExpiry = student.vencimentoPlano ? -daysAgo(student.vencimentoPlano) : null;
  const planNeedsAttention = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= teacherAttentionConfig.planoVenceAteDias;
  const last = (data.sessoesTreino || [])
    .filter((session) => session.alunoId === student.id && session.status === "concluido")
    .sort((a, b) => (b.concluidaEm || b.iniciadaEm || "").localeCompare(a.concluidaEm || a.iniciadaEm || ""))[0];
  const days = last ? daysAgo(last.concluidaEm || last.iniciadaEm) : null;
  if (days === null || days > teacherAttentionConfig.atencaoAteDias) return { label: days === null ? "Atenção" : "Sumido", key: days === null ? "atencao" : "sumidos", days };
  if (days > teacherAttentionConfig.emDiaAteDias || hasPendingQuestion || planNeedsAttention) return { label: "Atenção", key: "atencao", days };
  return { label: "Em dia", key: "em-dia", days };
}

function Row({ title, detail, to, status, icon: Icon }) {
  const content = <><span className="teacher-list-icon">{Icon && <Icon size={17} />}</span><span className="teacher-list-copy"><strong>{title}</strong><small>{detail}</small></span>{status ? <EtiquetaStatus status={status} /> : null}</>;
  return to ? <Link className="teacher-list-row" to={to}>{content}</Link> : <div className="teacher-list-row">{content}</div>;
}

export default function StudentProfilePage() {
  const { alunoId } = useParams();
  const { dados, atualizarDados, usuario: teacher } = useApp();
  const [activeTab, setActiveTab] = useState("Resumo");
  const [note, setNote] = useState("");
  const [goal, setGoal] = useState("");
  const [evaluation, setEvaluation] = useState({ data: dateKey(), medida: "", observacao: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState("");
  const student = dados.alunos.find((item) => item.id === alunoId);
  const summary = student ? getTeacherStudentSummary(dados, student) : null;

  useEffect(() => {
    let active = true;
    getPageContent("painel-professor")
      .then(() => { if (active) { setLoading(false); setError(false); } })
      .catch(() => { if (active) { setLoading(false); setError(true); } });
    return () => { active = false; };
  }, []);

  const upcomingBooking = summary?.bookings.filter((item) => item.data >= dateKey() && ["confirmado", "pendente"].includes(item.status)).sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`))[0];
  if (loading) return <div className="page-content teacher-page"><Carregando /></div>;
  if (error) return <div className="page-content teacher-page"><MensagemErro mensagem="Não foi possível carregar esta ficha. Tente novamente." tentarNovamente={() => { setLoading(true); setError(false); getPageContent("painel-professor").then(() => setLoading(false)).catch(() => { setLoading(false); setError(true); }); }} /></div>;
  if (!student || !summary) return <div className="page-content teacher-page"><header className="page-heading"><h1>Ficha do aluno</h1></header><EstadoVazio mensagem="Não encontramos este aluno." proximoPasso="Volte à lista para escolher um aluno cadastrado." acao={<Link className="button button--secondary" to="/professor/alunos">Ver alunos</Link>} /></div>;

  const situation = situationFor(dados, student);
  const lastSession = summary.sessions.find((session) => session.status === "concluido");
  const servicePlan = (dados.planosServicos || []).find((item) => item.id === student.planoVigenteId);
  const activeTraining = summary.plans.find((item) => ["publicado", "disponivel", "ativo"].includes(item.status));
  const activeGoal = summary.goals.find((item) => item.status === "ativa");
  const profile = dados.perfisAluno?.[student.id] || {};
  const phoneDigits = String(profile.telefone || "").replace(/\D/g, "");
  const whatsAppNumber = phoneDigits ? (phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`) : "";
  const payments = (dados.pagamentos || []).filter((item) => item.alunoId === student.id);
  const pendingBookings = summary.bookings.filter((item) => item.status !== "cancelado" && /aguardando pagamento|pendente/i.test(item.pagamento || ""));
  const responses = (dados.respostasQuestionarios || []).filter((item) => item.alunoId === student.id);

  function recordActivity(type, message) {
    atualizarDados("historicoAtividades", (items) => addAuditEvent(items || [], {
      usuarioId: teacher.id,
      usuarioNome: teacher.nome,
      perfil: "professor",
      alunoId: student.id,
      tipo: type,
      resumo: message,
      relatedTo: `/professor/alunos/${student.id}`,
    }));
  }

  function savePrivateNote(event) {
    event.preventDefault();
    if (note.trim().length < 3) return;
    atualizarDados("notasPrivadas", (items) => [...items, savePrivateNoteRecord()]);
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "nota privada", "Anotação privada adicionada pelo professor.", true));
    recordActivity("Anotação privada registrada", `Anotação privada adicionada à ficha de ${student.nome}.`);
    setNote("");
    setToast("Anotação salva. Só você pode ver.");
  }

  function savePrivateNoteRecord() {
    return createPrivateNote(student.id, teacher.nome, note);
  }

  function saveStudentGoal(event) {
    event.preventDefault();
    if (goal.trim().length < 3) return;
    atualizarDados("metas", (items) => [...items, saveGoal(student.id, goal)]);
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "meta", `Meta registrada: ${goal.trim()}.`));
    recordActivity("Meta criada", `Meta registrada para ${student.nome}.`);
    setGoal("");
    setToast("Meta adicionada.");
  }

  function savePhysicalEvaluation(event) {
    event.preventDefault();
    if (evaluation.medida.trim().length < 2) return;
    atualizarDados("avaliacoes", (items) => [...items, saveEvaluation(student.id, evaluation)]);
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "avaliação", `Avaliação registrada: ${evaluation.medida.trim()}.`));
    recordActivity("Avaliação registrada", `Avaliação registrada para ${student.nome}.`);
    setEvaluation({ data: dateKey(), medida: "", observacao: "" });
    setToast("Avaliação registrada.");
  }

  function updateGoal(event, item) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const progress = Math.max(0, Math.min(100, Number(form.get("progresso"))));
    const status = progress === 100 ? "concluida" : String(form.get("status"));
    const comment = String(form.get("comentario") || "").trim();
    atualizarDados("metas", (items) => items.map((current) => current.id === item.id ? {
      ...current,
      progresso: progress,
      status,
      comentariosProfessor: comment,
      historico: [...(current.historico || []), { data: new Date().toISOString(), autor: teacher.nome, progresso, status, comentario: comment }],
    } : current));
    atualizarDados("historicoAlunos", (items) => addStudentHistory(items, student.id, "meta atualizada", `Meta “${item.nome || item.descricao}” atualizada pelo professor.`));
    recordActivity("Meta atualizada", `Meta de ${student.nome} atualizada.`);
    setToast(progress === 100 ? "Meta concluída e registrada no histórico." : "Meta atualizada.");
  }

  const renderPanel = () => {
    if (activeTab === "Resumo") return <div className="student-summary-grid">
      <Cartao><span className="eyebrow">SITUAÇÃO</span><h2><span className={`student-situation student-situation--${situation.key}`}>{situation.label}</span></h2><p>{lastSession ? `Último treino concluído ${situation.days === 0 ? "hoje" : `há ${situation.days} ${situation.days === 1 ? "dia" : "dias"}`}.` : "Ainda não há treino concluído registrado."}</p></Cartao>
      <Cartao><span className="eyebrow">PLANO ATUAL</span><h2>{servicePlan?.nome || activeTraining?.nome || "Sem plano vinculado"}</h2><p>{student.vencimentoPlano ? `Vence em ${formatDate(student.vencimentoPlano, { day: "numeric", month: "long" })}.` : "Vencimento não informado."}</p></Cartao>
      <Cartao><span className="eyebrow">PRÓXIMO ATENDIMENTO</span><h2>{upcomingBooking ? formatDate(upcomingBooking.data, { weekday: "long", day: "numeric", month: "long" }) : "Sem atendimento marcado"}</h2><p>{upcomingBooking ? `${upcomingBooking.horario} · ${upcomingBooking.modalidade || upcomingBooking.tipo}` : "Agende quando precisarem conversar."}</p></Cartao>
      <Cartao><span className="eyebrow">META ATUAL</span><h2>{activeGoal?.nome || activeGoal?.descricao || "Sem meta ativa"}</h2><p>{activeGoal ? `${activeGoal.progresso || 0}% concluído` : "Registre uma meta na aba Evolução."}</p></Cartao>
    </div>;

    if (activeTab === "Treinos") return <Cartao><div className="section-title-row"><div><span className="eyebrow">PLANOS E HISTÓRICO</span><h2>Treinos</h2></div><Link className="button button--primary" to={`/professor/treinos/novo?aluno=${student.id}`}><Plus size={17} /> Criar treino</Link></div>{summary.plans.length ? summary.plans.map((item) => <Row key={item.id} title={item.nome} detail={`${item.frequencia || "Frequência a combinar"} · atualizado em ${formatDate(item.atualizadoEm)}`} status={item.status} icon={Dumbbell} to={`/professor/treinos/${item.id}/editar`} />) : <p className="muted-copy">Ainda não há treinos cadastrados.</p>}{summary.sessions.length ? <div className="mini-history"><h3>Treinos realizados</h3>{summary.sessions.map((item) => <p key={item.id}>{formatDate(item.concluidaEm || item.iniciadaEm)} · {item.planoSnapshot?.nome || "Treino"} · {item.status}</p>)}</div> : null}</Cartao>;

    if (activeTab === "Evolução") return <div className="student-profile-stack">
      <Cartao><div className="section-title-row"><div><span className="eyebrow">AVALIAÇÕES</span><h2>Registrar avaliação</h2></div></div><form className="student-profile-form" onSubmit={savePhysicalEvaluation}><label>Data<input type="date" value={evaluation.data} onChange={(event) => setEvaluation({ ...evaluation, data: event.target.value })} /></label><label>Medida ou avaliação<input value={evaluation.medida} onChange={(event) => setEvaluation({ ...evaluation, medida: event.target.value })} required /></label><label className="student-profile-form__wide">Observações<textarea rows="2" value={evaluation.observacao} onChange={(event) => setEvaluation({ ...evaluation, observacao: event.target.value })} /></label><Button type="submit">Salvar avaliação</Button></form>{summary.evaluations.length ? summary.evaluations.map((item) => <Row key={item.id} title={item.medida || Object.keys(item.indicadores || {}).join(", ") || "Avaliação"} detail={`${formatDate(item.data)} · ${item.observacao || "Sem observação"} · ${item.compartilhada ? "Compartilhada" : "Privada"}`} icon={FileText} />) : <p className="muted-copy">Sem avaliações registradas.</p>}</Cartao>
      <Cartao><span className="eyebrow">METAS</span><h2>Objetivos do aluno</h2><form className="student-profile-form" onSubmit={saveStudentGoal}><label className="student-profile-form__wide">Nova meta<input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Ex.: manter 2 treinos por semana" required minLength={3} /></label><Button type="submit">Adicionar meta</Button></form>{summary.goals.length ? summary.goals.map((item) => <form className="student-goal-edit" key={item.id} onSubmit={(event) => updateGoal(event, item)}><div><strong>{item.nome || item.descricao}</strong><small>{item.descricao}</small></div><label>Progresso (%)<input name="progresso" type="number" min="0" max="100" defaultValue={item.progresso || 0} /></label><label>Status<select name="status" defaultValue={item.status}><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="concluida">Concluída</option></select></label><label>Comentário do professor<input name="comentario" defaultValue={item.comentariosProfessor || ""} /></label><Button type="submit">Salvar</Button></form>) : <p className="muted-copy">Ainda não há metas cadastradas.</p>}</Cartao>
    </div>;

    if (activeTab === "Perguntas") return <Cartao><span className="eyebrow">CONVERSAS</span><h2>Perguntas do aluno</h2>{summary.doubts.length ? summary.doubts.map((item) => <Row key={item.id} title={item.assunto} detail={`${item.categoria} · enviada em ${formatDate(item.data)}`} status={item.status} icon={MessageCircle} to={`/professor/duvidas/${item.id}`} />) : <p className="muted-copy">Este aluno ainda não enviou perguntas.</p>}<h2 className="student-profile-subheading">Respostas de formulários</h2>{responses.length ? responses.map((response) => { const questionnaire = (dados.questionarios || []).find((item) => item.id === response.questionarioId); return <details className="tracking-record" key={response.id}><summary><strong>{questionnaire?.titulo || "Formulário"}</strong><span>{formatDate(response.enviadoEm)}</span></summary>{Object.entries(response.respostas || {}).map(([key, value]) => <p key={key}><strong>{questionnaire?.campos?.find((field) => field.id === key)?.rotulo || key}:</strong> {value}</p>)}</details>; }) : <p className="muted-copy">Sem respostas de formulários.</p>}</Cartao>;

    if (activeTab === "Pagamentos") return <Cartao><span className="eyebrow">SIMULADO · SEM COBRANÇA REAL</span><h2>Pagamentos</h2>{payments.map((item) => <Row key={item.id} title={`${item.servico || "Atendimento"} · R$ ${Number(item.valor || 0).toFixed(2).replace(".", ",")}`} detail={`${formatDate(item.data)} · ${item.status}`} status={item.status} />)}{pendingBookings.map((item) => <Row key={`booking-${item.id}`} title={`${item.motivo || "Atendimento"} · R$ ${Number(item.preco || 0).toFixed(2).replace(".", ",")}`} detail={`${formatDate(item.data)} · Pagamento pendente (simulado)`} status="pendente" />)}{!payments.length && !pendingBookings.length ? <p className="muted-copy">Não há pagamentos registrados para este aluno.</p> : null}</Cartao>;

    return <div className="student-profile-stack"><Cartao className="private-notes"><span className="eyebrow">PRIVADO · SÓ VOCÊ VÊ</span><h2>Anotações do professor</h2><p>Estas anotações nunca aparecem para o aluno.</p><form onSubmit={savePrivateNote}><label htmlFor="private-note">Nova anotação</label><textarea id="private-note" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escreva uma anotação para seu acompanhamento" /><Button type="submit">Salvar anotação</Button></form>{summary.privateNotes.length ? summary.privateNotes.map((item) => <div className="private-note-row" key={item.id}><p>{item.texto}</p><small>{formatDate(item.data, { day: "numeric", month: "short", year: "numeric" })}</small></div>) : <p className="muted-copy">Ainda não há anotações privadas.</p>}</Cartao><Cartao><span className="eyebrow">REGISTRO DE ALTERAÇÕES</span><h2>Histórico do aluno</h2>{summary.history.length ? summary.history.map((item) => <p className="student-history-row" key={item.id}><strong>{item.tipo}</strong><span>{item.descricao}</span><small>{formatDate(item.data, { day: "numeric", month: "short", year: "numeric" })}</small></p>) : <p className="muted-copy">Alterações importantes aparecerão aqui.</p>}</Cartao></div>;
  };

  return <div className="page-content teacher-page">
    <header className="page-heading"><div><span className="eyebrow">MOVIMENTO / ALUNOS</span><h1>{student.nome}</h1><p>Ficha de acompanhamento · {student.email}</p></div><div className="page-heading__actions"><Link className="button button--secondary" to="/professor/alunos"><ArrowLeft size={17} /> Alunos</Link></div></header>
    <Cartao className="student-profile__hero"><span className="avatar avatar--large">{student.nome.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="student-profile__identity"><h2>{student.nome}</h2><span className={`student-situation student-situation--${situation.key}`}>{situation.label}</span><p>{student.objetivo || "Objetivo ainda não cadastrado."}</p></div><div className="student-profile__actions"><Link className="button button--primary" to={`/professor/treinos/novo?aluno=${student.id}`}><Dumbbell size={17} /> Criar treino</Link><Link className="button button--secondary" to={`/professor/agenda?aluno=${student.id}`}><CalendarDays size={17} /> Agendar</Link><button className="button button--secondary" onClick={() => setActiveTab("Evolução")}><FileText size={17} /> Registrar avaliação</button>{whatsAppNumber && <a className="button button--secondary" href={`https://wa.me/${whatsAppNumber}`} target="_blank" rel="noreferrer"><Phone size={17} /> Chamar no WhatsApp</a>}</div></Cartao>
    <div className="student-profile-tabs" role="tablist" aria-label="Seções da ficha do aluno">{tabs.map((tab) => <button key={tab} type="button" role="tab" id={`student-tab-${tab}`} aria-selected={activeTab === tab} aria-controls="student-tab-panel" className={activeTab === tab ? "is-active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
    <div id="student-tab-panel" className="student-profile-panel" role="tabpanel" aria-labelledby={`student-tab-${activeTab}`}>{renderPanel()}</div>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </div>;
}
