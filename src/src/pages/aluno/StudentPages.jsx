import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Dumbbell, FileText, Heart, ImagePlus,
  Play, Plus, Search, ShieldAlert, SlidersHorizontal, Star, Video,
} from "lucide-react";
import Button from "../../components/Button";
import Cartao from "../../components/Card";
import EstadoVazio from "../../components/EmptyState";
import MensagemErro from "../../components/ErrorMessage";
import Carregando from "../../components/Loading";
import CampoFormulario from "../../components/FormField";
import EtiquetaStatus from "../../components/StatusTag";
import ModalConfirmacao from "../../components/ConfirmModal";
import Toast from "../../components/Toast";
import { useApp } from "../../context/AppContext";
import { getPageContent } from "../../services/dataService";
import { addAuditEvent } from "../../services/trackingService";
import {
  buildDashboard, completeTrainingSession, createBooking, createDoubt,
  createTrainingSession, getAvailableSlots, getStudentBookings, getStudentDoubt,
  getStudentDoubts, getStudentExercises, getStudentLesson, getStudentLessons,
  getStudentNotificationPreferences, getStudentNotifications, getStudentProfile,
  getStudentTrainingHistory, getStudentTrainings, getTrainingDetail, replyToDoubt,
  saveStudentProfile, updateBookingStatus,
} from "../../services/studentService";

function usePageLoad() {
  const [state, setState] = useState({ loading: true, error: false });
  const retry = useCallback(() => {
    setState({ loading: true, error: false });
    getPageContent("area-aluno")
      .then(() => setState({ loading: false, error: false }))
      .catch(() => setState({ loading: false, error: true }));
  }, []);
  useEffect(() => retry(), [retry]);
  return { ...state, retry };
}

function Screen({ title, description, children, load, empty, actions }) {
  const localLoad = usePageLoad();
  const page = load || localLoad;
  return (
    <div className="page-content student-page">
      <header className="page-heading">
        <div><span className="eyebrow">MOVIMENTO / ÁREA DO ALUNO</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
        {actions && <div className="page-heading__actions">{actions}</div>}
      </header>
      {page.loading ? <Carregando /> : page.error ? <MensagemErro mensagem="Não foi possível carregar esta tela. Tente novamente." tentarNovamente={page.retry} /> : empty ? <EstadoVazio mensagem={empty.mensagem} proximoPasso={empty.proximoPasso} acao={empty.acao} /> : children}
    </div>
  );
}

function dateLabel(value, options = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!value) return "Data não definida";
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function statusForSession(status) {
  if (status === "ativo") return "disponivel";
  return status || "disponivel";
}

function updateItem(items, id, transform) {
  return items.map((item) => item.id === id ? transform(item) : item);
}

function useStudentData() {
  const context = useApp();
  const student = context.usuario;
  return { ...context, student };
}

function recordStudentActivity(updateData, student, type, summary, relatedTo) {
  updateData("historicoAtividades", (items) => addAuditEvent(items || [], {
    usuarioId: student.id,
    usuarioNome: student.nome,
    perfil: "aluno",
    alunoId: student.id,
    tipo: type,
    resumo: summary,
    relatedTo,
  }));
}

export function AlunoInicioPage() {
  const { student, dados } = useStudentData();
  const dashboard = buildDashboard(dados, student.id);
  const welcomeName = student.nome.split(" ")[0];
  return (
    <Screen title={`Olá, ${welcomeName}`} description="Seu acompanhamento, organizado para o próximo passo.">
      <div className="student-dashboard">
        {dashboard.training ? (
          <Cartao className="dashboard-feature">
            <div className="dashboard-feature__copy"><span className="eyebrow">MEU TREINO DE HOJE</span><h2>{dashboard.training.nome}</h2><p>{dashboard.training.objetivo || "Seu treino está pronto para começar."}</p><div className="meta-line"><span><Clock3 size={15} />{dashboard.training.duracao || 45} min</span><span><Dumbbell size={15} />{dashboard.training.exercicios.length} exercícios</span></div><Link className="button button--primary" to={`/aluno/treinos/${dashboard.training.id}`}>{dashboard.training.andamento ? "Continuar treino" : "Começar treino"} <ArrowRight size={16} /></Link></div>
            <div className="feature-art" aria-hidden="true"><Dumbbell size={58} strokeWidth={1.2} /><span>01</span></div>
          </Cartao>
        ) : <Cartao className="dashboard-empty"><Dumbbell size={22} /><div><h2>Nenhum treino disponível</h2><p>Peça à professora para compartilhar seu próximo plano de treino.</p></div><Link to="/aluno/treinos" className="text-link">Ver meus treinos <ArrowRight size={15} /></Link></Cartao>}

        <div className="dashboard-grid">
          <Cartao className="dashboard-next">
            <div className="card-title-row"><span className="dashboard-icon"><CalendarDays size={17} /></span><span className="eyebrow">PRÓXIMO ATENDIMENTO</span></div>
            {dashboard.booking ? <><h2>{dateLabel(dashboard.booking.data, { weekday: "long", day: "numeric", month: "long" })}</h2><p className="booking-time">{dashboard.booking.horario} <span>·</span> {dashboard.booking.modalidade || dashboard.booking.tipo}</p>            <EtiquetaStatus status={dashboard.booking.status === "confirmado" ? "confirmado" : "pendente"} /><Link className="card-link" to="/aluno/agendamentos">Ver agenda <ArrowRight size={14} /></Link></> : <div className="compact-empty"><p>Você ainda não tem atendimento agendado.</p><Link className="text-link" to="/aluno/agendamentos/novo">Escolher horário <ArrowRight size={14} /></Link></div>}
          </Cartao>
          <Cartao className="dashboard-progress">
            <div className="card-title-row"><span className="dashboard-icon dashboard-icon--gold"><Star size={17} /></span><span className="eyebrow">SEU PROGRESSO</span></div>
            <div className="progress-number">{dashboard.attendance.completed}<span> sessões concluídas</span></div>
            <div className="progress-track" role="progressbar" aria-valuenow={dashboard.progress} aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de treinos concluídos"><span style={{ width: `${dashboard.progress}%` }} /></div>
            <p>{dashboard.progress ? `${dashboard.progress}% das sessões iniciadas foram concluídas.` : "Conclua seu primeiro treino para acompanhar sua evolução."}</p>
            <Link className="card-link" to="/aluno/treinos?filtro=historico">Ver histórico <ArrowRight size={14} /></Link>
          </Cartao>
        </div>

        <div className="dashboard-grid dashboard-grid--bottom">
          <Cartao className="dashboard-recent">
            <div className="section-title-row"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Avisos e respostas</h2></div><Link className="text-link" to="/aluno/notificacoes">Ver todos <ArrowRight size={14} /></Link></div>
            {dashboard.recentReplies.length ? dashboard.recentReplies.slice(0, 2).map((doubt) => <Link className="recent-row" key={doubt.id} to={`/aluno/duvidas/${doubt.id}`}><span className="recent-dot recent-dot--reply"><CircleHelp size={15} /></span><span><strong>Nova resposta: {doubt.assunto}</strong><small>{dateLabel(doubt.data)}</small></span><ArrowRight size={15} /></Link>) : null}
            {dashboard.recentNotifications.slice(0, 2).map((item) => <Link className="recent-row" key={item.id} to={item.relatedTo || "/aluno/notificacoes"}><span className="recent-dot"><Bell size={15} /></span><span><strong>{item.titulo}</strong><small>{item.mensagem}</small></span><ArrowRight size={15} /></Link>)}
            {!dashboard.recentReplies.length && !dashboard.recentNotifications.length && <p className="muted-copy">Nenhum aviso recente. Novidades aparecerão aqui.</p>}
          </Cartao>
          <Cartao className="dashboard-shortcuts">
            <span className="eyebrow">ATALHOS</span><h2>O que você precisa?</h2>
            <div className="shortcut-list">
              <Link to="/aluno/duvidas/nova"><span><CircleHelp size={17} /></span><strong>Enviar uma dúvida</strong><ArrowRight size={15} /></Link>
              <Link to="/aluno/aulas"><span><Video size={17} /></span><strong>Assistir às aulas</strong><ArrowRight size={15} /></Link>
              <Link to="/aluno/agendamentos/novo"><span><CalendarDays size={17} /></span><strong>Agendar atendimento</strong><ArrowRight size={15} /></Link>
            </div>
          </Cartao>
        </div>
      </div>
    </Screen>
  );
}

