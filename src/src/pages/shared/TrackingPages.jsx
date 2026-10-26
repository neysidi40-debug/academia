import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, Download, FileText, Flag, HeartPulse, Plus, ShieldAlert,
} from "lucide-react";
import Button from "../../components/Button";
import Cartao from "../../components/Card";
import Carregando from "../../components/Loading";
import EstadoVazio from "../../components/EmptyState";
import MensagemErro from "../../components/ErrorMessage";
import CampoFormulario from "../../components/FormField";
import EtiquetaStatus from "../../components/StatusTag";
import Toast from "../../components/Toast";
import { useApp } from "../../context/AppContext";
import { getPageContent } from "../../services/dataService";
import {
  addAuditEvent, createQuestionnaire, createServicePlan,
  saveGoalForStudent, simulatePayment, submitQuestionnaireResponse,
  summarizeReport, toCsv, updateStudentGoal,
} from "../../services/trackingService";

function useTrackingLoad(key) {
  const [state, setState] = useState({ loading: true, error: false });
  const retry = useCallback(() => {
    setState({ loading: true, error: false });
    getPageContent(key)
      .then(() => setState({ loading: false, error: false }))
      .catch(() => setState({ loading: false, error: true }));
  }, [key]);
  useEffect(() => retry(), [retry]);
  return { ...state, retry };
}

function TrackingScreen({ title, description, children, load, actions }) {
  return <main className="page-content tracking-page">
    <header className="page-heading"><div><span className="eyebrow">MOVIMENTO / ACOMPANHAMENTO</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-heading__actions">{actions}</div>}</header>
    {load.loading ? <Carregando /> : load.error ? <MensagemErro mensagem="Não foi possível carregar esta tela. Tente novamente." tentarNovamente={load.retry} /> : children}
  </main>;
}

function useTrackingData() {
  return useApp();
}

function audit(update, user, type, summary, relatedTo = "", studentId = "") {
  update("historicoAtividades", (items) => addAuditEvent(items || [], {
    usuarioId: user.id,
    usuarioNome: user.nome,
    perfil: user.perfil,
    tipo: type,
    resumo: summary,
    relatedTo,
    alunoId: studentId || (user.perfil === "aluno" ? user.id : ""),
  }));
}

function Empty({ message, next, action }) {
  return <EstadoVazio mensagem={message} proximoPasso={next} acao={action} />;
}

function formatDate(value) {
  if (!value) return "Sem data";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Sem data" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Sem data";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sem data" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function MiniChart({ points, label }) {
  if (!points.length) return <Empty message="Sem dados no período." next="Quando houver cargas registradas, elas aparecerão neste gráfico." />;
  const values = points.map((item) => Number(item.valor)).filter(Number.isFinite);
  if (!values.length) return <Empty message="Sem dados no período." next="Não há valores registrados para este indicador." />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = points.map((point, index) => ({
    x: 24 + (points.length === 1 ? 0 : (index / (points.length - 1)) * 252),
    y: 118 - ((Number(point.valor) - min) / range) * 88,
  }));
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  return <figure className="tracking-chart">
    <figcaption>{label}</figcaption>
    <svg viewBox="0 0 300 150" role="img" aria-label={`Evolução de ${label}`}>
      <line x1="20" y1="120" x2="282" y2="120" />
      <polyline points={polyline} />
      {coordinates.map((point, index) => <circle key={`${points[index].id}-${index}`} cx={point.x} cy={point.y} r="4"><title>{formatDate(points[index].data)}: {points[index].valor} {points[index].unidade || ""}</title></circle>)}
    </svg>
    <div className="tracking-chart__labels"><span>{formatDate(points[0].data)}</span><span>{formatDate(points[points.length - 1].data)}</span></div>
    <p className="muted-copy">Valores registrados, sem estimativas. {points[points.length - 1].valor} {points[points.length - 1].unidade || ""} no registro mais recente.</p>
  </figure>;
}

