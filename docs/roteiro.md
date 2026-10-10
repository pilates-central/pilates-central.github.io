# Roteiro

Documento de passagem entre etapas: o que já está feito, o que falta e o que quem pegar o
trabalho precisa saber. Atualizar a cada entrega.

## Etapa 1: fundação e agenda com presença (feita)

### Projeto
- [x] Vite + TypeScript estrito + Preact + @preact/signals, sem biblioteca de componentes
- [x] ESLint enxuto (recomendados do TypeScript, regras de hooks)
- [x] Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `e2e`, `icones`
- [x] Caminho base do GitHub Pages igual em desenvolvimento e publicação; desde a preparação da transferência, vem de `BASE_PATH` (`scripts/caminho-base.ts`), que o workflow deriva do nome do repositório (`/` em `pilates-central.github.io`)
- [x] Política de segurança de conteúdo numa `<meta>` (o Pages não manda cabeçalho), com hash do único script embutido

### App instalável (PWA)
- [x] Manifesto com nome, cores do tema, `display: standalone`, ícones 192 e 512, ícone maskable e `apple-touch-icon`
- [x] Ícones gerados do logo vetorizado (`npm run icones`); favicon com o monograma
- [x] Service worker gerado no build (`scripts/plugin-offline.ts` + `src/pwa/sw.js`): guarda o app e as fontes latinas e abre sem internet no modo demonstração
- [x] Aviso de "versão nova disponível": a versão nova fica esperando e o app avisa "Tem uma versão nova do app", com "Atualizar" (feito na revisão de login e segurança)

### Identidade
- [x] Logo vetorizado com potrace (`src/assets/marca/logo.svg`), anel refeito em geometria
- [x] Figura do logo separada (`figura.svg`, ainda sem uso: pensada para estados vazios e a página pública); monograma para o favicon
- [x] Tokens de cor, tipo, forma e movimento em `src/estilos/tokens.css`, com tema escuro
- [x] Fontes Playfair Display e Figtree servidas pelo próprio site (só o subconjunto latino)
- [x] Ícones de traço próprios (`src/componentes/Icone.tsx`), marca d'água PILATES, chevrons duplos, pílulas de contorno, card terracota, sombra tingida
- [x] Fotos do espaço tratadas pela receita do briefing, 4:5, webp em 480 e 960 px (`public/fotos/`), para a página pública da etapa 3. Nenhuma foto com pessoas. A etiqueta do vaso (com nomes) foi apagada.

### Movimento e componentes
- [x] `src/movimento/`: molas em `linear()` com alternativa `cubic-bezier`, durações de 180 a 320 ms, só transform e opacity, `prefers-reduced-motion`
- [x] Animação começa depois de pintar (`animarDepoisDePintar`): em aparelho lento o tempo de montar a tela não come o movimento
- [x] Botões (primário, secundário, terciário), campo, pílula e chip, card, folha inferior arrastável (velocidade, resistência, "voltar" do Android, foco preso, Esc), faixa de dias com pílula deslizante, vagas em pontos, esqueleto com brilho por transform, aviso flutuante com desfazer, estado vazio com selo de traço, barra de abas com rótulo, números que contam
- [x] Retorno de toque com escala e o conserto do `:active` no iOS
- [x] Entrada em cascata das listas quando os dados chegam
- [x] View Transition na troca de tema (Chromium); troca de aba em CSS (mediu melhor, ver README)
- [ ] Medir a View Transition num iPhone de verdade (`?transicao=vista` força) e, se fluida, liberar no Safari

### Domínio e dados
- [x] Tipos e regras: unidade, equipe, aluno, turma recorrente, aula derivada, registro de exceções, crédito de reposição, pagamento, configuração ([modelo de dados](modelo-de-dados.md))
- [x] Presença, aviso de falta com prazo e crédito, reposição só com vaga, cancelamento e feriado, desfazer cirúrgico, permissões por papel
- [x] Interface do repositório (`src/dados/repositorio.ts`) e adaptador de demonstração em localStorage, com gravação atômica e funcionando sem armazenamento (aba anônima)
- [x] Dados fictícios determinísticos: 2 unidades, responsável e 3 professores, 40 alunos, 29 turmas, três semanas de histórico, feriado de 12/10, mensalidades pendentes
- [x] "Recomeçar demonstração" em Ajustes; `?agora=AAAA-MM-DDTHH:MM` fixa o relógio (demonstrações e testes); `?atraso=ms` simula rede lenta

### Telas
- [x] Entrar (demonstração: explorar como administração ou como um dos professores)
- [x] Abas por papel (hoje as mesmas três; Alunos e Financeiro entram na etapa 2)
- [x] Hoje: próxima aula, alunos esperados, avisos, reposições, aulas seguintes
- [x] Agenda: faixa de dias, unidade, só as minhas (professor), aulas por período, deslizar entre dias
- [x] Chamada na folha: presente, faltou, avisou, todos presentes, desfazer, encaixar reposição, dar crédito fora do prazo e cancelar e reabrir aula (administração)
- [x] Ajustes: tema, instalar no celular (Android com botão, iPhone com passo a passo), recomeçar demonstração, trocar de perfil

### Testes e publicação
- [x] Vitest: domínio, dados, molas, gestos, contraste dos tokens (157 testes)
- [x] Playwright em dois projetos (Chromium com Pixel 7, WebKit com iPhone 13): entrada, agenda, chamada, hoje, PWA, acessibilidade (alvos de 48 px, texto de 16 px, folha inerte, reduzir movimento) e fluidez (intervalos de quadro e propriedades animadas)
- [x] GitHub Actions: tipos, lint, Vitest, build, ponta a ponta nos dois motores e publicação no Pages

## Etapa 2: gestão do estúdio (feita)

### Papéis e dados
- [x] Papéis sem gênero: titular (aparece como "Responsável"), administrador e professor; titular e administradores formam a "Administração", com o mesmo acesso ao dia a dia, financeiro incluído (`src/dominio/permissoes.ts`)
- [x] Regras da equipe com o ator em cada uma (`src/dominio/equipe.ts`): a administração convida professores; só o titular convida, promove ou tira administradores e passa a conta adiante (para administrador ativo que já entrou no app); ninguém tira o titular. Testes de tentativa de escalada em `equipe.test.ts`
- [x] Sessão guarda só quem entrou; o papel vem do cadastro da equipe (`src/app/perfil.ts`) e quem é desativado volta para a entrada
- [x] Financeiro separado do cadastro do aluno (`FinanceiroDoAluno`: mensalidade, forma preferida, vencimento), porque no Firestore a regra libera ou nega o documento inteiro e o professor não pode ler valores
- [x] Formas de pagamento: Pix, cartão de crédito, cartão de débito, dinheiro, transferência, Gympass, TotalPass, outro
- [x] Regras puras e testadas para alunos (validação, busca, pausar e arquivar, plano x turmas), turmas (validação, capacidade, conflito de horário, entrada com data), frequência e ausências seguidas, central de reposição (aulas com vaga para um crédito, a vencer e vencidos, limite por mês), financeiro do mês (previsto, recebido, em aberto, por forma, atrasados, planilha, lembrete) e unidades
- [x] Demonstração versão 2: responsável, uma pessoa na administração e 3 professores; histórico desde o começo do mês anterior (com o trecho antigo num sorteio separado, para as três semanas recentes ficarem iguais às da etapa 1); seis meses de mensalidades; um aluno com três faltas seguidas

### Telas
- [x] Navegação com telas empilhadas por aba (`#/alunos/a-10/editar`), "Voltar" escrito em toda subtela, histórico do navegador (o "voltar" do Android funciona) e a lista voltando para a mesma rolagem (`src/app/navegacao.ts`)
- [x] Abas por papel: administração com Hoje, Agenda, Alunos, Financeiro e Mais; professor sem Financeiro (link direto cai no Hoje)
- [x] Alunos: lista com busca sem acento ou pelo final do telefone, filtros de unidade e situação, destaque discreto de ausências seguidas e de plano x turmas; ficha com plano, turmas fixas, frequência do mês (e do mês passado), créditos, mensalidade e pagamentos, WhatsApp e ligar; cadastro e edição com validação em português e foco no primeiro erro; mensalidade sugerida pelo valor mais comum do plano; pausar e arquivar com confirmação e desfazer
- [x] Turmas: grade da semana por unidade com lugares e frequência do mês; criar e editar (horário, duração, lugares, professor) com conflito de horário do professor; colocar e tirar aluno fixo respeitando capacidade e horário do aluno, com desfazer; encerrar com confirmação e desfazer
- [x] Reposição: central com para encaixar (o que vence primeiro no topo), marcadas (as que já aconteceram ficam como feitas) e vencidas; folha de encaixe só com aulas com vaga da unidade nos próximos 14 dias, escolher e confirmar, com desfazer; na chamada, "Encaixar em outro horário" logo depois do aviso; limite de reposições por mês com cortesia da administração
- [x] Presença: frequência por aluno (ficha) e por turma (grade e detalhe) no mês; ausências seguidas com limite configurável
- [x] Financeiro: mês e unidade, previsto, recebido (com barra), em aberto, ativos; em aberto com atrasados primeiro, lembrete pelo WhatsApp e lançamento rápido; por forma de pagamento; gráfico de 6 meses tocável com tabela para leitor de tela; lançamentos com apagar e desfazer; planilha CSV do mês
- [x] Mais: nome e WhatsApp do estúdio, regras de reposição com prévia do texto, unidades (criar, editar, fechar só sem turmas e alunos), equipe (convidar, editar, promover, tirar acesso, passar a conta) com o papel escrito
- [x] Professor: agenda, alunos sem valores, chamada e reposição; sem financeiro nem ajustes do estúdio (só lê as regras de reposição)
- [ ] Cancelar o dia inteiro de uma vez (feriado móvel): hoje cancela-se aula por aula
- [x] Aviso de "versão nova disponível" do service worker (revisão de login e segurança)

