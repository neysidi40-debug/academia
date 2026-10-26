import { Activity, Bell, CalendarDays, CircleHelp, ClipboardCheck, Dumbbell, FileBarChart2, FileText, House, MoreHorizontal, Package, Settings, Users } from "lucide-react";
import AppLayout from "./AppLayout";

const navigation = [
  { label: "Início", to: "/professor/inicio", icon: House },
  { label: "Alunos", to: "/professor/alunos", icon: Users },
  { label: "Treinos", to: "/professor/treinos", icon: Dumbbell },
  { label: "Agenda", to: "/professor/agenda", icon: CalendarDays },
  { label: "Perguntas", to: "/professor/duvidas", icon: CircleHelp },
  {
    label: "Mais",
    icon: MoreHorizontal,
    children: [
      { label: "Atendimentos", to: "/professor/consultas", icon: CalendarDays },
      { label: "Exercícios", to: "/professor/exercicios", icon: Dumbbell },
      { label: "Aulas", to: "/professor/aulas", icon: CalendarDays },
      { label: "Avaliações físicas", to: "/professor/avaliacoes", icon: ClipboardCheck },
      { label: "Relatórios", to: "/professor/relatorios", icon: FileBarChart2 },
      { label: "Questionários", to: "/professor/questionarios", icon: FileText },
      { label: "Planos e serviços", to: "/professor/planos", icon: Package },
      { label: "Notificações", to: "/professor/notificacoes", icon: Bell },
      { label: "Registro de alterações", to: "/professor/atividades", icon: Activity },
      { label: "Configurações", to: "/professor/configuracoes", icon: Settings },
    ],
  },
];

export default function TeacherLayout() {
  return <AppLayout area="professor" navigation={navigation} />;
}