export function EvolucaoAlunoPage() {
  const { usuario, dados } = useTrackingData();
  const load = useTrackingLoad("evolucao-aluno");
  const [indicator, setIndicator] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const sessions = (dados.sessoesTreino || []).filter((item) => item.alunoId === usuario.id && item.status === "concluido");
  const loadMetrics = sessions.flatMap((session) => Object.entries(session.registros || {}).flatMap(([exerciseId, sets]) => {
    const exercise = (dados.exercicios || []).find((item) => item.id === exerciseId);
    return Object.entries(sets || {}).filter(([setNumber, values]) => /^\d+$/.test(setNumber) && values.carga !== "" && values.carga !== undefined && Number.isFinite(Number(values.carga)))
      .map(([setNumber, values]) => ({
        id: `${session.id}-${exerciseId}-${setNumber}`,
        nome: `Carga · ${exercise?.nome || exerciseId}`,
        valor: Number(values.carga),
        unidade: "kg",
        data: (session.concluidaEm || session.iniciadaEm || "").slice(0, 10),
        observacao: session.observacao || "",
      }));
  }));
  const metrics = [...loadMetrics]
    .filter((item) => (!indicator || item.nome === indicator) && (!from || item.data >= from) && (!to || item.data <= to))
    .sort((a, b) => a.data.localeCompare(b.data));
  const names = [...new Set(metrics.map((item) => item.nome))];
  const filteredSessions = sessions.filter((item) => (!from || (item.concluidaEm || "").slice(0, 10) >= from) && (!to || (item.concluidaEm || "").slice(0, 10) <= to));
  const loadIndicators = metrics.length;
  return <TrackingScreen title="Minha evolução" description="Consulte seus treinos concluídos e as cargas que você registrou." load={load}>
    <div className="filter-bar tracking-filter"><label className="select-control"><span>Indicador</span><select aria-label="Filtrar indicador" value={indicator} onChange={(event) => setIndicator(event.target.value)}><option value="">Todos</option>{names.map((name) => <option key={name}>{name}</option>)}</select></label><CampoFormulario label="De" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><CampoFormulario label="Até" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
    <div className="tracking-metrics"><Cartao><span className="eyebrow">TREINOS CONCLUÍDOS</span><strong className="tracking-value">{filteredSessions.length}</strong><small>{from || to ? "No período selecionado" : "No histórico disponível"}</small></Cartao><Cartao><span className="eyebrow">REGISTROS DE EVOLUÇÃO</span><strong className="tracking-value">{loadIndicators}</strong><small>Cargas executadas nos treinos</small></Cartao></div>
    <div className="tracking-grid"><Cartao><span className="eyebrow">EVOLUÇÃO DAS CARGAS</span><h2>Cargas registradas</h2><label className="sr-only" htmlFor="student-chart-indicator">Escolher indicador do gráfico</label><select id="student-chart-indicator" value={indicator || names[0] || ""} onChange={(event) => setIndicator(event.target.value)}><option value="">Escolha um indicador</option>{names.map((name) => <option key={name}>{name}</option>)}</select><MiniChart label={indicator || names[0] || "indicador"} points={metrics.filter((item) => !indicator || item.nome === indicator)} /></Cartao>
      <Cartao><span className="eyebrow">CARGAS E COMENTÁRIOS</span><h2>O que foi registrado</h2>{loadMetrics.filter((item) => (!from || item.data >= from) && (!to || item.data <= to)).map((item) => <p className="tracking-record" key={item.id}><strong>{item.nome}</strong>: {item.valor} {item.unidade} · {formatDate(item.data)}{item.observacao ? ` · ${item.observacao}` : ""}</p>)}{!loadMetrics.filter((item) => (!from || item.data >= from) && (!to || item.data <= to)).length && <Empty message="Sem dados no período." next="As cargas registradas nos treinos aparecerão aqui." />}</Cartao>
    </div>
    <Cartao><span className="eyebrow">METAS E ORIENTAÇÕES</span><h2>Meu acompanhamento</h2>{(dados.metas || []).filter((item) => item.alunoId === usuario.id).length ? (dados.metas || []).filter((item) => item.alunoId === usuario.id).map((goal) => <div className="tracking-goal" key={goal.id}><Flag size={17} /><div><strong>{goal.nome || goal.descricao}</strong><p>{goal.comentariosProfessor || "Sem comentário da professora."}</p></div><EtiquetaStatus status={goal.status} /></div>) : <Empty message="Nenhuma meta registrada." next="As metas combinadas com sua professora serão exibidas aqui." />}</Cartao>
    <p className="privacy-note"><ShieldAlert size={16} /> Esta tela mostra apenas seus treinos concluídos, cargas e metas.</p>
  </TrackingScreen>;
}

export function MetasAlunoPage() {
  const { usuario, dados, atualizarDados } = useTrackingData();
  const load = useTrackingLoad("metas-aluno");
  const [form, setForm] = useState({ nome: "", descricao: "", indicador: "", inicio: new Date().toISOString().slice(0, 10), prazo: "" });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const goals = (dados.metas || []).filter((item) => item.alunoId === usuario.id);
  function create(event) {
    event.preventDefault();
    if (form.nome.trim().length < 3 || !form.inicio || !form.prazo || form.prazo < form.inicio) {
      setError("Informe o nome e um prazo igual ou posterior à data de início.");
      return;
    }
    const goal = saveGoalForStudent(form, usuario.id);
    atualizarDados("metas", (items) => [...items, goal]);
    audit(atualizarDados, usuario, "Meta criada", `Meta “${goal.nome}” criada.`, "/aluno/metas");
    setForm({ nome: "", descricao: "", indicador: "", inicio: new Date().toISOString().slice(0, 10), prazo: "" });
    setError("");
    setToast("Meta registrada no seu acompanhamento.");
  }
  function update(goal, changes) {
    const next = updateStudentGoal(goal, changes, usuario.nome);
    atualizarDados("metas", (items) => items.map((item) => item.id === goal.id ? next : item));
    audit(atualizarDados, usuario, "Meta atualizada", `Meta “${goal.nome}”: ${next.status}, ${next.progresso}% de progresso.`, "/aluno/metas");
    setToast(next.status === "concluida" ? "Meta concluída e adicionada ao histórico." : "Progresso atualizado.");
  }
  return <TrackingScreen title="Metas e objetivos" description="Registre objetivos e acompanhe o progresso sem estimar valores." load={load}>
    <Cartao><form className="tracking-form" onSubmit={create}><span className="eyebrow">NOVA META</span><div className="editor-grid"><CampoFormulario label="Nome da meta" value={form.nome} erro={error} onChange={(event) => setForm({ ...form, nome: event.target.value })} /><CampoFormulario label="Indicador de progresso (opcional)" value={form.indicador} onChange={(event) => setForm({ ...form, indicador: event.target.value })} /><CampoFormulario label="Início" type="date" value={form.inicio} onChange={(event) => setForm({ ...form, inicio: event.target.value })} /><CampoFormulario label="Prazo" type="date" value={form.prazo} onChange={(event) => setForm({ ...form, prazo: event.target.value })} /></div><CampoFormulario label="Descrição" value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /><Button type="submit"><Plus size={15} /> Criar meta</Button></form></Cartao>
    <section className="tracking-list"><h2>Minhas metas</h2>{goals.length ? goals.map((goal) => <Cartao className="tracking-goal-card" key={goal.id}><div className="tracking-goal"><Flag size={18} /><div><strong>{goal.nome || goal.descricao}</strong><p>{goal.descricao}</p><small>Início {formatDate(goal.inicio)} · prazo {formatDate(goal.prazo)}{goal.indicador ? ` · ${goal.indicador}` : ""}</small></div><EtiquetaStatus status={goal.status} /></div><label className="progress-edit">Progresso registrado: {goal.progresso || 0}%<input type="range" min="0" max="100" step="5" value={goal.progresso || 0} disabled={goal.status === "concluida"} onChange={(event) => update(goal, { progresso: Number(event.target.value) })} aria-label={`Progresso da meta ${goal.nome || goal.descricao}`} /></label>{goal.comentariosProfessor && <p className="muted-copy">Comentário da professora: {goal.comentariosProfessor}</p>}{goal.concluidaEm && <small>Concluída em {formatDate(goal.concluidaEm)}</small>}</Cartao>) : <Empty message="Você ainda não tem metas." next="Crie uma meta para acompanhar um objetivo combinado." />}</section>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TrackingScreen>;
}

