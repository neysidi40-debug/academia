import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { getAppointmentTimes, isAppointmentDateAvailable, isAppointmentTimeAvailable, toDateKey } from "../utils/appointmentAvailability.js";

function PageHeader({ title, description, backTo = "/aluno/inicio", backLabel = "Voltar ao início" }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <Link className="button button--secondary" to={backTo}><Icon name="arrowBack" />{backLabel}</Link>
    </header>
  );
}

function formatDate(value, options = { weekday: "long", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(`${value}T12:00:00`));
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextBookableDate(date) {
  const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (let offset = 0; offset < 7; offset += 1) {
    if (isAppointmentDateAvailable(candidate)) return toDateKey(candidate);
    candidate.setDate(candidate.getDate() + 1);
  }
  return localDateKey(date);
}

export function StudentHomePage({ user, data }) {
  const training = data.trainings.find((item) => item.studentId === user.id && item.status === "Disponível");
  const appointment = data.appointments
    .filter((item) => item.studentId === user.id && item.date >= localDateKey() && item.status === "Confirmado")
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  const today = localDateKey();
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="page student-home">
      <header className="student-welcome">
        <div>
          <p className="student-welcome__eyebrow">TREINAMENTOS ONLINE</p>
          <h1>Olá, {user.nome.split(" ")[0]}</h1>
          <p>Seu treino e seu próximo atendimento estão aqui.</p>
        </div>
        <time dateTime={today}>{todayLabel}</time>
      </header>
      <section className="feature-card student-training-card" aria-labelledby="today-training-title">
        <p className="student-training-card__eyebrow">MEU TREINO DE HOJE</p>
        {training ? (
          <>
            <h2 id="today-training-title">{training.titulo}</h2>
            <p>{training.objetivo}</p>
            <p className="student-training-card__details">{training.duracao} minutos · {training.exercicios.length} exercícios</p>
            <Link className="button button--primary" to={`/aluno/treinamentos/${training.id}`}><Icon name="training" />Começar treino</Link>
          </>
        ) : (
          <>
            <h2 id="today-training-title">Nenhum treino disponível</h2>
            <p>Quando um treino for atribuído, ele aparecerá aqui.</p>
          </>
        )}
      </section>
      <section className="content-card student-appointment-card" aria-labelledby="next-appointment-title">
        <div>
          <p className="eyebrow">PRÓXIMO ATENDIMENTO</p>
        {appointment ? (
          <>
            <h2 id="next-appointment-title">{formatDate(appointment.date)}</h2>
            <p>{appointment.time} · {appointment.type} · {appointment.status}</p>
          </>
        ) : (
          <>
            <h2 id="next-appointment-title">Sem atendimento marcado</h2>
            <p>Consulte sua agenda para combinar um horário com o professor.</p>
          </>
        )}
        </div>
        <div className="student-appointment-card__action"><Link className="text-link" to="/aluno/agenda">Ver agenda</Link></div>
      </section>
      <Link className="student-all-trainings" to="/aluno/treinamentos">Ver todos os meus treinos</Link>
    </div>
  );
}

export function StudentTrainingsPage({ user, data }) {
  const trainings = data.trainings.filter((item) => item.studentId === user.id);
  return (
    <div className="page">
      <PageHeader title="Meus treinamentos" description="Seus planos e exercícios em um só lugar." />
      {trainings.length ? (
        <div className="card-list">{trainings.map((training) => (
          <article className="list-card" key={training.id}>
            <div><h2>{training.titulo}</h2><p>{training.objetivo}</p><small>{training.duracao} minutos · {training.exercicios.length} exercícios</small></div>
            <span className="status-pill">{training.status}</span>
            <Link className="button button--secondary" to={`/aluno/treinamentos/${training.id}`}><Icon name="training" />Ver treinamento</Link>
          </article>
        ))}</div>
      ) : <div className="empty-state"><h2>Nenhum treinamento ainda</h2><p>Seu professor poderá disponibilizar um plano por aqui.</p></div>}
    </div>
  );
}

