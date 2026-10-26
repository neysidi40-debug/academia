import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, RotateCcw, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import ModalConfirmacao from "../components/ConfirmModal";
import Toast from "../components/Toast";
import Button from "../components/Button";

export default function AppLayout({ area, navigation }) {
  const { usuario, sair, restaurar, dados } = useApp();
  const [menuAberto, setMenuAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState(false);
  const [toast, setToast] = useState("");
  const navigate = useNavigate();
  const count = dados.notificacoes.filter((item) => item.usuarioId === usuario?.id && !item.lida).length;

  function encerrarSessao() {
    sair();
    navigate("/login", { replace: true });
  }

  function confirmarRestauracao() {
    const restaurado = restaurar();
    setConfirmacao(false);
    if (!restaurado) {
      setToast("Não foi possível restaurar os dados. Tente novamente.");
      return;
    }
    setToast("Dados de exemplo restaurados.");
    window.setTimeout(() => {
      sair();
      navigate("/login", { replace: true });
    }, 900);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuAberto ? "sidebar--open" : ""}`}>
        <div className="sidebar__top">
          <NavLink className="brand" to={`/${area}/inicio`} onClick={() => setMenuAberto(false)}><span className="brand__mark">m</span> movimento</NavLink>
          <button className="icon-button sidebar__close" aria-label="Fechar menu" onClick={() => setMenuAberto(false)}><X size={20} /></button>
          <div className="area-label"><span className="area-label__dot" />{area === "aluno" ? "ÁREA DO ALUNO" : "PAINEL DO PROFESSOR"}</div>
          <nav className="side-nav" aria-label="Menu principal">
            {navigation.map(({ label, to, icon: Icon, children }) => children ? (
              <details key={label} className="side-nav__group">
                <summary className="side-nav__link"><Icon size={18} strokeWidth={1.8} /><span>{label}</span><span className="side-nav__chevron" aria-hidden="true">⌄</span></summary>
                <div className="side-nav__submenu">
                  {children.map(({ label: childLabel, to: childTo, icon: ChildIcon }) => (
                    <NavLink key={childTo} to={childTo} onClick={() => setMenuAberto(false)} className={({ isActive }) => `side-nav__link side-nav__sublink${isActive ? " side-nav__link--active" : ""}`}>
                      <ChildIcon size={17} strokeWidth={1.8} /><span>{childLabel}</span>
                    </NavLink>
                  ))}
                </div>
              </details>
            ) : (
              <NavLink key={to} to={to} onClick={() => setMenuAberto(false)} className={({ isActive }) => `side-nav__link${isActive ? " side-nav__link--active" : ""}`}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="sidebar__bottom">
          <div className="profile-mini">
            <span className="avatar">{usuario?.nome?.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <span><strong>{usuario?.nome}</strong><small>{area === "aluno" ? "Aluno" : "Professora"}</small></span>
          </div>
          <button className="side-action" onClick={() => setConfirmacao(true)}><RotateCcw size={16} /> Restaurar dados de exemplo</button>
        </div>
      </aside>
      {menuAberto && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label={menuAberto ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuAberto((current) => !current)}>{menuAberto ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="topbar__context"><span>Olá, {usuario?.nome?.split(" ")[0]}</span><small>Que bom ter você por aqui.</small></div>
          <div className="topbar__actions">
            <NavLink className="notification-button" to={`/${area}/notificacoes`} aria-label={`Notificações${count ? `, ${count} não lidas` : ""}`}><Bell size={19} />{count > 0 && <span className="notification-count">{count}</span>}</NavLink>
            <Button variant="ghost" className="signout-button" onClick={encerrarSessao}><LogOut size={16} /> Sair</Button>
          </div>
        </header>
        <div className="mobile-bottom-nav" aria-label="Navegação rápida">
          {navigation.slice(0, 4).map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => `mobile-bottom-nav__item${isActive ? " is-active" : ""}`}><Icon size={19} /><span>{label}</span></NavLink>
          ))}
        </div>
        <div className="content-area"><Outlet /></div>
      </div>
      <ModalConfirmacao aberto={confirmacao} titulo="Restaurar dados de exemplo?" mensagem="Os dados do protótipo voltarão ao estado inicial e você será desconectado. Esta ação não pode ser desfeita." confirmarTexto="Restaurar dados" aoFechar={() => setConfirmacao(false)} aoConfirmar={confirmarRestauracao} />
      <Toast mensagem={toast} fechar={() => setToast("")} />
    </div>
  );
}