export function QuestionariosAlunoPage() {
  const { usuario, dados, atualizarDados } = useTrackingData();
  const load = useTrackingLoad("questionarios-aluno");
  const [selectedId, setSelectedId] = useState("");
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const forms = (dados.questionarios || []).filter((form) => form.alunoIds.includes(usuario.id));
  const responses = (dados.respostasQuestionarios || []).filter((response) => response.alunoId === usuario.id);
  const selected = forms.find((form) => form.id === selectedId);
  function submit(event) {
    event.preventDefault();
    if (!selected) return;
    if (selected.prazo && selected.prazo < new Date().toISOString().slice(0, 10)) { setError("O prazo deste formulário terminou. Fale com sua professora se precisar de mais tempo."); return; }
    const result = submitQuestionnaireResponse(selected, answers, usuario);
    if (result.error) { setError(result.error); return; }
    atualizarDados("respostasQuestionarios", (items) => [...items, result.response]);
    atualizarDados("questionarios", (items) => items.map((form) => form.id === selected.id ? { ...form, respondidoAlunoIds: [...new Set([...(form.respondidoAlunoIds || []), usuario.id])] } : form));
    atualizarDados("notificacoes", (items) => [...items, { id: `notif-resposta-${result.response.id}`, usuarioId: "prof-1", titulo: "Questionário respondido", mensagem: `${usuario.nome} respondeu a “${selected.titulo}”.`, categoria: "questionarios", relatedTo: "/professor/questionarios", lida: false, data: new Date().toISOString() }]);
    audit(atualizarDados, usuario, "Questionário respondido", `Resposta enviada para “${selected.titulo}”.`, "/aluno/questionarios");
    setSelectedId("");
    setAnswers({});
    setError("");
    setToast("Resposta enviada e registrada no seu histórico.");
  }
  return <TrackingScreen title="Formulários e questionários" description="Responda às solicitações da professora. Campos obrigatórios estão identificados." load={load}>
    {selected ? <Cartao><div className="section-title-row"><div><span className="eyebrow">PRAZO {selected.prazo ? formatDate(selected.prazo) : "NÃO INFORMADO"}</span><h2>{selected.titulo}</h2></div><Button variant="secondary" onClick={() => setSelectedId("")}>Voltar</Button></div><p>{selected.descricao}</p><form className="tracking-form" onSubmit={submit}>{selected.campos.map((field) => <div className="form-field" key={field.id}><label htmlFor={`answer-${field.id}`}>{field.rotulo}{field.obrigatorio && <span aria-label="obrigatório"> *</span>}</label>{field.tipo === "longtext" ? <textarea id={`answer-${field.id}`} aria-required={field.obrigatorio} rows="4" value={answers[field.id] || ""} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} /> : field.tipo === "select" ? <select id={`answer-${field.id}`} aria-required={field.obrigatorio} value={answers[field.id] || ""} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })}><option value="">Selecione uma opção</option><option>Sim</option><option>Não</option><option>Não se aplica</option></select> : <input id={`answer-${field.id}`} aria-required={field.obrigatorio} type={field.tipo === "number" ? "number" : "text"} value={answers[field.id] || ""} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} />}</div>)}{error && <p className="form-field__error" role="alert">{error}</p>}<Button type="submit">Enviar respostas</Button></form></Cartao> : <div className="tracking-grid"><Cartao><span className="eyebrow">AGUARDANDO RESPOSTA</span><h2>Solicitações disponíveis</h2>{forms.filter((form) => !(form.respondidoAlunoIds || []).includes(usuario.id)).length ? forms.filter((form) => !(form.respondidoAlunoIds || []).includes(usuario.id)).map((form) => { const expired = Boolean(form.prazo && form.prazo < new Date().toISOString().slice(0, 10)); return <div className="tracking-row" key={form.id}><FileText size={17} /><span><strong>{form.titulo}</strong><small>{form.descricao} · {expired ? "Prazo encerrado" : `prazo ${formatDate(form.prazo)}`}</small></span><Button disabled={expired} onClick={() => { setSelectedId(form.id); setAnswers({}); }}>{expired ? "Prazo encerrado" : "Responder"}</Button></div>; }) : <Empty message="Nenhum formulário pendente." next="Novos questionários atribuídos pela professora aparecerão aqui." />}</Cartao><Cartao><span className="eyebrow">HISTÓRICO DE RESPOSTAS</span><h2>Enviados</h2>{responses.length ? responses.map((response) => { const form = forms.find((item) => item.id === response.questionarioId); return <details className="tracking-record" key={response.id}><summary><strong>{form?.titulo || "Questionário"}</strong><span>{formatDateTime(response.enviadoEm)}</span></summary>{Object.entries(response.respostas).map(([key, value]) => <p key={key}><strong>{form?.campos.find((field) => field.id === key)?.rotulo || key}:</strong> {value}</p>)}</details>; }) : <Empty message="Nenhuma resposta enviada." next="As respostas ficam registradas aqui após o envio." />}</Cartao></div>}
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TrackingScreen>;
}