### Testes
- [x] Vitest: regras novas (alunos, turmas, frequência, equipe com tentativas de escalada, unidades, financeiro do mês, planilha, lembrete, limite do mês, encaixe a partir do crédito) e dados da demonstração versão 2
- [x] Playwright nos dois motores: alunos, turmas, reposição, financeiro (inclusive o CSV baixado), equipe e papéis, auditoria de alvos de 48 px e texto de 16 px em todas as telas de gestão e folhas, fluidez das transições novas (abrir ficha, voltar, seção, folha de encaixe, escolher aula, troca de mês)

## Etapa 3: Firebase, papéis, acesso do aluno e página pública (feita)

### Firebase
- [x] Configuração do projeto num arquivo só (`src/config/firebase.ts`), lida no build de variáveis `VITE_FIREBASE_*` (no GitHub Actions, variáveis do repositório `FIREBASE_*`); sem elas, o site é só demonstração. Sem Analytics
- [x] Duas portas quando há projeto: **Entrar** (estúdio de verdade) e **Ver demonstração**; a escolha fica no aparelho (`src/app/modo.ts`); `?demo` leva direto à demonstração
- [x] SDK modular carregado sob demanda (`import()` em `src/app/conta.ts`), num pedaço `firebase-*.js` fora do pacote inicial e do cache do service worker; Firestore "lite" (REST), sem o iframe de login do Google
- [x] Emuladores só em `localhost` e com `?emulador=1` (ou `?emulador=demo-outro`, um projeto de teste vazio); portas em `firebase.json`; inerte no site publicado
- [x] Login por e-mail e senha com mensagens genéricas, senha nova, confirmação do e-mail antes de qualquer acesso (`src/dados/firebase/autenticacao.ts`)
- [x] Adaptador da equipe com o mesmo contrato da demonstração (`repositorioDaEquipe.ts`): transação por ação, registro da aula relido e mesclado aluno por aluno, cadastros só nos campos alterados, alunos fixos com `arrayUnion`/`arrayRemove`, vagas recalculadas com o registro fresco
- [x] Política de segurança amplia `connect-src` só para login, token e Firestore, e só com projeto configurado
- [x] `?agora=` e `?atraso=` só no modo demonstração

### Papéis e posse
- [x] Posse em `estudio/posse`, criada no primeiro acesso (trava no e-mail combinado nas regras) e mudada só pela passagem da conta
- [x] Convites em `convites/{e-mail}`; o papel só vale com o e-mail confirmado e igual ao do convite (`acessos/{uid}` liga a conta à pessoa)
- [x] Titular gravado como administrador na equipe; quem é titular diz a posse
- [x] Convite da equipe e do aluno com a mensagem pronta para o WhatsApp (o plano gratuito não manda e-mail)

### Regras do Firestore
- [x] `firestore.rules` com menor privilégio, esquema e tamanho em tudo, o resto negado; identidade calculada uma vez por pedido (o teto de 1000 expressões estourava com funções repetidas)
- [x] Financeiro em coleções só da administração; aluno lê só cópias sem nomes (`vagas`, `portal`) e os próprios créditos; página pública lê só `publico/estudio`
- [x] Aluno avisa a própria falta e encaixa a própria reposição: transação no cliente e as regras conferindo prazo (relógio do servidor), capacidade e a ligação entre registro, crédito e vaga
- [x] 174 testes no emulador (`npm run regras`), cada papel contra cada coleção e as tentativas de escalada; job próprio no CI

### Aluno, página pública e LGPD
- [x] App do aluno (liga e desliga em Mais, Estúdio; liberado por aluno na ficha): próximas aulas, avisar falta (gera crédito), desfazer no prazo, escolher a reposição numa aula com vaga, desistir no prazo; igual na demonstração ("Explorar como aluno")
- [x] Página pública `experimental/` sem login: marca, fotos do espaço, horários com vaga, endereço e pedido pelo WhatsApp com a mensagem pronta; nada é gravado; na demonstração lê os dados do aparelho
- [x] Aviso de privacidade em `privacidade/`; exportar os dados de um aluno (JSON) e excluir o aluno com confirmação, na ficha
- [x] Service worker guarda cada página pelo próprio endereço (o app, a experimental e a de privacidade)

### Testes
- [x] Vitest: projeções, app do aluno, privacidade, aula experimental, conversão e mescla do Firestore, leitura REST
- [x] Playwright com o SDK de verdade contra os emuladores, nos dois motores (`EMULADOR=1`): responsável entra e vê o financeiro, professor não vê, aluno avisa e remarca, página pública lista vagas sem gravar, professor convidado cria a conta e confirma o e-mail, administração grava estúdio, acesso de aluno, convite, reposição, pagamento e exclusão, login errado e senha nova respondem igual, primeiro acesso num estúdio vazio (só o e-mail combinado reivindica)
- [x] Playwright na demonstração: app do aluno, página pública (inclusive a vaga aberta por um aviso), privacidade, exportar e excluir, liberar o app; auditoria de alvos e texto nas telas novas
- [x] Trava em todo teste de ponta a ponta: pedido para domínios do Google é cortado e reprova

### Ficou para depois
- [ ] Publicar as regras no projeto real e fazer o primeiro acesso (passo a passo em [firebase.md](firebase.md)); conferir no primeiro acesso real que o console do navegador não mostra erro de política de segurança
- [ ] Preencher as variáveis `FIREBASE_*` do repositório no GitHub (sem elas, o site publicado fica só com a demonstração)
- [ ] Limite de reposições por mês também nas regras (hoje só o app confere)
- [x] Aviso de "versão nova disponível" do service worker (revisão de login e segurança)
- [ ] Cancelar o dia inteiro de uma vez (feriado móvel)
- [ ] Medir a View Transition num iPhone de verdade
- [ ] Deixar o caminho aberto para Gympass (Wellhub) e TotalPass, sem integrar agora (as formas de pagamento já existem)
- [x] Aula experimental na agenda (feita nas pendências de produto, abaixo): `RegistroAula.experimentais`, participante com origem `experimental`, "Registrar aula experimental" na chamada e no Hoje, vagas e página pública recalculadas, esquema nas regras com teste, "Cadastrar como aluno" com o cadastro preenchido
- [x] Textos da página pública configuráveis em Mais, Estúdio (idem): frase, focos, endereço, link do mapa e Instagram em `Configuracao` e em `publico/estudio`, com o esquema das regras

## Revisão de produto: o pedido do estúdio x o app (feita)

Comparação item por item com o que o estúdio pediu, usando o app como a administração e como um
professor num iPhone SE (375 x 667, uma mão), e contando os toques (`e2e/toques.spec.ts`).

### Atendido
- [x] Alunos cadastrados por unidade, com busca, ficha, pausa e arquivo
- [x] Agenda das aulas com os alunos dentro (turmas fixas de 2 ou 3 vezes por semana; a aula é derivada da turma)
- [x] Controle de presença por aula, frequência por aluno e por turma, destaque de quem anda faltando
- [x] Reposição: o aviso tira o aluno daquele dia e gera crédito; o encaixe é só em aula com vaga; central de reposição
- [x] Financeiro preenchido à mão: alunos ativos por unidade, formas de pagamento (Gympass e TotalPass incluídos), recebido x previsto, em aberto, últimos meses, planilha
- [x] Uso pelo celular, pela administração e pelos professores (PWA no iPhone e no Android)
- [x] Desejável: o aluno avisa a falta e escolhe a reposição sozinho; com o app do aluno desligado, a equipe faz por ele
- [x] Vários administradores, responsável pela conta e passagem da conta; textos sem pressupor uma pessoa só
- [x] Nada de treino, vídeo de aula, cronômetro, evolução corporal, conquistas ou onboarding de marketing (conferido no código)

### Parcial (resolvido depois)
- [x] Página de aula experimental: a equipe passou a **registrar a aula experimental na agenda** (ocupa a vaga, entra na chamada, vira aluno com um toque). Ver "Pendências de produto e do celular".
- [x] Produto genérico de agendamento: os textos da página pública (frase, focos, endereço, mapa, Instagram) vêm das configurações e a marca d'água é a primeira palavra do nome do estúdio; nada deste estúdio fica no código (idem).
- [x] Duas portas no site publicado: as variáveis `FIREBASE_*` foram criadas no GitHub e o site publicado abre com Entrar e Ver demonstração.

### Corrigido nesta revisão
- [x] "Ativos" na lista de alunos mostrava também os pausados (39), enquanto o Financeiro dizia 37 ativos; agora são o mesmo número, e a busca sem resultado diz em que lista achou a pessoa
- [x] "Todos presentes" aparecia como ação principal às 10h na aula das 18h; a chamada agora abre meia hora antes (`ABERTURA_DA_CHAMADA_MIN` em `src/dominio/presenca.ts`); o aviso de falta continua livre, e o card do Hoje diz "Ver quem vem" até a chamada abrir
- [x] "Lançar pagamento" listava em ordem alfabética (quem já pagou no topo); agora quem deve o mês vem primeiro, com o valor: 4 toques
- [x] "Para olhar" levava para a lista inteira de alunos; agora cada aluno sumido aparece pelo nome e abre a ficha (até 3; mais que isso, uma linha só)
- [x] "Trocar de perfil" deixava quem entrava depois na aba Mais; agora começa no Hoje (equipe) ou em Minhas aulas (aluno)
- [x] A página pública só era achada em Mais, Estúdio; agora está na entrada da demonstração e em Mais, com compartilhar ou copiar o link
- [x] Página pública: atalho para os horários na capa (no iPhone SE eles ficavam abaixo das fotos), fim de cada aula também com várias unidades, "Primeira vez?" para quem nunca fez aula
- [x] Grade de turmas cortava "frequência 100%" em reticências no celular estreito
- [x] Domingo sem aula: o Hoje diz quando é a próxima
- [x] Aula que acabou com alguém sem marcação só aparecia na Agenda; agora o Hoje mostra "Chamada por fazer", a um toque
- [x] Teste de telefone com um fixo de cara real trocado por um de zeros

### Toques contados (iPhone SE, `e2e/toques.spec.ts`)
- [x] Chamada da turma inteira: 2 toques (3 com uma falta); limite pedido: 3
- [x] Achar um aluno: 3; limite 3
- [x] Lançar pagamento: 3 pela lista de em aberto, 4 pelo botão geral; limite 4
- [x] Encaixar reposição: 5 pela central ou pela chamada; limite 5
- [x] O aluno remarca a própria aula: 5
- [x] Visitante até o pedido no WhatsApp: 1 (sem escolher horário) a 3

