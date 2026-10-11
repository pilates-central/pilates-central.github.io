# Segurança

Como o app protege os dados do estúdio, o que depende do console do Firebase, o que foi testado
como ataque e o que fica de fora. O banco é o Firestore no plano gratuito, sem Cloud Functions:
toda regra de acesso mora em [`firestore.rules`](../firestore.rules) e é conferida pelo Google a
cada leitura e gravação. A tela só esconde o que o banco já nega.

## O que protege o quê

| Risco | O que segura | Onde |
|---|---|---|
| Alguém lê ou grava o que não é do papel dele | regras do Firestore com menor privilégio, esquema e tamanho em tudo, o resto negado | `firestore.rules`, `testes-de-regras/` |
| Professor mexendo fora da unidade dele ou dando reposição sem falta | a aula que ele cria é de uma turma da unidade que o documento diz; o crédito que ele cria é o de um "avisou" no mesmo lote, e só sai junto com o "avisou"; usar e devolver crédito só junto com o encaixe | `turmaDaUnidade`, `creditoDoAvisoDaEquipe`, `usoConfereComOEncaixe` |
| Conta sem convite entra no estúdio | o papel vem de `acessos/{uid}` criado a partir de um convite para o e-mail confirmado | regras de `acessos` e `convites` |
| Convite esquecido vira porta aberta | todo convite nasce com prazo (`expiraEm`, 7 dias por padrão, configurável de 1 a 90) e o aceite depois dele é recusado; a administração revoga ou manda de novo | `conviteValido`, `conviteNoPrazo`, Mais, Equipe |
| Ninguém sabe o que aconteceu no login | cada resposta do Firebase vira uma frase em português; o código bruto fica atrás de "Detalhes" | `src/dados/firebase/erros.ts` |
| Descobrir quem é aluno tentando e-mails | mensagens iguais com ou sem conta; proteção contra enumeração do Firebase (console) | `erros.ts`, `docs/firebase.md` |
| Senha fraca | mínimo 8 no app e na política do projeto (console); força da senha enquanto digita | `src/dominio/senha.ts` |
| Celular emprestado | "Lembrar neste aparelho" desligado deixa a sessão só na aba | `autenticacao.ts` (persistência) |
| Script injetado, HTML por texto | política de segurança sem `unsafe-inline`, sem iframe (com o App Check, só o do reCAPTCHA); Trusted Types com política padrão que recusa HTML e script por texto | `scripts/plugin-offline.ts`, `src/app/confianca.ts` |
| Dado pessoal vazando pela URL ou pelo referrer | nada pessoal na URL (só códigos nas rotas); `referrer` `strict-origin-when-cross-origin` | `index.html` e as outras duas páginas |
| Dado do banco guardado no aparelho | o service worker só guarda arquivos do próprio site; a leitura da página pública fica na aba por dez minutos, nunca no cache do SW | `src/pwa/sw.js`, `src/experimental/dados.ts` |
| Versão velha do app com regras novas | a versão nova fica esperando e o app avisa "Tem uma versão nova do app" com "Atualizar" | `src/app/atualizacao.ts` |
| Regras publicadas mais velhas que o app | a recusa do banco vira uma frase: com a conta em dia, "peça para a administração publicar as regras novas"; com o acesso mudado, "sua conta não tem esse acesso" | `src/dados/falhas.ts`, `estado.ts` |
| Planilha colada com dado torto | cada linha passa pelas mesmas validações do cadastro antes de gravar; nada do texto vira HTML; as regras do banco conferem de novo | `src/dominio/importacao.ts` |
| Alguém de fora gasta a cota do plano gratuito | App Check com reCAPTCHA v3 (quando o dono liga e impõe no console) | `src/dados/firebase/sdk.ts`, `src/experimental/firebaseAppCheck.ts` |
| Chave de API usada em outro site | restrição da chave por site e por API (console do Google Cloud) | `docs/firebase.md` |
| Quem mexeu no dinheiro ou excluiu alguém | registro de alterações só com códigos, que ninguém edita nem apaga | coleção `auditoria`, Mais, Registro de alterações |

