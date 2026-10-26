import { ArrowRight } from "lucide-react";

export default function EstadoVazio({ mensagem, proximoPasso, acao }) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon" aria-hidden="true"><ArrowRight size={19} /></span>
      <h2>{mensagem}</h2>
      {proximoPasso && <p>{proximoPasso}</p>}
      {acao}
    </section>
  );
}