export function CheckinAlunoPage() {
  const { usuario, dados, atualizarDados } = useTrackingData();
  const load = useTrackingLoad("checkin-aluno");
  const [form, setForm] = useState({ sessaoId: "", momento: "antes", disposicao: "", esforco: "", desconfortos: "" });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const sessions = (dados.sessoesTreino || []).filter((item) => item.alunoId === usuario.id);
  const hasRisk = /(dor|sintoma|falta de ar|tontura|desmaio)/i.test(form.desconfortos);
  function submit(event) {
    event.preventDefault();
    if (!form.disposicao || !form.esforco) { setError("Informe disposição e esforço para registrar o check-in."); return; }
    const entry = { id: `checkin-${Date.now()}`, alunoId: usuario.id, sessaoId: form.sessaoId || "", momento: form.momento, disposicao: form.disposicao, esforco: form.esforco, desconfortos: form.desconfortos.trim(), data: new Date().toISOString() };
    atualizarDados("checkinsTreino", (items) => [...items, entry]);
    audit(atualizarDados, usuario, "Check-in de treino", `Check-in ${form.momento} registrado.`, "/aluno/check-in");
    setForm({ sessaoId: "", momento: "antes", disposicao: "", esforco: "", desconfortos: "" });
    setError("");
    setToast("Check-in registrado.");
  }
  const checkins = (dados.checkinsTreino || []).filter((item) => item.alunoId === usuario.id).sort((a, b) => b.data.localeCompare(a.data));
  return <TrackingScreen title="Check-in de treino" description="Registre como está se sentindo antes ou depois da sessão. Não é uma avaliação médica." load={load}>
    {hasRisk && <div className="safety-note" role="alert"><ShieldAlert size={18} /><p>Interrompa a atividade se estiver em andamento. Esse registro não oferece diagnóstico; procure avaliação profissional adequada para sintomas preocupantes.</p></div>}
    <Cartao><form className="tracking-form" onSubmit={submit}><div className="editor-grid"><div className="form-field"><label htmlFor="checkin-moment">Momento</label><select id="checkin-moment" value={form.momento} onChange={(event) => setForm({ ...form, momento: event.target.value })}><option value="antes">Antes do treino</option><option value="depois">Depois do treino</option></select></div><div className="form-field"><label htmlFor="checkin-session">Sessão relacionada (opcional)</label><select id="checkin-session" value={form.sessaoId} onChange={(event) => setForm({ ...form, sessaoId: event.target.value })}><option value="">Sem sessão específica</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.planoSnapshot?.nome || "Treino"} · {formatDate(session.iniciadaEm)}</option>)}</select></div><div className="form-field"><label htmlFor="checkin-energy">Disposição *</label><select id="checkin-energy" value={form.disposicao} onChange={(event) => setForm({ ...form, disposicao: event.target.value })}><option value="">Selecione</option><option>Baixa</option><option>Regular</option><option>Boa</option></select></div><div className="form-field"><label htmlFor="checkin-effort">Esforço percebido *</label><select id="checkin-effort" value={form.esforco} onChange={(event) => setForm({ ...form, esforco: event.target.value })}><option value="">Selecione</option><option>Leve</option><option>Moderado</option><option>Intenso</option></select></div></div><div className="form-field"><label htmlFor="checkin-notes">Desconfortos ou observações</label><textarea id="checkin-notes" rows="3" value={form.desconfortos} onChange={(event) => setForm({ ...form, desconfortos: event.target.value })} /></div>{error && <p className="form-field__error" role="alert">{error}</p>}<Button type="submit">Salvar check-in</Button></form></Cartao>
    <Cartao><span className="eyebrow">HISTÓRICO</span><h2>Meus registros</h2>{checkins.length ? checkins.map((item) => <div className="tracking-row" key={item.id}><HeartPulse size={17} /><span><strong>{item.momento === "antes" ? "Antes do treino" : "Depois do treino"} · disposição {item.disposicao}</strong><small>{formatDateTime(item.data)} · esforço {item.esforco}{item.desconfortos ? ` · ${item.desconfortos}` : ""}</small></span></div>) : <Empty message="Nenhum check-in registrado." next="Seu primeiro registro aparecerá aqui." />}</Cartao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TrackingScreen>;
}

