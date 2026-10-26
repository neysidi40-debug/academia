import { Check, CircleAlert, X } from "lucide-react";

export default function Toast({ mensagem, tipo = "sucesso", fechar }) {
  if (!mensagem) return null;
  const Icon = tipo === "erro" ? CircleAlert : Check;
  return (
    <div className={`toast toast--${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <span>{mensagem}</span>
      <button className="icon-button" onClick={fechar} aria-label="Fechar aviso"><X size={16} /></button>
    </div>
  );
}