## Revisão de segurança e privacidade (feita)

As regras foram atacadas no emulador como cada papel e como anônimo (`testes-de-regras/ataques.test.ts`),
o site foi conferido no navegador (política de segurança, console, cache, armazenamento) e cada
imagem versionada foi aberta e olhada.

### Achado e corrigido
- [x] O aluno desfazia o aviso de falta e ficava com o crédito: voltava para a aula e ainda repunha outra, até com o crédito já usado. Agora o crédito do aviso sai no mesmo lote (regra da vaga)
- [x] O aluno fixo se encaixava na própria turma, ocupando dois lugares com um crédito
- [x] Qualquer conta com e-mail confirmado lia `estudio/posse` (uid do titular e se o estúdio já tinha dono); agora só a equipe e o e-mail do primeiro acesso. Quem não tem convite cai direto em "Ainda não dá para entrar"
- [x] Um horário torto no documento público (o professor grava os horários, e as regras não conferem item por item) derrubava a página de aula experimental: sem horários e sem o botão do WhatsApp. A página agora confere cada horário e unidade
- [x] Excluir o aluno deixava `acessos/{uid}` com o e-mail dele; agora a administração acha e apaga o acesso de aluno (nunca o da equipe) na mesma gravação
- [x] O endereço de verdade do estúdio estava nos dados fictícios da demonstração, no teste e no passo a passo; trocado por um inventado (banco de demonstração versão 4) e a captura refeita
- [x] O aviso de privacidade não dizia que a sessão de login fica no celular nem que a conta de login também é apagada
- [x] Teste da administração no emulador dependia da hora: à noite o primeiro crédito da lista já não tinha aula com vaga

### Conferido sem defeito
- [x] Sem `innerHTML`/`dangerouslySetInnerHTML`; links para fora (WhatsApp, mapa) montados pelo app com `noopener`; telefone só com dígitos
- [x] Política de segurança sem `unsafe-inline` em script (dois scripts embutidos por hash); com projeto, `connect-src` só ganha login, token e Firestore; a política não libera `apis.google.com`, Analytics nem reCAPTCHA
- [x] Emulador inerte fora de `localhost` (código e política de segurança); `?agora=` e `?atraso=` só na demonstração
- [x] Console vazio entrando como responsável, professor e aluno; cache do service worker só com arquivos do site; no aparelho só o modo, a sessão de login (IndexedDB do SDK) e preferências
- [x] `npm audit --omit=dev`: 0 vulnerabilidades; dependências de produção: Preact, signals, Firebase e as duas fontes
- [x] Fotos do espaço (5, nos dois tamanhos) abertas uma a uma e as 22 capturas em folhas de contato: sem pessoas, sem metadados; a etiqueta da planta segue ilegível
- [x] Planilha CSV não deixa célula virar fórmula (`=`, `+`, `-`, `@`, tabulação)

### Ficou para depois
- [x] App Check do Firebase (feito na revisão de login e segurança, abaixo; ligar e impor é ação do dono no console)
- [x] Margem do teto de 1000 expressões na regra do registro escrito pelo aluno (idem: medido de 51 a 110 comparações a mais conforme o caminho, e o teste prova pelo menos 40 em todos)
- [ ] A conta de login do aluno excluído continua no Firebase Authentication (apagar pelo console, passo em [firebase.md](firebase.md)); sem Cloud Functions não há como apagar pelo app
- [x] Itens de listas gravadas pela equipe (horários públicos, alunos fixos, unidades, reposições) conferidos item a item (idem)

## Revisão no celular e de movimento (feita)

Passeio por 59 passos (entrada, folhas, chamada, agenda com faixa e dedo, alunos, turmas,
reposição, financeiro, ajustes, tema, esqueleto, app do aluno e página pública) em quatro
perfis: WebKit com iPhone 13 (390 x 664) e com o iPhone SE do Playwright (320 x 568, a menor tela),
Chromium com Pixel 7 e com a CPU 4x mais lenta. A agenda e os campos também a 375 px (iPhone SE de
segunda e terceira geração), nos testes.
Cada perfil gravado em vídeo, quadros a 10 por segundo olhados em folhas de contato; em cada passo,
intervalos de `requestAnimationFrame`, deslocamento de layout (CLS) e tarefas longas; nos gestos,
a posição da peça quadro a quadro contra a do dedo (com toque de verdade no Chromium, pelo CDP).

### Achado e corrigido
- [x] **Fontes baixavam duas vezes no iPhone** (59 kB a mais na primeira visita): o WebKit busca a fonte do CSS sem CORS e a pré-carga pedia com CORS. A pré-carga agora é montada conforme o motor (`preCargaDasFontes` em `scripts/plugin-offline.ts`); o aviso "preloaded but not used" sumiu do console do WebKit
- [x] **Teclado cobria o campo e o botão nas folhas** (lançar pagamento, busca do encaixe, senha nova): a folha acompanha a `visualViewport`, sobe até a borda do teclado por transform, encolhe e rola até o campo (`src/movimento/teclado.ts`, `FolhaInferior`)
- [x] **A folha trocava de conteúdo enquanto descia**: na entrada aparecia a equipe inteira no lugar dos professores, e no encaixe um "sem vaga" no lugar da aula marcada. A folha guarda o que mostrava aberta e fica inerte até sumir
- [x] **O aviso saltava** do alto para cima das abas quando a folha fechava, por cima dela; agora entra de novo no lugar novo
- [x] **Soltar o dedo dava tranco**: a folha arremessada partia do repouso e chegava a 3,7 px/ms com o dedo a 1 px/ms; a lista do dia, depois de um arraste longo, voltava uns pixels antes de sumir. As duas saem na velocidade do gesto (`curvaQueContinua` em `src/movimento/animar.ts`) e a lista sempre para a frente
- [x] **A faixa de dias descia 34 px sob o dedo no iPhone**: com o "Hoje" ao lado, o título dos outros dias quebrava em duas linhas (medido em 375 e 390 px nos dois motores). O "Hoje" foi para a linha do mês e o título ficou numa linha, com o tamanho ajustado à tela (medido nos 43 dias em 320 a 412 px: cabeçalho sempre da mesma altura)
- [x] Nome do estúdio cortado ("Pilates ...") a 360 px e menos: o selo de demonstração ficou mais estreito; cabe inteiro a partir de 360 px (a 320 px segue com reticências, "Pilates Ce...")
- [x] Contraste medido na tela: o "dom" e os outros dias sem aula da faixa ficavam em 4,2:1 no tema claro (cor secundária com opacidade em 13 px)
- [x] Abrir sem internet nunca tinha sido testado no WebKit (o teste era pulado); agora é, com o servidor desligado de verdade
- [x] No modo escuro automático, a barra do sistema (`theme-color`) ficava clara até o app carregar; o script do cabeçalho já a pinta escura antes da primeira pintura
- [x] Teste do aluno no emulador falhava no horário da aula dele (relógio de verdade)

### Conferido e certo
- [x] JS inicial da demonstração: 80 kB comprimidos (limite 170) e o Firebase não é baixado (teste em `e2e/celular.spec.ts`); fotos de 11 a 62 kB em webp
- [x] Manifesto, ícone do iPhone de 180 px sem transparência, `viewport-fit=cover` com as margens seguras no topo, nas abas, na folha e nos avisos, `100dvh`, campos de 16 px (sem zoom ao focar), rolagem da folha e da faixa sem vazar
- [x] CLS zero em todos os passos nos dois perfis do Chromium (o teste de fluidez agora reprova qualquer deslocamento sem toque)
- [x] Chromium: p95 de 16,7 a 16,8 ms em todos os 59 passos; com a CPU 4x, também 16,7 a 16,8 ms, com tarefas longas de 50 a 130 ms ao montar telas novas (a maior: a lista de alunos) e de 237 ms na carga da página
- [x] Folha e lista seguem o dedo: erro médio de 3 px no arraste lento da folha e de 9 px no deslize do dia (um passo do dedo, medido no quadro seguinte)
- [x] Foco visível em todos os controles percorridos com Tab nas 15 telas da medição de contraste; folhas com `role="dialog"`, título, foco preso e o resto inerte; faixa de dias com rótulo por dia e o dia escolhido marcado
- [x] "Reduzir movimento" desliga deslocamentos (teste existente)

### Ficou para depois
- [ ] Conferir num iPhone de verdade: o teclado nas folhas (aqui a `visualViewport` foi simulada nos dois motores), a barra de status com `apple-mobile-web-app-status-bar-style: default` no tema escuro, e a View Transition no Safari
- [ ] No WebKit do contêiner (sem GPU) a primeira folha da sessão leva de 0,7 a 2 s para subir e há quadros de 1 a 2 s em seguida; a mesma folha animando sozinha mediu p95 de 20 ms ali. Não reproduz no Chromium; vale medir num iPhone antes de mexer
- [x] Tela de abertura do app instalado no iPhone (`apple-touch-startup-image`): feita nas pendências de produto e do celular, abaixo
- [x] Tarefas longas ao montar Alunos, Financeiro e a ficha com a CPU 4x: listas e seções em partes (idem)
- [x] A marca das seções (Alunos, Turmas, Reposições) desliza de uma para outra, com o cabeçalho parado (idem)

## Revisão de login e segurança (feita)

O primeiro acesso de verdade falhou sem explicação: o projeto existia, mas o Authentication nunca
tinha sido iniciado no console, e o app só dizia que não deu para criar a conta (nenhum e-mail
chegou). Esta revisão fez o login explicar o que aconteceu e fechou o que a revisão de segurança
tinha deixado para depois. Tudo testado nos emuladores e com respostas simuladas; o projeto real
não foi tocado.