export function PagamentosAlunoPage() {
  const { usuario, dados, atualizarDados } = useTrackingData();
  const load = useTrackingLoad("pagamentos-aluno");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("todos");
  const payments = useMemo(() => {
    const existing = (dados.pagamentos || []).filter((item) => item.alunoId === usuario.id);
    const knownBookings = new Set(existing.map((item) => item.agendamentoId));
    const generated = (dados.agendamentos || []).filter((booking) => booking.alunoId === usuario.id && booking.status !== "cancelado" && !knownBookings.has(booking.id)).map((booking) => ({
      id: `pag-${booking.id}`, alunoId: usuario.id, agendamentoId: booking.id, valor: Number(booking.preco || 0), data: booking.data, servico: booking.modalidade || booking.tipo, status: "pendente", comprovante: "",
    }));
    return [...existing, ...generated].filter((item) => filter === "todos" || item.status === filter);
  }, [dados.pagamentos, dados.agendamentos, usuario.id, filter]);
  function pay(payment, resultStatus = "aprovado") {
    // No produto real, só altere o status após confirmação do provedor de pagamento.
    const result = simulatePayment(payment, resultStatus);
    atualizarDados("pagamentos", (items) => items.some((item) => item.id === payment.id) ? items.map((item) => item.id === payment.id ? result : item) : [...items, result]);
    audit(atualizarDados, usuario, "Pagamento simulado", `Pagamento de R$ ${payment.valor.toFixed(2)} ${resultStatus === "aprovado" ? "aprovado" : "falhou"} em simulação.`, "/aluno/pagamentos");
    setToast(resultStatus === "aprovado" ? "Pagamento simulado como aprovado. Nenhum dado de cartão foi solicitado." : "Pagamento simulado como falho. Tente novamente ou procure a professora.");
  }
  return <TrackingScreen title="Pagamentos" description="Histórico demonstrativo. Não informe dados de cartão: nenhuma cobrança real é feita." load={load}>
    <label className="select-control tracking-select"><span>Filtrar pagamentos</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="aprovado">Aprovados</option><option value="falho">Falhos</option></select></label>
    <div className="tracking-list">{payments.length ? payments.map((payment) => <Cartao className="payment-row" key={payment.id}><div><strong>{payment.servico}</strong><small>{formatDate(payment.data)} · R$ {Number(payment.valor).toFixed(2).replace(".", ",")}</small>{payment.comprovante && <small>Comprovante simulado: {payment.comprovante}</small>}</div><EtiquetaStatus status={payment.status} />{payment.status === "pendente" || payment.status === "falho" ? <div className="payment-actions"><Button onClick={() => pay(payment)}>Simular pagamento aprovado</Button><Button variant="secondary" onClick={() => pay(payment, "falho")}>Simular falha</Button></div> : null}</Cartao>) : <Empty message="Nenhuma transação neste filtro." next="Pagamentos associados aos seus atendimentos aparecerão aqui." />}</div>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TrackingScreen>;
}

function ActivityHistory({ profile }) {
  const { usuario, dados } = useTrackingData();
  const load = useTrackingLoad("historico-atividades");
  const entries = (dados.historicoAtividades || []).filter((event) => profile === "professor"
    ? true
    : event.alunoId === usuario.id || (event.perfil === "professor" && event.alunoId === usuario.id));
  function pathFor(event) {
    if (profile === "professor" && event.alunoId && event.relatedTo?.startsWith("/aluno/")) return `/professor/alunos/${event.alunoId}`;
    return event.relatedTo;
  }
  return <TrackingScreen title="Histórico de atividades" description="Registro de alterações no protótipo. Senhas e tokens não são registrados." load={load}>
    <div className="tracking-list">{entries.length ? entries.slice().sort((a, b) => b.data.localeCompare(a.data)).map((event) => <Cartao className="tracking-row" key={event.id}><Activity size={18} /><span><strong>{event.tipo}</strong><small>{formatDateTime(event.data)} · {event.usuarioNome} · {event.resumo}</small></span>{pathFor(event) && <Link className="text-link" to={pathFor(event)}>Abrir registro <ArrowRight size={14} /></Link>}</Cartao>) : <Empty message="Ainda não há eventos de atividade." next="Ações importantes realizadas neste protótipo serão listadas aqui." />}</div>
  </TrackingScreen>;
}

export function HistoricoAlunoPage() {
  return <ActivityHistory profile="aluno" />;
}

export function HistoricoProfessorPage() {
  return <ActivityHistory profile="professor" />;
}