## Quem é quem

| Papel | Como ganha o papel | O que vê | O que grava |
|---|---|---|---|
| Responsável (titular) | primeiro acesso, com o e-mail travado nas regras; ou recebendo a conta do titular anterior | tudo | tudo; só ele convida, promove e tira administradores e passa a conta |
| Administração | convite do titular | tudo, financeiro e registro de alterações incluídos | cadastros, agenda, financeiro, convites de professores e alunos, linhas do registro de alterações |
| Professor | convite da administração | agenda, turmas, alunos (sem valores), créditos, vagas | presença, aviso e reposição nas unidades em que dá aula; os horários da página pública |
| Aluno | acesso liberado na ficha, com o app do aluno ligado | o próprio portal, os próprios créditos e as vagas (sem nomes) | o próprio aviso de falta e a própria reposição, no prazo e com vaga |
| Qualquer pessoa | nada | o documento público (horários com vaga, unidades, WhatsApp) | nada |

### Como o papel é conferido

Para cada pedido, as regras calculam uma vez quem está pedindo (`quemSou`):

1. A conta precisa ter o **e-mail confirmado** (`email_verified`).
2. O documento `acessos/{uid}` liga a conta a uma pessoa. Só a própria conta cria o seu, e só a
   partir de um convite em `convites/{e-mail}` para o e-mail dela (ou no primeiro acesso), dentro
   do prazo do convite (`expiraEm`): vencido ou revogado (apagado), a conta fica sem papel até a
   administração mandar o convite de novo.
3. O papel vem do cadastro dessa pessoa: na equipe, o cadastro precisa ter o mesmo `uid`, estar
   ativo e ter o mesmo e-mail do login; o aluno precisa ter o acesso liberado, não estar arquivado,
   o e-mail igual e o app do aluno ligado nas configurações.

Desativar alguém, tirar o acesso de um aluno ou desligar o app do aluno corta o papel na hora,
sem depender do aparelho da pessoa. O papel nunca é lido do aparelho.

### Posse do estúdio

`estudio/posse` diz quem é o titular. É criado uma vez, junto com o cadastro e o acesso de quem
reivindica, e só pelo e-mail definido em `emailDoPrimeiroAcesso()` (trocado antes de publicar: ver
[firebase.md](firebase.md)). Depois, só o titular atual muda, e só para alguém da administração,
ativo, que já entrou com o e-mail confirmado. Ninguém apaga a posse. Quem lê a posse: a equipe e,
fora dela, só a conta do e-mail do primeiro acesso (para saber se o estúdio já tem responsável);
uma conta qualquer não fica sabendo quem é o titular nem se o estúdio já foi reivindicado.

## Login

- E-mail e senha, com confirmação do e-mail antes de qualquer acesso. A tela de confirmação diz
  para qual endereço o e-mail foi, lembra do spam, reenvia com espera de 60 segundos (o Firebase
  também limita) e "Já confirmei" recarrega a conta e o token antes de dizer que não confirmou.
- Toda falha do SDK passa por `erroDeConta` (`src/dados/firebase/erros.ts`): o código do Firebase
  vira uma frase em português para a pessoa, e o código bruto fica em "Detalhes", para quem está
  configurando o projeto. Os códigos mapeados: Authentication nunca iniciado no console
  (`auth/configuration-not-found`) e e-mail/senha desligado (`auth/operation-not-allowed`), os dois
  com "O login por e-mail e senha ainda não foi ativado no Firebase deste projeto"; sem rede;
  tentativas demais; domínio não autorizado; chave de API inválida ou restrita; App Check
  recusado; e-mail inválido; senha fraca ou fora da política; cota de e-mails do dia; conta
  desativada; sessão antiga demais para trocar a senha.
- Mensagens que não dizem se o e-mail tem conta: "E-mail ou senha não conferem" para qualquer
  credencial errada; "Se houver uma conta com este e-mail, enviamos um link" na senha nova; ao
  criar a conta, "e-mail já usado" responde com a mesma frase da recusa genérica, então vale com a
  proteção contra enumeração do Firebase ligada (padrão) ou não.
