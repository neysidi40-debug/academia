import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, MoveUpRight } from "lucide-react";
import Button from "../../components/Button";
import CampoFormulario from "../../components/FormField";
import MensagemErro from "../../components/ErrorMessage";
import ModalConfirmacao from "../../components/ConfirmModal";
import Toast from "../../components/Toast";
import { signIn } from "../../services/authService";
import { useApp } from "../../context/AppContext";

export default function LoginPage() {
  const { entrar, carregando, erro: appError, tentarCarregar, restaurar } = useApp();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [validacao, setValidacao] = useState({});
  const [confirmacao, setConfirmacao] = useState(false);
  const [toast, setToast] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  function irParaArea(usuario) {
    entrar(usuario);
    const intendedPath = location.state?.from?.pathname;
    const defaultPath = usuario.perfil === "professor" ? "/professor/inicio" : "/aluno/inicio";
    navigate(intendedPath?.startsWith(`/${usuario.perfil}/`) ? intendedPath : defaultPath, { replace: true });
  }

  function entrarComFormulario(event) {
    event.preventDefault();
    setErro("");
    setAviso("");
    const issues = {};
    if (!email.trim()) issues.email = "Informe seu e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.email = "Informe um e-mail válido.";
    if (!senha) issues.senha = "Informe sua senha.";
    setValidacao(issues);
    if (Object.keys(issues).length) return;
    const result = signIn(email, senha);
    if (!result.ok) {
      setErro(result.message);
      return;
    }
    irParaArea(result.usuario);
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Link className="brand brand--light" to="/login"><span className="brand__mark">m</span> movimento</Link>
        <div className="auth-story__content">
          <span className="eyebrow">TREINO COM ACOMPANHAMENTO</span>
          <h1>Consistência se constrói <em>um passo por vez.</em></h1>
          <p>Um espaço para acompanhar sua evolução e manter professor e aluno na mesma direção.</p>
        </div>
        <div className="auth-story__foot"><span>Movimento, no seu ritmo.</span><span>01 / 04</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand"><span className="brand__mark">m</span> movimento</div>
          <span className="eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>Acesse sua conta</h2>
          <p className="auth-intro">Entre para continuar seu acompanhamento.</p>
          {appError && <MensagemErro mensagem={appError} tentarNovamente={tentarCarregar} />}
          <form onSubmit={entrarComFormulario} noValidate>
            <CampoFormulario label="E-mail" type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={(event) => setEmail(event.target.value)} erro={validacao.email} />
            <div className="password-field">
              <CampoFormulario label="Senha" type={mostrarSenha ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" value={senha} onChange={(event) => setSenha(event.target.value)} erro={validacao.senha} />
              <button className="password-toggle" type="button" onClick={() => setMostrarSenha((current) => !current)} aria-label={mostrarSenha ? "Ocultar senha" : "Exibir senha"}>{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {erro && <MensagemErro mensagem={erro} />}
            {aviso && <p className="inline-notice" role="status">{aviso}</p>}
            <div className="auth-links"><Link to="/esqueci-minha-senha" state={{ email }}>Esqueci minha senha</Link></div>
            <Button type="submit" className="button--wide" disabled={carregando}>Entrar <MoveUpRight size={17} /></Button>
          </form>
          <div className="divider"><span>ou experimente uma demonstração</span></div>
          <div className="demo-buttons">
            <Button variant="secondary" className="button--wide" disabled={carregando} onClick={() => irParaArea({ id: "aluno-1", nome: "Lucas Martins", email: "lucas@email.com", perfil: "aluno", status: "ativo" })}>Entrar como Aluno</Button>
            <Button variant="secondary" className="button--wide" disabled={carregando} onClick={() => irParaArea({ id: "prof-1", nome: "Marina Costa", email: "marina@movimento.com", perfil: "professor", status: "ativo" })}>Entrar como Professor</Button>
          </div>
          <p className="prototype-note">Protótipo demonstrativo. Nenhum dado é enviado a um servidor.</p>
          <button className="text-button auth-reset" type="button" onClick={() => setConfirmacao(true)}>Restaurar dados de exemplo</button>
        </div>
      </section>
      <ModalConfirmacao aberto={confirmacao} titulo="Restaurar dados de exemplo?" mensagem="Os dados salvos neste navegador voltarão ao estado inicial. Esta ação não pode ser desfeita." confirmarTexto="Restaurar dados" aoFechar={() => setConfirmacao(false)} aoConfirmar={() => { const restaurado = restaurar(); setConfirmacao(false); setToast(restaurado ? "Dados de exemplo restaurados." : "Não foi possível restaurar os dados. Tente novamente."); }} />
      <Toast mensagem={toast} fechar={() => setToast("")} />
    </main>
  );
}
