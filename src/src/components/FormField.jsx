import { useId } from "react";

export default function CampoFormulario({ label, erro, className = "", ...props }) {
  const generatedId = useId();
  const id = props.id || generatedId;
  const errorId = erro ? `${id}-erro` : undefined;
  return (
    <div className={`form-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={Boolean(erro)} aria-describedby={errorId} {...props} />
      {erro && <span className="form-field__error" id={errorId}>{erro}</span>}
    </div>
  );
}