- Senha: mínimo de 8 caracteres no app, com a força mostrada enquanto digita (sem exigir símbolo:
  uma frase comprida vale mais). A política de senha do projeto também deve pedir 8 (console),
  porque a tela de senha nova do Firebase aceita 6 sem ela. Trocar a senha pelo app pede a atual
  (o Firebase exige login recente).
- "Lembrar neste aparelho" ligado guarda a sessão no IndexedDB do SDK; desligado, só na aba
  (`browserSessionPersistence`): fechou o navegador, a sessão sumiu.
- O SDK do Firebase só é baixado quando a pessoa escolhe **Entrar**: fica num pedaço separado, fora
  do pacote inicial e fora do cache do service worker. Sem o "resolvedor" de popup, o SDK não
  carrega o iframe de login do Google (e a política de segurança nem deixa iframe).

## Dados separados por quem pode ler

O Firestore libera ou nega o documento inteiro, então o que um papel não pode ver mora em outro
documento:

- `financeiroDosAlunos` e `pagamentos`: só a administração. O app do professor nem pede esses dados.
- `alunos` (com a observação da equipe): só a equipe. O aluno lê `portal/{id}`, uma cópia com o
  primeiro nome, a unidade e as turmas fixas, sem colegas.
- `registros/{aula}` leva também quem vem fazer a aula experimental (nome e telefone, em texto):
  só a equipe lê; o aluno, que mexe no mesmo documento por mescla, não cria nem muda esse mapa
  (as regras recusam), e as cópias sem nome (vagas, página pública) só contam o lugar. Quem
  virou aluno e depois pediu a exclusão fica ali só com o código (ver "O que fica de fora").
- `vagas/{aula}`: a aula de uma data só com lugares (capacidade, ocupados, cancelada) e o início
  da aula em milissegundos (`comecaEm`, conferido pelas regras contra a data e a hora), sem nomes.
- `publico/estudio`: o único documento sem login, só com o que a página mostra: nome do estúdio,
  WhatsApp, os textos do estúdio (frase até 160, até três focos de 40, endereço até 200, link do
  mapa só `https://` até 300, usuário do Instagram até 30 letras, números, ponto e sublinhado),
  unidades (mapa `id -> 'nome|endereco'`), se a aula experimental está aberta e os horários com
  vaga (um texto por horário, `'2026-10-13 18:00-18:50 u-centro 2'`). As regras conferem cada
  texto, cada horário e cada unidade quando a equipe grava (o professor só grava os horários); a
  página confere tudo de novo ao ler (`paginaPublicaDe` em `src/experimental/rest.ts`): só um link
  `https://` vira link, e um documento de antes das regras não derruba a página de quem nunca viu
  o estúdio.
- `auditoria`: o registro de alterações, só códigos (quem, o quê, com quem, quando). A
  administração grava a própria linha junto com a mudança e lê; ninguém edita nem apaga.

Essas cópias são gravadas pelo app da equipe na mesma transação de cada mudança e conferidas a
cada abertura (a janela de 14 dias anda sozinha).

## O que o aluno grava, e como o banco confere

Avisar a falta muda três documentos juntos: a marcação dele no registro da aula (por mescla, sem
ler os colegas), o crédito de reposição e a vaga (um lugar a menos). Encaixar a reposição: a
reposição dele no registro, o crédito marcado como usado e a vaga (um lugar a mais). O app faz isso
numa transação que lê a vaga e o crédito; se outro aluno pegar o último lugar no mesmo instante, a
transação refaz a conta e recusa. As regras conferem tudo de novo, do lado do servidor:

- só a chave do próprio aluno muda no registro, e o registro escrito por ele tem a sua própria
  validação enxuta (`registroDoAluno`: mesma aula da vaga, sem cancelamento, só os campos de sempre);
- o prazo é medido pelo relógio do servidor (`request.time`) contra `comecaEm` da vaga, o início
  da aula no fuso de Campinas (UTC-3, sem horário de verão desde 2019), gravado pela equipe e
  conferido pelas regras contra a data e a hora;
