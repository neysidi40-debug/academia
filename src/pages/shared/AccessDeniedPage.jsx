import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <main className="standalone-state">
      <div className="standalone-card">
        <span className="standalone-icon"><ShieldX size={24} /></span>
        <span className="eyebrow">ACESSO RESTRITO</span>
        <h1>Acesso negado</h1>
        <p>Esta área não está disponível para o seu perfil. Entre com a conta adequada para continuar.</p>
        <Link className="button button--primary" to="/login">Ir para entrada</Link>
      </div>
    </main>
  );
}
