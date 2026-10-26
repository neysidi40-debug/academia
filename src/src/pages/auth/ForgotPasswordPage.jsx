import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Button from "../../components/Button";
import CampoFormulario from "../../components/FormField";
import { getPasswordHelp } from "../../services/authService";

export default function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  function enviar(event) {
    event.preventDefault();
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErro("Informe um e-mail válido.");
      setMensagem("");
      return;
    }
    setErro("");
    setMensagem(getPasswordHelp(email));
  }
  return (
    <main className="recovery-page">
      <div className="recovery-card">
        <Link className="brand" to="/login"><span className="brand__mark">m</span> movimento</Link>
        <span className="eyebrow">RECUPERAÇÃO DE ACESSO</span>
        <h1>Esqueceu sua senha?</h1>
        <p>Informe o e-mail da sua conta para ver as instruções de recuperação.</p>
        <form onSubmit={enviar} noValidate>
          <CampoFormulario label="E-mail" type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={(event) => setEmail(event.target.value)} erro={erro} />
          <Button type="submit" className="button--wide">Ver instruções</Button>
        </form>
        {mensagem && <p className="inline-notice" role="status">{mensagem}</p>}
        <Link className="back-link" to="/login">Voltar para entrar</Link>
      </div>
    </main>
  );
}