- a vaga só sobe se não passar da capacidade, e só muda junto com o registro e o crédito
  (cada regra confere as outras pelo estado depois do lote, com `getAfter`);
- o crédito gasto no encaixe estava livre antes do lote (`creditoLivreAntes`, na regra da vaga): a
  regra do registro só lê o crédito como fica depois, e sem isso um crédito que já apontasse para
  a aula serviria de novo sem ser tocado;
- desfazer o aviso só passa se o crédito daquele aviso sair no mesmo lote (crédito já usado não
  sai, então o aviso de uma falta já reposta não se desfaz);
- o aluno não se encaixa numa aula da própria turma, onde já tem lugar.

## O que o professor grava

O professor faz a chamada, avisa e encaixa nas unidades em que dá aula. As regras conferem que:

- a aula que ele cria (registro ou vaga) é de uma turma daquela unidade (`turmaDaUnidade`). Sem
  isso, o professor de uma unidade criava o registro ou a vaga de uma aula de outra com a unidade
  dele, e o documento ficava travado: a unidade não muda depois, o registro não se apaga, o
  professor certo não fazia a chamada e a conferência da janela de vagas da administração
  passava a ser recusada inteira;
- o crédito que ele cria é o do aviso de verdade (`creditoDoAvisoDaEquipe`): o aluno está como
  "avisou" no registro da aula de origem depois do lote, o código é o fixo daquela falta, a
  unidade é a da aula, nasce livre e vale no máximo os dias combinados. Antes, um "crédito de
  aviso" para qualquer aluno, sem falta e válido até 2099 passava (uma cortesia com outro nome);
- usar e devolver crédito vai junto com o encaixe (`usoConfereComOEncaixe`): marcar como usado só
  com o aluno na reposição daquela aula, devolver só tirando a reposição de lá;
- o crédito do aviso só sai junto com o "avisou" (a pessoa veio afinal, ou o aviso foi desfeito):
  apagar e deixar o aviso lá tirava a reposição do aluno.

A administração não passa por essas conferências: ela grava turmas e vagas novas no mesmo lote, e
uma leitura por turma estouraria o teto de leituras por lote (abaixo).

### Teto de expressões

O Firestore avalia no máximo 1000 expressões por pedido. As regras do registro escrito pelo aluno
chegavam perto disso (o encaixe aguentava só mais 8 a 15 comparações). Elas foram enxugadas: o
registro do aluno tem a própria validação, a situação na aula é lida do próprio pedido (sem
reler o registro), o crédito é lido uma vez e o instante da aula vem pronto na vaga.
`testes-de-regras/folga.test.ts` carrega as regras com comparações a mais enfiadas na função de
cada caminho e prova que o pedido legítimo ainda passa com pelo menos 40 de sobra; com
`MEDIR_FOLGA=arquivo` ele procura o ponto exato em que cada caminho estoura (medido de novo na
revisão adversarial, com as regras antes e depois dela, os mesmos números: de 50, no encaixe numa
aula que já tem registro de outra pessoa, a 110, na vaga do aviso). Passando do teto, o
pedido é recusado (erro para o lado seguro), mas o aluno ficaria sem remarcar: quem mexer nas
regras do aluno roda o teste e, se precisar, mede de novo (ver [roteiro.md](roteiro.md)).

### Teto de leituras (o emulador não confere)

Cada pedido pode ler no máximo 10 documentos diferentes com `get`, `exists` e `getAfter` (20 num
lote ou transação); leitura repetida do mesmo documento não conta de novo. **O emulador não impõe
esse teto** (conferido: uma regra com 11 leituras diferentes num documento e um lote de 30 com uma
leitura diferente em cada passam no emulador), então os testes não pegam quem passar dele; no
projeto de verdade o pedido seria recusado. Contagem feita à mão, por documento diferente:

- aluno: avisar e desfazer o aviso leem no máximo 9 documentos diferentes no lote (acesso,
  cadastro, configuração, vaga antes e depois, turma, registro antes e depois, crédito depois), o
  encaixe 10 (mais o crédito antes) e a desistência 7; nenhuma gravação passa de 7 sozinha;
