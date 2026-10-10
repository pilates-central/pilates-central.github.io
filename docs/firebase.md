# Ligar o app ao Firebase do estúdio

Passo a passo para quem cuida da conta Google do projeto. Tudo cabe no plano gratuito (Spark):
sem Cloud Functions, sem cartão de crédito.

Enquanto nada disso estiver feito, o site funciona em **modo demonstração** (dados fictícios no
aparelho). Depois de configurado, a tela inicial mostra duas portas: **Entrar** (o estúdio de
verdade) e **Ver demonstração**.

## 1. O projeto

1. No [console do Firebase](https://console.firebase.google.com), crie o projeto (plano Spark).
   O Google Analytics não é usado pelo app: pode deixar desligado. Se ele foi ligado sem querer,
   o app continua sem carregar nada dele (não há `measurementId` na configuração nem na política
   de segurança do site); para desligar de vez: Configurações do projeto, Integrações, Google
   Analytics, Desvincular.
2. **Não fique refém de uma conta só.** Em Configurações do projeto, Usuários e permissões,
   adicione as outras pessoas da administração como membros do projeto (papel Proprietário ou
   Editor). Assim, se alguém perder o acesso à conta Google, outra pessoa ainda consegue entrar no
   console, publicar regras e baixar os dados.

## 2. Login por e-mail e senha

1. **Authentication, Começar.** No menu do console, abra Authentication e toque em **Começar**
   (ou "Vamos começar"). Esse toque cria a configuração de login do projeto. Sem ele, nada do
   login existe ainda: **a criação de conta falha e nenhum e-mail chega**. O app, nesse caso,
   mostra "O login por e-mail e senha ainda não foi ativado no Firebase deste projeto" (em
   **Detalhes** aparece `auth/configuration-not-found`). Foi exatamente isso que aconteceu no
   primeiro acesso: o projeto existia, mas o Authentication nunca tinha sido iniciado.
2. Authentication, Método de login (Sign-in method): ative **E-mail/senha** (o "link por e-mail"
   fica desligado). Com o Authentication iniciado mas este método desligado, o app mostra a mesma
   frase, com `auth/operation-not-allowed` em Detalhes.
3. Authentication, Configurações:
   - **Domínios autorizados:** acrescente `kohijow.github.io` (onde o site está publicado hoje)
     e `pilates-central.github.io` (o endereço definitivo, quando o repositório passar para a
     organização do estúdio). O `localhost` já vem na lista. Hoje o login por e-mail e senha
     não depende dessa lista (o app não usa login do Google nem link de volta nos e-mails), mas
     ela vale para o que vier depois; se o Firebase recusar o endereço, o app mostra "Este
     endereço do site não está autorizado no Firebase". Quem barra o uso da configuração em
     outro site é a restrição da chave (passo 4 da seção 5).
   - **Ações do usuário:**
     - "Ativar a criação (registro)" fica ligada: quem é convidado cria a própria conta. Quem não
       tem convite até cria uma conta, mas não vê nada (as regras do banco negam).
     - **Proteção contra enumeração de e-mail:** ligada (é o padrão em projetos novos). Com ela,
       o Firebase responde igual exista ou não a conta, e o app já mostra frases que não dizem
       se um e-mail tem conta ("E-mail ou senha não conferem"; "Se houver uma conta com este
       e-mail, enviamos um link").
   - **Política de senha:** comprimento mínimo **8** e "Exigir". O app pede 8 e mostra a força da
     senha enquanto a pessoa digita, mas a tela de senha nova do Firebase aceita 6 sem essa
     política. Não exija símbolo: uma frase comprida protege mais.
   - **reCAPTCHA (proteção de e-mail e senha, "SMS/e-mail abuse"):** deixe desligado. O App Check
     (seção 7) já protege o login contra uso automatizado; ligar os dois pede mais um script na
     política de segurança do site.
4. Authentication, Modelos (Templates): escolha o idioma **português** para os e-mails de
   confirmação e de senha nova. Nos modelos, o "nome do remetente" pode ser o nome do estúdio.

## 3. O banco (Firestore)

1. Firestore Database, Criar banco de dados, **modo de produção**, local `southamerica-east1`
   (São Paulo).
2. Nada de criar coleções à mão: o primeiro acesso e o próprio app criam o que precisa.

## 4. As regras do banco (antes de qualquer acesso)

O arquivo [`firestore.rules`](../firestore.rules) tem todas as regras. Antes de publicar:

1. Abra o arquivo e troque o e-mail de `emailDoPrimeiroAcesso()` (hoje
   `responsavel@example.com`) pelo e-mail de **quem vai fazer o primeiro acesso**. Essa trava
   impede que outra pessoa crie uma conta antes e reivindique o estúdio.
2. No console: Firestore Database, Regras. Apague o que estiver lá, cole o conteúdo do arquivo
   (com o e-mail trocado) e toque em **Publicar**.
3. Opcional: no "Playground de regras" do console, simule uma leitura de `pagamentos/qualquer`
   sem login. Tem que dar **negado**.

As mesmas regras rodam nos testes automáticos (`npm run regras`, no emulador); quem mexer nelas
deve rodar os testes antes de publicar de novo. **Toda mudança no arquivo pede republicação**: o
site não publica regras sozinho.

## 5. A configuração do app

1. Configurações do projeto, Seus apps: se ainda não houver, adicione um app **Web**. Copie os
   seis valores do `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`). O `measurementId`, se aparecer, não é usado.
2. Esses valores não são segredo (vão para o navegador de quem abre o site), mas ficam fora do
   repositório, em variáveis do GitHub:
   GitHub, repositório, Settings, Secrets and variables, Actions, aba **Variables**, crie:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`.
   A próxima publicação (qualquer push na `main`, ou "Run workflow" no Actions) já sai com as duas
   portas. O arquivo que lê tudo isso é [`src/config/firebase.ts`](../src/config/firebase.ts).
3. Para rodar no computador com o projeto de verdade, copie `.env.exemplo` para
   `.env.production.local` (não vai para o repositório) e preencha.
4. **Restrinja a chave do navegador.** No Google Cloud Console (o projeto Firebase aparece lá com
   o mesmo nome), APIs e serviços, Credenciais, abra a chave "Browser key (auto created by
   Firebase)":
   - Restrições de aplicativo: **Sites** (referenciadores HTTP), com `https://kohijow.github.io/*`,
     `https://pilates-central.github.io/*` e, se for testar no computador com o projeto real,
     `http://localhost:*/*`.
   - Restrições de API: **Identity Toolkit API**, **Token Service API** e **Cloud Firestore API**
     (e, com o App Check ligado, **Firebase App Check API**). Nada mais.
   O site manda o endereço de origem em cada pedido (política de referenciador
   `strict-origin-when-cross-origin`), que é o que a restrição por site confere.

## 6. O primeiro acesso (define quem é a Responsável)

**Leia antes de entrar:** a primeira conta que entra num estúdio sem dono vira **Responsável**
(titular) pela conta: é quem convida, promove e tira pessoas da administração e quem pode passar
a conta para outra pessoa. Só o e-mail colocado nas regras (passo 4) consegue fazer isso. Se o
projeto foi criado por outra pessoa da família, tudo bem: quem faz o primeiro acesso pode ser o
dono da conta Google, e ele convida a proprietária do estúdio para a administração (ou passa a
conta para ela depois).

1. Abra o site, toque em **Entrar** e depois em **Primeiro acesso? Criar conta**.
2. Use o e-mail das regras e uma senha com pelo menos 8 caracteres (a barra abaixo do campo diz
   se ela está boa). "Lembrar neste aparelho" fica ligado no seu celular; desligue num aparelho
   emprestado.
3. A tela seguinte diz para qual endereço o e-mail de confirmação foi. Abra o e-mail (olhe o spam
   e a aba de promoções), toque no link e volte ao app: **Já confirmei**. Não chegou em um
   minuto? **Reenviar o e-mail** (a espera de 60 segundos entre envios é de propósito).
4. O app pergunta seu nome, WhatsApp e o nome do estúdio. Toque em **Começar**.
5. Com o estúdio ainda vazio, abre sozinho o guia **Montar o estúdio**: o WhatsApp do estúdio,
   as unidades, os professores, a grade da semana (tocar no horário cria a turma) e os alunos,
   colados de uma planilha. Cada passo tem **Pular**; o guia fica em Mais, Montar o estúdio, para
   voltar quando quiser (ver "Começando a usar" no README).

Se em vez disso aparecer "O login por e-mail e senha ainda não foi ativado" ou outra frase de
erro, toque em **Detalhes**: o código que aparece ali (`auth/...`) diz o que falta na lista de
verificação no fim deste documento.

## 7. App Check (protege a cota e o login contra robôs)

O documento público da aula experimental é lido sem login, e o plano gratuito tem uma cota
diária de leituras. O App Check faz o Firebase só atender pedidos vindos do site de verdade,
conferidos pelo reCAPTCHA v3 (invisível para quem usa). O app já tem o suporte pronto, desligado
até existir a chave. Tudo abaixo é feito por quem cuida do projeto; nada disso roda nos testes.

1. **As duas chaves do reCAPTCHA v3** saem do console do reCAPTCHA, não do Firebase: abra
   `https://www.google.com/recaptcha/admin/create` com a mesma conta Google do projeto. Rótulo:
   o nome do estúdio. Tipo: **Baseado em pontuação (v3)**. Domínios: `kohijow.github.io` e
   `pilates-central.github.io` (só o nome, sem `https://` nem caminho). Aceite os termos e
   envie. A página mostra a **chave do site** (vai para o site) e a **chave secreta** (vai para
   o Firebase). O `localhost` não precisa entrar: no computador vale o token de depuração
   (passo 6).
2. No console do Firebase, **App Check**, aba Apps, toque no app Web, escolha **reCAPTCHA** e
   cole a **chave secreta**. Deixe a validade do token como vem (1 dia) e salve.
3. GitHub, Settings, Secrets and variables, Actions, aba Variables: crie
   `FIREBASE_APPCHECK_SITE_KEY` com a **chave do site**. A próxima publicação sai com o App Check
   ligado: a política de segurança do site passa a liberar só os endereços do reCAPTCHA e do App
   Check (e a política do reCAPTCHA no Trusted Types), e o rodapé do login e da página pública
   ganham a frase de aviso que o Google exige.
4. Abra o site publicado, entre e abra a página de aula experimental. No console, App Check, aba
   **Métricas**, os pedidos devem aparecer como "verificados". Espere um ou dois dias de uso
   normal assim. Se aparecerem como "não verificados" ou "inválidos", não imponha: confira se a
   chave do site no GitHub é a par da chave secreta colada no Firebase e se os dois domínios
   estão no reCAPTCHA.
5. Só então **imponha** (Enforce): App Check, aba APIs, **Cloud Firestore**, Impor; e
   **Authentication**, Impor. A partir daí, pedido sem token válido é recusado pelo Google, antes
   de chegar às regras.
6. Para usar o site no computador com o projeto real (`npm run build` com `.env.production.local`
   preenchido, depois `npm run preview`), o app pede um **token de depuração**: em `localhost` ele
   liga o modo de depuração do SDK, que escreve o token no console do navegador (F12) na primeira
   abertura. Registre esse token em App Check, aba Apps, menu do app Web, **Gerenciar tokens de
   depuração**. Sem isso, com o App Check imposto, o site local é recusado (o site publicado
   continua funcionando). Com os emuladores (`?emulador=1`) o App Check fica desligado.

Conferido sem o projeto real (os pedidos ao Firebase respondidos pelo teste; só o script público
do reCAPTCHA veio do Google): com uma chave de teste no build e o token de depuração, o SDK troca
o token e o login e a leitura da página pública saem com o cabeçalho `X-Firebase-AppCheck`, nos
dois motores; o script de verdade do reCAPTCHA carrega sem recusa da política de segurança nem do
Trusted Types. Sem a chave, nada disso liga (nenhum pedido ao reCAPTCHA nem ao App Check). O que
só dá para ver com a chave verdadeira é o passo 4: as métricas "verificadas".

Se algo der errado depois de impor (a página pública sem horários, o login recusando com
`auth/firebase-app-check-token-is-invalid` em Detalhes), volte em App Check, APIs, e troque
"Impor" por "Não impor": tudo volta a funcionar na hora, sem publicar nada.

## 8. Depois do primeiro acesso

O guia Montar o estúdio cobre o primeiro dia (estúdio, unidades, professores, grade e alunos).
Para o resto, e para mexer depois, em **Mais**:

1. **Estúdio:** WhatsApp, os textos da página pública (a frase de apresentação, até três focos,
   o endereço, o link do mapa e o Instagram), se o **app do aluno** e a **página de aula
   experimental** ficam ligados, e por quantos dias um convite vale.
2. **Unidades** (com o endereço: é ele que aparece na página de aula experimental, por exemplo
   "Rua Exemplo, 100, sala 2, Centro"), depois **Alunos** (com e-mail para
   quem vai usar o app; vários de uma vez em Alunos, **Importar**, colando da planilha) e
   **Turmas** (também por planilha, em Turmas, **Importar**).
3. **Equipe:** convide a administração e os professores pelo e-mail de cada um. O app não manda
   e-mail de convite (isso pediria Cloud Functions): na ficha da pessoa, **Mandar o convite pelo
   WhatsApp** ou **Compartilhar o convite** (copia o texto pronto, com o endereço do site e o
   e-mail). A pessoa toca em **Primeiro acesso? Criar conta** com aquele e-mail e confirma o
   e-mail. O papel só vale com o e-mail confirmado e igual ao do convite. O convite vale por 7
   dias (Mais, Estúdio, "Validade do convite", de 1 a 90): a lista da equipe mostra os convites
   pendentes com a data e o prazo; vencido, **Mandar o convite de novo**; se foi engano,
   **Revogar o convite** (a pessoa não consegue mais entrar com aquele e-mail até ser convidada
   de novo).
4. **Alunos:** na ficha, **Liberar o app** e **Mandar o convite pelo WhatsApp** ou **Compartilhar o
   convite** (a mensagem já vem pronta, com o endereço e o e-mail). Vale o mesmo prazo; passou,
   **Mandar o convite de novo**.
5. **Passar a conta:** Equipe, a pessoa, **Passar a conta**. Ela precisa ser da administração e já
   ter entrado com o e-mail confirmado.
6. **Senha:** cada pessoa troca a própria em Mais, Conta, **Trocar a senha** (pede a atual). Quem
   esqueceu usa **Esqueci a senha** na tela de entrar: o link chega por e-mail.
7. **Pedido de exclusão (LGPD):** na ficha do aluno, **Excluir o cadastro** apaga o cadastro e o
   que liga a conta dele ao estúdio. Se ele tinha conta no app, apague também a conta de login: no
   console, Authentication, Usuários, procure o e-mail e exclua. Em Mais, **Registro de
   alterações**, fica anotado quem excluiu e quando (só com o código do aluno).

A página pública fica em `https://pilates-central.github.io/experimental/` (até a transferência
do repositório, em `https://kohijow.github.io/pilates-central-web/experimental/`). Ela só lê um
documento com horários e vagas (sem nomes), que o app da equipe atualiza sozinho a cada abertura
e a cada mudança na agenda.

## 9. Limites do plano gratuito

O Spark permite por dia 50 mil leituras e 20 mil gravações no Firestore. Abrir o app da equipe lê
o cadastro (alunos, turmas, equipe), as aulas de seis semanas e os créditos: algumas centenas de
leituras num estúdio pequeno. Marcar uma presença grava um ou dois documentos. A página pública
lê um documento por visita, e guarda a leitura por dez minutos no navegador de quem visita. Folga
de sobra; o App Check (seção 7) impede que alguém de fora gaste a cota de propósito.

## Lista de verificação final (console)

Para conferir quando o login não anda ou antes de avisar a equipe. Cada linha é um clique no
console do Firebase, salvo onde diz Google Cloud ou GitHub.

- [ ] **Authentication iniciado**: Authentication abre com as abas Usuários, Método de login,
      Modelos, Configurações (e não com o botão "Começar"). Sintoma de quando falta: a criação de
      conta falha e nenhum e-mail chega; o app diz que o login não foi ativado.
- [ ] **E-mail/senha ligado**: Authentication, Método de login, E-mail/senha = Ativado.
- [ ] **Domínios autorizados**: Authentication, Configurações, Domínios autorizados tem
      `kohijow.github.io` e `pilates-central.github.io`.
- [ ] **Modelos em português**: Authentication, Modelos, idioma = Português (Brasil).
- [ ] **Proteção contra enumeração de e-mails ligada**: Authentication, Configurações, Ações do
      usuário (ou "Proteção de e-mail"), "Proteção contra enumeração de e-mail" = ligada.
- [ ] **Política de senha**: Authentication, Configurações, Política de senha, mínimo 8, Exigir.
- [ ] **Regras publicadas** com o e-mail do primeiro acesso trocado: Firestore Database, Regras,
      a primeira linha útil mostra `rules_version = '2'` e `emailDoPrimeiroAcesso()` devolve o
      e-mail certo.
- [ ] **Chave de API restrita** (Google Cloud, APIs e serviços, Credenciais): sites
      `https://kohijow.github.io/*` e `https://pilates-central.github.io/*`; APIs Identity
      Toolkit, Token Service, Cloud Firestore (e App Check, quando ligado).
- [ ] **Variáveis no GitHub** (Settings, Secrets and variables, Actions, Variables): as seis
      `FIREBASE_*` e, com o App Check, `FIREBASE_APPCHECK_SITE_KEY`; o último workflow da `main`
      passou e publicou.
- [ ] **App Check** (seção 7): chaves do reCAPTCHA v3 criadas no console do reCAPTCHA com os
      dois domínios; a secreta no App Check do Firebase, a do site em `FIREBASE_APPCHECK_SITE_KEY`;
      depois de um ou dois dias de métricas "verificadas", Firestore e Authentication com "Impor".
- [ ] **Membros do projeto**: Configurações do projeto, Usuários e permissões, mais de uma pessoa
      como Proprietário ou Editor.

## Testar sem o projeto de verdade (emuladores)

Nada de teste usa o projeto real. Com Java 21 e o firebase-tools instalados:

```bash
npm run regras            # regras do Firestore contra o emulador (projeto demo-pilates)

# ponta a ponta com o SDK de verdade, nos dois motores
npm run build
npx vite preview --port 8887 &
firebase emulators:exec --only auth,firestore --project demo-pilates \
  "EMULADOR=1 npx playwright test"
```

O app só liga os emuladores em `localhost`/`127.0.0.1` e com `?emulador=1` no endereço (portas em
[`firebase.json`](../firebase.json)); `?emulador=demo-qualquer-coisa` usa outro projeto de teste,
vazio, para ver o primeiro acesso do zero. No site publicado esse caminho nunca liga. Os testes
ainda têm uma trava: qualquer pedido para domínios do Google é cortado e reprova o teste.

O emulador de login "manda" os e-mails para `http://127.0.0.1:8844/emulator/v1/projects/demo-pilates/oobCodes`:
os testes pegam ali o link de confirmação e o de senha nova, como se a pessoa tivesse aberto o
e-mail. O caso "Authentication não iniciado" é testado sem emulador, com a resposta
`CONFIGURATION_NOT_FOUND` simulada pelo Playwright (`e2e/login.spec.ts`).

Para rodar dois conjuntos de emuladores na mesma máquina, copie `firebase.json` para
`firebase.local.json` com outras portas e aponte `FIREBASE_JSON=firebase.local.json` no build,
no `firebase emulators:exec --config firebase.local.json` e nos testes: o app, os testes de regras
e os de ponta a ponta leem as portas desse arquivo. Se a cópia ficar em outra pasta, escreva o
caminho das regras por inteiro (`"rules": "/caminho/do/clone/firestore.rules"`): o firebase-tools
resolve o caminho a partir da pasta do arquivo de configuração e, sem achar as regras, sobe o
emulador aberto a tudo, sem avisar os testes.