export function StudentTrainingDetailPage({ user, data, onUpdate }) {
  const { trainingId } = useParams();
  const training = data.trainings.find((item) => item.id === trainingId && item.studentId === user.id);
  const feedback = (data.feedbacks || []).find((item) => item.trainingId === trainingId && item.studentId === user.id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  if (!training) return <div className="page"><PageHeader title="Treinamento não encontrado" backTo="/aluno/treinamentos" backLabel="Meus treinamentos" /><div className="empty-state"><p>Este treinamento não está disponível para sua conta.</p></div></div>;

  function completeTraining() {
    onUpdate((current) => ({
      ...current,
      trainings: current.trainings.map((item) => item.id === training.id ? { ...item, status: "Concluído" } : item),
      students: current.students.map((item) => item.id === user.id ? { ...item, ultimoTreino: new Date().toISOString().slice(0, 10) } : item),
    }));
  }

  function submitFeedback(event) {
    event.preventDefault();
    setFeedbackError("");
    if (rating < 1 || rating > 5) {
      setFeedbackError("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }
    if (!comment.trim()) {
      setFeedbackError("Escreva um comentário antes de enviar.");
      return;
    }

    onUpdate((current) => {
      const feedbacks = current.feedbacks || [];
      if (feedbacks.some((item) => item.trainingId === training.id && item.studentId === user.id)) {
        return current;
      }
      return {
        ...current,
        feedbacks: [{
          id: `feedback-${Date.now()}`,
          trainingId: training.id,
          trainingTitle: training.titulo,
          studentId: user.id,
          studentName: user.nome,
          rating,
          comment: comment.trim(),
          createdAt: new Date().toISOString(),
        }, ...feedbacks],
      };
    });
    setFeedbackSaved(true);
  }

  return (
    <div className="page">
      <PageHeader title={training.titulo} description={training.objetivo} backTo="/aluno/treinamentos" backLabel="Meus treinamentos" />
      <section className="content-card">
        <p className="supporting-text">{training.duracao} minutos · {training.exercicios.length} exercícios</p>
        <h2>Exercícios</h2>
        <ol className="exercise-list">{training.exercicios.map((exercise) => <li key={exercise}>{exercise}</li>)}</ol>
        {training.status === "Concluído" ? <p className="success-note">Treinamento concluído. Você pode rever os exercícios quando quiser.</p> : <button className="button button--primary" type="button" onClick={completeTraining}><Icon name="check" />Marcar treino como concluído</button>}
      </section>
      {training.status === "Concluído" && (
        feedback || feedbackSaved ? (
          <section className="content-card" aria-live="polite">
            <p className="success-note">Obrigado! Seu feedback foi enviado e ficará visível para os outros alunos.</p>
          </section>
        ) : (
          <form className="content-card form-card training-feedback-form" onSubmit={submitFeedback}>
            <div>
              <p className="eyebrow">TREINO CONCLUÍDO</p>
              <h2>Como foi esse treino?</h2>
              <p className="supporting-text">Sua avaliação será pública para os outros alunos.</p>
            </div>
            <fieldset className="star-rating">
              <legend>Sua nota (de 1 a 5 estrelas)</legend>
              <div className="star-rating__buttons">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={`star-rating__button${value <= rating ? " is-selected" : ""}`}
                    type="button"
                    aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
            <label>Comentário<textarea required maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Conte brevemente como foi sua experiência." /></label>
            <small className="supporting-text">{comment.length}/500 caracteres</small>
            {feedbackError && <p className="error-note" role="alert">{feedbackError}</p>}
            <button className="button button--primary" type="submit"><Icon name="check" />Enviar feedback</button>
          </form>
        )
      )}
      <p className="safety-note">Se sentir dor ou mal-estar, interrompa o exercício e procure orientação do professor.</p>
    </div>
  );
}

export function StudentFeedbacksPage({ data }) {
  const feedbacks = [...(data.feedbacks || [])].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  return (
    <div className="page">
      <PageHeader title="Feedbacks dos alunos" description="Avaliações de treinos concluídos, compartilhadas pelos alunos." />
      {feedbacks.length ? (
        <div className="card-list">
          {feedbacks.map((feedback) => (
            <article className="content-card feedback-card" key={feedback.id}>
              <div className="feedback-card__heading">
                <div>
                  <h2>{feedback.trainingTitle}</h2>
                  <p>{feedback.studentName}</p>
                </div>
                <span className="feedback-rating" role="img" aria-label={`${feedback.rating} de 5 estrelas`}>
                  {"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}
                  <small>{feedback.rating}/5</small>
                </span>
              </div>
              <p className="feedback-card__comment">{feedback.comment}</p>
              <time dateTime={feedback.createdAt}>{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(feedback.createdAt))}</time>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Ainda não há feedbacks</h2>
          <p>Quando os alunos avaliarem treinos concluídos, os comentários aparecerão aqui.</p>
          <Link className="button button--secondary" to="/aluno/treinamentos"><Icon name="training" />Ver meus treinos</Link>
        </div>
      )}
    </div>
  );
}

export function StudentAgendaPage({ user, data, onUpdate }) {
  const today = toDateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => nextBookableDate(new Date()));
  const [selectedTime, setSelectedTime] = useState("");
  const [type, setType] = useState("Presencial");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth);
  const currentMonth = new Date();
  const isCurrentMonth = year === currentMonth.getFullYear() && month === currentMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const selectedDateValue = new Date(`${selectedDate}T12:00:00`);
  const appointmentsOnDate = data.appointments.filter((item) => item.date === selectedDate);
  const times = [...new Set([
    ...getAppointmentTimes(selectedDateValue),
    ...appointmentsOnDate.map((item) => item.time),
  ])].sort((a, b) => a.localeCompare(b));
  const upcomingAppointments = data.appointments
    .filter((item) => item.studentId === user.id && item.date >= today && item.status !== "Cancelado")
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  function changeMonth(offset) {
    const nextMonth = new Date(year, month + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate(nextBookableDate(nextMonth));
    setSelectedTime("");
    setMessage("");
    setError("");
  }

  function selectDate(dateKey) {
    setSelectedDate(dateKey);
    setSelectedTime("");
    setMessage("");
    setError("");
  }

  function bookAppointment() {
    setMessage("");
    setError("");
    if (selectedDate < today) {
      setError("Escolha uma data a partir de hoje.");
      return;
    }
    if (!isAppointmentTimeAvailable(data.appointments, selectedDateValue, selectedTime)) {
      setSelectedTime("");
      setError("Esse horário acabou de ser reservado. Escolha outro horário disponível.");
      return;
    }
    onUpdate((current) => ({
      ...current,
      appointments: [
        ...current.appointments,
        { id: `atend-${Date.now()}`, studentId: user.id, date: selectedDate, time: selectedTime, type, status: "Confirmado" },
      ],
    }));
    setMessage("Aula marcada. Você já pode conferir em Minha agenda.");
    setSelectedTime("");
  }

  return (
    <div className="page">
      <PageHeader title="Agenda do professor" description="Escolha uma data e veja os horários livres." />
      <p className="availability-note">Atendimentos de segunda a sábado, das 8h às 17h30. Horários a cada 30 minutos.</p>
      <section className="content-card calendar-card student-calendar" aria-label="Calendário da agenda do professor">
        <div className="calendar-header">
          <button className="calendar-nav" type="button" aria-label="Mês anterior" disabled={isCurrentMonth} onClick={() => changeMonth(-1)}>‹</button>
          <h2>{monthName}</h2>
          <button className="calendar-nav" type="button" aria-label="Próximo mês" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="calendar-grid" aria-label={`Dias de ${monthName}`}>
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day, index) => (
            <span className="calendar-weekday" key={day} aria-label={["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"][index]}>{day}</span>
          ))}
          {calendarDays.map((day, index) => {
            if (!day) return <span className="calendar-blank" key={`blank-${index}`} aria-hidden="true" />;
            const date = new Date(year, month, day);
            const dateKey = toDateKey(date);
            const hasAppointment = data.appointments.some((item) => item.date === dateKey && item.status !== "Cancelado");
            const isPast = dateKey < today;
            const isOpen = isAppointmentDateAvailable(date);
            return (
              <button
                className={`calendar-day${selectedDate === dateKey ? " is-selected" : ""}${dateKey === today ? " is-today" : ""}${!isOpen ? " is-unavailable" : ""}`}
                type="button"
                key={dateKey}
                disabled={isPast || !isOpen}
                aria-pressed={selectedDate === dateKey}
                aria-label={`${day} de ${monthName}${hasAppointment ? ", há horário reservado" : ""}${!isOpen ? ", professor não atende" : ""}`}
                onClick={() => selectDate(dateKey)}
              >
                {day}
                {hasAppointment && <span className="calendar-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>
      <section className="content-card calendar-details">
        <div className="section-heading"><h2>{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</h2></div>
        {error && <p className="error-note" role="alert">{error}</p>}
        {message && <p className="success-note" role="status">{message}</p>}
        {times.length ? (
          <>
            <p className="supporting-text">Toque em um horário livre para selecionar.</p>
            <div className="appointment-slots" aria-label="Horários disponíveis">
              {times.map((time) => {
                const available = isAppointmentTimeAvailable(data.appointments, selectedDateValue, time);
                return (
                  <button
                    className={`appointment-slot${available ? "" : " is-booked"}${selectedTime === time ? " is-selected" : ""}`}
                    type="button"
                    key={time}
                    disabled={!available}
                    aria-label={available ? `${time}, disponível` : `${time}, já marcado`}
                    aria-pressed={selectedTime === time}
                    onClick={() => { setSelectedTime(time); setError(""); setMessage(""); }}
                  >
                    <span>{available ? time : `× ${time}`}</span>
                    {!available && <small>Já marcado</small>}
                  </button>
                );
              })}
            </div>
          </>
        ) : <p className="calendar-empty">O professor não atende aos domingos.</p>}
        {selectedTime && <div className="appointment-confirm">
          <label>Modalidade<select value={type} onChange={(event) => setType(event.target.value)}><option>Presencial</option><option>Online</option></select></label>
          <p>Você selecionou <strong>{selectedTime}</strong> para {formatDate(selectedDate, { day: "numeric", month: "long" })}.</p>
          <button className="button button--primary" type="button" onClick={bookAppointment}><Icon name="calendar" />Confirmar aula</button>
        </div>}
      </section>
      <section className="content-card student-upcoming">
        <h2>Meus próximos atendimentos</h2>
        {upcomingAppointments.length ? <div className="simple-list">{upcomingAppointments.map((item) => (
          <div className="simple-list-row" key={item.id}><strong>{item.time}</strong><span><b>{formatDate(item.date)}</b><small>{item.type}</small></span><span className="status-pill">{item.status}</span></div>
        ))}</div> : <p className="calendar-empty">Você ainda não tem aulas marcadas.</p>}
      </section>
    </div>
  );
}

export function StudentProfilePage({ user, onUpdateUser, onUpdateData }) {
  const [email, setEmail] = useState(user.email || "lucas@email.com");
  const [phone, setPhone] = useState(user.telefone || "(11) 98888-1010");
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
    const updated = { ...user, email: email.trim(), telefone: phone.trim() };
    onUpdateUser(updated);
    onUpdateData((current) => ({
      ...current,
      students: current.students.map((student) => student.id === user.id
        ? { ...student, email: updated.email, telefone: updated.telefone }
        : student),
    }));
    setMessage("Perfil atualizado.");
  }

  return (
    <div className="page">
      <PageHeader title="Meu perfil" description="Mantenha seus dados de contato atualizados." />
      <form className="content-card form-card profile-form" onSubmit={saveProfile}>
        {message && <p className="success-note" role="status">{message}</p>}
        {error && <p className="error-note" role="alert">{error}</p>}
        <p className="profile-name"><strong>Nome na plataforma:</strong> {user.nome}</p>
        <label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Telefone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
        <p className="supporting-text">Os dados são usados apenas nesta demonstração.</p>
        <button className="button button--primary" type="submit"><Icon name="save" />Salvar alterações</button>
      </form>
    </div>
  );
}