- equipe: quem pede (acesso e cadastro), a posse quando a regra pergunta pelo titular, e no
  convite o cadastro convidado e a configuração; o professor lê também a turma da aula que cria
  e, no crédito, o registro da aula de origem e a configuração;
- a conferência da janela de vagas do professor vai em lotes de no máximo 12 turmas
  (`lotesDeVagas` em `src/dados/firebase/repositorioDaEquipe.ts`): cada turma nova é uma leitura.

Regra nova que lê documento: conte de novo antes de publicar.

## Esquema e tamanho

Toda gravação passa por validação de campos (`hasAll` e `hasOnly`), tipos, formatos (datas,
horas, e-mails em minúsculas, telefones só com dígitos) e tamanhos (nome até 80, observação até
500, listas e mapas com teto). As listas que a equipe grava são conferidas item a item: as regras
não têm laço, então a lista vira um texto (`join`) com um separador que o item não pode ter, e uma
expressão regular confere todos os itens de uma vez (`ids`, `datas`, `horariosPublicos`,
`unidadesPublicasValidas`). Alunos fixos, datas de entrada, unidades do professor, chaves e
créditos das marcações e reposições, horários e unidades da página pública passam por isso. O que
não está nas regras é negado.

## No navegador

- Política de segurança de conteúdo (CSP) em `<meta>` em todas as páginas: scripts só do próprio
  site, sem `unsafe-inline` (os dois scripts embutidos, o do tema e o da pré-carga das fontes,
  entram pelo hash), `frame-src 'none'`, conexões só com o próprio site e, com projeto configurado,
  com os três endereços do Firebase (login, token e Firestore). Com o App Check ligado entram só
  os endereços do reCAPTCHA v3 e da troca de token (`regrasDaPolitica` em
  `scripts/plugin-offline.ts`, com teste). Sem Google Analytics, sem fontes ou scripts de terceiros.
- Trusted Types (`require-trusted-types-for 'script'` e `trusted-types default`): o app instala
  uma política padrão (`src/app/confianca.ts`) que recusa HTML e script por texto e só aceita
  script por endereço para o service worker do próprio site (e o reCAPTCHA, com o App Check).
  Com o App Check ligado, a política também deixa existir a política do próprio reCAPTCHA
  (`goog#html`): sem ela, o script do Google caía na política padrão, que recusa HTML por texto,
  quebrava, e o App Check ficava sem token fora de `localhost` (achado na revisão adversarial,
  com o script de verdade do reCAPTCHA e o Firebase simulado). O
  endereço chega à política como foi escrito no código (o service worker é registrado por um
  caminho relativo), então ela o resolve contra a página antes de comparar. Conferido nos dois
  motores dos testes (Chromium e o WebKit do Playwright 1.60); um motor sem Trusted Types ignora a
  diretiva e segue com o resto da política.
- `<meta name="referrer" content="strict-origin-when-cross-origin">`: links para fora (WhatsApp,
  mapa) recebem só a origem do site, nunca a rota.
- Nenhum texto vindo do banco vira HTML: não há `innerHTML` nem `dangerouslySetInnerHTML`; links
  para fora são montados pelo app, com `noopener`. Nada pessoal na URL: as rotas levam só códigos.
- Emuladores do Firebase só ligam em `localhost`/`127.0.0.1` e com `?emulador=1`; no site
  publicado o caminho nunca liga, e a política de segurança bloqueia endereço local de qualquer jeito.
- O service worker guarda só os arquivos do próprio site (páginas, scripts, estilos, fontes,
  ícones). Pedidos ao Firebase e aos emuladores vão direto para a rede e não passam pelo cache
  (testado: depois de entrar e abrir o financeiro, o cache não tem nada de login nem de banco).
  Uma versão nova fica esperando até a pessoa tocar em "Atualizar"; trocar o código com o app
  aberto deixaria duas versões convivendo.
