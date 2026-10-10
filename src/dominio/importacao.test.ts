import { describe, expect, it } from 'vitest'
import { turma } from './apoio-de-teste'
import {
  conferirImportacao,
  conferirTurmas,
  detectarSeparador,
  juntarDiasEHorario,
  lerAlunos,
  lerData,
  lerDiaDaSemana,
  lerForma,
  lerHora,
  lerTabela,
  lerTurmas,
  lerTurmasDaPlanilha,
  lerVezes,
  lerVezesNoMeio,
  lotesDaImportacao,
  mapearColunasDeAlunos,
  mapearColunasDeTurmas,
  modeloDeAlunos,
  modeloDeTurmas,
  reconhecerCampo,
  CAMPOS_DE_ALUNO,
} from './importacao'
import type { ContextoDaImportacao, ContextoDeTurmas } from './importacao'
import type { Aluno, MembroEquipe, Unidade } from './tipos'

const unidades: Unidade[] = [
  { id: 'u-centro', nome: 'Centro', endereco: '', ativa: true },
  { id: 'u-jardim', nome: 'Jardim', endereco: '', ativa: true },
]

const equipe: MembroEquipe[] = [
  { id: 'e-helena', nome: 'Helena Prado', papel: 'titular', email: 'helena@example.com', telefone: '', unidades: [], ativo: true },
  { id: 'e-camila', nome: 'Camila Nunes', papel: 'professor', email: 'camila@example.com', telefone: '', unidades: ['u-centro'], ativo: true },
  { id: 'e-rafael', nome: 'Rafael Moreira', papel: 'professor', email: 'rafael@example.com', telefone: '', unidades: ['u-centro', 'u-jardim'], ativo: true },
]

function aluno(id: string, parcial: Partial<Aluno> = {}): Aluno {
  return { id, nome: `Aluno ${id}`, unidadeId: 'u-centro', telefone: `55119000000${id.slice(-2)}`, email: '', vezesPorSemana: 2, situacao: 'ativo', observacao: '', desde: '2026-01-10', ...parcial }
}

const turmas = [
  turma({ id: 't-seg-07', diaDaSemana: 1, inicio: '07:00', capacidade: 2, alunosFixos: ['a1'], professorId: 'e-camila' }),
  turma({ id: 't-qua-07', diaDaSemana: 3, inicio: '07:00', capacidade: 5, alunosFixos: [], professorId: 'e-camila' }),
  turma({ id: 't-ter-18', diaDaSemana: 2, inicio: '18:30', capacidade: 5, alunosFixos: [], professorId: 'e-camila' }),
  turma({ id: 't-jardim-seg-07', unidadeId: 'u-jardim', diaDaSemana: 1, inicio: '07:00', capacidade: 5, alunosFixos: [], professorId: 'e-rafael' }),
]

const ctx: ContextoDaImportacao = {
  unidades,
  turmas,
  alunos: [aluno('a1', { nome: 'Ana Almeida', telefone: '5511900000001' })],
  hoje: '2026-10-09',
  unidadePadrao: 'u-centro',
}

let contador = 0
const idNovo = (p: string) => `${p}-${++contador}`

