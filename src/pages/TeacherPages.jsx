import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { getAppointmentTimes, isAppointmentDateAvailable, isAppointmentTimeAvailable, toDateKey } from "../utils/appointmentAvailability.js";
import { createPasswordCredential } from "../utils/passwordCredentials.js";

function PageHeader({ title, description, backTo = "/professor/inicio", backLabel = "Voltar ao início", action }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-header__actions">{action}<Link className="button button--secondary" to={backTo}><Icon name="arrowBack" />{backLabel}</Link></div>
    </header>
  );
}

function formatDate(value, options = { day: "numeric", month: "long" }) {
  return value ? new Intl.DateTimeFormat("pt-BR", options).format(new Date(`${value}T12:00:00`)) : "Sem registro";
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function lastActivityDays(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const last = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - last.getTime()) / 86400000);
}

function studentStatus(student) {
  if (student.status !== "Ativo") return student.status;
  const days = lastActivityDays(student.ultimoTreino);
  if (days === null || days > 14) return "Sumido";
  if (days > 7) return "Atenção";
  return "Em dia";
}

export function TeacherHomePage({ data, user }) {
  const active = data.students.filter((student) => student.status === "Ativo");
  const today = localDateKey();
  const lastDay = new Date();
  lastDay.setDate(lastDay.getDate() + 7);
  const nextWeek = localDateKey(lastDay);
  const todaysAppointments = data.appointments.filter((item) => item.date === today && item.status !== "Cancelado");
  const nextWeekAppointments = data.appointments
    .filter((item) => item.date >= today && item.date <= nextWeek && item.status !== "Cancelado")
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const attention = active.filter((student) => ["Atenção", "Sumido"].includes(studentStatus(student)));
  const appointmentsToShow = todaysAppointments.length ? todaysAppointments : nextWeekAppointments;
  const appointmentsTitle = todaysAppointments.length ? "Atendimentos de hoje" : "Próximos 7 dias";
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="page teacher-home">
      <header className="teacher-welcome">
        <div>
          <p className="teacher-welcome__eyebrow">PAINEL DO PROFESSOR</p>
          <h1>Olá, {user.nome.split(" ")[0]}</h1>
          <p>O que precisa da sua atenção hoje?</p>
        </div>
        <time dateTime={today}>{todayLabel}</time>
      </header>
      <nav className="quick-links dashboard-actions" aria-label="Ações rápidas">
        <Link className="button button--primary" to="/professor/clientes/novo"><Icon name="add" />Cadastrar cliente</Link>
        <Link className="button button--secondary" to="/professor/treinamentos"><Icon name="training" />Criar treino</Link>
        <Link className="button button--secondary" to="/professor/agenda"><Icon name="calendar" />Agendar aula</Link>
      </nav>
      <div className="summary-grid dashboard-summary">
        <Link className="summary-card" to="/professor/alunos"><strong>{active.length}</strong><span>Alunos ativos</span></Link>
        <Link className="summary-card summary-card--featured" to="/professor/agenda"><strong>{nextWeekAppointments.length}</strong><span>Atendimentos · 7 dias</span></Link>
        <Link className="summary-card" to="/professor/alunos"><strong>{attention.length}</strong><span>Alunos para acompanhar</span></Link>
        <Link className="summary-card" to="/professor/treinamentos"><strong>{data.trainings.length}</strong><span>Treinos ativos</span></Link>
      </div>
      <div className="dashboard-panels">
        <section className="content-card">
          <div className="section-heading"><div><p className="eyebrow">AGENDA</p><h2>{appointmentsTitle}</h2></div><Link className="text-link" to="/professor/agenda">Ver agenda</Link></div>
          {appointmentsToShow.length ? <div className="simple-list">{appointmentsToShow.slice(0, 5).map((item) => {
            const student = data.students.find((person) => person.id === item.studentId);
            return <div className="simple-list-row" key={item.id}><strong>{item.time}</strong><span><b>{student?.nome || "Aluno"}</b><small>{item.type}{item.date !== today ? ` · ${formatDate(item.date, { weekday: "short", day: "numeric", month: "short" })}` : ""}</small></span><span className="status-pill">{item.status}</span></div>;
          })}</div> : <div className="empty-inline"><p>Nenhum atendimento nos próximos 7 dias.</p><Link className="button button--secondary" to="/professor/agenda">Agendar</Link></div>}
        </section>
        <section className="content-card">
          <div className="section-heading"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Alunos para acompanhar</h2></div><Link className="text-link" to="/professor/alunos">Ver todos</Link></div>
          {attention.length ? <div className="simple-list attention-list">{attention.slice(0, 4).map((student) => {
            const days = lastActivityDays(student.ultimoTreino);
            const reason = days === null ? "Sem treino registrado" : `Não treina há ${days} dias`;
            return <div className="simple-list-row" key={student.id}><span><b>{student.nome}</b><small>{reason}</small></span><Link className="button button--secondary" to={`/professor/alunos/${student.id}`}>Ver aluno</Link></div>;
          })}</div> : <p className="success-note">Tudo em dia por aqui.</p>}
        </section>
      </div>
      <section className="content-card">
        <div className="section-heading"><div><p className="eyebrow">TREINAMENTOS</p><h2>Treinamentos recentes</h2></div><Link className="text-link" to="/professor/treinamentos">Ver treinamentos</Link></div>
        {data.trainings.length ? data.trainings.slice(0, 4).map((training) => {
          const student = data.students.find((person) => person.id === training.studentId);
          return <div className="simple-list-row" key={training.id}><span><b>{training.titulo}</b><small>{student?.nome || "Sem aluno atribuído"}</small></span><span className="status-pill">{training.status}</span></div>;
        }) : <div className="empty-inline"><p>Nenhum treinamento cadastrado.</p><Link className="button button--secondary" to="/professor/treinamentos">Criar treinamento</Link></div>}
      </section>
    </div>
  );
}

