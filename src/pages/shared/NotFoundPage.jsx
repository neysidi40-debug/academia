import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="standalone-state">
      <div className="standalone-card">
        <span className="eyebrow">PÁGINA NÃO ENCONTRADA</span>
        <h1>Não encontramos este endereço</h1>
        <p>Confira o endereço ou volte para a entrada.</p>
        <Link className="button button--primary" to="/login">Voltar para entrada</Link>
      </div>
    </main>
  );
}