describe('ler o texto colado', () => {
  it('detecta tabulação, ponto e vírgula ou vírgula', () => {
    expect(detectarSeparador('Nome\tWhatsApp\nAna\t119')).toBe('\t')
    expect(detectarSeparador('Nome;WhatsApp\nAna;119')).toBe(';')
    expect(detectarSeparador('Nome,WhatsApp\nAna,119')).toBe(',')
    // o separador vence o que aparece dentro do texto
    expect(detectarSeparador('Nome;Turmas\nAna;seg 7h, qua 7h\nBia;ter 18h, qui 18h')).toBe(';')
  })

  it('lê aspas, separador dentro de aspas, quebras de linha e a marca do Excel', () => {
    const texto = '\uFEFFNome;Turmas;Obs\r\n"Souza, Ana";"seg 7h; qua 7h";"disse ""oi""\nem duas linhas"\r\n\r\n'
    expect(lerTabela(texto)).toEqual([
      ['Nome', 'Turmas', 'Obs'],
      ['Souza, Ana', 'seg 7h; qua 7h', 'disse "oi"\nem duas linhas'],
    ])
  })

  it('aspa no meio do texto fica como está', () => {
    expect(lerTabela('Ana "Aninha" Souza\t(11) 90000-0002\nBia\t(11) 90000-0003')).toEqual([
      ['Ana "Aninha" Souza', '(11) 90000-0002'],
      ['Bia', '(11) 90000-0003'],
    ])
  })

  it('reconhece colunas pelo nome em português, com ou sem acento', () => {
    expect(reconhecerCampo('Nome completo', CAMPOS_DE_ALUNO)).toBe('nome')
    expect(reconhecerCampo('WHATSAPP (com DDD)', CAMPOS_DE_ALUNO)).toBe('telefone')
    expect(reconhecerCampo('Celular', CAMPOS_DE_ALUNO)).toBe('telefone')
    expect(reconhecerCampo('E-mail', CAMPOS_DE_ALUNO)).toBe('email')
    expect(reconhecerCampo('Vezes por semana', CAMPOS_DE_ALUNO)).toBe('vezesPorSemana')
    expect(reconhecerCampo('Plano', CAMPOS_DE_ALUNO)).toBe('vezesPorSemana')
    expect(reconhecerCampo('Horários', CAMPOS_DE_ALUNO)).toBe('turmas')
    expect(reconhecerCampo('Mensalidade', CAMPOS_DE_ALUNO)).toBe('valorMensal')
    expect(reconhecerCampo('Valor (R$)', CAMPOS_DE_ALUNO)).toBe('valorMensal')
    expect(reconhecerCampo('Forma de pagamento', CAMPOS_DE_ALUNO)).toBe('formaPreferida')
    expect(reconhecerCampo('Observação', CAMPOS_DE_ALUNO)).toBe('observacao')
    expect(reconhecerCampo('Unidade', CAMPOS_DE_ALUNO)).toBe('unidade')
    expect(reconhecerCampo('Aluno desde', CAMPOS_DE_ALUNO)).toBe('desde')
    expect(reconhecerCampo('Coluna estranha', CAMPOS_DE_ALUNO)).toBeNull()
  })

  it('com cabeçalho, mapeia pelo nome e aponta o que não reconheceu; sem cabeçalho, pela posição do modelo', () => {
    const com = mapearColunasDeAlunos([
      ['Nome', 'Zap', 'Plano', 'Coluna X'],
      ['Ana Souza', '(11) 90000-0002', '2x', 'abc'],
    ])
    expect(com.comCabecalho).toBe(true)
    expect(com.colunas).toEqual(['nome', 'telefone', 'vezesPorSemana', 'ignorar'])
    expect(com.naoReconhecidas).toEqual([3])
    const sem = mapearColunasDeAlunos([['Ana Souza', '(11) 90000-0002', '', '2']])
    expect(sem.comCabecalho).toBe(false)
    expect(sem.colunas).toEqual(['nome', 'telefone', 'ignorar', 'vezesPorSemana'])
    expect(sem.naoReconhecidas).toEqual([])
    // a mesma coluna duas vezes: vale a primeira
    expect(mapearColunasDeAlunos([['Nome', 'Nome'], ['Ana', 'Bia']]).colunas).toEqual(['nome', 'ignorar'])
  })

  it('os dias numa coluna e a hora em outra viram uma coluna só de turmas', () => {
    const juntas = juntarDiasEHorario([
      ['Nome', 'Celular', 'Dias', 'Horário', 'Valor'],
      ['Ana Souza', '(11) 90000-0002', 'seg e qua', '7h', '280'],
      ['Bia Lima', '(11) 90000-0003', 'Terça, Quinta', '18:30', '280'],
      ['Caio Reis', '(11) 90000-0004', '', '', '280'],
    ])
    expect(juntas).toEqual([
      ['Nome', 'Celular', 'Dias', 'Valor'],
      ['Ana Souza', '(11) 90000-0002', 'seg/qua 7h', '280'],
      ['Bia Lima', '(11) 90000-0003', 'Terça/Quinta 18:30', '280'],
      ['Caio Reis', '(11) 90000-0004', '', '280'],
    ])
    const mapa = mapearColunasDeAlunos(juntas)
    expect(mapa.colunas).toEqual(['nome', 'telefone', 'turmas', 'valorMensal'])
    expect(mapa.naoReconhecidas).toEqual([])
    expect(lerTurmas('Terça/Quinta 18:30').map((h) => h?.dia)).toEqual([2, 4])
    // uma coluna só de turmas, ou sem cabeçalho: nada muda
    const umaSo = [['Nome', 'Horários'], ['Ana Souza', 'seg 7h']]
    expect(juntarDiasEHorario(umaSo)).toEqual(umaSo)
    const semCabecalho = [['Ana Souza', '(11) 90000-0002', 'seg', '7h']]
    expect(juntarDiasEHorario(semCabecalho)).toEqual(semCabecalho)
  })
})