export function TeacherStudentsPage({ data }) {
  const [search, setSearch] = useState("");
  const location = useLocation();
  const registeredEmail = location.state?.registeredEmail;
  const students = data.students
    .filter((student) => `${student.nome} ${student.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => ["Sumido", "Atenção", "Em dia", "Convite pendente"].indexOf(studentStatus(a)) - ["Sumido", "Atenção", "Em dia", "Convite pendente"].indexOf(studentStatus(b)));
  return (
    <div className="page">
      <PageHeader
        title="Alunos"
        description="Veja a situação e o último treino de cada aluno."
        action={<Link className="button button--primary" to="/professor/clientes/novo"><Icon name="add" />Cadastrar cliente</Link>}
      />
      {registeredEmail && <p className="success-note" role="status">Cliente cadastrado. Ele pode entrar com {registeredEmail} e a senha definida no cadastro.</p>}
      <label className="search-field">Buscar aluno<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou e-mail" /></label>
      {students.length ? <div className="card-list">{students.map((student) => (
        <article className="list-card" key={student.id}>
          <div><h2>{student.nome}</h2><p>{student.email}</p><small>Plano: {student.plano} · Último treino: {student.ultimoTreino ? formatDate(student.ultimoTreino) : "Sem registro"}</small></div>
          <span className={`status-pill${studentStatus(student) === "Atenção" || studentStatus(student) === "Sumido" ? " status-pill--attention" : ""}`}>{studentStatus(student)}</span>
          <Link className="button button--secondary" to={`/professor/alunos/${student.id}`}>Ver aluno</Link>
        </article>
      ))}</div> : <div className="empty-state"><h2>Nenhum aluno encontrado</h2><p>Tente buscar por outro nome ou e-mail.</p></div>}
    </div>
  );
}

export function TeacherFeedbacksPage({ data }) {
  const feedbacks = [...(data.feedbacks || [])].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const averageRating = feedbacks.length
    ? (feedbacks.reduce((total, feedback) => total + feedback.rating, 0) / feedbacks.length).toFixed(1)
    : null;

  return (
    <div className="page">
      <PageHeader title="Avaliações dos alunos" description="Todos os feedbacks recebidos após a conclusão dos treinos." />
      {feedbacks.length ? (
        <>
          <section className="content-card feedback-summary" aria-label="Resumo das avaliações recebidas">
            <strong>{averageRating}<span>/5</span></strong>
            <div>
              <span className="feedback-rating" role="img" aria-label={`Média de ${averageRating} de 5 estrelas`}>
                {"★".repeat(Math.round(Number(averageRating)))}{"☆".repeat(5 - Math.round(Number(averageRating)))}
              </span>
              <p>{feedbacks.length} {feedbacks.length === 1 ? "avaliação recebida" : "avaliações recebidas"}</p>
            </div>
          </section>
          <div className="card-list">
            {feedbacks.map((feedback) => (
              <article className="content-card feedback-card" key={feedback.id}>
                <div className="feedback-card__heading">
                  <div>
                    <h2>{feedback.trainingTitle}</h2>
                    <p>Aluno: {feedback.studentName}</p>
                  </div>
                  <span className="feedback-rating" role="img" aria-label={`${feedback.rating} de 5 estrelas`}>
                    {"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}
                    <small>{feedback.rating}/5</small>
                  </span>
                </div>
                <p className="feedback-card__comment">{feedback.comment}</p>
                <time dateTime={feedback.createdAt}>
                  {new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(feedback.createdAt))}
                </time>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>Ainda não há avaliações</h2>
          <p>Quando os alunos concluírem um treino e enviarem feedback, todas as avaliações aparecerão aqui.</p>
          <Link className="button button--secondary" to="/professor/treinamentos"><Icon name="training" />Ver treinamentos</Link>
        </div>
      )}
    </div>
  );
}

export function TeacherRegisterStudentPage({ data, onUpdate }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function registerStudent(event) {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Confira o e-mail para continuar.");
      return;
    }
    if (data.students.some((student) => student.email.toLowerCase() === normalizedEmail)) {
      setError("Já existe um cliente cadastrado com esse e-mail.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("As senhas não coincidem. Confira os dois campos.");
      return;
    }
    setIsSubmitting(true);
    try {
      const passwordCredential = await createPasswordCredential(password);
      const newStudent = {
        id: `aluno-${Date.now()}`,
        nome: `ALUNO${data.students.length + 1}`,
        email: normalizedEmail,
        telefone: phone.trim(),
        status: "Ativo",
        plano: plan.trim() || "Não definido",
        ultimoTreino: "",
        passwordCredential,
      };
      onUpdate((current) => ({ ...current, students: [...current.students, newStudent] }));
      navigate("/professor/alunos", { state: { registeredEmail: normalizedEmail } });
    } catch {
      setError("Não foi possível criar o acesso agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Cadastrar cliente" description="Crie o acesso do cliente à plataforma." backTo="/professor/alunos" backLabel="Voltar aos alunos" />
      <form className="content-card form-card profile-form" onSubmit={registerStudent}>
        <p className="supporting-text">O cliente será identificado como ALUNO{data.students.length + 1}. Defina uma senha para permitir o acesso com o e-mail cadastrado.</p>
        {error && <p className="error-note" role="alert">{error}</p>}
        <label>E-mail do cliente<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Senha do cliente<input required type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Confirmar senha<input required type="password" autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>
        <label>Telefone<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Plano (opcional)<input value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="Ex.: Acompanhamento mensal" /></label>
        <button className="button button--primary" type="submit" disabled={isSubmitting}>
          <Icon name="add" />{isSubmitting ? "Criando acesso..." : "Cadastrar cliente"}
        </button>
      </form>
    </div>
  );
}

export function TeacherStudentDetailPage({ data }) {
  const { studentId } = useParams();
  const student = data.students.find((item) => item.id === studentId);
  if (!student) return <div className="page"><PageHeader title="Aluno não encontrado" backTo="/professor/alunos" backLabel="Voltar aos alunos" /><div className="empty-state"><p>Não encontramos esse cadastro.</p></div></div>;
  const trainings = data.trainings.filter((item) => item.studentId === student.id);
  const appointments = data.appointments.filter((item) => item.studentId === student.id);
  return (
    <div className="page">
      <PageHeader title={student.nome} description="Ficha de acompanhamento do aluno." backTo="/professor/alunos" backLabel="Voltar aos alunos" />
      <div className="summary-grid summary-grid--two">
        <section className="content-card"><p className="eyebrow">SITUAÇÃO</p><h2>{studentStatus(student)}</h2><p>Último treino: {student.ultimoTreino ? formatDate(student.ultimoTreino) : "Sem registro"}</p></section>
        <section className="content-card"><p className="eyebrow">PLANO</p><h2>{student.plano}</h2><p>Telefone: {student.telefone}</p></section>
      </div>
      <section className="content-card"><div className="section-heading"><h2>Treinamentos</h2><Link className="button button--primary" to="/professor/treinamentos">Ver treinamentos</Link></div>{trainings.length ? trainings.map((item) => <div className="simple-list-row" key={item.id}><span><b>{item.titulo}</b><small>{item.duracao} minutos · {item.status}</small></span></div>) : <p>Nenhum treinamento atribuído.</p>}</section>
      <section className="content-card"><h2>Próximos atendimentos</h2>{appointments.length ? appointments.map((item) => <div className="simple-list-row" key={item.id}><span><b>{formatDate(item.date)}</b><small>{item.time} · {item.type} · {item.status}</small></span></div>) : <p>Nenhum atendimento marcado.</p>}</section>
      {student.telefone && <a className="button button--secondary" href={`https://wa.me/${student.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
    </div>
  );
}

