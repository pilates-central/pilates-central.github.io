// O texto da ajuda dentro do app (Mais, Ajuda). O mesmo texto está em docs/guia-da-equipe.md, para
// mandar no WhatsApp: o teste conteudoDaAjuda.test.ts confere que os dois não se desencontram.

export interface CartaoDeAjuda {
  id: string
  titulo: string
  /** frases curtas, uma ideia por parágrafo */
  paragrafos: readonly string[]
  /** passo a passo, quando ajuda */
  passos?: readonly string[]
  /** o que vem depois do passo a passo */
  depois?: readonly string[]
  /** a administração vê todos; o professor não vê o que é só da administração */
  soAdministracao?: boolean
}

export const CARTOES_DE_AJUDA: readonly CartaoDeAjuda[] = [
  {
    id: 'instalar',
    titulo: 'Pôr o app na tela inicial',
    paragrafos: ['O app abre pelo navegador e fica na tela inicial como os outros, sem loja.'],
    passos: [
      'No iPhone, abra o link do app no Safari.',
      'Toque em Compartilhar (o quadrado com a seta para cima). Se ele não estiver à vista, fica no botão de três pontinhos, ao lado do endereço.',
      'Role e toque em Adicionar à Tela de Início. Se aparecer Abrir como App Web, deixe ligado. Toque em Adicionar.',
    ],
    depois: [
      'Depois, abra o app pelo ícone e entre com o seu e-mail e a sua senha: o app da tela inicial não usa o que ficou no Safari.',
      'No Android, no Chrome: toque no menu (os três pontinhos) e em Instalar app, ou em Adicionar à tela inicial.',
    ],
  },
  {
    id: 'montar',
    titulo: 'Montar o estúdio',
    paragrafos: [
      'Em Mais, Montar o estúdio: nome e WhatsApp, unidades, professores, a grade da semana (tocar no horário cria a turma) e os alunos de uma planilha.',
      'Cada passo tem Pular. Dá para voltar ao guia quando quiser.',
    ],
    soAdministracao: true,
  },
  {
    id: 'chamada',
    titulo: 'Fazer a chamada',
    paragrafos: [
      'No Hoje ou na Agenda, toque na aula. A chamada abre meia hora antes de a aula começar.',
      'Todos presentes marca a turma inteira de uma vez. Quem não veio: toque em Faltou na linha da pessoa.',
      'Errou? Toque em Desfazer, no aviso que aparece embaixo.',
    ],
  },
  {
    id: 'reposicao',
    titulo: 'Reposição',
    paragrafos: [
      'Quem avisa que não vem dentro do prazo do estúdio ganha uma reposição. Na chamada, toque em Avisou.',
      'Logo depois aparece Encaixar em outro horário, só com aulas que têm vaga, na mesma unidade. Também dá em Alunos, Reposições, Encaixar.',
      'A reposição vale pelos dias combinados em Mais, Regras de reposição. A que vence primeiro fica no topo.',
    ],
  },
  {
    id: 'pagamento',
    titulo: 'Lançar um pagamento',
    paragrafos: [
      'Em Financeiro, quem ainda não pagou o mês aparece em Em aberto, com o valor do plano.',
      'Toque em Lançar na linha da pessoa, confira o valor e a forma, e toque em Lançar de novo. Na mesma linha, Lembrar abre o WhatsApp com a mensagem pronta.',
    ],
    soAdministracao: true,
  },
  {
    id: 'convidar',
    titulo: 'Convidar alguém para o app',
    paragrafos: [
      'Equipe: em Mais, Equipe, Convidar pessoa. Escreva nome e e-mail e escolha Professor ou Administração. Depois, na ficha da pessoa, toque em Mandar o convite pelo WhatsApp.',
      'A pessoa abre o link, toca em Entrar e em Primeiro acesso? Criar conta, com aquele mesmo e-mail, e confirma o e-mail. O convite vale 7 dias (o prazo muda em Mais, Estúdio); venceu, mande de novo.',
      'Aluno: na ficha dele, Liberar o app (com o app do aluno ligado em Mais, Estúdio).',
    ],
    soAdministracao: true,
  },
  {
    id: 'professor',
    titulo: 'O que o professor vê',
    paragrafos: [
      'A agenda e a chamada das unidades em que dá aula, os alunos (sem valores) e as reposições.',
      'Não vê o financeiro e não muda turmas, equipe nem as regras do estúdio.',
    ],
  },
  {
    id: 'aluno',
    titulo: 'O que o aluno vê',
    paragrafos: [
      'Só quando a administração liga o app do aluno e libera a pessoa: as próximas aulas dele, Não vou poder ir dentro do prazo, e a escolha de onde repor, só onde tem vaga.',
      'O aluno não vê o nome de outros alunos nem nada do financeiro.',
    ],
  },
  {
    id: 'sem-internet',
    titulo: 'Sem internet',
    paragrafos: [
      'O que você marca fica na tela e espera numa fila. Uma faixa no alto diz quantas mudanças esperam a internet.',
      'Quando a conexão volta, tudo é gravado sozinho. Enquanto a faixa estiver lá, não feche o app.',
    ],
  },
  {
    id: 'privacidade',
    titulo: 'Privacidade',
    paragrafos: [
      'Os dados dos alunos ficam no banco do estúdio, protegidos por senha e pelo papel de cada pessoa.',
      'Observação do aluno: só o que a equipe precisa saber. A pedido do aluno, a ficha dele tem Baixar os dados do aluno e Excluir o cadastro.',
      'O aviso de privacidade completo fica em Mais, Aviso de privacidade.',
    ],
  },
]