### Login e primeiro acesso
- [x] Cada código do Firebase vira uma frase em português (`src/dados/firebase/erros.ts`): Authentication não iniciado ou e-mail/senha desligado ("O login por e-mail e senha ainda não foi ativado no Firebase deste projeto..."), sem rede, tentativas demais, domínio não autorizado, chave de API restrita, e-mail inválido, senha fraca, cota de e-mails do dia, App Check, sessão antiga. A frase nunca mostra o código; "Detalhes" mostra o código bruto para quem configura o projeto. "E-mail já usado" responde igual à recusa genérica, com ou sem a proteção contra enumeração ligada
- [x] Confirmação do e-mail: o endereço na tela, aviso de spam e promoções, "Reenviar" com espera de 60 s e contagem, "Já confirmei" recarrega a conta e o token antes de dizer que não confirmou; se a conta sair mas o primeiro e-mail falhar, a tela diz o motivo mapeado e deixa reenviar
- [x] "Esqueci a senha" diz para qual e-mail foi e o que fazer com o link; trocar a senha em Mais, Conta (pede a atual, "A senha atual não confere" quando erra); sair; força da senha enquanto digita (mínimo 8, sem exigir símbolo, `src/dominio/senha.ts`); "Lembrar neste aparelho" (desligado, a sessão fica só na aba)
- [x] `docs/firebase.md`: "Authentication, Começar" em primeiro lugar, com o sintoma de quando falta; lista de verificação final do console; App Check passo a passo; chave de API restrita por site e por API
- [x] Testes: `erros.test.ts` e `senha.test.ts` (Vitest); `e2e/login.spec.ts` nos dois motores: CONFIGURATION_NOT_FOUND, OPERATION_NOT_ALLOWED, tentativas demais, credencial inválida, e-mail inválido, rede cortada, senha fraca e e-mail já usado simulados com `route.fulfill` (sem emulador); com os emuladores, confirmação com envio falhando, reenvio, contagem (relógio controlado) e link do e-mail, senha nova pelo link e troca de senha pelo app, sessão fora do aparelho, cache do service worker sem nada do login nem do banco

### Segurança
- [x] App Check com reCAPTCHA v3 atrás de `VITE_FIREBASE_APPCHECK_SITE_KEY` (`src/dados/firebase/sdk.ts`, `src/experimental/firebaseAppCheck.ts`): sem chave, desligado; com os emuladores, desligado; em localhost com o projeto real, token de depuração. A política de segurança só libera o reCAPTCHA e a troca de token com a chave; a página pública manda o token no pedido REST. Ligar e impor é ação do dono (firebase.md, seção 7); nada foi ativado no projeto real
- [x] Regras: listas gravadas pela equipe conferidas item a item até o teto (`ids`, `datas`, `horariosPublicos`, `unidadesPublicasValidas`: a lista vira um texto e uma expressão regular confere tudo de uma vez). O documento público mudou de forma para isso: horário em texto (`'2026-10-13 18:00-18:50 u-centro 2'`) e unidades num mapa `id -> 'nome|endereco'`; a página confere cada item de novo ao ler. A vaga leva `comecaEm` (início da aula em ms, conferido contra data e hora) e as regras do aluno deixam de recalcular o instante; o registro escrito pelo aluno tem a sua validação enxuta (`registroDoAluno`) em vez da da equipe; medido com `MEDIR_FOLGA`, cada caminho do aluno aguenta de 51 (encaixar numa aula com registro de outra pessoa) a 110 (a vaga no aviso) comparações a mais, contra 8 a 15 antes, e `folga.test.ts` prova pelo menos 40 em todos
- [x] Furo aberto pela reestruturação e fechado: a regra do registro passou a ler o crédito só como fica depois do lote; um crédito que já apontasse para a aula serviria de novo sem ser tocado. A regra da vaga confere que o crédito estava livre antes (`creditoLivreAntes`), com teste em `ataques.test.ts`
- [x] Documento público: só os campos que a página mostra, com teto de tamanho em cada um; a página lê uma vez por sessão do navegador e revalida depois de 10 minutos (sessionStorage, nunca o service worker)
- [x] Cliente: `frame-src 'none'`; Trusted Types com política padrão (`src/app/confianca.ts`: HTML e script por texto recusados, script por endereço só o service worker e, com App Check, o reCAPTCHA; o endereço relativo do registro do service worker é resolvido contra a página antes de comparar, senão o registro era recusado no Chromium; conferido nos dois motores dos testes); `referrer` `strict-origin-when-cross-origin` nas três páginas; service worker com a versão nova esperando e o aviso "Tem uma versão nova do app" com "Atualizar" (`src/app/atualizacao.ts`); nada do Firestore nem do login no cache (testado)
- [x] LGPD: a exclusão também apaga a observação dos pagamentos do aluno (fica só o código, nos dois adaptadores); o aviso de privacidade diz o que fica depois da exclusão, a sessão fora do aparelho, o cache da página pública e o App Check. Registro de alterações (coleção `auditoria`: só códigos, só a administração lê, ninguém edita nem apaga): pagamento lançado ou apagado, cadastro excluído, acesso do aluno liberado ou tirado, papel mudado, acesso da equipe desligado ou religado, conta passada; tela em Mais, Registro de alterações; na demonstração fica no aparelho. Testes de regras para cada tentativa (assinar pelo outro, professor gravando, editar, apagar, ação fora da lista, campo a mais)
- [x] `npm audit --omit=dev`: 0 vulnerabilidades; nenhuma dependência nova (o App Check vem do pacote `firebase`)
- [x] `docs/seguranca.md` refeito: o que protege o quê, o que depende do console, o que foi testado como ataque

### Achado e corrigido no trabalho que veio pela metade
- [x] `FIREBASE_CONFIG` como nome da variável que troca o `firebase.json`: o próprio `firebase emulators:exec` define `FIREBASE_CONFIG` com um JSON, e os três arquivos de testes de regras nem abriam. Virou `FIREBASE_JSON`
- [x] O App Check era ligado também com os emuladores: no CI, assim que o dono criasse `FIREBASE_APPCHECK_SITE_KEY`, o reCAPTCHA pediria o Google e a trava dos testes reprovaria tudo
- [x] A política de Trusted Types recusava o registro do service worker no Chromium: o app registra `sw.js` por caminho relativo e a política só aceitava o endereço absoluto, então o registro falhava em silêncio e o app publicado não abriria sem internet (os seis testes de service worker caíam). A política resolve o endereço contra a página antes de comparar, com teste
- [x] Na primeira visita a página recarregava sozinha: o `controllerchange` disparado pela primeira instalação (o service worker reivindica a página) era tratado como "versão nova assumiu". Agora só recarrega se já havia um controlador ou se a pessoa tocou em Atualizar
- [x] O teste da versão nova trocava o `sw.js` por rota do Playwright, que não alcança a busca do script do service worker (nenhum dos dois motores): o teste sobe um servidor próprio de `dist/` que passa a entregar outra versão (`servidorDoDist` em `e2e/apoio.ts`, o mesmo do teste sem servidor)
- [x] No WebKit, pedido que passa pelo service worker também não é alcançado pela rota: os testes que simulam a resposta do Firebase rodam com o service worker bloqueado (`serviceWorkers: 'block'`), e só o teste do cache o liga
- [x] `trustedTypes.getPolicyNames()` não existe nos motores; o teste confere `defaultPolicy.name`. O teste de senha procurava "Professor Senha" no título do Hoje, que cumprimenta pelo primeiro nome
- [x] `irPara` (ir pelo endereço nos testes) logo depois de uma folha fechar perdia a navegação: a folha tira a própria entrada do histórico com `history.back()`, que é assíncrono, e o back desfazia a entrada nova. Só apareceu no WebKit do CI (mais lento), no teste da administração com os emuladores; o ajudante agora espera o histórico ficar sem a folha

### Ficou para depois
- [ ] A conta de login do aluno excluído continua no Firebase Authentication (apagar pelo console); sem Cloud Functions não há como apagar pelo app
- [ ] Trusted Types: o Chromium e o WebKit do Playwright 1.60 aplicam (testado nos dois); conferir num iPhone de verdade se o Safari instalado também aplica (um motor antigo ignora a diretiva e o teste pula lá). O resto da política vale igual
- [ ] Depois de o dono ligar e impor o App Check: conferir no site publicado que o login e a página pública seguem funcionando e que o console do navegador não acusa a política de segurança

## Pendências de produto e do celular, convites e caminho base (feita)

O que a revisão de produto e a do celular tinham deixado para depois, mais os convites com prazo
e a preparação para o site mudar de endereço (o repositório passa para a organização do estúdio
e o site vai para a raiz de `pilates-central.github.io`). O repositório antigo em Expo
(`KohiJow/Pilates-Central`) ganhou um aviso no topo do README apontando para este, e a descrição
"Protótipo inicial em Expo; o app do estúdio virou o pilates-central-web".

### Aula experimental na agenda
- [x] `RegistroAula.experimentais` (código para nome e telefone; só a equipe lê o registro); participante com origem `experimental` em `montarAula`: ocupa lugar, entra na chamada, não gera crédito, não entra na frequência nem no financeiro, conta nos alunos esperados do dia (`src/dominio/aulaExperimental.ts`)
- [x] "Registrar aula experimental" na folha da aula (com vaga, de pé, antes de terminar) e no Hoje (lista as aulas com vaga dos próximos 14 dias das unidades da pessoa; também no dia sem aula); nome e WhatsApp validados; a mesma pessoa não entra duas vezes na mesma aula; teto de 10 por aula
- [x] Na chamada: presente ou faltou (nunca "avisou"), "Tirar" com desfazer, WhatsApp a um toque, pílula "experimental"; o card da aula mostra "1 experimental"; o Hoje lista "Aulas experimentais de hoje"
- [x] "Cadastrar como aluno": o cadastro abre com nome, WhatsApp e unidade; ao salvar, o registro da aula aponta o aluno e a chamada passa a abrir a ficha
- [x] Vagas, app do aluno e página pública contam o lugar sem o nome; no Firestore cada pessoa vai numa linha `'Nome|telefone[|alunoId]'` conferida de uma vez pelas regras; o aluno, que mexe no mesmo documento por mescla, não toca nesse mapa (testes em `testes-de-regras/experimentais.test.ts`)
- [x] Demonstração versão 5: uma pessoa registrada na aula de sábado de manhã do Centro; aviso de privacidade diz o que fica guardado de quem vem experimentar
- [x] Testes: domínio, desfazer, conversão e mescla, projeções, regras; `e2e/experimental.spec.ts` nos dois motores e, com os emuladores, o professor registrando pelo Hoje e o registro indo para o banco em texto