export function AvaliacoesProfessorPage() {
  const { usuario, dados, atualizarDados } = useTrackingData();
  const load = useTrackingLoad("avaliacoes-professor");
  const [studentId, setStudentId] = useState("");
  const [form, setForm] = useState({ data: new Date().toISOString().slice(0, 10), indicator: "", value: "", unit: "", observation: "" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const student = dados.alunos.find((item) => item.id === studentId);
  const evaluations = (dados.avaliacoes || []).filter((item) => !studentId || item.alunoId === studentId).sort((a, b) => b.data.localeCompare(a.data));
  function save(event) {
    event.preventDefault();
    if (!studentId || !form.indicator.trim() || !form.value || !form.data) { setError("Selecione um aluno e informe data, indicador e valor."); return; }
    const numeric = Number(form.value);
    if (!Number.isFinite(numeric)) { setError("O valor do indicador precisa ser numérico."); return; }
    const evaluation = {
      id: `avaliacao-${Date.now()}`, alunoId: studentId, data: form.data,
      indicadores: { [form.indicator.trim()]: { valor: numeric, unidade: form.unit.trim() } },
      observacao: form.observation.trim(), compartilhada: false, criadoPor: usuario.id,
      alteracoes: [],
    };
    atualizarDados("avaliacoes", (items) => [...items, evaluation]);
    audit(atualizarDados, usuario, "Avaliação física", `Avaliação registrada para ${student.nome}: ${form.indicator.trim()}.`, "/professor/avaliacoes", "");
    setForm({ data: new Date().toISOString().slice(0, 10), indicator: "", value: "", unit: "", observation: "" });
    setError("");
    setToast("Avaliação registrada.");
  }
  function correct(evaluation) {
    const oldValue = Object.values(evaluation.indicadores || {})[0]?.valor;
    const replacement = window.prompt("Informe o valor corrigido:", String(oldValue ?? ""));
    if (replacement === null) return;
    if (!replacement.trim() || !Number.isFinite(Number(replacement))) { setError("Informe um valor numérico válido para corrigir."); return; }
    const metricName = Object.keys(evaluation.indicadores || {})[0];
    const updated = { ...evaluation, indicadores: { ...evaluation.indicadores, [metricName]: { ...evaluation.indicadores[metricName], valor: Number(replacement) } }, alteracoes: [...(evaluation.alteracoes || []), { de: oldValue, para: Number(replacement), autor: usuario.nome, data: new Date().toISOString() }] };
    atualizarDados("avaliacoes", (items) => items.map((item) => item.id === evaluation.id ? updated : item));
    audit(atualizarDados, usuario, "Avaliação corrigida", `Indicador ${metricName} corrigido para ${student?.nome || "aluno"}.`, `/professor/alunos/${evaluation.alunoId}`, evaluation.alunoId);
    setToast("Correção registrada no histórico da avaliação.");
  }
  return <TrackingScreen title="Avaliações físicas" description="Registre somente indicadores necessários. As avaliações são visíveis apenas para você." load={load}>
    <Cartao><form className="tracking-form" onSubmit={save}><span className="eyebrow">NOVA AVALIAÇÃO</span><div className="editor-grid"><div className="form-field"><label htmlFor="evaluation-student">Aluno</label><select id="evaluation-student" value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Selecione um aluno</option>{dados.alunos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div><CampoFormulario label="Data" type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} /><CampoFormulario label="Indicador" value={form.indicator} onChange={(event) => setForm({ ...form, indicator: event.target.value })} /><CampoFormulario label="Valor" type="number" step="any" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /><CampoFormulario label="Unidade (opcional)" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></div><div className="form-field"><label htmlFor="evaluation-observation">Observações</label><textarea id="evaluation-observation" rows="3" value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} /></div>{error && <p className="form-field__error" role="alert">{error}</p>}<Button type="submit">Salvar avaliação</Button></form></Cartao>
    <Cartao><span className="eyebrow">HISTÓRICO COMPARATIVO</span><h2>{student?.nome || "Selecione um aluno para filtrar"}</h2>{studentId && <MiniChart label="Indicador selecionado" points={evaluations.flatMap((item) => Object.entries(item.indicadores || {}).map(([name, metric]) => ({ id: item.id, data: item.data, nome: name, valor: metric.valor, unidade: metric.unidade }))).filter((point) => point.nome === form.indicator || !form.indicator).sort((a, b) => a.data.localeCompare(b.data))} />}{evaluations.length ? evaluations.map((item) => <article className="tracking-record" key={item.id}><strong>{formatDate(item.data)} · {dados.alunos.find((person) => person.id === item.alunoId)?.nome}</strong><p>{Object.entries(item.indicadores || {}).map(([name, metric]) => `${name}: ${metric.valor} ${metric.unidade || ""}`).join(" · ") || item.medida}</p><p>{item.observacao || "Sem observações"}</p>{(item.alteracoes || []).map((change, index) => <small key={index}>Correção {change.de} → {change.para} · {formatDateTime(change.data)}</small>)}<Button variant="secondary" onClick={() => correct(item)}>Corrigir valor</Button></article>) : <Empty message="Sem avaliações para exibir." next="Selecione um aluno e registre indicadores para formar o histórico." />}</Cartao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TrackingScreen>;
}

export function RelatoriosProfessorPage() {
  const { dados } = useTrackingData();
  const load = useTrackingLoad("relatorios-professor");
  const [filters, setFilters] = useState({ alunoId: "", inicio: "", fim: "" });
  const report = useMemo(() => summarizeReport(dados, filters), [dados, filters]);
  function exportCsv() {
    const csv = toCsv([
      ["Indicador", "Valor", "Origem", `Intervalo: ${filters.inicio || "início"} a ${filters.fim || "hoje"}`],
      ["Sessões iniciadas", report.startedSessions, "Histórico de sessões de treino", ""],
      ["Treinos concluídos", report.completedSessions, "Histórico de sessões de treino", ""],
      ["Dúvidas recebidas", report.doubtsReceived, "Dúvidas registradas", ""],
      ["Dúvidas respondidas", report.doubtsAnswered, "Mensagens do professor em dúvidas", ""],
      ["Consultas concluídas", report.appointmentsCompleted, "Agendamentos", ""],
      ["Consultas canceladas", report.appointmentsCancelled, "Agendamentos", ""],
      ["Alunos ativos sem treino concluído no intervalo", report.lowActivity.length, "Sessões de treino e cadastro", ""],
    ]);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relatorio-acompanhamento.csv";
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <TrackingScreen title="Relatórios e indicadores" description="Resumo calculado dos dados simulados. O CSV contém métricas agregadas, sem nomes ou e-mails." load={load} actions={<Button onClick={exportCsv}><Download size={15} /> Exportar CSV</Button>}>
    <div className="filter-bar tracking-filter"><label className="select-control"><span>Aluno</span><select value={filters.alunoId} onChange={(event) => setFilters({ ...filters, alunoId: event.target.value })}><option value="">Todos</option>{dados.alunos.map((student) => <option key={student.id} value={student.id}>{student.nome}</option>)}</select></label><CampoFormulario label="De" type="date" value={filters.inicio} onChange={(event) => setFilters({ ...filters, inicio: event.target.value })} /><CampoFormulario label="Até" type="date" value={filters.fim} onChange={(event) => setFilters({ ...filters, fim: event.target.value })} /></div>
    <div className="tracking-metrics">{[["Sessões iniciadas", report.startedSessions], ["Treinos concluídos", report.completedSessions], ["Dúvidas recebidas", report.doubtsReceived], ["Dúvidas respondidas", report.doubtsAnswered], ["Consultas concluídas", report.appointmentsCompleted], ["Consultas canceladas", report.appointmentsCancelled], ["Alunos sem atividade concluída", report.lowActivity.length]].map(([label, value]) => <Cartao key={label}><span className="eyebrow">{label}</span><strong className="tracking-value">{value}</strong></Cartao>)}</div>
    <Cartao><span className="eyebrow">ORIGEM E INTERVALO</span><h2>Como ler este relatório</h2><p>Os totais vêm de sessões, dúvidas, agendamentos e cadastro de alunos mantidos no estado do protótipo.</p><p>Intervalo consultado: {filters.inicio ? formatDate(filters.inicio) : "sem data inicial"} a {filters.fim ? formatDate(filters.fim) : "sem data final"}.</p>{report.lowActivity.length ? <p>Baixa atividade no intervalo: {report.lowActivity.map((student) => student.nome).join(", ")}.</p> : <p className="muted-copy">Nenhum aluno ativo sem treino concluído neste intervalo, ou ainda não há dados suficientes.</p>}</Cartao>
  </TrackingScreen>;
}

export function QuestionariosProfessorPage() {
  const { usuario, dados, atualizarDados } = useTrackingData();
  const load = useTrackingLoad("questionarios-professor");
  const [form, setForm] = useState({ titulo: "", descricao: "", prazo: "", alunoIds: [] });
  const [fields, setFields] = useState([{ rotulo: "", tipo: "text", obrigatorio: true }]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const questionnaires = dados.questionarios || [];
  function publish(event) {
    event.preventDefault();
    if (form.titulo.trim().length < 3 || !form.prazo || form.prazo < new Date().toISOString().slice(0, 10) || !form.alunoIds.length || !fields.length || fields.some((field) => !field.rotulo.trim())) { setError("Informe título, prazo válido, campos e pelo menos um aluno."); return; }
    const questionnaire = createQuestionnaire({ ...form, campos: fields }, usuario);
    atualizarDados("questionarios", (items) => [...items, questionnaire]);
    atualizarDados("notificacoes", (items) => [...items, ...form.alunoIds.map((studentId) => ({ id: `notif-${questionnaire.id}-${studentId}`, usuarioId: studentId, titulo: "Novo formulário disponível", mensagem: `A professora enviou: ${questionnaire.titulo}.`, categoria: "questionarios", relatedTo: "/aluno/questionarios", lida: false, data: new Date().toISOString() }))]);
    audit(atualizarDados, usuario, "Questionário atribuído", `Formulário “${questionnaire.titulo}” atribuído a ${form.alunoIds.length} aluno(s).`, "/professor/questionarios");
    setForm({ titulo: "", descricao: "", prazo: "", alunoIds: [] });
    setFields([{ rotulo: "", tipo: "text", obrigatorio: true }]);
    setError("");
    setToast("Questionário publicado e alunos notificados.");
  }
  return <TrackingScreen title="Formulários e questionários" description="Solicite somente as informações necessárias e atribua prazos claros." load={load}>
    <Cartao><form className="tracking-form" onSubmit={publish}><span className="eyebrow">CRIAR E ATRIBUIR</span><div className="editor-grid"><CampoFormulario label="Título" value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} /><CampoFormulario label="Prazo" type="date" value={form.prazo} onChange={(event) => setForm({ ...form, prazo: event.target.value })} /></div><CampoFormulario label="Descrição" value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /><div className="form-field"><span>Alunos</span><div className="tracking-checklist">{dados.alunos.filter((student) => student.status === "ativo").map((student) => <label key={student.id}><input type="checkbox" checked={form.alunoIds.includes(student.id)} onChange={(event) => setForm({ ...form, alunoIds: event.target.checked ? [...form.alunoIds, student.id] : form.alunoIds.filter((id) => id !== student.id) })} />{student.nome}</label>)}</div></div><div className="tracking-field-list"><div className="section-title-row"><h3>Campos</h3><Button variant="secondary" onClick={() => setFields([...fields, { rotulo: "", tipo: "text", obrigatorio: false }])}><Plus size={14} /> Campo</Button></div>{fields.map((field, index) => <div className="editor-grid tracking-field" key={index}><CampoFormulario label={`Campo ${index + 1}`} value={field.rotulo} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, rotulo: event.target.value } : item))} /><div className="form-field"><label htmlFor={`field-type-${index}`}>Tipo</label><select id={`field-type-${index}`} value={field.tipo} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, tipo: event.target.value } : item))}><option value="text">Resposta curta</option><option value="longtext">Resposta longa</option><option value="number">Número</option><option value="select">Sim / Não</option></select></div><label className="check-control"><input type="checkbox" checked={field.obrigatorio} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, obrigatorio: event.target.checked } : item))} /> Obrigatório</label><Button variant="ghost" disabled={fields.length === 1} onClick={() => setFields(fields.filter((_, i) => i !== index))}>Remover</Button></div>)}</div>{error && <p className="form-field__error" role="alert">{error}</p>}<Button type="submit">Publicar formulário</Button></form></Cartao>
    <Cartao><span className="eyebrow">RESPOSTAS RECEBIDAS</span><h2>Formulários atribuídos</h2>{questionnaires.length ? questionnaires.map((item) => <details className="tracking-record" key={item.id}><summary><strong>{item.titulo}</strong><span>{(item.respostasQuestionarios || dados.respostasQuestionarios || []).filter((response) => response.questionarioId === item.id).length} respostas · prazo {formatDate(item.prazo)}</span></summary><p>{item.descricao}</p>{(dados.respostasQuestionarios || []).filter((response) => response.questionarioId === item.id).map((response) => <div className="tracking-row" key={response.id}><FileText size={16} /><span><strong>{response.alunoNome} · {formatDateTime(response.enviadoEm)}</strong><small>{Object.entries(response.respostas).map(([key, value]) => `${item.campos.find((field) => field.id === key)?.rotulo || key}: ${value}`).join(" · ")}</small></span></div>)}</details>) : <Empty message="Nenhum questionário criado." next="Crie um formulário e atribua a alunos ativos para receber respostas." />}</Cartao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TrackingScreen>;
}

