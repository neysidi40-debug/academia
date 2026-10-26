import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { mockUsers } from "../data/mockData.js";
import { verifyPasswordCredential } from "../utils/passwordCredentials.js";

export default function LoginPage({ onSignIn, theme, onToggleTheme, data }) {
  const { role } = useParams();
  const navigate = useNavigate();
  const professorProfile = data.profiles?.professor || mockUsers.professor;
  const [email, setEmail] = useState(role === "professor" ? professorProfile.email : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const isKnownRole = role === "aluno" || role === "professor";

  useEffect(() => {
    setEmail(role === "professor" ? professorProfile.email : "");
    setPassword("");
    setError("");
  }, [role, professorProfile.email]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const validProfessor = role === "professor"
      && normalizedEmail === professorProfile.email.toLowerCase()
      && password === "demo123";
    const student = role === "aluno"
      ? data.students.find((item) => item.status === "Ativo" && item.email.toLowerCase() === normalizedEmail)
      : null;
    let validStudent = false;
    if (student) {
      try {
        validStudent = student.passwordCredential
          ? await verifyPasswordCredential(password, student.passwordCredential)
          : password === "demo123";
      } catch {
        setError("Não foi possível validar o acesso agora. Tente novamente.");
        return;
      }
    }
    if (!validProfessor && !validStudent) {
      setError("Não foi possível entrar. Confira os dados e tente novamente.");
      return;
    }
    onSignIn(role, normalizedEmail);
    navigate(`/${role}/inicio`, { replace: true });
  }

  if (!isKnownRole) {
    return (
      <main className="login-page">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <section className="login-card" aria-labelledby="login-title">
          <div className="brand brand--login">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span>Treinamentos Online</span>
          </div>
          <p className="eyebrow">BEM-VINDO(A)</p>
          <h1 id="login-title">Acompanhe seu treinamento</h1>
          <p className="intro-copy">Escolha sua área para entrar.</p>
          <div className="login-actions">
            <Link className="button button--primary" to="/login/aluno"><Icon name="login" />Entrar como aluno</Link>
            <Link className="button button--secondary" to="/login/professor"><Icon name="login" />Entrar como professor</Link>
          </div>
          <p className="helper-copy">Clientes são cadastrados pelo professor. Não há cadastro de professor nesta demonstração.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <section className="login-card" aria-labelledby="login-title">
        <Link className="brand brand--login" to="/">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>Treinamentos Online</span>
        </Link>
        <p className="eyebrow">ACESSO {role === "aluno" ? "DO ALUNO" : "DO PROFESSOR"}</p>
        <h1 id="login-title">Entrar na sua conta</h1>
        <p className="intro-copy">
          {role === "aluno"
            ? "Entre com o e-mail cadastrado pelo professor."
            : "Acesse a conta única de demonstração do professor."}
        </p>
        <form className="form-card login-form" onSubmit={submit}>
          <label>E-mail
            <input
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>Senha
            <input
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="error-note" role="alert">{error}</p>}
          <button className="button button--primary" type="submit"><Icon name="login" />Entrar</button>
        </form>
        <div className="demo-credentials">
          <strong>{role === "aluno" ? "Acesso de clientes cadastrados" : "Conta única do professor"}</strong>
          {role === "professor" && <span>{professorProfile.email}</span>}
          {role === "aluno" && <span>Exemplos: lucas@email.com ou bia@email.com</span>}
          <span>Senha das contas de exemplo: demo123</span>
        </div>
        <Link className="login-back-link" to="/">Voltar à escolha de perfil</Link>
      </section>
    </main>
  );
}
