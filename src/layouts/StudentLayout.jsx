import { Activity, CalendarDays, CircleHelp, CreditCard, Dumbbell, FileText, Flag, HeartPulse, House, PersonStanding, UserRound } from "lucide-react";
import AppLayout from "./AppLayout";

const navigation = [
  { label: "Início", to: "/aluno/inicio", icon: House },
  { label: "Meus treinos", to: "/aluno/treinos", icon: Dumbbell },
  { label: "Exercícios", to: "/aluno/exercicios", icon: PersonStanding },
  { label: "Minhas aulas", to: "/aluno/aulas", icon: CalendarDays },
  { label: "Minhas dúvidas", to: "/aluno/duvidas", icon: CircleHelp },
  { label: "Agendamentos", to: "/aluno/agendamentos", icon: CalendarDays },
  { label: "Perfil e configurações", to: "/aluno/perfil", icon: UserRound },
  { label: "Minha evolução", to: "/aluno/evolucao", icon: Activity },
  { label: "Metas e objetivos", to: "/aluno/metas", icon: Flag },
  { label: "Questionários", to: "/aluno/questionarios", icon: FileText },
  { label: "Check-in de treino", to: "/aluno/check-in", icon: HeartPulse },
  { label: "Pagamentos", to: "/aluno/pagamentos", icon: CreditCard },
  { label: "Histórico de atividades", to: "/aluno/atividades", icon: Activity },
];

export default function StudentLayout() {
  return <AppLayout area="aluno" navigation={navigation} />;
}
