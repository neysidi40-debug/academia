import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import Icon from "./Icon.jsx";
import ProfileAvatar from "./ProfileAvatar.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export default function AppLayout({ user, area, links, onSignOut, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`app-shell app-shell--${area}`}>
      <aside className={`sidebar${menuOpen ? " sidebar--open" : ""}`}>
        <Link className="brand" to={`/${area}/inicio`} onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>Treinamentos Online</span>
        </Link>
        <nav className="navigation" aria-label="Menu principal">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `navigation-link${isActive ? " is-active" : ""}`}
            >
              <Icon name={link.icon} />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-profile">
          <ProfileAvatar name={user.nome} />
          <span className="sidebar-profile__name"><strong>{user.nome}</strong><small>{user.papel}</small></span>
          <button className="text-button sidebar-signout" type="button" onClick={onSignOut} aria-label="Sair">
            <Icon name="logout" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      {menuOpen && <button className="menu-backdrop" type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle" type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? "Fechar" : "Menu"}
          </button>
          <p>Olá, {user.nome.split(" ")[0]}</p>
          <span>{area === "aluno" ? "Área do aluno" : "Painel do professor"}</span>
          <button className="mobile-signout" type="button" onClick={onSignOut}><Icon name="logout" />Sair</button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </header>
        <Outlet />
      </main>
      <nav className="mobile-navigation" aria-label="Navegação principal">
        {links.map((link) => {
          const label = link.label
            .replace("Meus treinamentos", "Treinos")
            .replace("Treinamentos", "Treinos")
            .replace("Minha agenda", "Agenda")
            .replace("Avaliações", "Feedbacks");
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `mobile-navigation__link${isActive ? " is-active" : ""}`}
            >
              <Icon name={link.icon} size={16} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