describe('pedaços que as pessoas escrevem', () => {
  it('dia da semana', () => {
    expect(lerDiaDaSemana('seg')).toBe(1)
    expect(lerDiaDaSemana('Segunda-feira')).toBe(1)
    expect(lerDiaDaSemana('terça')).toBe(2)
    expect(lerDiaDaSemana('Sáb.')).toBe(6)
    expect(lerDiaDaSemana('2a feira')).toBe(1)
    expect(lerDiaDaSemana('x')).toBeNull()
  })

  it('hora', () => {
    expect(lerHora('7h')).toBe('07:00')
    expect(lerHora('7h30')).toBe('07:30')
    expect(lerHora('07:00')).toBe('07:00')
    expect(lerHora('18:30')).toBe('18:30')
    expect(lerHora('19')).toBe('19:00')
    expect(lerHora('7 h')).toBe('07:00')
    expect(lerHora('18h30min')).toBe('18:30')
    expect(lerHora('25h')).toBeNull()
    expect(lerHora('manhã')).toBeNull()
  })

  it('turmas escritas de vários jeitos', () => {
    expect(lerTurmas('seg 7h, qua 7h')).toEqual([
      { dia: 1, inicio: '07:00', texto: 'seg 7h' },
      { dia: 3, inicio: '07:00', texto: 'qua 7h' },
    ])
    expect(lerTurmas('segunda 07:00; quarta 07:00').map((h) => h?.dia)).toEqual([1, 3])
    expect(lerTurmas('seg e qua 7h').map((h) => h?.dia)).toEqual([1, 3])
    expect(lerTurmas('seg/qua 7h').map((h) => h?.dia)).toEqual([1, 3])
    expect(lerTurmas('Seg 7h e Qua 7h').map((h) => h?.dia)).toEqual([1, 3])
    expect(lerTurmas('ter 18h30').map((h) => h?.inicio)).toEqual(['18:30'])
    expect(lerTurmas('7h')).toEqual([null])
    expect(lerTurmas('seg')).toEqual([null])
    expect(lerTurmas('')).toEqual([])
  })

  it('turmas com "às", com o começo e o fim, e separadas por barra ou mais', () => {
    const lidas = (t: string) => lerTurmas(t).map((h) => (h ? `${h.dia} ${h.inicio}` : null))
    expect(lidas('seg às 18h, qua às 18h')).toEqual(['1 18:00', '3 18:00'])
    expect(lidas('Segunda e quarta às 8h')).toEqual(['1 08:00', '3 08:00'])
    expect(lidas('ter a partir das 19h')).toEqual(['2 19:00'])
    expect(lidas('Seg 8h / Qua 8h')).toEqual(['1 08:00', '3 08:00'])
    expect(lidas('seg 7h + qui 9h30')).toEqual(['1 07:00', '4 09:30'])
    expect(lidas('ter - 18h')).toEqual(['2 18:00'])
    expect(lidas('qui 7 h')).toEqual(['4 07:00'])
    expect(lidas('seg 7h às 7h50, qua 7h às 7h50')).toEqual(['1 07:00', '3 07:00'])
    expect(lidas('ter 18:00-18:50 e qui 18:00 - 18:50')).toEqual(['2 18:00', '4 18:00'])
    expect(lidas('Terça 7:00 e Quinta 7:00')).toEqual(['2 07:00', '4 07:00'])
    // "seg a sex" é um intervalo de dias: melhor pedir para escrever do que ler errado
    expect(lidas('seg a sex 7h')).toEqual([null])
  })

  it('vezes por semana, forma de pagamento e data', () => {
    expect(lerVezes('2')).toBe(2)
    expect(lerVezes('2x')).toBe(2)
    expect(lerVezes('3 vezes por semana')).toBe(3)
    expect(lerVezes('duas')).toBe(2)
    expect(lerVezes('muitas')).toBeNull()
    expect(lerVezes('3 aulas/semana')).toBe(3)
    expect(lerVezes('2x semana')).toBe(2)
    expect(lerVezes('2 x na semana')).toBe(2)
    expect(lerVezes('3x/sem')).toBe(3)
    // no meio de um texto maior, só na leitura da linha (a coluna se reconhece pelo texto inteiro)
    expect(lerVezes('Mensal 2x')).toBeNull()
    expect(lerVezesNoMeio('Mensal 2x')).toBe(2)
    expect(lerVezesNoMeio('Trimestral - 3 vezes por semana')).toBe(3)
    expect(lerVezesNoMeio('Mensal')).toBeNull()
    expect(lerVezesNoMeio('R$ 280')).toBeNull()
    expect(lerVezes('280')).toBeNull()
    expect(lerVezes('12')).toBeNull()
    expect(lerForma('Pix')).toBe('pix')
    expect(lerForma('cartão de crédito')).toBe('cartao_credito')
    expect(lerForma('Crédito')).toBe('cartao_credito')
    expect(lerForma('débito')).toBe('cartao_debito')
    expect(lerForma('Dinheiro')).toBe('dinheiro')
    expect(lerForma('TED')).toBe('transferencia')
    expect(lerForma('Wellhub')).toBe('gympass')
    expect(lerForma('TotalPass')).toBe('totalpass')
    expect(lerForma('cheque')).toBeNull()
    expect(lerData('10/03/2026')).toBe('2026-03-10')
    expect(lerData('1/3/26')).toBe('2026-03-01')
    expect(lerData('2026-03-10')).toBe('2026-03-10')
    expect(lerData('31/02/2026')).toBeNull()
  })
})

