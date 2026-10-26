import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Carregando from "../components/Loading";
import MensagemErro from "../components/ErrorMessage";
import AccessDeniedPage from "../pages/shared/AccessDeniedPage";

export default function ProtectedRoute({ perfil, children }) {
  const { usuario, carregando, erro, tentarCarregar } = useApp();
  const location = useLocation();
  if (carregando) return <Carregando texto="Preparando sua área..." />;
  if (erro) return <main className="standalone-state"><MensagemErro mensagem={erro} tentarNovamente={tentarCarregar} /></main>;
  if (!usuario) return <Navigate to="/sessao-expirada" replace state={{ from: location }} />;
  // No produto real, esta autorização também deverá ser validada no servidor.
  if (usuario.perfil !== perfil) return <AccessDeniedPage />;
  return children;
}