### Textos do estúdio
- [x] Mais, Estúdio: frase de apresentação (160), até três focos (40 cada), endereço livre (200), link do mapa (só `https://`, 300) e Instagram (30, só o nome); os tetos em `TAMANHOS` são os mesmos das regras; "Validade do convite" (ver abaixo)
- [x] A página pública mostra a frase e os focos na capa, o endereço com o link do mapa (o configurado ou a busca pelo endereço) e o Instagram em "Onde fica" (com mais de uma unidade, cada unidade com endereço próprio ganha a linha dela; a que tem o mesmo endereço do estúdio não repete); sem frase escrita, a capa explica só o caminho
- [x] Marca d'água com a primeira palavra do nome do estúdio (na entrada e na página pública); o nome padrão só em `CONFIGURACAO_PADRAO`
- [x] Documento público com os textos (sanitizados ao gravar e ao ler); regras conferem cada texto; o professor segue só gravando os horários (`testes-de-regras/estudio.test.ts`, `e2e/estudio.spec.ts`)

### Convites
- [x] Todo convite (equipe e aluno) nasce com prazo: `expiraEm` no documento `convites/{e-mail}`, dentro de `validadeDoConviteDias` (7 por padrão, de 1 a 90, em Mais, Estúdio); as regras recusam o aceite depois do prazo e um convite sem prazo não vale (`testes-de-regras/convites.test.ts`)
- [x] Equipe: seção "Convites pendentes" com a data do registro e "vale até" ou "venceu em"; na ficha, "Mandar o convite pelo WhatsApp", "Compartilhar o convite" (ou "Copiar o convite", sem o compartilhar do sistema), "Mandar o convite de novo" (venceu), "Revogar o convite" (a pessoa fica sem acesso e o convite do e-mail some; "Convidar de novo" devolve); nos convites para a administração, só o titular. Registro de alterações anota `convite-revogado` e `convite-reenviado`
- [x] Aluno: a ficha diz até quando o convite vale, oferece compartilhar ou copiar e "Mandar o convite de novo" quando vence (o prazo recomeça)
- [x] A mensagem do convite (`src/dominio/convites.ts`) leva o link de entrada `?entrar` (abre direto na porta de entrar; nada pessoal na URL) e o e-mail no texto; no app, um convite vencido ou revogado explica o motivo em vez da recusa genérica
- [x] Testes: domínio (`convites.test.ts`, `equipe.test.ts`), regras, `e2e/equipe.spec.ts` (pendentes com data, copiar, revogar, mandar de novo, vencido) e o teste da administração com os emuladores confere o prazo gravado

### Celular
- [x] Tela de abertura do app instalado no iPhone: `apple-touch-startup-image` com uma imagem exata por tamanho de tela (11 iPhones, do SE ao Pro Max) e por tema, geradas por `npm run abertura` (`scripts/gerar-abertura.mjs`, lista em `scripts/abertura.ts`) e reduzidas a 64 cores por `scripts/comprimir-abertura.py` (de 1 MB para 350 kB); as `<link>` entram no `index.html` no build com o caminho base; a página mostra o mesmo logo no centro até o app montar (`.abertura` em `index.html`, tirado em `main.tsx` antes de renderizar: o Preact não tira o que já estava no contêiner). Fora do cache do service worker
- [x] Listas grandes em partes (`useEmPartes` em `src/componentes/emPartes.ts`): a lista de alunos, as listas do financeiro depois de "Mostrar todos" e as seções da ficha montam em partes depois de pintar; a rolagem guardada ao voltar da ficha insiste por alguns quadros até a página crescer
- [x] Marca das seções deslizando: as três seções da aba Alunos dividem a mesma chave de tela (`secaoDaAba` em `navegacao.ts`), o cabeçalho fica e só o conteúdo entra num quadro próprio (`secao-quadro`); a marca anda por transform de uma seção para a outra. `irParaSecao` nos testes espera a marca e o quadro
- [x] Medições com a CPU 4x mais lenta no Chromium (`LENTO=1 e2e/movimento.spec.ts`, que agora também mede abrir a lista de alunos), antes e depois: lista de alunos de 117 para 83 ms de quadro de montar (tarefa longa de 119 para 87 ms), ficha de 83 para 33 ms, voltar da ficha de 67 para 50 ms sem tarefa longa; p95 de 33 ms nos dois passos em que a parte seguinte monta durante a entrada (limite 50); velocidade normal toda em 16,7 ms, CLS zero. Números na seção Movimento do README

### Caminho base
- [x] `BASE_PATH` numa fonte só (`scripts/caminho-base.ts`): build, manifesto (id, start_url, scope), service worker, telas de abertura, Playwright e testes de ponta a ponta leem o mesmo valor; o workflow deriva do nome do repositório (`/` quando termina em `.github.io`); suíte inteira rodada com `/pilates-central-web/` e com `/`
- [x] README e docs com os dois endereços: o novo (`https://pilates-central.github.io/`) como principal, o antigo até a transferência

### Achado e corrigido no trabalho que veio pela metade
- [x] "Registrar aula experimental" no Hoje ficava dentro do bloco do dia com aulas: no sábado da professora (sem aula) o botão não existia e o teste com os emuladores esperava para sempre. Agora aparece também no dia sem aula
- [x] A página pública repetia o endereço: o do estúdio e o da unidade Centro, iguais; a unidade com o mesmo endereço do estúdio não ganha linha
- [x] O link "Abrir" do Instagram tinha 44 px de largura (alvo mínimo é 48): link curto no fim de uma linha de lista ganhou largura mínima
- [x] O espaço reservado da tela de abertura ficava no DOM por cima do app (o Preact reaproveita o contêiner sem tirar o que já havia): a agenda descia 594 px no iPhone SE. `main.tsx` esvazia o contêiner antes de renderizar, com teste
- [x] Com a lista em partes, voltar da ficha para o fim da lista rolava até onde a página alcançava no primeiro quadro (1775 px em vez de 3143): a rolagem agora insiste por até 12 quadros
- [x] O teste do caminho base passava `undefined` de propósito e caía no parâmetro padrão, que lê o ambiente: com `BASE_PATH=/` na suíte (como o workflow vai rodar depois da transferência) ele reprovava. O teste agora controla a variável de ambiente
- [x] O teste do professor registrando a experimental pelo Hoje usava o mesmo telefone nos dois motores, que registram na mesma aula do mesmo emulador: o segundo era recusado como pessoa repetida. Um telefone por motor
- [x] O teste da marca deslizando conferia posições do meio também no WebKit, onde um quadro pode levar mais que a transição inteira (a amostra via só 4 e 237, no CI e no contêiner): a conferência do meio do caminho ficou só no Chromium; no WebKit vale a nav que persiste e a posição final

### Ficou para depois
- [ ] Conferir num iPhone de verdade a tela de abertura (a mídia exata por aparelho e o `prefers-color-scheme` nela), o teclado nas folhas, Trusted Types e a View Transition
- [ ] A conta de login do aluno excluído continua no Firebase Authentication (apagar pelo console)
- [ ] Depois de o dono ligar e impor o App Check: conferir login e página pública no site publicado
- [ ] Cancelar o dia inteiro de uma vez (feriado móvel); limite de reposições por mês nas regras

## Pronto para usar: primeiro uso guiado, importação de alunos e ajuda (feita)

A proprietária do estúdio começa a usar com os alunos no caderno ou numa planilha; cadastrar um
a um, tela por tela, é o que faz desistir. Esta etapa fez o primeiro dia caber em poucos toques e
conferiu tudo como quem usa, com o estúdio de verdade nos emuladores, nos dois motores. As regras
do Firestore não mudaram: tudo grava pelo repositório de sempre, com as mesmas regras.

### Primeiro uso guiado (Montar o estúdio)
- [x] Guia em cinco passos, um por tela (`src/telas/montar/`): o estúdio (nome e WhatsApp), unidades, professores (nome e e-mail; o convite sai depois), turmas da semana e alunos; progresso em cima ("Passo 2 de 5" e a barra), "Pular este passo", "Voltar" e "Sair do guia"; no fim, o resumo (unidades, professores e convites para mandar, turmas, alunos), "Ir para a agenda" e "Mandar os convites"
- [x] Abre sozinho para a administração quando o estúdio de verdade está vazio (sem turma e sem aluno), no passo que falta (`src/app/guia.ts`, `passoInicial` em `src/dominio/montagem.ts`); quem sai do guia não o vê abrir de novo naquele aparelho. Fica em Mais, Montar o estúdio. Tela inteira, sem a barra de abas (`emFoco` em `navegacao.ts`)
- [x] Grade visual: tabela de dias (segunda a sábado; domingo quando o estúdio abre) por horários (das 6h às 21h, mais os horários quebrados que existem ou que a pessoa põe em "Outro horário"); tocar cria a turma com o professor, a duração e os lugares escolhidos em cima, tocar de novo tira; turma já gravada não sai por aqui; "Copiar um dia para outros" pula o que está ocupado ou dá choque de professor; as turmas novas ficam no rascunho até "Salvar a grade", gravadas numa vez (`criarTurmasEmLote`); sair com turmas por salvar pergunta antes
- [x] O que vale para turma, unidade e professor é o de sempre (`validarTurma`, `validarUnidade`, `convidar`): mesmo professor em duas turmas que se cruzam, professor fora da unidade, nome de unidade repetido, e-mail repetido
- [x] Na demonstração o guia é uma prévia: mostra e "cria" tudo num rascunho, sem gravar
- [x] Estados vazios que levam à ação: Hoje e Agenda sem turma ("Montar a grade"), Turmas sem turma ("Montar a grade", "Nova turma", "Importar"), Alunos sem aluno ("Importar de uma planilha", "Cadastrar um aluno"); para o professor, o que esperar
- [x] Testes: `montagem.test.ts` (passos, grade, choque, cópia, resumo), `e2e/primeiro-uso.spec.ts` (o guia inteiro na prévia, pular e sair, a folha do padrão, a grade no iPhone SE de 375 e 320 px) e a auditoria de alvos, texto e contraste de cada passo