describe('conferir os alunos da planilha', () => {
  const texto = [
    'Nome\tWhatsApp\tE-mail\tVezes por semana\tTurmas\tMensalidade\tForma de pagamento\tObservação',
    'Bianca Souza\t(11) 90000-0010\tbianca@example.com\t2\tseg 7h, qua 7h\tR$ 280,00\tPix\tjoelho',
    'Carlos Lima\t119000000\t\t1\tqua 7h\t\t\t',
    'Diego Rocha\t(11) 90000-0012\t\t2\tseg 7h, sex 9h\t300\tcartão\t',
    'Ana Almeida\t(11) 90000-0001\t\t2\t\t280\tPix\t',
    'Elisa Prado\t(11) 90000-0013\t\t1\tqua 7h\t280\tdinheiro\t',
    'Elisa Prado\t(11) 90000-0014\t\t1\t\t280\tPix\t',
  ].join('\n')

  it('lê, confere cada linha e simula a entrada nas turmas na ordem da planilha', () => {
    contador = 0
    const linhas = lerTabela(texto)
    const mapa = mapearColunasDeAlunos(linhas)
    expect(mapa.comCabecalho).toBe(true)
    const r = conferirImportacao(lerAlunos(linhas, mapa, ctx), ctx, idNovo)
    expect(r.lidos).toHaveLength(6)
    const [bianca, carlos, diego, ana, elisa, elisa2] = r.lidos
    expect(bianca?.erros).toEqual({})
    expect(bianca?.turmaIds).toEqual(['t-seg-07', 't-qua-07'])
    expect(bianca?.plano).toEqual({ valorMensal: 'R$ 280,00', formaPreferida: 'pix', diaVencimento: 10 })
    expect(carlos?.erros.telefone).toMatch(/DDD e número/)
    expect(carlos?.avisos).toContain('Sem mensalidade na planilha: preencha depois, na ficha.')
    // a turma de segunda tinha 2 lugares: a1 e a Bianca encheram
    expect(diego?.erros.turmas).toMatch(/Não existe turma de sexta às 9h/)
    expect(ana?.erros.nome).toBe('Ana Almeida já está cadastrado com este WhatsApp.')
    expect(elisa?.erros).toEqual({})
    expect(elisa2?.erros.nome).toBe('Repetido: a mesma pessoa está na linha 5.')
    expect(r.validos.map((l) => l.rascunho.nome)).toEqual(['Bianca Souza', 'Elisa Prado'])
    expect(r.gravacao.alunos.map((a) => a.nome)).toEqual(['Bianca Souza', 'Elisa Prado'])
    expect(r.gravacao.alunos[0]?.telefone).toBe('5511900000010')
    expect(r.gravacao.financeiro).toHaveLength(2)
    expect(r.gravacao.financeiro[0]).toMatchObject({ alunoId: r.gravacao.alunos[0]?.id, valorMensal: 28000, formaPreferida: 'pix' })
    const seg = r.gravacao.turmas.find((t) => t.id === 't-seg-07')
    const qua = r.gravacao.turmas.find((t) => t.id === 't-qua-07')
    expect(seg?.alunosFixos).toEqual(['a1', r.gravacao.alunos[0]?.id])
    expect(seg?.fixosDesde?.[r.gravacao.alunos[0]?.id ?? '']).toBe('2026-10-09')
    expect(qua?.alunosFixos).toEqual([r.gravacao.alunos[0]?.id, r.gravacao.alunos[1]?.id])
  })

  it('turma cheia pela própria planilha e repetido confirmado como outra pessoa', () => {
    contador = 0
    const linhas = lerTabela('Nome\tWhatsApp\tTurmas\nFabio Reis\t(11) 90000-0020\tseg 7h\nGabi Reis\t(11) 90000-0021\tseg 7h\nHeitor Reis\t(11) 90000-0020\t')
    const lidos = lerAlunos(linhas, mapearColunasDeAlunos(linhas), ctx)
    const r = conferirImportacao(lidos, ctx, idNovo)
    expect(r.lidos[0]?.erros).toEqual({})
    expect(r.lidos[1]?.erros.turmas).toBe('A turma está cheia (2 de 2).')
    expect(r.lidos[2]?.erros.nome).toBe('Repetido: a mesma pessoa está na linha 1.')
    // a pessoa confirma que é outra (família com o mesmo número)
    const confirmado = lidos.map((l, i) => (i === 2 ? { ...l, mesmoAssim: true } : l))
    expect(conferirImportacao(confirmado, ctx, idNovo).lidos[2]?.erros).toEqual({})
  })

  it('com a unidade escrita e sem plano', () => {
    contador = 0
    const linhas = lerTabela('Nome;WhatsApp;E-mail;Vezes;Turmas;Valor;Forma;Obs;Unidade\nIvo Nunes;(11) 90000-0030;;;seg 7h;;;;Jardim\nJulia Dias;(11) 90000-0031;;;;;;;Praia')
    const mapa = mapearColunasDeAlunos(linhas)
    const r = conferirImportacao(lerAlunos(linhas, mapa, ctx), ctx, idNovo)
    expect(r.lidos[0]?.rascunho.unidadeId).toBe('u-jardim')
    expect(r.lidos[0]?.turmaIds).toEqual(['t-jardim-seg-07'])
    expect(r.lidos[0]?.rascunho.vezesPorSemana).toBe(1)
    expect(r.lidos[0]?.plano).toBeNull()
    expect(r.lidos[1]?.erros.unidade).toBe('Não existe a unidade "Praia".')
  })

  it('o plano escrito como o estúdio chama ("Mensal 2x", "Mensal") não segura a linha', () => {
    contador = 0
    const linhas = lerTabela('Nome\tWhatsApp\tPlano\tTurmas\nIvo Nunes\t(11) 90000-0040\tMensal 3x\t\nJulia Dias\t(11) 90000-0041\tMensal\tseg 7h\nKaio Lima\t(11) 90000-0042\tTrimestral\t')
    const mapa = mapearColunasDeAlunos(linhas)
    expect(mapa.colunas).toEqual(['nome', 'telefone', 'vezesPorSemana', 'turmas'])
    const r = conferirImportacao(lerAlunos(linhas, mapa, ctx), ctx, idNovo)
    expect(r.comErro).toEqual([])
    expect(r.lidos.map((l) => l.rascunho.vezesPorSemana)).toEqual([3, 1, 2])
    expect(r.lidos[1]?.avisos[0]).toBe('Não entendi o plano "Mensal": ficou 1x por semana.')
    expect(r.lidos[2]?.avisos[0]).toBe('Não entendi o plano "Trimestral": ficou 2x por semana.')
  })

  it('parte a gravação em lotes, e a turma de cada lote leva os fixos até ali', () => {
    const alunos = Array.from({ length: 5 }, (_, i) => aluno(`n${i}`))
    const t = turma({ id: 't-x', capacidade: 10, alunosFixos: ['a1', 'n0', 'n1', 'n2', 'n3', 'n4'], fixosDesde: { n0: '2026-10-09', n1: '2026-10-09', n2: '2026-10-09', n3: '2026-10-09', n4: '2026-10-09' } })
    const lotes = lotesDaImportacao({ alunos, financeiro: [], turmas: [t] }, 2)
    expect(lotes).toHaveLength(3)
    expect(lotes[0]?.alunos.map((a) => a.id)).toEqual(['n0', 'n1'])
    expect(lotes[0]?.turmas[0]?.alunosFixos).toEqual(['a1', 'n0', 'n1'])
    expect(Object.keys(lotes[0]?.turmas[0]?.fixosDesde ?? {})).toEqual(['n0', 'n1'])
    expect(lotes[1]?.turmas[0]?.alunosFixos).toEqual(['a1', 'n0', 'n1', 'n2', 'n3'])
    expect(lotes[2]?.turmas[0]?.alunosFixos).toEqual(['a1', 'n0', 'n1', 'n2', 'n3', 'n4'])
  })

  it('o modelo em branco é só o cabeçalho, e ele é reconhecido inteiro', () => {
    const linhas = lerTabela(modeloDeAlunos())
    expect(linhas).toEqual([['Nome', 'WhatsApp', 'E-mail', 'Vezes por semana', 'Turmas', 'Mensalidade', 'Forma de pagamento', 'Observação']])
    const mapa = mapearColunasDeAlunos(linhas)
    expect(mapa.comCabecalho).toBe(true)
    expect(mapa.colunas).toEqual(['nome', 'telefone', 'email', 'vezesPorSemana', 'turmas', 'valorMensal', 'formaPreferida', 'observacao'])
    expect(mapa.naoReconhecidas).toEqual([])
    expect(lerAlunos(linhas, mapa, ctx)).toEqual([])
    expect(mapearColunasDeTurmas(lerTabela(modeloDeTurmas())).colunas).toEqual(['dia', 'inicio', 'duracaoMin', 'capacidade', 'professor', 'unidade'])
  })

  it('sem cabeçalho e em outra ordem, as colunas são reconhecidas pelo conteúdo', () => {
    const linhas = lerTabela(
      [
        '(11) 90000-0040\tLia Campos\tseg 7h\t280\tPix\t2x\tlia@example.com\tjoelho',
        '(11) 90000-0041\tMauro Dias\tqua 7h\t300,00\tdinheiro\t1\t\t',
        '11 900000042\tNina Rocha\tqua 7h\tR$ 350\tcartão de crédito\t2 vezes\tnina@example.com\tcostas',
      ].join('\n'),
    )
    const mapa = mapearColunasDeAlunos(linhas)
    expect(mapa.comCabecalho).toBe(false)
    expect(mapa.colunas).toEqual(['telefone', 'nome', 'turmas', 'valorMensal', 'formaPreferida', 'vezesPorSemana', 'email', 'ignorar'])
    // a última (texto livre) a pessoa diz o que é
    expect(mapa.naoReconhecidas).toEqual([7])
    const r = conferirImportacao(lerAlunos(linhas, mapa, ctx), ctx, idNovo)
    expect(r.comErro.map((l) => [l.linha, l.erros])).toEqual([])
    expect(r.gravacao.alunos.map((a) => [a.nome, a.vezesPorSemana])).toEqual([
      ['Lia Campos', 2],
      ['Mauro Dias', 1],
      ['Nina Rocha', 2],
    ])
    expect(r.gravacao.financeiro.map((f) => [f.valorMensal, f.formaPreferida])).toEqual([
      [28000, 'pix'],
      [30000, 'dinheiro'],
      [35000, 'cartao_credito'],
    ])
  })
})

