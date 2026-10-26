import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AppLayout from "./components/AppLayout.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { initialData, mockUsers } from "./data/mockData.js";
import LoginPage from "./pages/LoginPage.jsx";
import {
  StudentAgendaPage, StudentHomePage, StudentProfilePage, StudentTrainingDetailPage, StudentTrainingsPage,
} from "./pages/StudentPages.jsx";
import {
  TeacherAgendaPage, TeacherFeedbacksPage, TeacherHomePage, TeacherProfilePage, TeacherRegisterStudentPage, TeacherStudentDetailPage, TeacherStudentsPage, TeacherTrainingsPage,
} from "./pages/TeacherPages.jsx";

const studentLinks = [
  { label: "Início", to: "/aluno/inicio", icon: "home" },
  { label: "Meus treinamentos", to: "/aluno/treinamentos", icon: "training" },
  { label: "Minha agenda", to: "/aluno/agenda", icon: "calendar" },
  { label: "Meu perfil", to: "/aluno/perfil", icon: "profile" },
];

const teacherLinks = [
  { label: "Início", to: "/professor/inicio", icon: "home" },
  { label: "Alunos", to: "/professor/alunos", icon: "users" },
  { label: "Treinamentos", to: "/professor/treinamentos", icon: "training" },
  { label: "Agenda", to: "/professor/agenda", icon: "calendar" },
  { label: "Avaliações", to: "/professor/avaliacoes", icon: "star" },
  { label: "Meu perfil", to: "/professor/perfil", icon: "profile" },
];

function removePhotoFields(value) {
  if (Array.isArray(value)) return value.map(removePhotoFields);
  if (!value || typeof value !== "object") return value;
  const photoFields = new Set(["photo", "photoCrop", "photoAspect", "profilePhoto"]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !photoFields.has(key))
      .map(([key, nestedValue]) => [key, removePhotoFields(nestedValue)]),
  );
}

function RequireRole({ role, user, children }) {
  if (!user) return <Navigate to="/" replace />;
  const currentRole = user.papel.toLowerCase().startsWith("prof") ? "professor" : "aluno";
  if (currentRole !== role) return <Navigate to={`/${currentRole}/inicio`} replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(() => {
    const storedData = window.localStorage.getItem("treinamentos-online-data");
    if (!storedData) return initialData;
    const parsedData = removePhotoFields(JSON.parse(storedData));
    const students = (Array.isArray(parsedData.students) ? parsedData.students : initialData.students)
      .map((student, index) => ({
        ...student,
        nome: `ALUNO${index + 1}`,
      }));
    const studentNames = new Map(students.map((student) => [student.id, student.nome]));
    const storedProfessor = parsedData.profiles?.professor || initialData.profiles.professor;
    const professorProfile = {
      ...storedProfessor,
      nome: "EFRAIN",
      papel: "Professor",
    };
    return {
      ...initialData,
      ...parsedData,
      profiles: {
        ...initialData.profiles,
        ...(parsedData.profiles || {}),
        professor: professorProfile,
      },
      students,
      trainings: Array.isArray(parsedData.trainings) ? parsedData.trainings : initialData.trainings,
      appointments: Array.isArray(parsedData.appointments) ? parsedData.appointments : initialData.appointments,
      feedbacks: (Array.isArray(parsedData.feedbacks) ? parsedData.feedbacks : []).map((feedback) => ({
        ...feedback,
        studentName: studentNames.get(feedback.studentId) || feedback.studentName,
      })),
    };
  });
  const [theme, setTheme] = useState(() => window.localStorage.getItem("treinamentos-online-theme") || "light");
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("treinamentos-online-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("treinamentos-online-data", JSON.stringify(data));
  }, [data]);

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  function signOut() {
    setUser(null);
    navigate("/", { replace: true });
  }

  function signIn(role, email) {
    if (role === "professor") {
      setUser({ ...mockUsers.professor, ...(data.profiles?.professor || {}), nome: "EFRAIN", papel: "Professor" });
      return;
    }
    const student = data.students.find((item) => (
      item.status === "Ativo" && item.email.toLowerCase() === email.toLowerCase()
    ));
    if (student) setUser({ ...student, nome: `ALUNO${data.students.findIndex((item) => item.id === student.id) + 1}`, papel: "Aluno" });
  }

  function loginProps() {
    return {
      onSignIn: signIn,
      theme,
      onToggleTheme: toggleTheme,
      data: { ...data, profiles: { ...initialData.profiles, ...(data.profiles || {}) } },
    };
  }

  function layoutProps(area) {
    const userForArea = user || data.profiles?.[area] || mockUsers[area];
    return {
      user: area === "professor"
        ? { ...userForArea, nome: "EFRAIN", papel: "Professor" }
        : userForArea,
      area,
      links: area === "aluno" ? studentLinks : teacherLinks,
      onSignOut: signOut,
      theme,
      onToggleTheme: toggleTheme,
    };
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage {...loginProps()} />} />
      <Route path="/login/:role" element={<LoginPage {...loginProps()} />} />
      <Route path="/aluno" element={<RequireRole role="aluno" user={user}><AppLayout {...layoutProps("aluno")} /></RequireRole>}>
        <Route path="inicio" element={<StudentHomePage user={user || mockUsers.aluno} data={data} />} />
        <Route path="treinamentos" element={<StudentTrainingsPage user={user || mockUsers.aluno} data={data} />} />
        <Route path="treinamentos/:trainingId" element={<StudentTrainingDetailPage user={user || mockUsers.aluno} data={data} onUpdate={setData} />} />
        <Route path="agenda" element={<StudentAgendaPage user={user || mockUsers.aluno} data={data} onUpdate={setData} />} />
        <Route path="perfil" element={<StudentProfilePage user={user || mockUsers.aluno} onUpdateUser={setUser} onUpdateData={setData} />} />
        <Route index element={<Navigate to="inicio" replace />} />
      </Route>
      <Route path="/professor" element={<RequireRole role="professor" user={user}><AppLayout {...layoutProps("professor")} /></RequireRole>}>
        <Route path="inicio" element={<TeacherHomePage user={user || mockUsers.professor} data={data} />} />
        <Route path="alunos" element={<TeacherStudentsPage data={data} />} />
        <Route path="clientes/novo" element={<TeacherRegisterStudentPage data={data} onUpdate={setData} />} />
        <Route path="alunos/:studentId" element={<TeacherStudentDetailPage data={data} />} />
        <Route path="treinamentos" element={<TeacherTrainingsPage data={data} onUpdate={setData} />} />
        <Route path="avaliacoes" element={<TeacherFeedbacksPage data={data} />} />
        <Route path="agenda" element={<TeacherAgendaPage data={data} onUpdate={setData} />} />
        <Route path="perfil" element={<TeacherProfilePage user={user || data.profiles?.professor || mockUsers.professor} onUpdateUser={setUser} onUpdateData={setData} data={data} />} />
        <Route index element={<Navigate to="inicio" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
