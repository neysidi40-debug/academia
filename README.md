# Movimento — Plataforma de acompanhamento de treinamento

Protótipo front-end em React, Vite e React Router. Os dados são simulados e ficam no navegador; não há backend, banco de dados ou autenticação real.

## Como rodar

1. Instale o Node.js 18 ou superior.
2. Na pasta do projeto, instale as dependências:

   ```bash
   npm install
   ```

3. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

4. Abra o endereço indicado pelo Vite (normalmente `http://localhost:5173`).

Para gerar a versão de produção, use `npm run build`. Na tela de entrada, use **Entrar como Aluno** ou **Entrar como Professor**. Há um único perfil de professor, Marina Costa, e cinco alunos de demonstração (Lucas Martins, Beatriz Almeida, Rafael Souza, Camila Ferreira e Pedro Nunes). No formulário, as contas de demonstração usam a senha `treino123`.

Use **Restaurar dados de exemplo** no login ou no menu lateral para descartar as alterações locais e voltar aos mocks. O estado do protótipo é salvo no `localStorage` do navegador; limpar os dados do site também remove as alterações.

## Área do Aluno

Após entrar como Aluno, a navegação inclui painel, treinos e histórico de sessões, exercícios dos planos atribuídos, aulas gravadas, dúvidas e conversas, agendamentos, notificações e perfil. Os fluxos de treino, dúvida e agendamento salvam alterações simuladas no `localStorage`.

## Painel do Professor

Entre pela demonstração de Professor para gerenciar alunos, publicar treinos, manter a biblioteca de exercícios e aulas, responder dúvidas, organizar disponibilidade e consultas, e ajustar configurações profissionais. As alterações usam o estado compartilhado do protótipo e aparecem para os alunos correspondentes. Notas privadas do professor são exibidas somente no painel dele.

### Fluxos demonstráveis

1. Entre como Professor, abra **Treinos** e escolha **Criar treino**. Preencha o plano, adicione exercícios, selecione um ou mais alunos e publique.
2. Saia, entre como Aluno atribuído, abra a notificação ou **Meus treinos**, inicie o treino e registre as séries. Ao finalizar e confirmar, a sessão fica no histórico.
3. Como Aluno, envie uma dúvida em **Minhas dúvidas**. Saia, entre como Professor, abra **Dúvidas**, responda e envie.
4. Volte ao perfil do Aluno para ver a resposta na conversa e a notificação.

Use **Restaurar dados de exemplo** para limpar as alterações locais e repetir os fluxos.

## Acompanhamento e telas complementares

O aluno pode consultar evolução e histórico, ver somente indicadores compartilhados, criar metas, responder questionários, registrar check-ins e consultar pagamentos simulados. O professor pode registrar avaliações com opção de compartilhamento, corrigir medidas com histórico, consultar relatórios e exportar métricas agregadas em CSV, atribuir questionários e cadastrar planos e serviços sem cobrança recorrente. O histórico de atividades mostra eventos relevantes conforme o perfil.

## Decisões em aberto e padrão adotado

Não há decisões bloqueantes para esta demonstração. Para transformar o protótipo em produto, ainda devem ser confirmados os critérios de renovação dos planos, os indicadores de avaliação aceitos, a política de cobrança e os canais de notificação.

- Cadastro de aluno apenas por convite simulado; não há cadastro público.
- Agendamentos são confirmados automaticamente, conforme o fluxo da Parte 2.
- Pagamento não é obrigatório para reservar e nenhum pagamento é real.
- Vídeos são exibidos por links externos; não há upload de vídeo.
- Existe um único professor responsável pelos alunos simulados.
- Notificações ficam somente dentro da plataforma.

Os gráficos de evolução usam SVG acessível e nativo, sem dependência de biblioteca externa.

## Substituições necessárias para backend e banco de dados

- Trocar os serviços de `src/services/` por chamadas à API e persistência no banco; definir contratos, validações e migrações para novos dados.
- Substituir a entrada simulada e `localStorage` por autenticação segura, gestão de sessão, expiração e recuperação de conta.
- Validar papéis e propriedade dos dados no servidor; a proteção de rotas atual é apenas uma barreira de interface.
- Implementar upload de anexos/fotos com armazenamento, varredura, limites e URLs autorizadas; hoje os anexos são simulados/localizados no navegador.
- Integrar pagamentos com provedor e webhooks idempotentes; o protótipo nunca solicita dados de cartão e o status simulado não prova pagamento.
- Persistir auditoria com controle de acesso, retenção e minimização de dados pessoais.
- Configurar envio externo de notificações apenas com consentimento, preferências e registros de entrega.

## Estrutura

```text
src/
  app/                  # rotas e proteção por perfil
  components/           # elementos reutilizáveis da interface
  context/              # estado global e persistência
  data/                 # dados simulados
  layouts/              # navegação das áreas do aluno e do professor
  pages/
    auth/               # entrada e recuperação simuladas
    aluno/              # dashboard e fluxos da Área do Aluno
    professor/          # dashboard e fluxos do Painel do Professor
    shared/             # páginas de acompanhamento compartilhadas e sessão expirada
  services/             # acesso aos dados e regras de negócio simuladas
  styles/               # estilos globais e responsivos
```