### Importar alunos e turmas
- [x] `src/dominio/importacao.ts`: lê o texto (tabulação, ponto e vírgula ou vírgula, o mais frequente; aspas no começo da célula protegem separador e quebra de linha; a marca do Excel sai), reconhece as colunas pelo nome em português (nome, WhatsApp, e-mail, plano em vezes por semana, turmas por dia e hora, mensalidade, forma de pagamento, observação, unidade, desde) e, sem cabeçalho, pelo conteúdo; o que não reconhece fica para a pessoa dizer o que é
- [x] Cada linha passa pelas regras do cadastro (`validarAluno`, `validarPlano`, `colocarNaTurma`): WhatsApp sem DDD, turma que não existe na unidade, turma cheia (a planilha vai enchendo as turmas na ordem), repetido com quem já existe ou com uma linha de cima ("É outra pessoa" para família que divide o número)
- [x] Tela (`src/telas/alunos/Importacao.tsx`): colar ou escolher o .csv (UTF-8 ou Windows-1252), "Como escrever cada coluna", prévia com as linhas com erro primeiro, correção numa folha com os campos do cadastro (e a lista das turmas da unidade, dia a dia), tirar a linha, gravação em lotes de 60 (`importarAlunos`), resumo (quantos entraram, quantos já nas turmas, quantos sem mensalidade, quem ficou de fora e por quê) e "Desfazer a importação" (só quem ainda não tem presença, reposição nem pagamento)
- [x] Turmas pelo mesmo caminho (dia, horário, duração, lugares, professor, unidade), com correção na folha; modelo em branco para os dois (só o cabeçalho, com a marca que faz o Excel ler os acentos)
- [x] Na demonstração a importação grava no aparelho (dá para experimentar inteira); dentro do guia, na prévia, só confere
- [x] Testes: `importacao.test.ts` (separador, aspas, reconhecimento, conteúdo, vezes, forma, data, conferência, lotes, turmas) e `e2e/importacao.spec.ts` nos dois motores

### Ajuda e mensagens de gravação
- [x] Mais, Ajuda: cards curtos, sem jargão (instalar no iPhone, com o desenho do caminho, e no Android; montar o estúdio; chamada; reposição; pagamento; convidar; o que o professor vê; o que o aluno vê; sem internet; privacidade); o professor não vê o que é só da administração. O texto mora em `src/telas/mais/conteudoDaAjuda.ts` e o mesmo está em [guia-da-equipe.md](guia-da-equipe.md), para mandar no WhatsApp; `conteudoDaAjuda.test.ts` reprova se os dois se desencontram
- [x] Gravação no modo real (`src/dados/falhas.ts`, `estado.ts`): sem internet (ou o SDK sem conseguir falar com o banco) a mudança fica na tela e numa fila na memória, com a faixa "1 mudança esperando a internet para gravar" e "Tentar agora"; anda sozinha no evento `online` e a cada 20 s. Recusa do banco: relê os cadastros; se o acesso de quem gravou mudou (ou nem a leitura passa), "Sua conta não tem esse acesso"; com a conta em dia, "as regras do Firebase estão desatualizadas... Peça para a administração publicar as regras novas". Erro com frase pronta do adaptador aparece como veio. No app do aluno, sem fila: a frase diz que nada foi gravado
- [x] Testes: `falhas.test.ts`; `e2e/ajuda.spec.ts`; e os três casos de gravação no teste de começar a usar

### Verificado como quem usa (`e2e/comecando.spec.ts`, com os emuladores, nos dois motores)
- [x] A responsável cria a conta num estúdio vazio, confirma o e-mail, passa pelo guia (unidade, professora, quatro turmas com uma cópia de dia), importa 30 alunos de um TSV colado (10 entram nas turmas), abre a agenda e faz a chamada da aula de hoje; a falta marcada sem internet entra na fila e grava quando a conexão volta; com regras de uma versão anterior no emulador, a frase pede regras novas; convida uma administradora, que cria a conta e entra em outro contexto (outro aparelho) e vê o financeiro; com o acesso tirado, a gravação dela diz que a conta não tem esse acesso
- [x] Toques: criar a conta 6, primeiro uso 20 (sem a importação), importar 30 alunos 4, chamada 2, convidar a administradora 8 (mais 1 para mandar pelo WhatsApp), ela entrar 6 (tabela no README)

### Achado e corrigido no trabalho que veio pela metade
- [x] `lerVezes('280')` dava 2 (a expressão não ia até o fim do texto): uma coluna de mensalidade virava "vezes por semana". Agora o texto inteiro tem que ser o plano
- [x] O modelo de planilha vinha com duas linhas de exemplo: esquecidas na planilha, virariam dois alunos de mentira. Agora é só o cabeçalho, e o "como escrever" fica na tela
- [x] Uma aspa no meio do texto (Ana "Aninha" Souza) engolia o resto da planilha; aspas só valem no começo da célula
- [x] Sem cabeçalho, as colunas iam pela posição do modelo; uma planilha em outra ordem saía toda errada. Agora vão pelo conteúdo, e o resto a pessoa diz
- [x] Na demonstração a importação não gravava (não dava para experimentar nem testar o lote); grava no aparelho, e só o guia, na prévia, não grava
- [x] A fila de "sem internet" valia também na demonstração (que grava no aparelho): com o celular sem rede, a demonstração diria "Sem internet" e seguraria a mudança
- [x] A recusa do banco com a conta desligada dizia "regras desatualizadas": a releitura dos cadastros também é recusada nesse caso, e agora isso conta como conta sem acesso (provado no teste de começar a usar). A frase das regras citava um arquivo do repositório; agora diz o que fazer
- [x] O campo de arquivo ficava escondido com 1 px (a auditoria de 48 px reprovaria); agora cobre o botão inteiro, transparente
- [x] Na correção de uma linha, a lista das turmas da unidade sumia justo quando havia erro (o campo mostra o erro no lugar da ajuda) e era cortada em 12 turmas; agora fica sempre, um dia por linha

### Ficou para depois
- [ ] O app não fica escutando o banco: o que outra pessoa grava (um convite aceito, uma presença marcada no outro celular) aparece quando o app é aberto de novo. No teste, a responsável só via a administradora como "convite pendente" depois de recarregar. Vale um "puxar para atualizar" ou reler ao voltar para o app
- [ ] A fila de "sem internet" mora na memória: fechar o app com a faixa na tela perde o que esperava (a faixa e a Ajuda pedem para não fechar). Guardar a fila no aparelho pede cuidado com a ordem e com outra pessoa mexendo na mesma aula
- [ ] O professor sem e-mail não entra no guia: a regra do banco pede e-mail em todo cadastro da equipe (mudar pediria republicar as regras). Quem não tem o e-mail do professor ainda pode pular o passo e escolher o próprio nome na grade
- [ ] Conferir num iPhone de verdade: a folha de correção com o teclado, o arquivo .csv escolhido pelo app Arquivos e o colar do Numbers
- [ ] Antes das 4h30 (Campinas) o teste de começar a usar não tem aula possível hoje e pula a chamada (anota no relatório do teste)

## Revisão de produto e celular do primeiro dia (feita)

A proprietária começa a usar no iPhone. Esta revisão usou o app como ela no primeiro dia, com o
estúdio vazio nos emuladores (WebKit com iPhone 13 e Chromium com Pixel 7, com vídeo e capturas),
comparou o app com o pedido do estúdio item a item, mediu as telas novas no celular e rodou a
suíte inteira antes e depois, com o caminho base padrão e com `BASE_PATH=/`.

### O pedido do estúdio x o app
- [x] Gestão, não treino: nada de vídeo, cronômetro, evolução ou conquistas (conferido no código)
- [x] Alunos por unidade (no cadastro, na lista e na importação), agenda com os alunos dentro, presença por aula, turmas fixas de 2 ou 3 vezes por semana
- [x] Reposição: quem avisa sai do dia e entra em outra aula com vaga (pela chamada ou pela central)
- [x] Financeiro preenchido à mão: alunos ativos por unidade, formas de pagamento (Gympass e TotalPass incluídos), recebido, previsto e em aberto, os últimos meses
- [x] Uso pelo celular, pela administração e pelos professores, como página web instalável
- [x] Desejável 1: o aluno avisa e remarca sozinho (app do aluno, desligado até a administração ligar); sem ele, a equipe faz por ele
- [ ] Desejável 2, parcial por decisão: o visitante vê os horários com vaga e pede pelo WhatsApp; quem registra na agenda é a equipe. Marcar sozinho pediria gravação sem login no banco (cota e spam no plano gratuito, sem Cloud Functions)
- [x] Gympass e TotalPass: só o caminho aberto (formas de pagamento), sem integração, como pedido
- [x] Produto genérico: os textos da página pública vêm de Mais, Estúdio; no código fica só a marca do app
- [x] Vários administradores, titular "Responsável" que passa a conta, rótulos sem gênero; configuração no build, sem Analytics, duas portas; dados fictícios, sem fotos com pessoas, sem ficha de saúde

### Usado como a proprietária (emuladores, estúdio vazio)
- [x] Criar a conta e confirmar: 6 toques. Guia com o estúdio, uma unidade com endereço, dois professores e 15 turmas (duas cópias de dia): 34 toques sem a importação
- [x] Planilha de 30 linhas com 8 erros de propósito colada no guia. Na versão de antes, 4 dos 8 eram jeitos comuns de escrever que o app não lia (corrigido, abaixo); os outros 4 (WhatsApp sem DDD, aluna repetida, turma que não existe, turma cheia) apareceram com a frase certa. 7 toques depois de colar, corrigindo uma linha e tirando outra; 23 alunos entraram, 14 nas turmas
- [x] Chamada da turma inteira: 2 toques. Achar aluno: 3. Pagamento pela linha em aberto: 3. Reposição pela central: 5. Registrar a aula experimental pelo Hoje: 5. Os mesmos números ficam conferidos em `e2e/toques.spec.ts` (iPhone SE)
- [x] Aula experimental de ponta a ponta: registrada pelo Hoje na primeira aula com vaga, aparece na chamada, recebe presente e vira aluno com o cadastro já preenchido
- [x] Console do navegador sem erro e nenhum pedido ao Firebase de verdade nos dois motores