export function TeacherTrainingsPage({ data, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [studentId, setStudentId] = useState(data.students[0]?.id || "");
  const [message, setMessage] = useState("");

  function createTraining(event) {
    event.preventDefault();
    if (!title.trim() || !studentId) return;
    onUpdate((current) => ({
      ...current,
      trainings: [{ id: `treino-${Date.now()}`, studentId, titulo: title.trim(), objetivo: "Treinamento criado pelo professor.", duracao: 45, status: "Disponível", exercicios: ["Exercício a definir"] }, ...current.trainings],
    }));
    setMessage("Treinamento criado e disponibilizado.");
    setTitle("");
    setShowForm(false);
  }

  return (
    <div className="page">
      <PageHeader title="Treinamentos" description="Crie e acompanhe os planos compartilhados com seus alunos." action={<button className="button button--primary" type="button" onClick={() => setShowForm((show) => !show)}>Criar treinamento</button>} />
      {message && <p className="success-note" role="status">{message}</p>}
      {showForm && <form className="content-card form-card" onSubmit={createTraining}><h2>Novo treinamento</h2><label>Título<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Treino de força" /></label><label>Aluno<select value={studentId} onChange={(event) => setStudentId(event.target.value)}>{data.students.filter((student) => student.status === "Ativo").map((student) => <option value={student.id} key={student.id}>{student.nome}</option>)}</select></label><div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="button button--primary" type="submit">Salvar treinamento</button></div></form>}
      {data.trainings.length ? <div className="card-list">{data.trainings.map((training) => {
        const student = data.students.find((item) => item.id === training.studentId);
        return <article className="list-card" key={training.id}><div><h2>{training.titulo}</h2><p>{student?.nome || "Sem aluno"}</p><small>{training.duracao} minutos · {training.exercicios.length} exercícios</small></div><span className="status-pill">{training.status}</span></article>;
      })}</div> : <div className="empty-state"><h2>Nenhum treinamento cadastrado</h2><p>Crie um plano para compartilhar com seus alunos.</p></div>}
    </div>
  );
}

export function TeacherAgendaPage({ data, onUpdate }) {
  const todayKey = toDateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState(data.students.find((student) => student.status === "Ativo")?.id || "");
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("Presencial");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth);
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const appointments = data.appointments
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const activeStudents = data.students.filter((student) => student.status === "Ativo");

  function changeMonth(offset) {
    const nextMonth = new Date(year, month + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate(toDateKey(nextMonth));
    setShowForm(false);
    setError("");
    setConfirmation("");
  }

  function createAppointment(event) {
    event.preventDefault();
    setError("");
    setConfirmation("");
    if (selectedDate < todayKey) {
      setError("Escolha uma data a partir de hoje.");
      return;
    }
    const appointmentDate = new Date(`${selectedDate}T12:00:00`);
    if (!isAppointmentDateAvailable(appointmentDate)) {
      setError("O professor não atende aos domingos. Escolha outro dia.");
      return;
    }
    if (!getAppointmentTimes(appointmentDate).includes(time)) {
      setError("Escolha um horário entre 8h e 18h, em intervalos de 30 minutos.");
      return;
    }
    if (!isAppointmentTimeAvailable(data.appointments, appointmentDate, time)) {
      setError("Esse horário já está ocupado. Escolha outro.");
      return;
    }
    const student = activeStudents.find((item) => item.id === studentId);
    if (!student) {
      setError("Escolha um aluno ativo para continuar.");
      return;
    }
    onUpdate((current) => ({
      ...current,
      appointments: [
        ...current.appointments,
        { id: `atend-${Date.now()}`, studentId, date: selectedDate, time, type, status: "Confirmado" },
      ],
    }));
    setShowForm(false);
    setConfirmation("Atendimento agendado.");
  }

  return (
    <div className="page">
      <PageHeader
        title="Agenda"
        action={<button className="button button--primary" type="button" onClick={() => { setShowForm((current) => !current); setError(""); setConfirmation(""); }}>Agendar atendimento</button>}
      />
      <section className="content-card calendar-card" aria-label="Calendário de atendimentos">
        <div className="calendar-header">
          <button className="calendar-nav" type="button" aria-label="Mês anterior" onClick={() => changeMonth(-1)}>‹</button>
          <h2>{monthName}</h2>
          <button className="calendar-nav" type="button" aria-label="Próximo mês" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="calendar-grid" aria-label={`Dias de ${monthName}`}>
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((weekday, index) => (
            <span className="calendar-weekday" key={weekday} aria-label={["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"][index]}>{weekday}</span>
          ))}
          {calendarCells.map((day, index) => {
            if (!day) return <span className="calendar-blank" key={`blank-${index}`} aria-hidden="true" />;
            const date = new Date(year, month, day);
            const dateKey = toDateKey(date);
            const hasAppointment = data.appointments.some((item) => item.date === dateKey && item.status !== "Cancelado");
            return (
              <button
                className={`calendar-day${selectedDate === dateKey ? " is-selected" : ""}${dateKey === todayKey ? " is-today" : ""}`}
                type="button"
                key={dateKey}
                aria-pressed={selectedDate === dateKey}
                aria-label={`${day} de ${monthName}${hasAppointment ? ", com atendimento" : ""}`}
                onClick={() => { setSelectedDate(dateKey); setShowForm(false); setError(""); setConfirmation(""); }}
              >
                {day}
                {hasAppointment && <span className="calendar-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>
      <section className="content-card calendar-details">
        <div className="section-heading">
          <h2>{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</h2>
        </div>
        {confirmation && <p className="success-note" role="status">{confirmation}</p>}
        {appointments.length ? <div className="simple-list">{appointments.map((item) => {
          const student = data.students.find((person) => person.id === item.studentId);
          return <div className="simple-list-row" key={item.id}><strong>{item.time}</strong><span><b>{student?.nome || "Aluno"}</b><small>{item.type}</small></span><span className="status-pill">{item.status}</span></div>;
        })}</div> : <p className="calendar-empty">Sem atendimentos nesta data.</p>}
        {showForm && <form className="form-card calendar-form" onSubmit={createAppointment}>
          <h3>Novo atendimento</h3>
          {error && <p className="error-note" role="alert">{error}</p>}
          <label>Aluno<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}>{activeStudents.map((student) => <option key={student.id} value={student.id}>{student.nome}</option>)}</select></label>
          <div className="calendar-form__row">
            <label>Horário<input required type="time" min="08:00" max="17:30" step="1800" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            <label>Modalidade<select value={type} onChange={(event) => setType(event.target.value)}><option>Presencial</option><option>Online</option></select></label>
          </div>
          <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="button button--primary" type="submit">Salvar</button></div>
        </form>}
      </section>
    </div>
  );
}

export function TeacherProfilePage({ user, onUpdateUser, onUpdateData, data }) {
  const [email, setEmail] = useState(user.email || "marina@treinamentos.com");
  const [phone, setPhone] = useState(user.telefone || "(11) 90000-1000");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Confira o e-mail antes de salvar.");
      return;
    }
    if (data.students.some((student) => student.email.toLowerCase() === email.trim().toLowerCase())) {
      setError("Esse e-mail já está cadastrado para um cliente.");
      return;
    }
    const updated = { ...user, nome: "EFRAIN", papel: "Professor", email: email.trim(), telefone: phone.trim() };
    onUpdateUser(updated);
    onUpdateData((current) => ({
      ...current,
      profiles: { ...current.profiles, professor: updated },
    }));
    setMessage("Perfil atualizado.");
  }

  return (
    <div className="page">
      <PageHeader title="Meu perfil" description="Atualize seus dados profissionais e de contato." />
      <form className="content-card form-card profile-form" onSubmit={saveProfile}>
        {message && <p className="success-note" role="status">{message}</p>}
        {error && <p className="error-note" role="alert">{error}</p>}
        <label>Nome no painel<input value="EFRAIN" readOnly /></label>
        <label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Telefone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
        <p className="supporting-text">Os dados são usados apenas nesta demonstração.</p>
        <button className="button button--primary" type="submit"><Icon name="save" />Salvar alterações</button>
      </form>
    </div>
  );
}