describe('conferir as turmas da planilha', () => {
  const ctxTurmas: ContextoDeTurmas = { unidades, turmas, equipe, hoje: '2026-10-09', unidadePadrao: 'u-centro', capacidadePadrao: 5 }

  it('lê dia, horário, duração, lugares, professor e unidade, e aponta choque e repetição', () => {
    contador = 0
    const linhas = lerTabela('Dia;Horário;Duração;Lugares;Professor;Unidade\nseg;7h;50;6;Camila;Centro\nqua;7h;50;6;Camila;Centro\nter;18h30;50;5;Rafael;Centro\nqui;19h;;;Fulano;\nseg;7h;50;6;camila;Centro\nseg;7h30;50;6;Camila;\nsex;25h;50;5;Rafael;Jardim')
    const mapa = mapearColunasDeTurmas(linhas)
    expect(mapa.colunas).toEqual(['dia', 'inicio', 'duracaoMin', 'capacidade', 'professor', 'unidade'])
    const r = conferirTurmas(lerTurmasDaPlanilha(linhas, mapa, ctxTurmas), ctxTurmas, idNovo)
    const [seg, qua, ter, qui, repetida, choque, hora] = r.lidas
    // o modelo: seg 7h com Camila já existe no estúdio de teste
    expect(seg?.erros.inicio).toBe('Já existe a turma de segunda, 7h com esta pessoa.')
    expect(qua?.erros.inicio).toBe('Já existe a turma de quarta, 7h com esta pessoa.')
    expect(ter?.erros).toEqual({})
    expect(ter?.rascunho).toMatchObject({ diaDaSemana: 2, inicio: '18:30', duracaoMin: 50, capacidade: 5, professorId: 'e-rafael', unidadeId: 'u-centro' })
    expect(qui?.erros.professor).toMatch(/Não achei "Fulano"/)
    expect(qui?.rascunho.duracaoMin).toBe(50)
    expect(qui?.rascunho.capacidade).toBe(5)
    expect(repetida?.erros.inicio).toBe('Já existe a turma de segunda, 7h com esta pessoa.')
    expect(choque?.erros.professor).toBe('Camila já dá a turma de segunda, 7h.')
    expect(hora?.erros.inicio).toMatch(/Não entendi o horário "25h"/)
    expect(r.turmas).toHaveLength(1)
    expect(r.turmas[0]).toMatchObject({ diaDaSemana: 2, inicio: '18:30', professorId: 'e-rafael', ativa: true, desde: '2026-10-09' })
  })

  it('a administração também dá aula, pelo primeiro nome', () => {
    contador = 0
    const linhas = lerTabela('Dia;Horário;Professor\nsex;9h;Helena')
    const r = conferirTurmas(lerTurmasDaPlanilha(linhas, mapearColunasDeTurmas(linhas), ctxTurmas), ctxTurmas, idNovo)
    expect(r.validas).toHaveLength(1)
    expect(r.turmas[0]?.professorId).toBe('e-helena')
  })
})