### Achado e corrigido
- [x] A importação não lia "seg às 18h", "Seg 8h / Qua 8h", começo e fim da aula ("ter 18:00-18:50", "seg 7h às 7h50"), "2x semana" nem o WhatsApp com o zero antes do DDD ("019 90000-0015"); agora lê, com teste. "seg a sex 7h" continua pedindo para escrever os dias (é intervalo, e ler errado seria pior)
- [x] Coluna "Plano" com o nome do plano ("Mensal", "Trimestral", "Mensal 2x"): cada linha virava erro e a planilha inteira ficava de fora. Agora "Mensal 2x" dá 2x, e o plano que não diz as vezes vira aviso ("ficou 2x por semana", ou o número de turmas), que some quando a pessoa confere na correção
- [x] Planilha com os dias numa coluna e a hora em outra ("Dias: seg e qua", "Horário: 7h"): a segunda coluna era ignorada e todas as linhas davam erro de horário; agora as duas viram uma coluna de turmas (`juntarDiasEHorario`)
- [x] Depois de importar, corrigir o que ficou de fora obrigava a colar tudo de novo e achar as linhas no meio de 30 "já está cadastrado"; agora "Corrigir as linhas que ficaram de fora" volta à prévia só com elas
- [x] A prévia aparecia rolada até onde estava o botão, no meio da lista, sem o título com as linhas com erro (visto nos vídeos do WebKit, iPhone 13 e SE); cada etapa da importação começa do topo
- [x] "Conferir" ficava embaixo de três botões: com o teclado do iPhone aberto depois de colar, não estava à vista; foi para logo abaixo do campo
- [x] Sem internet, uma planilha inteira (ou a grade do guia) ia para a fila que só vive com o app aberto; agora a tela pede conexão e nada sai dela (provado com os emuladores nos dois motores)
- [x] A página de aula experimental e o app do aluno começam desligados, e no estúdio de verdade a página pública abria sem nenhum horário, sem nada no guia dizendo por quê; o fim do guia diz e aponta Mais, Estúdio
- [x] Ajuda e Mais, Instalar: o Safari do iOS atual pode esconder o Compartilhar no botão de três pontinhos e pergunta "Abrir como App Web"; e o app da tela inicial não usa a sessão do Safari, então quem entrou pelo Safari entra de novo pelo ícone. Os três passos dizem isso (e o guia da equipe também)
- [x] Na prévia, na tela de 320 px, o círculo de estado tirava a largura do texto (a frase do erro quebrava em quatro linhas); ali ele sai, a pílula já diz "pronto" ou "corrigir"
- [x] README dizia o tipo de servidor dos testes; ficou só "máquina de 4 núcleos"

### Celular
- [x] Teste novo de fluidez das telas do primeiro dia (`e2e/movimento.spec.ts`): abrir o guia, passar de passo, abrir a grade, tocar num horário, a folha do padrão, conferir 40 linhas, a folha de correção e a Ajuda. Chromium (Pixel 7): p95 de 16,7 a 16,8 ms na velocidade normal e com a CPU 4x, CLS zero; quadro de montar de 83 ms na grade e 133 ms na prévia de 40 linhas com a CPU 4x, sem tarefa longa na velocidade normal. Números na tabela do README
- [x] Vídeos quadro a quadro: Chromium com a CPU 4x, WebKit com iPhone 13 e com iPhone SE (320 x 568); a folha sobe e desce inteira, o guia troca de passo sem salto, a grade rola dentro da caixa no SE e a página nunca rola de lado
- [x] Foco pelo teclado nas telas novas, nos dois motores (`foco.mjs`, fora do repositório): todos os controles com anel visível e dentro da tela; na folha de correção o foco fica preso nela
- [x] Os specs das telas novas (guia, importação, Ajuda, fluidez) também passam no WebKit com o perfil do iPhone SE

### Ficou para depois
- [ ] A fila de "sem internet" continua só na memória. Guardar no aparelho pede guardar também o estado de antes de cada gravação (a mescla do registro da aula compara com ele); a importação e a grade agora não entram nela
- [ ] O app não fica escutando o banco: o que outra pessoa grava aparece ao abrir de novo (herdado)
- [ ] A planilha de verdade da proprietária pode ter um formato que ninguém previu; na prévia, as colunas podem ser trocadas à mão, mas uma coluna que mistura coisas (plano e valor juntos, por exemplo) precisa ser separada na planilha
- [ ] Conferir num iPhone de verdade: Compartilhar e "Abrir como App Web" na versão do iOS dela, colar do Numbers e do Excel no campo grande com o teclado aberto, a tela de abertura e o login pelo ícone depois de instalar

## Notas para quem continuar

- **Seções da aba Alunos:** as três seções dividem a chave de tela (`chaveDaTelaDe` em `src/app/navegacao.ts`, `SECOES_DA_ABA`); `Alunos.tsx` renderiza o cabeçalho (`CabecaDeAlunos`) e o conteúdo num `QuadroDeTela` com a classe `secao-quadro`. Conteúdo de seção é um `div.tela` sem cabeçalho. Nos testes, `irParaSecao` espera a marca (`esperarSemAnimacao('.secoes-marca')`, cujo repouso não é transform zero) e o quadro.
- **Listas em partes:** `useEmPartes(total, primeira, passo)` devolve quantos itens mostrar agora e vai crescendo a cada dois quadros depois de pintar; serve também para seções de uma tela (`useEmPartes(3, 1, 1)` na ficha). Tudo o que entra depois fica abaixo do que já estava (nada se move: CLS zero). A rolagem guardada (`rolarPara` em `navegacao.ts`) insiste por até 12 quadros.
- **Tela de abertura do iPhone:** tamanhos em `scripts/abertura.ts` (um por `device-width`/`device-height`/densidade; aparelhos com a mesma tela lógica dividem a imagem); `npm run abertura` no contêiner do Playwright e depois `python3 scripts/comprimir-abertura.py`. O `index.html` mostra `.abertura` (logo por máscara, cor do tema) até `main.tsx` esvaziar o contêiner. As imagens ficam fora do precache (`PUBLICOS` em `plugin-offline.ts`).
- **Convites:** o prazo mora em `convites/{e-mail}.expiraEm` (ms), calculado em `repositorioDaEquipe.ts` a partir de `convite.enviadoEm` (equipe) ou `acesso.convidadoEm` (aluno) mais `validadeDoConviteDias`; mandar de novo é gravar uma data nova (o adaptador reescreve o documento), revogar é `ativo: false` com o convite guardado (o adaptador apaga o documento). As regras conferem o prazo em `conviteValido` (ao criar, com um dia de folga) e em `conviteNoPrazo` (no aceite, equipe e aluno). O link do convite é `?entrar` (`src/app/modo.ts`), sem o e-mail.
- **Aula experimental:** `registrarExperimental`, `tirarExperimental` e `vincularAluno` em `src/dominio/aulaExperimental.ts`; o participante leva `experimental` (nome e telefone) e `alunoId` é o código do registro; `nomeDoParticipante` em `estado.ts` resolve o nome. No Firestore o mapa vai em texto (`codificarExperimental`/`decodificarExperimental` em `conversao.ts`) e a mescla do registro aplica só a pessoa desta ação. O cadastro nascido de uma experimental passa por `cadastroDeExperimental` (`estadoDaLista.ts`) e `salvarAluno(..., origem)`.
- **Textos do estúdio:** `TextosDoEstudio` em `tipos.ts`, tetos em `TAMANHOS`, limpeza em `limparTextosDoEstudio`; a página pública lê por `paginaPublicaDe` (só `https://` vira link) e mostra `FRASE_PADRAO` quando a frase está vazia. A marca d'água usa `palavraDaMarca(nomeEstudio)`.

- **Coisas de celular em `e2e/celular.spec.ts`:** teclado (a `visualViewport` é trocada por uma falsa que encolhe como a do iPhone; espere `.folha[data-teclado]` antes de medir), fontes uma vez só, JS inicial e Firebase fora, campos de 16 px, servidor desligado (o teste sobe um servidor só dele em `dist/`, então rode depois do build), agenda no iPhone SE, folha descendo com o mesmo conteúdo, aviso trocando de lugar e a lista do dia saindo para a frente.
- **Folhas:** o conteúdo mostrado enquanto a folha desce é o da última vez que ela estava aberta. Se precisar mudar algo na folha durante a saída, mude antes de fechar.
- **Soltar o dedo:** use `curvaQueContinua(velocidade, distancia, duracao)` em qualquer animação que começa no fim de um gesto; as curvas comuns começam paradas e dão tranco.
- **Contraste:** além dos pares de tokens (`contraste.test.ts`), `e2e/acessibilidade.spec.ts` mede cada texto visível contra o fundo composto nos dois temas. Opacidade em texto pequeno quase sempre reprova.

- **Rodar os testes de ponta a ponta onde o WebKit do Playwright não instala:** com o `npm run preview` no ar (porta 8887), rodar o contêiner do Playwright 1.60:
  `podman run --rm --network host -v "$PWD":/w:Z -w /w --ipc=host mcr.microsoft.com/playwright:v1.60.0-noble npx playwright test`.
  `LENTO=1` liga a CPU 4x mais lenta no Chromium; `GRAVAR=1` grava vídeo da fluidez (quadros com `ffmpeg -i video.webm -vf fps=10 quadro-%03d.png`).