export function MeusTreinosPage() {
  const { student, dados } = useStudentData();
  const [searchParams, setSearchParams] = useSearchParams();
  const historical = searchParams.get("filtro") === "historico";
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const trains = getStudentTrainings(dados, student.id);
  const history = getStudentTrainingHistory(dados, student.id);
  const filtered = trains.filter((item) => {
    const matchesText = `${item.nome} ${item.objetivo || ""} ${item.equipamentos?.join(" ") || ""}`.toLowerCase().includes(busca.toLowerCase());
    return matchesText && (filtro === "todos" || item.estado === filtro);
  });
  const load = usePageLoad();
  return <Screen title={historical ? "Histórico de treinos" : "Meus treinos"} description={historical ? "Sessões concluídas salvas no seu acompanhamento." : "Planos, andamento e histórico do seu treinamento."} load={load} empty={historical ? !history.length ? { mensagem: "Você ainda não concluiu sessões de treino.", proximoPasso: "Ao finalizar um treino, a sessão ficará disponível neste histórico.", acao: <Button variant="secondary" onClick={() => setSearchParams({})}>Ver treinos disponíveis</Button> } : null : !trains.length ? { mensagem: "Sua professora ainda não disponibilizou um treino.", proximoPasso: "Converse com ela para combinar seu próximo plano." } : null} actions={<Button variant="secondary" onClick={() => setSearchParams(historical ? {} : { filtro: "historico" })}>{historical ? "Voltar aos treinos" : "Histórico"}</Button>}>
      {!historical ? <>
        <div className="filter-bar"><label className="search-control"><Search size={17} /><input aria-label="Buscar treinos" placeholder="Buscar treino ou equipamento" value={busca} onChange={(event) => setBusca(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={16} /><span className="sr-only">Filtrar treinos</span><select value={filtro} onChange={(event) => setFiltro(event.target.value)}><option value="todos">Todos os status</option><option value="disponivel">Disponíveis</option><option value="em andamento">Em andamento</option><option value="concluido">Concluídos</option><option value="expirado">Expirados</option></select></label></div>
        {filtered.length ? <div className="training-list">{filtered.map((item) => <Cartao className="training-card" key={item.id}><div className="training-card__icon"><Dumbbell size={21} /></div><div className="training-card__main"><div className="training-card__title"><h2>{item.nome}</h2><EtiquetaStatus status={statusForSession(item.estado)} /></div><p>{item.objetivo}</p><div className="meta-line"><span>{item.dia || item.frequencia}</span><span><Clock3 size={14} />{item.duracao || 45} min</span><span><Dumbbell size={14} />{item.equipamentos?.join(", ") || "Peso corporal"}</span></div></div><Link className="button button--secondary training-card__action" to={`/aluno/treinos/${item.id}`}>{item.andamento ? "Continuar" : "Acessar treino"} <ArrowRight size={15} /></Link></Cartao>)}</div> : <EstadoVazio mensagem={trains.length ? "Nenhum treino encontrado." : "Sua professora ainda não disponibilizou um treino."} proximoPasso={trains.length ? "Tente outra busca ou escolha um filtro diferente." : "Converse com ela para combinar seu próximo plano."} />}
      </> : <div className="training-list">{history.map((item) => {
        const snapshot = item.planoSnapshot || {};
        return <Cartao className="history-row" key={item.id}><span className="training-card__icon"><CheckCircle2 size={20} /></span><div><strong>{snapshot.nome || "Treino concluído"}</strong><p>{dateLabel(item.concluidaEm || item.iniciadaEm)} · {snapshot.duracao || 45} min</p><small>{Object.keys(item.registros || {}).length} exercícios registrados · Planejamento preservado</small></div><EtiquetaStatus status="concluido" /></Cartao>;
      })}</div>}
    </Screen>;
}

export function ExerciciosPage() {
  const { student, dados } = useStudentData();
  const [busca, setBusca] = useState("");
  const exercises = getStudentExercises(dados, student.id);
  const filtered = exercises.filter((item) => `${item.nome} ${item.grupo} ${item.equipamento}`.toLowerCase().includes(busca.toLowerCase()));
  const load = usePageLoad();
  return <Screen title="Exercícios" description="Movimentos dos treinos compartilhados com você." load={load} empty={!exercises.length ? { mensagem: "Ainda não há exercícios nos seus treinos.", proximoPasso: "Quando sua professora disponibilizar um plano, os movimentos aparecerão aqui." } : null}>
    <div className="filter-bar"><label className="search-control"><Search size={17} /><input aria-label="Buscar exercícios" placeholder="Buscar por exercício, grupo ou material" value={busca} onChange={(event) => setBusca(event.target.value)} /></label></div>
    {filtered.length ? <div className="exercise-library">{filtered.map((item) => <Cartao className="exercise-library__item" key={item.id}><span className="dashboard-icon"><Dumbbell size={17} /></span><span><strong>{item.nome}</strong><small>{item.grupo} · {item.equipamento}</small></span></Cartao>)}</div> : <EstadoVazio mensagem="Nenhum exercício encontrado." proximoPasso="Tente buscar por outro nome, grupo muscular ou equipamento." />}
  </Screen>;
}

export function TreinoDetalhePage() {
  const { treinoId } = useParams();
  const { student, dados, atualizarDados } = useStudentData();
  const plan = getTrainingDetail(dados, student.id, treinoId);
  const [session, setSession] = useState(plan?.andamento || plan?.sessaoConcluida || null);
  const [toast, setToast] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [avaliacao, setAvaliacao] = useState("");
  const load = usePageLoad();
  useEffect(() => {
    if (plan?.andamento) setSession(plan.andamento);
    else if (plan?.sessaoConcluida) setSession(plan.sessaoConcluida);
  }, [plan?.andamento?.id, plan?.sessaoConcluida?.id]);

  function saveSession(next) {
    setSession(next);
    atualizarDados("sessoesTreino", (items) => {
      const existing = items.findIndex((item) => item.id === next.id);
      return existing < 0 ? [...items, next] : updateItem(items, next.id, () => next);
    });
  }
  function start() {
    if (!plan) return;
    saveSession(createTrainingSession(plan, student.id, session));
  }
  function setRegister(exerciseId, setNumber, key, value) {
    const current = session || createTrainingSession(plan, student.id, null);
    const registros = { ...(current.registros || {}), [exerciseId]: { ...(current.registros?.[exerciseId] || {}), [setNumber]: { ...(current.registros?.[exerciseId]?.[setNumber] || {}), [key]: value } } };
    saveSession({ ...current, registros });
  }
  function completeExercise(exerciseId) {
    const current = session || createTrainingSession(plan, student.id, null);
    saveSession({ ...current, exerciciosConcluidos: [...new Set([...(current.exerciciosConcluidos || []), exerciseId])], registros: { ...(current.registros || {}), [exerciseId]: { ...(current.registros?.[exerciseId] || {}), concluido: true } } });
  }
  function finalize() {
    if (!session) return;
    const done = completeTrainingSession(session, { avaliacao, observacao: session.observacao || "" });
    saveSession(done);
    recordStudentActivity(atualizarDados, student, "Treino concluído", `Sessão “${plan.nome}” concluída e adicionada ao histórico.`, "/aluno/treinos?filtro=historico");
    setFinalizando(false);
    setToast("Treino concluído e salvo no seu histórico.");
  }

  if (!plan) return <Screen title="Treino" load={load} empty={{ mensagem: "Não encontramos este treino na sua área.", proximoPasso: "Volte para seus treinos para escolher um plano disponível.", acao: <Link className="button button--secondary" to="/aluno/treinos">Ver meus treinos</Link> }} />;
  const completed = session?.status === "concluido";
  const started = Boolean(session);
  return (
    <Screen title={plan.nome} description={`${plan.objetivo} · ${plan.duracao} minutos`} load={load} actions={<Link className="button button--secondary" to="/aluno/treinos"><ArrowLeft size={15} /> Meus treinos</Link>}>
      <div className="training-detail">
        <Cartao className="training-plan-summary"><div><span className="eyebrow">PLANO DA PROFESSORA · {plan.frequencia}</span><h2>Seu treino, no seu ritmo</h2><p>As orientações planejadas permanecem separadas do que você registrar durante a atividade.</p></div><EtiquetaStatus status={completed ? "concluido" : started ? "pendente" : "disponivel"} /></Cartao>
        {!started && <div className="start-panel"><div><h2>Pronto para começar?</h2><p>Separe os materiais indicados e faça os exercícios com conforto.</p></div><Button onClick={start}><Play size={16} /> Iniciar treino</Button></div>}
        {started && !completed && <div className="safety-note" role="note"><ShieldAlert size={19} /><p><strong>Cuide do seu bem-estar.</strong> Interrompa a atividade e busque orientação da professora ou de um profissional de saúde se sentir dor ou algum sintoma preocupante.</p></div>}
        <div className="exercise-list">{plan.exercicios.map((exercise) => {
          const exerciseDone = session?.exerciciosConcluidos?.includes(exercise.id) || session?.registros?.[exercise.id]?.concluido;
          return <Cartao className="exercise-card" key={exercise.id}><div className="exercise-card__header"><span className="exercise-number">{String(exercise.ordem).padStart(2, "0")}</span><div><h3>{exercise.nome}</h3><p>{exercise.grupo} · {exercise.equipamento}</p></div>{exerciseDone && <span className="exercise-done"><CheckCircle2 size={17} /> Concluído</span>}</div><div className="exercise-demonstration"><span><Video size={19} /></span><p>Vídeo demonstrativo<br /><small>Exemplo visual do movimento</small></p><Button variant="secondary" disabled aria-label={`Demonstração de ${exercise.nome} indisponível nesta etapa`}>Prévia</Button></div><p className="exercise-instruction">{exercise.instrucoes}</p><div className="exercise-prescription"><span><small>Séries</small><strong>{exercise.series}</strong></span><span><small>Repetições</small><strong>{exercise.repeticoes}</strong></span><span><small>Descanso</small><strong>{exercise.descanso}</strong></span><span><small>Carga planejada</small><strong>{exercise.carga}</strong></span></div>
            {started && !completed && <div className="set-register"><h4>Registro realizado</h4>{Array.from({ length: exercise.series }, (_, index) => { const set = session?.registros?.[exercise.id]?.[index] || {}; return <div className="set-register__row" key={index}><span>Série {index + 1}</span><label>Carga<input aria-label={`Carga da série ${index + 1} de ${exercise.nome}`} value={set.carga || ""} placeholder="kg" onChange={(event) => setRegister(exercise.id, index, "carga", event.target.value)} /></label><label>Repetições<input aria-label={`Repetições da série ${index + 1} de ${exercise.nome}`} inputMode="numeric" value={set.repeticoes || ""} placeholder="nº" onChange={(event) => setRegister(exercise.id, index, "repeticoes", event.target.value)} /></label><label className="check-control"><input type="checkbox" checked={Boolean(set.concluida)} onChange={(event) => setRegister(exercise.id, index, "concluida", event.target.checked)} /> Série concluída</label></div>; })}<Button variant={exerciseDone ? "secondary" : "primary"} onClick={() => completeExercise(exercise.id)}>{exerciseDone ? "Exercício concluído" : "Marcar exercício como concluído"}</Button></div>}
          </Cartao>;
        })}</div>
        {started && <Cartao className="training-notes"><label htmlFor="training-note">Observação (opcional)</label><textarea id="training-note" value={session?.observacao || ""} disabled={completed} onChange={(event) => saveSession({ ...session, observacao: event.target.value })} placeholder="Como você se sentiu durante o treino?" /><p>Seu progresso parcial é salvo automaticamente neste navegador.</p>{completed ? <div className="completion-summary"><CheckCircle2 size={18} /> Sessão concluída {session.avaliacao ? `· Avaliação: ${session.avaliacao}` : ""}</div> : <><label htmlFor="training-rating">Avaliação final (opcional)</label><select id="training-rating" value={avaliacao} onChange={(event) => setAvaliacao(event.target.value)}><option value="">Escolha uma avaliação</option><option>Leve</option><option>Na medida</option><option>Desafiador</option></select><Button onClick={() => setFinalizando(true)}>Finalizar treino</Button></>}</Cartao>}
      </div>
      <ModalConfirmacao aberto={finalizando} titulo="Finalizar treino?" mensagem="Ao confirmar, esta sessão será salva no histórico como concluída. Os exercícios planejados não serão alterados." confirmarTexto="Finalizar treino" aoFechar={() => setFinalizando(false)} aoConfirmar={finalize} />
      <Toast mensagem={toast} fechar={() => setToast("")} />
    </Screen>
  );
}

export function AulasPage() {
  const { student, dados, atualizarDados } = useStudentData();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [soFavoritos, setSoFavoritos] = useState(false);
  const lessons = getStudentLessons(dados, student.id);
  const categories = ["Todas", ...new Set(lessons.map((item) => item.categoria))];
  const filtered = lessons.filter((lesson) => (categoria === "Todas" || lesson.categoria === categoria) && (!soFavoritos || lesson.favorita) && `${lesson.titulo} ${lesson.descricao}`.toLowerCase().includes(busca.toLowerCase()));
  const load = usePageLoad();
  function toggleFavorite(id) {
    atualizarDados("favoritosAula", (items) => items.some((item) => item.alunoId === student.id && item.aulaId === id) ? items.filter((item) => !(item.alunoId === student.id && item.aulaId === id)) : [...items, { alunoId: student.id, aulaId: id }]);
  }
  return <Screen title="Aulas gravadas" description="Conteúdos escolhidos para acompanhar seu treinamento." load={load} empty={!lessons.length ? { mensagem: "Ainda não há aulas disponíveis para você.", proximoPasso: "Sua professora poderá compartilhar conteúdos com você por aqui." } : null}>
    <div className="filter-bar"><label className="search-control"><Search size={17} /><input aria-label="Buscar aulas" placeholder="Buscar uma aula" value={busca} onChange={(event) => setBusca(event.target.value)} /></label><label className="select-control"><SlidersHorizontal size={16} /><span className="sr-only">Filtrar por categoria</span><select value={categoria} onChange={(event) => setCategoria(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><Button variant={soFavoritos ? "primary" : "secondary"} onClick={() => setSoFavoritos((value) => !value)}><Heart size={15} /> Favoritas</Button></div>
    {filtered.length ? <div className="lesson-grid">{filtered.map((lesson) => <article className="lesson-card" key={lesson.id}><div className="lesson-thumbnail"><Video size={26} /><span>{lesson.duracao} min</span><button className={`favorite-button${lesson.favorita ? " is-favorite" : ""}`} onClick={() => toggleFavorite(lesson.id)} aria-label={lesson.favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"}><Heart size={17} fill={lesson.favorita ? "currentColor" : "none"} /></button>{lesson.nova && <span className="new-badge">Novo</span>}</div><div className="lesson-card__body"><div className="lesson-card__meta"><span>{lesson.categoria}</span>{lesson.concluida && <span className="complete-label"><Check size={13} /> Concluída</span>}</div><h2>{lesson.titulo}</h2><p>{lesson.descricao}</p><Link to={`/aluno/aulas/${lesson.id}`} className="text-link">{lesson.concluida ? "Assistir novamente" : "Ver aula"} <ArrowRight size={15} /></Link></div></article>)}</div> : <EstadoVazio mensagem="Nenhuma aula corresponde a esta busca." proximoPasso="Tente mudar a categoria ou remover o filtro de favoritas." />}
  </Screen>;
}

export function AulaDetalhePage() {
  const { aulaId } = useParams();
  const { student, dados, atualizarDados } = useStudentData();
  const lesson = getStudentLesson(dados, student.id, aulaId);
  const [videoError, setVideoError] = useState(false);
  const [toast, setToast] = useState("");
  const load = usePageLoad();
  if (!lesson) return <Screen title="Aula" load={load} empty={{ mensagem: "Esta aula não está disponível para sua conta.", proximoPasso: "Volte à biblioteca para ver os conteúdos compartilhados com você.", acao: <Link className="button button--secondary" to="/aluno/aulas">Ver aulas</Link> }} />;
  function markComplete() {
    if (lesson.concluida) return;
    atualizarDados("aulasConcluidas", (items) => [...items, { alunoId: student.id, aulaId: lesson.id, concluidaEm: new Date().toISOString() }]);
    setToast("Aula marcada como concluída.");
  }
  const related = (lesson.relacionada || []).map((id) => getStudentLesson(dados, student.id, id)).filter(Boolean);
  return <Screen title={lesson.titulo} description={lesson.categoria} load={load} actions={<Link className="button button--secondary" to="/aluno/aulas"><ArrowLeft size={15} /> Biblioteca</Link>}>
    <div className="lesson-detail">
      <div className="video-player">{videoError ? <div className="video-fallback"><Video size={28} /><h2>Não foi possível reproduzir esta aula.</h2><p>Verifique sua conexão e tente novamente. Se o problema continuar, atualize a página ou fale com sua professora.</p><Button variant="secondary" onClick={() => setVideoError(false)}>Tentar novamente</Button></div> : <><iframe title={`Aula: ${lesson.titulo}`} src={lesson.videoUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen onError={() => setVideoError(true)} /><button className="video-failure-link" onClick={() => setVideoError(true)}>O vídeo não carregou?</button></>}</div>
      <div className="lesson-detail__columns"><div><Cartao><span className="eyebrow">SOBRE A AULA</span><h2>{lesson.titulo}</h2><p>{lesson.descricao}</p><h3>Objetivos</h3><p>{lesson.objetivo}</p><div className="meta-line"><span><Clock3 size={14} />{lesson.duracao} minutos</span><span>{lesson.categoria}</span></div><Button onClick={markComplete} disabled={lesson.concluida}>{lesson.concluida ? <><CheckCircle2 size={16} /> Aula concluída</> : "Marcar como concluída"}</Button></Cartao></div>
        <div className="lesson-side"><Cartao><span className="eyebrow">MATERIAIS</span>{lesson.materiais.length ? lesson.materiais.map((item) => <p className="material-row" key={item}><Dumbbell size={15} /> {item}</p>) : <p className="muted-copy">Não são necessários materiais.</p>}</Cartao>{related.length > 0 && <Cartao><span className="eyebrow">AULAS RELACIONADAS</span>{related.map((item) => <Link className="related-lesson" key={item.id} to={`/aluno/aulas/${item.id}`}><span>{item.titulo}<small>{item.duracao} min · {item.categoria}</small></span><ArrowRight size={15} /></Link>)}</Cartao>}</div>
      </div>
    </div><Toast mensagem={toast} fechar={() => setToast("")} />
  </Screen>;
}

export function DuvidasPage() {
  const { student, dados } = useStudentData();
  const [filtro, setFiltro] = useState("todas");
  const doubts = getStudentDoubts(dados, student.id);
  const visible = doubts.filter((item) => filtro === "todas" || (filtro === "pendentes" && item.status === "pendente") || (filtro === "respondidas" && item.status === "respondida") || (filtro === "resolvidas" && item.status === "resolvida"));
  const load = usePageLoad();
  const labels = { pendente: "Pendente", respondida: "Respondida", resolvida: "Resolvida" };
  return <Screen title="Minhas dúvidas" description="Converse com sua professora sobre o acompanhamento." load={load} actions={<Link className="button button--primary" to="/aluno/duvidas/nova"><Plus size={16} /> Nova dúvida</Link>}>
    <div className="notice-banner"><ShieldAlert size={17} /><p>Este canal não é um serviço de emergência. Em caso de urgência, procure atendimento adequado.</p></div>
    <div className="tab-filters" role="group" aria-label="Filtrar dúvidas">{[["todas", "Todas"], ["pendentes", "Pendentes"], ["respondidas", "Respondidas"], ["resolvidas", "Resolvidas"]].map(([value, label]) => <button key={value} className={filtro === value ? "is-active" : ""} onClick={() => setFiltro(value)}>{label}</button>)}</div>
    {visible.length ? <div className="doubt-list">{visible.map((item) => <Link className="doubt-row" key={item.id} to={`/aluno/duvidas/${item.id}`}><span className="doubt-row__icon"><CircleHelp size={18} /></span><span className="doubt-row__main"><strong>{item.assunto}{item.respostaNova && <span className="new-dot" aria-label="Resposta nova" />}</strong><small>{item.categoria} · {dateLabel(item.data)} · {(item.mensagens || []).length} mensagens</small></span><EtiquetaStatus status={item.status} /><ArrowRight size={16} /></Link>)}</div> : <EstadoVazio mensagem={doubts.length ? "Não há dúvidas nesta categoria." : "Você ainda não enviou dúvidas."} proximoPasso="Se tiver uma pergunta sobre seu treino, envie uma mensagem para sua professora." />}
  </Screen>;
}

const allowedAttachmentTypes = ["image/jpeg", "image/png", "application/pdf", "video/mp4"];
const allowedExtensions = /\.(jpe?g|png|pdf|mp4)$/i;
const maxAttachmentBytes = 10 * 1024 * 1024;

export function NovaDuvidaPage() {
  const { student, atualizarDados } = useStudentData();
  const navigate = useNavigate();
  const [form, setForm] = useState({ assunto: "", categoria: "", descricao: "" });
  const [attachments, setAttachments] = useState([]);
  const attachmentUrls = useRef([]);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const load = usePageLoad();
  function addFiles(event) {
    const files = Array.from(event.target.files || []);
    const rejected = [];
    const accepted = [];
    files.forEach((file) => {
      const allowedType = file.type ? allowedAttachmentTypes.includes(file.type) : allowedExtensions.test(file.name);
      if (!allowedType || file.name.toLowerCase().match(/\.(exe|bat|cmd|com|msi|sh|js|jar|ps1)$/)) rejected.push(`${file.name}: formato não autorizado`);
      else if (file.size > maxAttachmentBytes) rejected.push(`${file.name}: maior que 10 MB`);
      else if (attachments.some((item) => item.nome === file.name) || accepted.some((item) => item.nome === file.name)) rejected.push(`${file.name}: este arquivo já foi adicionado`);
      else if (attachments.length + accepted.length >= 5) rejected.push(`${file.name}: limite de 5 arquivos por dúvida`);
      else accepted.push({ file, nome: file.name, tipo: file.type, tamanho: file.size, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "" });
    });
    accepted.forEach((item) => { if (item.url) attachmentUrls.current.push(item.url); });
    setAttachments((items) => [...items, ...accepted]);
    setErrors((current) => ({ ...current, anexos: rejected.length ? rejected.join(". ") : "" }));
    event.target.value = "";
  }
  function removeFile(name) {
    setAttachments((items) => {
      const target = items.find((item) => item.nome === name);
      if (target?.url) URL.revokeObjectURL(target.url);
      return items.filter((item) => item.nome !== name);
    });
    setErrors((current) => ({ ...current, anexos: "" }));
  }
  useEffect(() => () => attachmentUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (form.assunto.trim().length < 4) nextErrors.assunto = "Escreva um assunto com pelo menos 4 caracteres.";
    if (!form.categoria) nextErrors.categoria = "Escolha uma categoria.";
    if (form.descricao.trim().length < 10) nextErrors.descricao = "Descreva sua dúvida com pelo menos 10 caracteres.";
    if (attachments.length > 5) nextErrors.anexos = "Você pode anexar até 5 arquivos.";
    if (errors.anexos) nextErrors.anexos = errors.anexos;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSending(true);
    try {
      const result = createDoubt(student, { ...form, anexos: attachments });
      atualizarDados("duvidas", (items) => [result.doubt, ...items]);
      atualizarDados("notificacoes", (items) => [result.notification, ...items]);
      recordStudentActivity(atualizarDados, student, "Dúvida enviada", `Dúvida “${form.assunto.trim()}” enviada à professora.`, `/aluno/duvidas/${result.doubt.id}`);
      setToast("Dúvida enviada para sua professora.");
      window.setTimeout(() => navigate(`/aluno/duvidas/${result.doubt.id}`, { replace: true }), 700);
    } catch {
      setErrors((current) => ({ ...current, envio: "Não foi possível enviar sua dúvida. O texto preenchido foi mantido; tente novamente." }));
      setSending(false);
    }
  }
  return <Screen title="Nova dúvida" description="Envie sua pergunta para a professora." load={load} actions={<Link className="button button--secondary" to="/aluno/duvidas"><ArrowLeft size={15} /> Minhas dúvidas</Link>}>
    <form className="form-card student-form" onSubmit={submit} noValidate>
      <div className="notice-banner notice-banner--warm"><ShieldAlert size={17} /><p>Este canal não substitui atendimento de emergência. Se estiver com dor intensa ou sintomas preocupantes, interrompa a atividade e procure orientação.</p></div>
      <CampoFormulario label="Assunto" placeholder="Ex.: Dúvida sobre meu treino" value={form.assunto} erro={errors.assunto} onChange={(event) => setForm({ ...form, assunto: event.target.value })} />
      <div className="form-field"><label htmlFor="doubt-category">Categoria</label><select id="doubt-category" value={form.categoria} aria-invalid={Boolean(errors.categoria)} onChange={(event) => setForm({ ...form, categoria: event.target.value })}><option value="">Selecione uma categoria</option><option>Treino</option><option>Execução de exercício</option><option>Agendamento</option><option>Bem-estar</option><option>Outro assunto</option></select>{errors.categoria && <span className="form-field__error">{errors.categoria}</span>}</div>
      <div className="form-field"><label htmlFor="doubt-description">Sua dúvida</label><textarea id="doubt-description" rows="6" placeholder="Conte o que você gostaria de saber..." value={form.descricao} aria-invalid={Boolean(errors.descricao)} onChange={(event) => setForm({ ...form, descricao: event.target.value })} />{errors.descricao && <span className="form-field__error">{errors.descricao}</span>}</div>
      <div className="form-field"><label htmlFor="doubt-files">Anexos (opcional)</label><label className="upload-control" htmlFor="doubt-files"><ImagePlus size={19} /><span>Selecionar arquivos</span><small>Até 5 arquivos · JPG, PNG, PDF ou MP4 · máximo 10 MB cada</small></label><input className="file-input-hidden" id="doubt-files" type="file" accept=".jpg,.jpeg,.png,.pdf,.mp4,image/jpeg,image/png,application/pdf,video/mp4" multiple onChange={addFiles} />{errors.anexos && <span className="form-field__error">{errors.anexos}</span>}</div>
      {attachments.length > 0 && <div className="attachment-preview">{attachments.map((file) => <div className="attachment-chip" key={file.nome}>{file.url ? <img src={file.url} alt={`Pré-visualização de ${file.nome}`} /> : <FileText size={18} />}<span>{file.nome}<small>{(file.tamanho / (1024 * 1024)).toFixed(1)} MB</small></span><button type="button" onClick={() => removeFile(file.nome)} aria-label={`Remover ${file.nome}`}>Remover</button></div>)}</div>}
      {errors.envio && <MensagemErro mensagem={errors.envio} />}
      <div className="form-actions"><Button variant="secondary" onClick={() => navigate("/aluno/duvidas")}>Cancelar</Button><Button type="submit" disabled={sending}>{sending ? "Enviando..." : "Enviar dúvida"} <ArrowRight size={15} /></Button></div>
    </form><Toast mensagem={toast} fechar={() => setToast("")} />
  </Screen>;
}

export function DuvidaDetalhePage() {
  const { duvidaId } = useParams();
  const { student, dados, atualizarDados } = useStudentData();
  const doubt = getStudentDoubt(dados, student.id, duvidaId);
  const [text, setText] = useState("");
  const [erro, setErro] = useState("");
  const load = usePageLoad();
  useEffect(() => {
    if (doubt?.respostaNova) atualizarDados("duvidas", (items) => updateItem(items, doubt.id, (item) => ({ ...item, respostaNova: false })));
  }, [doubt?.id, doubt?.respostaNova, atualizarDados]);
  function sendReply(event) {
    event.preventDefault();
    if (text.trim().length < 2) { setErro("Escreva uma mensagem antes de enviar."); return; }
    atualizarDados("duvidas", (items) => updateItem(items, doubt.id, (item) => replyToDoubt(item, student, text)));
    recordStudentActivity(atualizarDados, student, "Conversa complementada", `Mensagem adicionada à dúvida “${doubt.assunto}”.`, `/aluno/duvidas/${doubt.id}`);
    setText("");
    setErro("");
  }
  if (!doubt) return <Screen title="Conversa" load={load} empty={{ mensagem: "Não encontramos esta dúvida.", proximoPasso: "Volte para a lista e selecione uma conversa disponível.", acao: <Link className="button button--secondary" to="/aluno/duvidas">Minhas dúvidas</Link> }} />;
  return <Screen title={doubt.assunto} description={`${doubt.categoria} · ${dateLabel(doubt.data)}`} load={load} actions={<Link className="button button--secondary" to="/aluno/duvidas"><ArrowLeft size={15} /> Minhas dúvidas</Link>}>
    <div className="conversation-wrap"><div className="conversation-status"><span>Status</span><EtiquetaStatus status={doubt.status === "resolvida" ? "concluido" : doubt.status} />{doubt.respostaNova && <span className="new-response-label">Resposta nova</span>}</div>
      <div className="conversation-messages" aria-live="polite">{(doubt.mensagens || []).map((message) => { const own = message.autorId === student.id; return <article className={`message-bubble${own ? " message-bubble--own" : ""}`} key={message.id}><div className="message-meta"><strong>{own ? "Você" : message.autor}</strong><time dateTime={message.data}>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(message.data))}</time></div><p>{message.texto}</p>{message.anexos?.map((item) => <span className="message-attachment" key={item.nome}><FileText size={14} />{item.nome}</span>)}</article>; })}</div>
      {doubt.status !== "resolvida" && <form className="reply-form" onSubmit={sendReply}><label htmlFor="reply-text">Complementar dúvida</label><textarea id="reply-text" rows="3" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma mensagem para a professora..." />{erro && <span className="form-field__error">{erro}</span>}<Button type="submit">Enviar mensagem <ArrowRight size={15} /></Button></form>}
      {doubt.status === "resolvida" && <div className="inline-notice">Esta conversa foi marcada como resolvida. Para retomar, envie uma nova dúvida.</div>}
    </div>
  </Screen>;
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AgendamentosPage() {
  const { student, dados } = useStudentData();
  const bookings = getStudentBookings(dados, student.id).sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
  const load = usePageLoad();
  return <Screen title="Agendamentos" description="Consulte seus atendimentos e escolha um novo horário." load={load} empty={!bookings.length ? { mensagem: "Você ainda não tem agendamentos.", proximoPasso: "Veja os serviços disponíveis e escolha um horário para conversar com sua professora." } : null} actions={<Link className="button button--primary" to="/aluno/agendamentos/novo"><Plus size={16} /> Novo agendamento</Link>}>
    {bookings.length ? <div className="booking-list">{bookings.map((item) => <Link key={item.id} className="booking-row" to={`/aluno/agendamentos/${item.id}`}><span className="booking-datebox"><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(`${item.data}T12:00:00`))}</strong><small>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${item.data}T12:00:00`))}</small></span><span className="booking-info"><strong>{item.modalidade || item.tipo}</strong><small>{dateLabel(item.data, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {item.horario}</small><small>{item.duracao || 45} min · {item.local || "Local a combinar"}</small></span><span className="booking-price">R$ {Number(item.preco || 0).toFixed(2).replace(".", ",")}</span><EtiquetaStatus status={item.status} /><ArrowRight size={16} /></Link>)}</div> : null}
  </Screen>;
}

export function NovoAgendamentoPage() {
  const { student, dados, atualizarDados } = useStudentData();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [type, setType] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slot, setSlot] = useState("");
  const [draft, setDraft] = useState({ motivo: "", observacoes: "", aceite: false });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [notice, setNotice] = useState("");
  const load = usePageLoad();
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + 1 + weekOffset * 7 + index);
    return localDateString(date);
  }), [weekOffset]);
  const availableSlots = selectedDate && type ? getAvailableSlots(dados, selectedDate, type) : [];
  const service = type === "online" ? { label: "Conversa on-line", description: "Orientação por videochamada, sem deslocamento.", duration: dados.disponibilidade?.duracoes?.online || 45, price: dados.disponibilidade?.valores?.online || 75, rules: dados.disponibilidade?.regrasCancelamento || "Cancelamento gratuito até 24 horas antes." } : { label: "Atendimento presencial", description: "Encontro presencial para avaliação e orientação do treino.", duration: dados.disponibilidade?.duracoes?.presencial || 50, price: dados.disponibilidade?.valores?.presencial || 95, rules: dados.disponibilidade?.regrasCancelamento || "Cancelamento gratuito até 24 horas antes." };
  function validateStep() {
    const nextErrors = {};
    if (step === 1 && !type) nextErrors.tipo = "Escolha uma modalidade disponível.";
    if (step === 2 && (!selectedDate || !slot)) nextErrors.horario = "Escolha um dia e horário disponível.";
    if (step === 3) {
      if (draft.motivo.trim().length < 3) nextErrors.motivo = "Informe brevemente o motivo do atendimento.";
      if (!draft.aceite) nextErrors.aceite = "É necessário aceitar as regras para continuar.";
    }
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  }
  async function continueStep(event) {
    event.preventDefault();
    if (!validateStep()) return;
    if (step < 3) setStep((current) => current + 1);
    else {
      setSubmitting(true);
      setNotice("");
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      const booking = createBooking(dados, student.id, { tipo: type, data: selectedDate, horario: slot, motivo: draft.motivo, observacoes: draft.observacoes });
      if (!booking) {
        setNotice("Este horário acabou de ficar indisponível. Escolha outro horário para continuar.");
        setStep(2);
        setSlot("");
        setSubmitting(false);
        return;
      }
      atualizarDados("agendamentos", (items) => [...items, booking]);
      atualizarDados("notificacoes", (items) => [...items, { id: `not-${booking.id}`, usuarioId: student.id, titulo: "Agendamento confirmado", mensagem: `${booking.modalidade} em ${dateLabel(booking.data)} às ${booking.horario}.`, categoria: "aulas", relatedTo: `/aluno/agendamentos/${booking.id}`, lida: false, data: new Date().toISOString() }]);
      atualizarDados("notificacoes", (items) => [...items, { id: `not-prof-${booking.id}`, usuarioId: "prof-1", titulo: "Novo agendamento", mensagem: `${student.nome} reservou ${booking.modalidade} em ${dateLabel(booking.data)} às ${booking.horario}.`, categoria: "agendamentos", relatedTo: `/professor/consultas/${booking.id}`, lida: false, data: new Date().toISOString() }]);
      recordStudentActivity(atualizarDados, student, "Agendamento criado", `${booking.modalidade} em ${dateLabel(booking.data)} às ${booking.horario}.`, `/aluno/agendamentos/${booking.id}`);
      navigate(`/aluno/agendamentos/${booking.id}`, { replace: true, state: { confirmado: true } });
    }
  }
  return <Screen title="Novo agendamento" description="Escolha a modalidade e um horário para seu atendimento." load={load} actions={<Link className="button button--secondary" to="/aluno/agendamentos"><ArrowLeft size={15} /> Agendamentos</Link>}>
    <div className="booking-wizard"><ol className="wizard-steps" aria-label="Etapas do agendamento">{["Serviço", "Data e horário", "Revisão"].map((label, index) => <li key={label} className={step === index + 1 ? "is-current" : step > index + 1 ? "is-complete" : ""}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span>{label}</li>)}</ol>
      {notice && <MensagemErro mensagem={notice} />}
      <form className="form-card booking-form" onSubmit={continueStep} noValidate>
        {step === 1 && <><span className="eyebrow">ETAPA 1 · TIPO DE ATENDIMENTO</span><h2>Como prefere conversar?</h2><p className="muted-copy">Confira duração e valor antes de escolher.</p><div className="service-options">{[["online", "Conversa on-line", "Orientação por videochamada, sem deslocamento.", `${dados.disponibilidade?.duracoes?.online || 45} min`, `R$ ${Number(dados.disponibilidade?.valores?.online || 75).toFixed(2).replace(".", ",")}`], ["presencial", "Atendimento presencial", dados.configuracoesProfessor?.local || "Encontro presencial com sua professora.", `${dados.disponibilidade?.duracoes?.presencial || 50} min`, `R$ ${Number(dados.disponibilidade?.valores?.presencial || 95).toFixed(2).replace(".", ",")}`]].map(([value, title, description, duration, price]) => <button type="button" key={value} className={`service-option${type === value ? " is-selected" : ""}`} onClick={() => { setType(value); setErrors({}); }}><span className="service-option__check">{type === value && <Check size={13} />}</span><strong>{title}</strong><p>{description}</p><span className="service-option__meta">{duration} <b>{price}</b></span></button>)}</div><div className="service-unavailable"><strong>Avaliação presencial completa</strong><span>Indisponível no momento</span></div><div className="rules-copy"><strong>Regras de cancelamento</strong><p>{service.rules}</p></div>{errors.tipo && <span className="form-field__error">{errors.tipo}</span>}</>}
        {step === 2 && <><span className="eyebrow">ETAPA 2 · DATA E HORÁRIO</span><h2>Escolha um horário disponível</h2><p className="muted-copy">Horários ocupados ou bloqueados não aparecem para seleção.</p><div className="week-navigation"><Button variant="secondary" onClick={() => { setWeekOffset((value) => Math.max(0, value - 1)); setSelectedDate(""); setSlot(""); }} disabled={weekOffset === 0}><ChevronLeft size={16} /> Semana anterior</Button><strong>{dateLabel(dates[0], { day: "numeric", month: "long" })} – {dateLabel(dates[6], { day: "numeric", month: "long" })}</strong><Button variant="secondary" onClick={() => { setWeekOffset((value) => value + 1); setSelectedDate(""); setSlot(""); }}>Próxima semana <ChevronRight size={16} /></Button></div><div className="date-picker" role="group" aria-label="Dias disponíveis">{dates.map((date) => { const slots = getAvailableSlots(dados, date, type || "online"); const selected = date === selectedDate; return <button type="button" disabled={!slots.length} key={date} aria-pressed={selected} className={`date-option${selected ? " is-selected" : ""}${!slots.length ? " is-disabled" : ""}`} onClick={() => { setSelectedDate(date); setSlot(""); }}><small>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${date}T12:00:00`))}</small><strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(`${date}T12:00:00`))}</strong><small>{slots.length ? `${slots.length} horários` : "Indisponível"}</small></button>; })}</div>{selectedDate && <div className="available-slots"><strong>Horários de {dateLabel(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</strong>{availableSlots.length ? <div>{availableSlots.map((time) => <button type="button" key={time} className={slot === time ? "is-selected" : ""} aria-pressed={slot === time} onClick={() => { setSlot(time); setErrors({}); }}>{time}</button>)}</div> : <p>Não há horários disponíveis neste dia. Escolha outra data.</p>}</div>}{errors.horario && <span className="form-field__error">{errors.horario}</span>}</>}
        {step === 3 && <><span className="eyebrow">ETAPA 3 · DADOS E REVISÃO</span><h2>Confira seu agendamento</h2><CampoFormulario label="Motivo do atendimento" placeholder="Ex.: revisar meu plano de treino" value={draft.motivo} erro={errors.motivo} onChange={(event) => setDraft({ ...draft, motivo: event.target.value })} /><div className="form-field"><label htmlFor="booking-notes">Observações (opcional)</label><textarea id="booking-notes" rows="3" value={draft.observacoes} onChange={(event) => setDraft({ ...draft, observacoes: event.target.value })} placeholder="Informações que a professora deve saber" /></div>{type === "presencial" && <div className="location-notice"><strong>Local do atendimento</strong><p>Espaço Movimento · Rua das Flores, 120</p></div>}{type === "online" && <div className="location-notice"><strong>Acesso on-line</strong><p>As instruções de acesso serão apresentadas após a confirmação.</p></div>}<div className="booking-review"><span>Modalidade<strong>{service.label}</strong></span><span>Data e horário<strong>{dateLabel(selectedDate)} · {slot}</strong></span><span>Duração<strong>{service.duration} min</strong></span><span>Valor<strong>R$ {service.price.toFixed(2).replace(".", ",")}</strong></span><span>Pagamento<strong>Simulado · após confirmação</strong></span></div><p className="rules-copy">{service.rules}</p><label className="check-control check-control--wide"><input type="checkbox" checked={draft.aceite} onChange={(event) => setDraft({ ...draft, aceite: event.target.checked })} /> Li e aceito as regras de cancelamento e alteração.</label>{errors.aceite && <span className="form-field__error">{errors.aceite}</span>}</>}
        <div className="form-actions">{step > 1 ? <Button variant="secondary" type="button" onClick={() => { setStep((value) => value - 1); setErrors({}); }}>Voltar</Button> : <span />}{step === 3 && <span className="price-emphasis">Total: R$ {service.price.toFixed(2).replace(".", ",")}</span>}<Button type="submit" disabled={submitting}>{step === 3 ? submitting ? "Confirmando..." : "Confirmar agendamento" : "Continuar"} <ArrowRight size={15} /></Button></div>
      </form>
    </div>
  </Screen>;
}

export function AgendamentoDetalhePage() {
  const { agendamentoId } = useParams();
  const { student, dados, atualizarDados } = useStudentData();
  const booking = getStudentBookings(dados, student.id).find((item) => item.id === agendamentoId);
  const [modal, setModal] = useState("");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const load = usePageLoad();
  function applyStatus(status) {
    if (reason.trim().length < 3) { setError("Informe o motivo para continuar."); return; }
    atualizarDados("agendamentos", (items) => updateItem(items, booking.id, (item) => updateBookingStatus(item, status, reason, student.nome)));
    atualizarDados("notificacoes", (items) => [...items, { id: `not-alteracao-${booking.id}-${Date.now()}`, usuarioId: "prof-1", titulo: status === "cancelado" ? "Agendamento cancelado pelo aluno" : "Solicitação de reagendamento", mensagem: `${student.nome} ${status === "cancelado" ? "cancelou" : "solicitou reagendamento de"} ${booking.modalidade || booking.tipo} em ${dateLabel(booking.data)}.`, categoria: "agendamentos", relatedTo: `/professor/consultas/${booking.id}`, lida: false, data: new Date().toISOString() }]);
    recordStudentActivity(atualizarDados, student, status === "cancelado" ? "Agendamento cancelado" : "Reagendamento solicitado", `Motivo: ${reason.trim()}`, `/aluno/agendamentos/${booking.id}`);
    setModal("");
    setReason("");
    setError("");
    setToast(status === "cancelado" ? "Cancelamento registrado." : "Solicitação de reagendamento registrada.");
  }
  if (!booking) return <Screen title="Detalhe do agendamento" load={load} empty={{ mensagem: "Não encontramos este agendamento.", proximoPasso: "Volte à agenda para consultar os horários da sua conta.", acao: <Link className="button button--secondary" to="/aluno/agendamentos">Ver agendamentos</Link> }} />;
  const allowedToChange = ["confirmado", "pendente"].includes(booking.status);
  const startsAt = new Date(`${booking.data}T${booking.horario}:00`);
  const changeDeadline = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  const withinNoticePeriod = changeDeadline <= new Date();
  return <Screen title="Detalhe do agendamento" description="Informações do seu atendimento." load={load} actions={<Link className="button button--secondary" to="/aluno/agendamentos"><ArrowLeft size={15} /> Agendamentos</Link>}>
    <div className="booking-detail"><Cartao className="booking-detail__hero"><span className="eyebrow">ATENDIMENTO</span><div className="booking-detail__title"><h2>{booking.modalidade || booking.tipo}</h2><EtiquetaStatus status={booking.status} /></div><p><CalendarDays size={17} />{dateLabel(booking.data, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {booking.horario}</p><p><Clock3 size={17} />{booking.duracao || 45} minutos</p></Cartao><div className="booking-detail__grid"><Cartao><span className="eyebrow">LOCAL / ACESSO</span><p>{booking.local || (booking.tipo === "online" ? "As instruções de acesso serão enviadas." : "Local a combinar.")}</p>{booking.tipo === "online" && booking.status === "confirmado" && <Button variant="secondary" disabled>Link disponível próximo ao horário</Button>}</Cartao><Cartao><span className="eyebrow">VALOR E PAGAMENTO</span><h2>R$ {Number(booking.preco || 0).toFixed(2).replace(".", ",")}</h2><p>{booking.pagamento || "Pagamento simulado"}</p></Cartao><Cartao><span className="eyebrow">MOTIVO</span><p>{booking.motivo || "Não informado"}</p>{booking.observacoes && <p className="muted-copy">{booking.observacoes}</p>}</Cartao></div>
      {allowedToChange && <><div className="booking-deadline"><Clock3 size={16} /><span>Prazo para cancelamento sem custo<strong>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(changeDeadline)}</strong></span></div><div className="form-actions booking-actions"><Button variant="secondary" onClick={() => setModal("reagendar")}>Solicitar reagendamento</Button><Button variant="danger" onClick={() => setModal("cancelar")}>Cancelar agendamento</Button></div></>}
      {booking.historicoStatus?.length > 0 && <Cartao className="status-history"><span className="eyebrow">HISTÓRICO DE ALTERAÇÕES</span>{booking.historicoStatus.map((entry, index) => <p key={`${entry.data}-${index}`}><strong>{entry.status === "cancelado" ? "Cancelamento" : "Solicitação de reagendamento"}</strong> · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.data))} · {entry.autor}<br /><small>Motivo: {entry.motivo}</small></p>)}</Cartao>}
    </div>
    <ModalConfirmacao aberto={Boolean(modal)} titulo={modal === "cancelar" ? "Cancelar agendamento?" : "Solicitar reagendamento?"} mensagem={modal === "cancelar" ? withinNoticePeriod ? "O prazo para cancelamento sem custo passou. A solicitação será registrada e poderá estar sujeita às regras de cancelamento." : "O horário será liberado e a solicitação registrada no histórico. Confirme apenas se deseja mesmo cancelar." : "A professora receberá sua solicitação. O horário atual permanece até que um novo seja combinado."} confirmarTexto={modal === "cancelar" ? "Confirmar cancelamento" : "Enviar solicitação"} aoFechar={() => { setModal(""); setReason(""); setError(""); }} aoConfirmar={() => applyStatus(modal === "cancelar" ? "cancelado" : "reagendamento solicitado")}><div className="form-field"><label htmlFor="booking-reason">Motivo</label><textarea id="booking-reason" rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Conte brevemente o motivo" />{error && <span className="form-field__error">{error}</span>}</div></ModalConfirmacao>
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </Screen>;
}

export function NotificacoesPage() {
  const { student, dados, atualizarDados } = useStudentData();
  const notifications = getStudentNotifications(dados, student.id);
  const preferences = getStudentNotificationPreferences(dados, student.id);
  const load = usePageLoad();
  function togglePreference(key) {
    if (key === "respostas" || key === "aulas") return;
    atualizarDados("perfisAluno", (profiles) => ({ ...profiles, [student.id]: { ...profiles[student.id], preferencias: { ...preferences, [key]: !preferences[key] } } }));
  }
  return <Screen title="Notificações" description="Acompanhe avisos e escolha quais atualizações quer receber." load={load}>
    <div className="notifications-layout"><div className="notification-list">{notifications.length ? notifications.map((item) => <Link className={`notification-row${item.lida ? "" : " is-unread"}`} key={item.id} to={item.relatedTo || notificationPath(item)} onClick={() => atualizarDados("notificacoes", (items) => updateItem(items, item.id, (current) => ({ ...current, lida: true })))}><span className="notification-icon"><Bell size={17} /></span><span className="notification-copy"><strong>{item.titulo}</strong><span>{item.mensagem}</span><small>{dateLabel(item.data)}</small></span>{!item.lida && <span className="unread-dot" aria-label="Não lida" />}<ArrowRight size={15} /></Link>) : <EstadoVazio mensagem="Você está em dia." proximoPasso="Quando houver uma atualização sobre seus treinos, aulas ou dúvidas, ela aparecerá aqui." />}</div>
      <Cartao className="notification-preferences"><span className="eyebrow">PREFERÊNCIAS</span><h2>O que quer acompanhar?</h2><p>Atualizações importantes continuam ativas para manter seu acompanhamento em dia.</p>{[["aulas", "Aulas e agendamentos", true], ["respostas", "Respostas às dúvidas", true], ["treinos", "Atualizações de treino", false], ["lembretes", "Lembretes", false], ["novidades", "Novidades e conteúdos", false]].map(([key, label, essential]) => <label className="switch-row" key={key}><span>{label}{essential && <small>Essencial</small>}</span><input type="checkbox" checked={essential || preferences[key] !== false} disabled={essential} onChange={() => togglePreference(key)} /><span className="switch-ui" /></label>)}</Cartao>
    </div>
  </Screen>;
}

function notificationPath(item) {
  if (item.categoria === "treinos") return "/aluno/treinos";
  if (item.categoria === "respostas") return "/aluno/duvidas";
  if (item.categoria === "aulas") return "/aluno/agendamentos";
  return "/aluno/notificacoes";
}

export function PerfilPage() {
  const { student, dados, atualizarDados, entrar } = useStudentData();
  const saved = getStudentProfile(dados, student.id);
  const studentRecord = dados.alunos.find((item) => item.id === student.id);
  const currentServicePlan = studentRecord?.planoVigenteId ? (dados.planosServicos || []).find((item) => item.id === studentRecord.planoVigenteId) : null;
  const [form, setForm] = useState({ nome: student.nome, email: student.email, telefone: saved.telefone || "", foto: saved.foto || "", preferencias: { aulas: true, treinos: true, respostas: true, lembretes: true, novidades: false, ...saved.preferencias } });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [failure, setFailure] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState({ atual: "", nova: "", confirmar: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [legalModal, setLegalModal] = useState("");
  const [dataRequestOpen, setDataRequestOpen] = useState(false);
  const load = usePageLoad();
  function save(event) {
    event.preventDefault();
    const next = {};
    if (form.nome.trim().length < 3) next.nome = "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Informe um e-mail válido.";
    if (form.telefone && !/^[+\d\s()\-]{8,20}$/.test(form.telefone)) next.telefone = "Confira o número de telefone.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const result = saveStudentProfile(dados, student, form);
      atualizarDados("alunos", result.dados.alunos);
      atualizarDados("perfisAluno", result.dados.perfisAluno);
      entrar(result.user);
      setFailure("");
      setToast("Seus dados foram atualizados.");
    } catch {
      setFailure("Não foi possível salvar as alterações. Seus dados preenchidos foram mantidos para tentar novamente.");
    }
  }
  function changePassword(event) {
    event.preventDefault();
    if (!password.atual || password.nova.length < 8 || password.nova !== password.confirmar) {
      setPasswordMessage("Confira a senha atual, use ao menos 8 caracteres e confirme a nova senha.");
      return;
    }
    setPasswordMessage("Senha atualizada neste protótipo. A alteração não foi enviada a um servidor.");
    setPassword({ atual: "", nova: "", confirmar: "" });
  }
  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 1024 * 1024) {
      setErrors((current) => ({ ...current, foto: "Escolha uma imagem JPG ou PNG de até 1 MB." }));
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, foto: String(reader.result) }));
      setErrors((current) => ({ ...current, foto: "" }));
    };
    reader.onerror = () => setErrors((current) => ({ ...current, foto: "Não foi possível abrir esta imagem. Tente outro arquivo." }));
    reader.readAsDataURL(file);
  }
  return <Screen title="Perfil e configurações" description="Mantenha seus dados e preferências atualizados." load={load}>
    <div className="profile-layout"><form className="form-card profile-form" onSubmit={save} noValidate><span className="eyebrow">DADOS PESSOAIS</span><div className="profile-photo"><span className="avatar avatar--large">{form.nome.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><label className="button button--secondary" htmlFor="profile-photo"><ImagePlus size={15} /> Alterar foto</label><input className="file-input-hidden" id="profile-photo" type="file" accept="image/png,image/jpeg" onChange={selectPhoto} /><small>JPG ou PNG · até 1 MB</small>{errors.foto && <span className="form-field__error">{errors.foto}</span>}</div>{form.foto && <img className="profile-photo-preview" src={form.foto} alt="Prévia da foto de perfil" />}<CampoFormulario label="Nome completo" value={form.nome} erro={errors.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /><CampoFormulario label="E-mail" type="email" value={form.email} erro={errors.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><CampoFormulario label="Telefone" type="tel" placeholder="(00) 00000-0000" value={form.telefone} erro={errors.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} />{failure && <MensagemErro mensagem={failure} />}<Button type="submit">Salvar dados</Button></form>
      <div className="profile-side">{currentServicePlan && <Cartao><span className="eyebrow">PLANO DE SERVIÇO VIGENTE</span><h2>{currentServicePlan.nome}</h2><p>{currentServicePlan.servicos.join(" · ")} · {currentServicePlan.modalidades.join(" / ")}</p><p>R$ {currentServicePlan.preco.toFixed(2).replace(".", ",")} · {currentServicePlan.vigencia}</p><small>{currentServicePlan.regras}</small></Cartao>}<Cartao><span className="eyebrow">SEGURANÇA</span><h2>Senha</h2><p>Faça uma atualização simulada da senha da sua conta.</p><Button variant="secondary" onClick={() => setPasswordOpen((value) => !value)}>{passwordOpen ? "Fechar alteração" : "Alterar senha"}</Button>{passwordOpen && <form className="password-change" onSubmit={changePassword}><CampoFormulario label="Senha atual" type="password" value={password.atual} onChange={(event) => setPassword({ ...password, atual: event.target.value })} /><CampoFormulario label="Nova senha" type="password" value={password.nova} onChange={(event) => setPassword({ ...password, nova: event.target.value })} /><CampoFormulario label="Confirmar nova senha" type="password" value={password.confirmar} onChange={(event) => setPassword({ ...password, confirmar: event.target.value })} /><Button type="submit">Atualizar senha</Button>{passwordMessage && <p className="inline-notice" role="status">{passwordMessage}</p>}</form>}</Cartao>
        <Cartao><span className="eyebrow">PREFERÊNCIAS DE AVISO</span><h2>Notificações</h2>{[["aulas", "Aulas e agenda", true], ["respostas", "Respostas das dúvidas", true], ["treinos", "Treinos", false], ["lembretes", "Lembretes", false], ["novidades", "Novos conteúdos", false]].map(([key, label, essential]) => <label className="switch-row" key={key}><span>{label}{essential && <small>Essencial</small>}</span><input type="checkbox" checked={essential || form.preferencias[key]} disabled={essential} onChange={() => setForm({ ...form, preferencias: { ...form.preferencias, [key]: !form.preferencias[key] } })} /><span className="switch-ui" /></label>)}</Cartao>
        <Cartao><span className="eyebrow">SEUS DIREITOS</span><h2>Privacidade e dados</h2><p>Consulte informações sobre o uso dos seus dados e solicite uma cópia dos dados simulados.</p><div className="legal-links"><button onClick={() => setLegalModal("termos")}>Termos de uso <ArrowRight size={14} /></button><button onClick={() => setLegalModal("privacidade")}>Política de privacidade <ArrowRight size={14} /></button><Button variant="secondary" onClick={() => setDataRequestOpen(true)}>Solicitar meus dados (LGPD)</Button></div></Cartao></div>
    </div>
    <ModalConfirmacao aberto={Boolean(legalModal)} titulo={legalModal === "termos" ? "Termos de uso" : "Política de privacidade"} mensagem={legalModal === "termos" ? "Este protótipo é demonstrativo e não realiza atendimento, pagamento ou autenticação real. As informações de treino são orientações simuladas; respeite seus limites e converse com sua professora em caso de dúvida." : "Os dados deste protótipo são simulados e armazenados apenas no localStorage deste navegador. Nenhuma informação é enviada a um servidor. Você pode restaurar os dados de exemplo ou solicitar uma cópia dos dados simulados."} confirmarTexto="Fechar" aoFechar={() => setLegalModal("")} aoConfirmar={() => setLegalModal("")} />
    <ModalConfirmacao aberto={dataRequestOpen} titulo="Solicitar uma cópia dos dados?" mensagem="A solicitação será registrada apenas neste protótipo. Não há envio de dados a um servidor." confirmarTexto="Confirmar solicitação" aoFechar={() => setDataRequestOpen(false)} aoConfirmar={() => { setDataRequestOpen(false); setToast("Solicitação de dados registrada no protótipo."); }} />
    <Toast mensagem={toast} fechar={() => setToast("")} />
  </Screen>;
}
