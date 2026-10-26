function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const mockUsers = {
  professor: {
    id: "prof-1",
    nome: "EFRAIN",
    papel: "Professor",
    email: "marina@treinamentos.com",
    telefone: "(11) 90000-1000",
  },
  aluno: {
    id: "aluno-1",
    nome: "ALUNO1",
    papel: "Aluno",
    email: "lucas@email.com",
    telefone: "(11) 98888-1010",
  },
};

export const initialData = {
  profiles: {
    professor: { ...mockUsers.professor },
  },
  students: [
    { id: "aluno-1", nome: "ALUNO1", email: "lucas@email.com", telefone: "(11) 98888-1010", status: "Ativo", plano: "Acompanhamento mensal", ultimoTreino: dateOffset(-2) },
    { id: "aluno-2", nome: "ALUNO2", email: "bia@email.com", telefone: "(11) 97777-2020", status: "Ativo", plano: "Treino e avaliação", ultimoTreino: dateOffset(-9) },
    { id: "aluno-3", nome: "ALUNO3", email: "rafael@email.com", telefone: "(11) 96666-3030", status: "Convite pendente", plano: "Não definido", ultimoTreino: "" },
  ],
  trainings: [
    { id: "treino-1", studentId: "aluno-1", titulo: "Força e condicionamento", objetivo: "Fortalecer o corpo e melhorar o condicionamento.", duracao: 45, status: "Disponível", exercicios: ["Agachamento livre", "Remada com elástico", "Prancha frontal"] },
    { id: "treino-2", studentId: "aluno-1", titulo: "Mobilidade e recuperação", objetivo: "Uma sessão leve para mobilidade.", duracao: 30, status: "Disponível", exercicios: ["Mobilidade de quadril", "Ponte de glúteos", "Caminhada leve"] },
    { id: "treino-3", studentId: "aluno-2", titulo: "Treino de força", objetivo: "Movimentos de força com controle.", duracao: 50, status: "Disponível", exercicios: ["Avanço alternado", "Desenvolvimento com halteres", "Dead bug"] },
  ],
  appointments: [
    { id: "atend-1", studentId: "aluno-1", date: dateOffset(1), time: "09:00", type: "Presencial", status: "Confirmado" },
    { id: "atend-2", studentId: "aluno-2", date: dateOffset(3), time: "11:00", type: "Online", status: "Confirmado" },
  ],
};