- **WebKit do contêiner não tem GPU:** os tempos de quadro dele variam muito e servem de registro, não de régua (ver o comentário em `e2e/movimento.spec.ts`). Mesmo assim ele achou três problemas reais: sombra com desfoque cara demais, texto do dia sumindo no deslize e o aviso cobrindo a alça da folha.
- **Arrastar nos testes:** usar `arrastar()` de `e2e/apoio.ts`, que move um passo a cada 16 ms; o movimento instantâneo do Playwright vira "arremesso" e fecha a folha.
- **Nada de cor animada:** o teste de fluidez reprova qualquer animação ou transição que não seja de transform ou opacity.
- **Sombras:** cards usam a sombra sem desfoque (`--sombra-1`); desfoque grande só em elemento único (folha, aviso).
- **Conteúdo do repositório:** sem travessão, sem ponto médio, sem nomes reais, sem trechos de conversa com a cliente, sem fotos com pessoas. E-mails só `@example.com`, telefones `55119000000xx` (exemplos na tela usam `(19) 90000-0000`).
- **Papéis:** no código `titular`, `administrador` e `professor` (mais o aluno, fora da equipe); na tela "Responsável", "Administração" e "Professor". Toda regra de equipe recebe quem está agindo (`src/dominio/equipe.ts`); `firestore.rules` repete as mesmas recusas e `testes-de-regras/` testa cada uma no emulador.
- **Financeiro separado:** `FinanceiroDoAluno` (coleção `financeiroDosAlunos`) só é pedido por quem pode ver financeiro (`carregarFinanceiro` em `src/dados/estado.ts`); o teste com o emulador confere que o app do professor nem pede.
- **Teto de 1000 expressões nas regras do aluno:** `testes-de-regras/folga.test.ts` carrega as regras com comparações a mais enfiadas em cada função do caminho do aluno (aviso, desfazer, encaixe, desistência, vaga, crédito) e prova que o pedido legítimo ainda passa com 40 de sobra (medido: 51 a 110); `MEDIR_FOLGA=/tmp/folga.txt npx vitest run --config vitest.regras.config.ts testes-de-regras/folga.test.ts` (com o emulador no ar) escreve a folga exata de cada caminho. Conferência nova do aluno vai de preferência na regra da vaga (`alunoMexeNaVaga`, a mais folgada). Recusa por teto também aparece em casos negados de propósito; isso não muda o resultado, mas não prova a lógica.
- **Regras do Firestore:** calcule quem pede uma vez (`quemSou`) e passe adiante; funções que relêem o papel estouram o teto de 1000 expressões por pedido. Leia documento com `dados(caminho, padrao)` (um `get` que trata o documento ausente), não `exists` mais `get`: há teto de 10 leituras por operação e 20 por lote. Lista gravada pela equipe é conferida item a item com `join` mais uma expressão regular (`ids`, `datas`, `horariosPublicos`): uma expressão para a lista inteira, em vez de dezenas por item. Rode `npm run regras` (sobe o emulador sozinho) ou, com o emulador já no ar, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8824 npx vitest run --config vitest.regras.config.ts`. Mudou as regras? O dono republica no console (o site não publica regras).
- **Dois conjuntos de emuladores na mesma máquina:** copie `firebase.json` com outras portas e aponte `FIREBASE_JSON=outro.json` no build, nos testes de regras e nos de ponta a ponta, mais `--config outro.json` no firebase-tools (o nome `FIREBASE_CONFIG` não serve: o próprio `emulators:exec` o define com um JSON).
- **Erros do login:** toda falha do SDK passa por `erroDeConta(erro, operacao)` (`src/dados/firebase/erros.ts`); a frase nunca leva o código, que fica em `detalhe` e aparece atrás de "Detalhes" (`ErroDaConta`). Código novo do Firebase: acrescente em `fraseDoCodigo`, com teste em `erros.test.ts`. O caso "Authentication não iniciado" é testado sem emulador, com a resposta simulada em `e2e/login.spec.ts`.
- **App Check:** liga só com `VITE_FIREBASE_APPCHECK_SITE_KEY` no build e nunca com os emuladores (`ligarSdk` e `experimental/dados.ts`). Com a chave, a política de segurança e a política de Trusted Types liberam os endereços do reCAPTCHA (`regrasDaPolitica` em `scripts/plugin-offline.ts`, `enderecosDeScriptPermitidos` em `src/app/confianca.ts`); qualquer outro script por endereço precisa entrar nos dois lugares.
- **Versão nova do service worker:** a versão instalada fica esperando (`install` só chama `skipWaiting` quando não há outra ativa); `src/app/atualizacao.ts` avisa e, no "Atualizar", manda `{ tipo: 'ativar' }`; a página recarrega no `controllerchange`. Teste em `e2e/pwa.spec.ts`.
- **Registro de alterações:** `anotar()` em `src/dados/gestao.ts` junta a linha à gravação (e ao desfazer). Ação nova: `AcaoAuditada` em `tipos.ts`, a frase em `descreverAuditoria`, a lista em `auditoriaValida` nas regras. Só códigos: nunca nome, telefone nem e-mail.
- **Ponta a ponta com o Firebase:** com os emuladores no ar (`firebase emulators:start --only auth,firestore --project demo-pilates`) e a prévia rodando, `EMULADOR=1` faz o Playwright limpar os emuladores, criar as contas e gravar a demonstração de hoje (`e2e/firebase/preparar.ts`) e rodar `e2e/firebase.spec.ts`. Cada motor usa um aluno diferente (os dois podem rodar juntos no mesmo emulador) e um projeto vazio próprio para o primeiro acesso (`?emulador=demo-pilates-vazio-<motor>`). O emulador de login guarda todas as contas no projeto padrão (o SDK não manda o projeto no login); o Firestore separa os dados por projeto, por isso `singleProjectMode` fica desligado em `firebase.json`. No Chromium, `bypassCSP` deixa o app falar com o emulador; no WebKit a `<meta>` da política sai do HTML servido no teste (servir a página pelo teste no Chromium faz o navegador bloquear o endereço local).
- **Trava do Firebase real:** importe `test` e `expect` de `e2e/base.ts`, nunca de `@playwright/test`: a trava corta e reprova qualquer pedido para domínios do Google.
- **Projeto configurado no build:** com as variáveis `FIREBASE_*`, a tela inicial vira as duas portas. Os testes da demonstração abrem com `?demo` (ver `abrirApp`) para valer com ou sem projeto.
- **Desfazer:** ações de cadastro passam por `gravarComDesfazer` com um inverso calculado na hora de desfazer (por exemplo, tirar da turma só o aluno colocado). No Firebase, alunos fixos com `arrayUnion`/`arrayRemove` para duas pessoas não apagarem a mudança uma da outra.
- **Dados da demonstração:** versão 3 (`VERSAO_DO_BANCO`): app do aluno e página pública ligados, seis alunos com acesso (Beatriz Barbosa, a-11, é a dos testes) e o endereço do Centro igual ao do estúdio. Quem tinha versão anterior no aparelho ganha dados novos ao abrir. As três semanas recentes são as mesmas da etapa 1 (os testes conhecem: sexta 9/10, 18h com Camila tem 5 de 6; Ana Almeida tem 4 ausências seguidas; outubro tem R$ 10.660,00 previstos e R$ 5.590,00 recebidos).
- **Telas em teste:** para esperar uma tela nova parar, `esperarParado(page, '.tela-quadro')`; `irPara(page, '#/rota')` abre pelo endereço; `irParaSecao` troca Alunos, Turmas e Reposições.

- **Guia de primeiro uso:** passos em `PASSOS` (`src/dominio/montagem.ts`), uma rota por passo (`#/mais/montar/<passo>`, trocados com `trocarTela`, sem empilhar: o "voltar" do celular sai do guia). O rascunho (`src/telas/montar/estadoDaMontagem.ts`) é um sinal do módulo, vivo enquanto o app está aberto: no modo real cada passo grava na hora, menos a grade, que espera "Salvar a grade"; na demonstração tudo fica no rascunho (`previa`). `abrirGuiaSePreciso` (`src/app/guia.ts`) roda ao entrar na conta; "visto" fica no `localStorage` do aparelho.
- **Importação:** a lógica é pura (`src/dominio/importacao.ts`) e a tela só mostra. Coluna nova: `CampoDeAluno`, `NOME_DO_CAMPO`, `SINONIMOS` (sem acento, minúsculas) e, se der para reconhecer pelo conteúdo, um teste em `inferirColunasDeAlunos`. A gravação vai em lotes de `ALUNOS_POR_LOTE` (uma transação do Firestore aguenta 500 escritas; um lote de 60 com o financeiro, as turmas e as vagas fica longe disso).
- **Fila sem internet:** `salvarOuEnfileirar` em `estado.ts`; a demonstração nunca entra na fila. Para testar, `context.setOffline(true)` antes de marcar e `false` depois (o evento `online` anda a fila; o intervalo de 20 s cobre o motor que não o dispara).
- **Regras velhas no teste:** `trocarRegras(projeto, texto)` (`e2e/firebase/contas.ts`) troca as regras só de um projeto do emulador; devolva as do arquivo num `finally`.
- **Ajuda:** mudou um card em `conteudoDaAjuda.ts`? Mude o mesmo texto em `docs/guia-da-equipe.md` (o teste compara).
- **Importação, jeitos de escrever:** turmas passam por `lerTurmas` (começo e fim da aula viram só o começo; o que vem depois de uma hora separa horários; "às" sai), o plano por `lerVezes`, o telefone por `normalizarTelefone` (o zero antes do DDD só no celular de 12 dígitos). Duas colunas de turmas no cabeçalho (só dias e só horas) viram uma em `juntarDiasEHorario`, antes do mapeamento. Jeito novo: teste em `importacao.test.ts` primeiro.
- **Perfil do iPhone SE nos testes:** uma configuração do Playwright em `.mjs` (o carregador não tira tipos de arquivo em `node_modules`) com um projeto chamado `webkit` e `devices['iPhone SE']`, apontando `testDir` para `e2e`, roda os specs do celular nos 320 x 568 sem mexer em `playwright.config.ts`.
- **Contêineres ao mesmo tempo:** monte as pastas com `:z` (rótulo compartilhado), não `:Z`: um contêiner novo com `:Z` rerrotula a pasta e o outro, já rodando, perde o acesso. E espere "All emulators ready" no log do `firebase emulators:start`: o de login começa a ouvir depois do Firestore.
- **Logs dos emuladores:** `firebase-debug.log` registra o ambiente inteiro do shell que rodou o comando; está no `.gitignore` e não pode ser versionado nem colado em lugar nenhum.
