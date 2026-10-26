import { getDemoCredentials } from "./dataService";

export function signIn(email, password) {
  const credential = getDemoCredentials().find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.senha === password,
  );
  if (!credential) {
    return { ok: false, message: "Não foi possível entrar. Confira seus dados ou use uma conta de demonstração." };
  }

  const status = credential.usuario.status;
  if (status === "convite_pendente") {
    return { ok: false, message: "Seu convite ainda está pendente. Peça à professora para reenviar o convite e ativar seu acesso." };
  }
  if (status === "suspenso") {
    return { ok: false, message: "Seu acesso está suspenso. Entre em contato com a professora para saber como reativá-lo." };
  }
  if (status === "encerrado") {
    return { ok: false, message: "Este acompanhamento foi encerrado. Fale com a professora para combinar os próximos passos." };
  }
  return { ok: true, usuario: credential.usuario };
}

export function getPasswordHelp(email) {
  if (!email.trim()) return "Informe seu e-mail para receber as instruções de recuperação.";
  return "Se houver uma conta ativa para este e-mail, as instruções de recuperação estarão disponíveis na sua caixa de entrada. Como este é um protótipo, nenhum e-mail será enviado.";
}
