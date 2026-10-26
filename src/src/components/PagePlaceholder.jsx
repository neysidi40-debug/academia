import { useCallback, useEffect, useState } from "react";
import { getPageContent } from "../services/dataService";
import Carregando from "./Loading";
import EstadoVazio from "./EmptyState";
import MensagemErro from "./ErrorMessage";

export default function PagePlaceholder({ titulo, descricao, proximoPasso = "As informações desta área aparecerão aqui nas próximas etapas." }) {
  const [status, setStatus] = useState("carregando");
  const carregar = useCallback(() => {
    setStatus("carregando");
    getPageContent(titulo)
      .then(() => setStatus("vazio"))
      .catch(() => setStatus("erro"));
  }, [titulo]);

  useEffect(() => carregar(), [carregar]);
  return (
    <div className="page-content">
      <header className="page-heading">
        <div><span className="eyebrow">MOVIMENTO / SUA ÁREA</span><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>
      </header>
      {status === "carregando" && <Carregando />}
      {status === "erro" && <MensagemErro tentarNovamente={carregar} />}
      {status === "vazio" && <EstadoVazio mensagem="Ainda não há informações por aqui." proximoPasso={proximoPasso} />}
    </div>
  );
}