- A página pública guarda a última leitura do documento público na aba (sessionStorage) por dez
  minutos: abrir e fechar várias vezes não gasta a cota do estúdio de novo. Nada disso vai para o
  service worker.
- O código do app não escreve nada no console (com o App Check em `localhost` e projeto real, o
  SDK do Google escreve o token de depuração, de propósito).
- `?agora=` (relógio de mentira) e `?atraso=` só existem no modo demonstração.
- A configuração do projeto não é segredo (vai para o navegador), mas fica fora do repositório,
  em variáveis do GitHub Actions.

## App Check

Qualquer pessoa pode ler o documento público sem login, e cada leitura conta na cota do dia do
plano gratuito. O App Check faz o Firebase só atender pedidos vindos do site de verdade,
conferidos pelo reCAPTCHA v3 (invisível). O app está pronto: com `VITE_FIREBASE_APPCHECK_SITE_KEY`
no build, o SDK manda o token em cada pedido do login e do Firestore, a página pública manda o
token no pedido REST (`X-Firebase-AppCheck`), a política de segurança libera o reCAPTCHA e a frase
que o Google exige aparece no rodapé. Sem a chave, tudo isso fica desligado; com os emuladores,
também. Ligar, observar as métricas e impor é passo do console, descrito em
[firebase.md](firebase.md); impor cedo demais derruba o login e a página pública, e desimpor
resolve na hora.

## O que depende do console

O app não consegue conferir nem mudar nada disto; a lista de verificação com os cliques está em
[firebase.md](firebase.md):

- Authentication iniciado ("Começar"): sem isso a criação de conta falha e nenhum e-mail chega.
- E-mail/senha ligado; domínio `pilates-central.github.io` autorizado;
  modelos de e-mail em português.
- Proteção contra enumeração de e-mails ligada; política de senha com mínimo 8.
- Regras publicadas com o e-mail do primeiro acesso trocado (e republicadas a cada mudança no
  arquivo).
- Chave de API restrita por site e por API no Google Cloud.
- App Check: as chaves do reCAPTCHA v3 criadas no console do reCAPTCHA (não no Firebase), a
  secreta no App Check do Firebase e a do site na variável do GitHub; imposto só depois das
  métricas "verificadas".
- Mais de uma pessoa como membro do projeto.

## Tentativas de escalada testadas

`npm run regras` roda 282 testes no emulador, cada papel contra cada coleção, permitindo e negando
(`testes-de-regras/regras.test.ts`), as tentativas das revisões de segurança
(`testes-de-regras/ataques.test.ts`), a folga do teto de expressões (`folga.test.ts`), as aulas
experimentais no registro (`experimentais.test.ts`), os textos do estúdio (`estudio.test.ts`), o
prazo dos convites (`convites.test.ts`) e o que o professor grava (`equipe-por-unidade.test.ts`).
Entre eles:

- professor lendo `pagamentos`, `financeiroDosAlunos` ou `auditoria`; professor marcando presença
  em outra unidade, cancelando aula ou dando crédito de cortesia;
- aluno lendo o cadastro de outro aluno (ou o próprio, que tem a observação da equipe), o portal ou
  os créditos de outro, turmas e registros (que têm nomes);
- aluno avisando a falta de outro, fora do prazo, numa turma que não é dele, sem abrir a vaga,
  com crédito de validade maior, ou criando crédito sem avisar;
- aluno se colocando em aula cheia, usando crédito de outro, vencido, já usado ou já gasto nesta
  mesma aula sem tocar nele, ocupando dois lugares (somando dois na vaga ou se encaixando na
  própria turma) ou entrando sem gastar o crédito; aluno marcando presença em si mesmo; aluno
  mexendo em `comecaEm`;
- aluno desfazendo o aviso e ficando com o crédito (voltava para a aula e ainda repunha outra), ou
  desfazendo o aviso de uma falta já reposta; aluno apagando o aviso ou a reposição de outro,
  mexendo na validade, na unidade ou na origem do próprio crédito, mudando a capacidade da vaga;