const emptyPlan = { nome: "", descricao: "", servicos: "", preco: "", vigencia: "", modalidades: ["Online"], regras: "", alunoIds: [] };
export function PlanosProfessorPage() {
  const { usuario, dados, atualizarDados } = useTrackingData();
  const load = useTrackingLoad("planos-professor");
  const [form, setForm] = useState(emptyPlan);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const plans = dados.planosServicos || [];
  function save(event) {
    event.preventDefault();
    if (form.nome.trim().length < 3 || !form.servicos.trim() || !form.vigencia.trim() || Number(form.preco) < 0 || !form.alunoIds.length || !form.modalidades.length) { setError("Preencha os campos obrigatórios, modalidade e pelo menos um aluno."); return; }
    const plan = createServicePlan(form);
    atualizarDados("planosServicos", (items) => [...items, plan]);
    atualizarDados("alunos", (items) => items.map((student) => form.alunoIds.includes(student.id) ? { ...student, planoVigenteId: plan.id } : student));
    audit(atualizarDados, usuario, "Plano de serviço cadastrado", `Plano “${plan.nome}” criado para ${form.alunoIds.length} aluno(s).`, "/professor/planos");
    setForm(emptyPlan);
    setError("");
    setToast("Plano cadastrado. Nenhuma cobrança foi criada.");
  }
  return <TrackingScreen title="Planos e serviços" description="Cadastro demonstrativo sem cobrança recorrente. Um novo preço não altera o plano já vinculado." load={load}>
    <Cartao><form className="tracking-form" onSubmit={save}><span className="eyebrow">CADASTRAR PLANO</span><div className="editor-grid"><CampoFormulario label="Nome do plano" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /><CampoFormulario label="Preço (R$)" type="number" min="0" step="0.01" value={form.preco} onChange={(event) => setForm({ ...form, preco: event.target.value })} /><CampoFormulario label="Vigência" value={form.vigencia} onChange={(event) => setForm({ ...form, vigencia: event.target.value })} placeholder="Ex.: 3 meses" /><CampoFormulario label="Serviços incluídos (separados por vírgula)" value={form.servicos} onChange={(event) => setForm({ ...form, servicos: event.target.value })} /></div><CampoFormulario label="Descrição" value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /><CampoFormulario label="Regras de renovação e cancelamento" value={form.regras} onChange={(event) => setForm({ ...form, regras: event.target.value })} /><div className="tracking-checklist">{["Online", "Presencial"].map((mode) => <label key={mode}><input type="checkbox" checked={form.modalidades.includes(mode)} onChange={(event) => setForm({ ...form, modalidades: event.target.checked ? [...form.modalidades, mode] : form.modalidades.filter((item) => item !== mode) })} />{mode}</label>)}</div><div className="form-field"><span>Vincular alunos</span><div className="tracking-checklist">{dados.alunos.filter((student) => student.status === "ativo").map((student) => <label key={student.id}><input type="checkbox" checked={form.alunoIds.includes(student.id)} onChange={(event) => setForm({ ...form, alunoIds: event.target.checked ? [...form.alunoIds, student.id] : form.alunoIds.filter((id) => id !== student.id) })} />{student.nome}</label>)}</div></div>{error && <p className="form-field__error" role="alert">{error}</p>}<Button type="submit">Salvar plano</Button></form></Cartao>
    <section className="tracking-list"><h2>Planos cadastrados</h2>{plans.length ? plans.map((plan) => <Cartao className="tracking-plan" key={plan.id}><strong>{plan.nome}</strong><p>{plan.descricao}</p><p>{plan.servicos.join(" · ")} · {plan.modalidades.join(" / ")}</p><p>R$ {plan.preco.toFixed(2).replace(".", ",")} · {plan.vigencia}</p><small>Alunos: {plan.alunoIds.map((id) => dados.alunos.find((student) => student.id === id)?.nome).filter(Boolean).join(", ")}</small><p className="muted-copy">{plan.regras}</p></Cartao>) : <Empty message="Nenhum plano cadastrado." next="Cadastre um plano de serviço para vincular a alunos." />}</section>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </TrackingScreen>;
}
