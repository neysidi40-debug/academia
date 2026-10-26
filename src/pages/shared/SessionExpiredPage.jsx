import { Link } from "react-router-dom";
import { LogIn, ShieldAlert } from "lucide-react";

export default function SessionExpiredPage() {
  return <main className="standalone-state">
    <section className="empty-state" aria-labelledby="session-expired-title">
      <span className="empty-state__icon" aria-hidden="true"><ShieldAlert size={20} /></span>
      <span className="eyebrow">SESSÃO ENCERRADA</span>
      <h1 id="session-expired-title">Entre novamente para continuar</h1>
      <p>Sua sessão não está ativa. Faça uma nova entrada pela demonstração de aluno ou professor.</p>
      <Link className="button button--primary" to="/login"><LogIn size={16} /> Ir para entrada</Link>
    </section>
  </main>;
}