- campo a mais, texto enorme e tipo errado no que o aluno e a administração gravam (registro,
  crédito, vaga, cadastro, turma, página pública); item torto no meio de uma lista (id com espaço,
  data fora do formato, horário com texto a mais, unidade sem nome, nome de 61 letras), a lista
  cheia passando e a primeira a mais sendo recusada; vaga com `comecaEm` que não bate com a hora;
- convite forjado: professor, aluno ou pessoa de fora criando convite ou cadastro; convite que não
  bate com o cadastro (outro e-mail, outro papel); cadastro já nascendo com `uid`;
- aceitar convite com e-mail não confirmado, com outro e-mail, ou mudando o próprio papel no aceite;
  trocar o próprio acesso para apontar para o titular; aceitar um convite vencido, sem prazo ou
  revogado (equipe e aluno); criar convite sem prazo, com prazo no passado ou além da validade
  combinada; validade da configuração fora de 1 a 90 dias;
- aluno registrando, tirando ou mudando quem vem fazer a aula experimental (ou marcando a presença
  dessa pessoa), ou criando o registro já com alguém para experimentar; item torto no mapa (sem a
  barra, telefone com letra, nome vazio ou de 81 letras, código com espaço, valor que não é texto,
  quebra de linha), a 11a pessoa na mesma aula; professor de outra unidade registrando;
- textos do estúdio fora dos tetos ou com o separador, link do mapa sem `https://` ou com script,
  Instagram com espaço ou arroba, professor mexendo nos textos da página pública;
- administrador convidando, promovendo ou desativando administrador, ou revogando o convite de
  administração que o titular fez; mexendo no cadastro do titular; titular se desativando;
- professor criando o registro ou a vaga de uma aula de outra unidade (dizendo que é da dele) ou de
  turma que não existe; criando crédito sem o aluno ter avisado, com código inventado, validade
  além da combinada, já usado ou como cortesia; marcando crédito como usado sem pôr o aluno na
  aula, devolvendo crédito usado sem tirar a reposição, ou apagando o crédito e deixando o aviso;
- mudar o e-mail de quem já entrou (é ele que liga a conta ao papel);
- administrador tentando tomar o convite de administração feito pelo titular (trocando o e-mail,
  reescrevendo o convite ou criando um cadastro de aluno com o mesmo código);
- mexer na posse: apagar, reescrever, passar para professor, para convite pendente ou com `uid`
  trocado; reivindicar com outro e-mail ou sem e-mail confirmado; conta qualquer lendo a posse;
- registro de alterações: assinar pelo outro, professor ou aluno gravando, editar ou apagar uma
  linha (nem a administração), ação fora da lista, campo a mais, detalhe comprido demais;
- a conta com o e-mail da responsável, mas sem confirmar, não lê nem grava nada;
- coleção fora das regras: negada até para a administração.

## Testes no navegador

- `EMULADOR=1 npx playwright test`: ponta a ponta com o SDK de verdade contra os emuladores, nos
  motores do Chrome e do Safari: a responsável entra e vê o financeiro, o professor entra e não
  vê (nem pede os dados), o aluno avisa a falta e remarca, a página pública lista as vagas sem
  gravar nada, um professor convidado cria a conta, confirma o e-mail e entra, a administração
  grava estúdio, acesso de aluno, convite, reposição, pagamento e exclusão (com o acesso do aluno
  saindo junto), o login errado e a senha nova respondem igual com ou sem conta, e no primeiro
  acesso de um estúdio vazio só o e-mail combinado nas regras vira responsável; outra conta nem
  fica sabendo que o estúdio está sem dono.
- `e2e/login.spec.ts`: sem emulador, as respostas do Firebase simuladas (`CONFIGURATION_NOT_FOUND`,
  `OPERATION_NOT_ALLOWED`, tentativas demais, credencial inválida, e-mail inválido, rede cortada,
  senha fraca, e-mail já usado), cada uma com a sua frase e nunca com o código na frase; com os
  emuladores, a confirmação do e-mail com o primeiro envio falhando, reenvio, contagem de 60 s e o
  link do e-mail, senha nova pelo link e troca de senha pelo app, "Lembrar neste aparelho"
  desligado (outra aba sem sessão) e o cache do service worker sem nada do login nem do banco.
