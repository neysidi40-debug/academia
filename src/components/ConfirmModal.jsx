import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Button from "./Button";

export default function ModalConfirmacao({ aberto, titulo, mensagem, confirmarTexto = "Confirmar", aoConfirmar, aoFechar, children, ocultarAcoes = false }) {
  useEffect(() => {
    if (!aberto) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && aoFechar()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button modal__close" onClick={aoFechar} aria-label="Fechar janela"><X size={18} /></button>
        <h2 id="modal-title">{titulo}</h2>
        <p>{mensagem}</p>
        {children}
        {!ocultarAcoes && <div className="modal__actions">
          <Button variant="secondary" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={aoConfirmar}>{confirmarTexto}</Button>
        </div>}
      </section>
    </div>,
    document.body,
  );
}
