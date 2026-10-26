import Button from "./Button";

export default function MensagemErro({ mensagem = "Não foi possível carregar esta página.", tentarNovamente }) {
  return (
    <div className="error-message" role="alert">
      <p>{mensagem}</p>
      {tentarNovamente && <Button variant="secondary" onClick={tentarNovamente}>Tentar novamente</Button>}
    </div>
  );
}