- `e2e/pwa.spec.ts`: a política de segurança sem `unsafe-inline`, com Trusted Types; HTML por texto
  e script de outro endereço recusados no Chrome; a versão nova do service worker esperando e
  assumindo só no "Atualizar".
- `e2e/alteracoes.spec.ts`: o registro de alterações com quem fez e quando, o aluno excluído só
  pelo código, e o professor sem a tela (nem pelo endereço).
- `scripts/plugin-offline.test.ts`: as diretivas da política com e sem projeto e com App Check;
  o service worker nunca guarda o Firebase.
- `src/experimental/rest.test.ts`: horário torto no documento público fica de fora em vez de
  derrubar a página; a leitura guardada na aba vale dez minutos e só para o mesmo projeto.
- `src/app/modo.test.ts`: o emulador não liga fora de `localhost`, nem com `?emulador=1`, e só aceita projetos de teste (`demo-`).
- Todo teste de ponta a ponta tem uma trava que corta e reprova qualquer pedido para domínios do
  Google: o projeto real nunca é lido nem gravado por teste.

## O que fica de fora (conhecido)

- **Limite de reposições por mês:** conferido pelo app; as regras não contam créditos (contar
  pediria um contador a mais em cada gravação). Quem contornar o app ganha créditos a mais, todos
  ligados a faltas de verdade e visíveis para a administração.
- **Números das vagas e do portal** são cópias mantidas pela equipe. Se ninguém da equipe abrir o
  app por duas semanas, a janela do aluno e da página pública encolhe até alguém abrir de novo.
  As regras confiam na equipe para esses números (só o aluno é limitado a mais ou menos um).
- **Aviso fora do prazo marcado pela equipe** (sem crédito) não aparece para o aluno como "você
  avisou": o aluno só vê os próprios créditos, não o registro da aula.
- **Convites não mandam e-mail:** sem Cloud Functions, a pessoa é avisada pelo WhatsApp (ou pelo
  convite copiado) e cria a conta com o e-mail do convite. A mensagem leva o e-mail da pessoa no
  texto, de propósito (é o convite); o link em si (`?entrar`) não leva nada pessoal.
- **Exclusão de aluno:** apaga cadastro, mensalidade, portal, convite, créditos, as marcações
  futuras, a observação dos pagamentos e o documento que liga a conta de login ao cadastro
  (`acessos/{uid}`, com o e-mail); se o cadastro nasceu de uma aula experimental, o nome e o
  telefone guardados no registro daquela aula dão lugar a "Aluno removido" (procurados até 120
  dias antes do cadastro); presenças antigas, pagamentos e a linha do registro de
  alterações ficam só com o código do aluno (o caixa precisa fechar). A conta de login do aluno,
  se existir, continua no Firebase Authentication sem papel nenhum; apagar a conta é pelo console
  (ver [firebase.md](firebase.md)).
- **Turmas do portal do aluno:** cada turma é um mapa (dia, horário, desde); as regras conferem só
  o tamanho da lista, porque conferir mapa a mapa custa mais do que o teto de expressões deixa.
  Quem grava é só a administração, e o app do aluno confere cada turma ao ler.
- **Trusted Types em motor antigo:** a diretiva é ignorada (o WebKit dos testes aplica; um
  Safari antigo não); o resto da política vale igual.
- **App Check:** o código está pronto, mas só protege depois que o dono registra o site e impõe no
  console; até lá a cota do plano gratuito segue exposta.
- **Quem veio só experimentar** (e não virou aluno) fica no registro daquela aula com nome e
  telefone; depois que a aula termina, o app não tem como tirar (antes dela, "Tirar"). Um pedido de
  exclusão dessa pessoa hoje é atendido pelo console (Firestore, o documento `registros/<turma>_<data>`,
  campo `experimentais`).
- **Teto de leituras das regras:** o emulador não confere (ver "Teto de leituras"); a contagem
  é manual.
