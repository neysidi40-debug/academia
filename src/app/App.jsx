import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "../pages/auth/LoginPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import AccessDeniedPage from "../pages/shared/AccessDeniedPage";
import NotFoundPage from "../pages/shared/NotFoundPage";
import SessionExpiredPage from "../pages/shared/SessionExpiredPage";
import {
  AvaliacoesProfessorPage, CheckinAlunoPage, EvolucaoAlunoPage,
  HistoricoAlunoPage, HistoricoProfessorPage, MetasAlunoPage,
  PagamentosAlunoPage, PlanosProfessorPage, QuestionariosAlunoPage,
  QuestionariosProfessorPage, RelatoriosProfessorPage,
} from "../pages/shared/TrackingPages";
import StudentLayout from "../layouts/StudentLayout";
import TeacherLayout from "../layouts/TeacherLayout";
import PagePlaceholder from "../components/PagePlaceholder";
import ProfessorInicioPage from "../pages/professor/ProfessorInicioPage";
import {
  AgendamentoDetalhePage, AgendamentosPage, AlunoInicioPage, AulaDetalhePage,
  AulasPage, DuvidaDetalhePage, DuvidasPage, ExerciciosPage, MeusTreinosPage, NovaDuvidaPage,
  NovoAgendamentoPage, NotificacoesPage, PerfilPage, TreinoDetalhePage,
} from "../pages/aluno/StudentPages";
import {
  AgendaProfessorPage, AlunosPage, AulasProfessorPage,
  BibliotecaExerciciosPage, ConfiguracoesProfessorPage, ConsultaDetalheProfessorPage,
  ConsultasProfessorPage, DuvidasProfessorPage, EditorTreinoPage,
  NotificacoesProfessorPage, ProfessorInicioPage as TeacherDashboardPage,
  ResponderDuvidaPage, TreinosProfessorPage,
} from "../pages/professor/TeacherPages";
import StudentProfilePage from "../pages/professor/StudentProfilePage";

function PlaceholderRoutes({ area }) {
  const pages = area === "aluno" ? [["inicio", AlunoInicioPage]] : [];
  return pages.map(([path, page]) => {
    const Page = typeof page === "string" ? () => <PagePlaceholder titulo={page} /> : page;
    return <Route key={path} path={path} element={<Page />} />;
  });
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-minha-senha" element={<ForgotPasswordPage />} />
      <Route path="/acesso-negado" element={<AccessDeniedPage />} />
      <Route path="/sessao-expirada" element={<SessionExpiredPage />} />
      <Route path="/aluno" element={<ProtectedRoute perfil="aluno"><StudentLayout /></ProtectedRoute>}>
        {PlaceholderRoutes({ area: "aluno" })}
        <Route path="treinos" element={<MeusTreinosPage />} />
        <Route path="treinos/:treinoId" element={<TreinoDetalhePage />} />
        <Route path="exercicios" element={<ExerciciosPage />} />
        <Route path="aulas" element={<AulasPage />} />
        <Route path="aulas/:aulaId" element={<AulaDetalhePage />} />
        <Route path="duvidas" element={<DuvidasPage />} />
        <Route path="duvidas/nova" element={<NovaDuvidaPage />} />
        <Route path="duvidas/:duvidaId" element={<DuvidaDetalhePage />} />
        <Route path="agendamentos" element={<AgendamentosPage />} />
        <Route path="agendamentos/novo" element={<NovoAgendamentoPage />} />
        <Route path="agendamentos/:agendamentoId" element={<AgendamentoDetalhePage />} />
        <Route path="notificacoes" element={<NotificacoesPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="evolucao" element={<EvolucaoAlunoPage />} />
        <Route path="metas" element={<MetasAlunoPage />} />
        <Route path="questionarios" element={<QuestionariosAlunoPage />} />
        <Route path="check-in" element={<CheckinAlunoPage />} />
        <Route path="pagamentos" element={<PagamentosAlunoPage />} />
        <Route path="atividades" element={<HistoricoAlunoPage />} />
        <Route index element={<Navigate to="inicio" replace />} />
      </Route>
      <Route path="/professor" element={<ProtectedRoute perfil="professor"><TeacherLayout /></ProtectedRoute>}>
        <Route path="inicio" element={<TeacherDashboardPage />} />
        <Route path="alunos" element={<AlunosPage />} />
        <Route path="alunos/:alunoId" element={<StudentProfilePage />} />
        <Route path="treinos" element={<TreinosProfessorPage />} />
        <Route path="treinos/novo" element={<EditorTreinoPage />} />
        <Route path="treinos/:treinoId/editar" element={<EditorTreinoPage />} />
        <Route path="exercicios" element={<BibliotecaExerciciosPage />} />
        <Route path="aulas" element={<AulasProfessorPage />} />
        <Route path="duvidas" element={<DuvidasProfessorPage />} />
        <Route path="duvidas/:duvidaId" element={<ResponderDuvidaPage />} />
        <Route path="agendamentos" element={<ConsultasProfessorPage />} />
        <Route path="agendamentos/:agendamentoId" element={<ConsultaDetalheProfessorPage />} />
        <Route path="agenda" element={<AgendaProfessorPage />} />
        <Route path="consultas" element={<ConsultasProfessorPage />} />
        <Route path="consultas/:agendamentoId" element={<ConsultaDetalheProfessorPage />} />
        <Route path="configuracoes" element={<ConfiguracoesProfessorPage />} />
        <Route path="notificacoes" element={<NotificacoesProfessorPage />} />
        <Route path="avaliacoes" element={<AvaliacoesProfessorPage />} />
        <Route path="relatorios" element={<RelatoriosProfessorPage />} />
        <Route path="questionarios" element={<QuestionariosProfessorPage />} />
        <Route path="planos" element={<PlanosProfessorPage />} />
        <Route path="atividades" element={<HistoricoProfessorPage />} />
        <Route index element={<Navigate to="inicio" replace />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
