// LGPD: o aluno tem direito de receber os próprios dados e de pedir a exclusão. A exportação
// junta tudo o que o estúdio guarda sobre ele num arquivo legível; a exclusão apaga o cadastro
// e tira o aluno das turmas e das aulas que ainda vão acontecer.
import { turmasDoAluno } from './agenda'
import { nomeDoDia } from './datas'
import type { Participacao } from './frequencia'
import { NOME_DA_FORMA } from './pagamentos'
import type {
  Aluno,
  CreditoReposicao,
  DataISO,
  FinanceiroDoAluno,
  Id,
  Instante,
  Pagamento,
  RegistroAula,
  Turma,
  Unidade,
} from './tipos'

const NOME_DA_MARCACAO = { presente: 'presente', faltou: 'faltou', avisou: 'avisou que não vinha' } as const

export interface FontesDaExportacao {
  aluno: Aluno
  unidades: readonly Unidade[]
  turmas: readonly Turma[]
  /** só quando quem exporta é da administração (o professor não vê valores) */
  financeiro?: FinanceiroDoAluno
  pagamentos: readonly Pagamento[]
  creditos: readonly CreditoReposicao[]
  participacoes: readonly Participacao[]
  geradoEm: Instante
  nomeEstudio: string
}

/** Tudo o que o estúdio guarda sobre o aluno, em português, pronto para virar um arquivo JSON. */
export function dadosDoAluno(f: FontesDaExportacao) {
  const unidade = (id: Id) => f.unidades.find((u) => u.id === id)?.nome ?? id
  const a = f.aluno
  return {
    sobre: `Dados guardados por ${f.nomeEstudio} sobre ${a.nome}, exportados em ${f.geradoEm}.`,
    cadastro: {
      nome: a.nome,
      telefone: a.telefone,
      email: a.email,
      unidade: unidade(a.unidadeId),
      plano: `${a.vezesPorSemana}x por semana`,
      situacao: a.situacao,
      alunoDesde: a.desde,
      observacaoDaEquipe: a.observacao,
      acessoAoApp: a.acesso ? `liberado em ${a.acesso.convidadoEm}` : 'não',
    },
    turmasFixas: turmasDoAluno(a.id, f.turmas).map((t) => ({
      dia: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][t.diaDaSemana] ?? '',
      horario: t.inicio,
      unidade: unidade(t.unidadeId),
    })),
    ...(f.financeiro
      ? {
          mensalidade: {
            valorEmCentavos: f.financeiro.valorMensal,
            formaPreferida: NOME_DA_FORMA[f.financeiro.formaPreferida],
            diaDeVencimento: f.financeiro.diaVencimento,
          },
        }
      : {}),
    pagamentos: f.pagamentos
      .filter((p) => p.alunoId === a.id)
      .sort((x, y) => x.pagoEm.localeCompare(y.pagoEm))
      .map((p) => ({ mes: p.competencia, pagoEm: p.pagoEm, valorEmCentavos: p.valor, forma: NOME_DA_FORMA[p.forma], observacao: p.observacao })),
    presencas: f.participacoes
      .filter((p) => p.participante.alunoId === a.id)
      .map((p) => ({
        data: p.aula.data,
        dia: nomeDoDia(p.aula.data),
        horario: p.aula.inicio,
        tipo: p.participante.origem === 'reposicao' ? 'reposição' : 'turma fixa',
        marcacao: p.participante.marcacao ? NOME_DA_MARCACAO[p.participante.marcacao] : 'sem marcação',
      })),
    creditosDeReposicao: f.creditos
      .filter((c) => c.alunoId === a.id)
      .map((c) => ({
        daFaltaEm: c.origem.data,
        motivo: c.motivo ?? 'aviso',
        validoAte: c.validoAte,
        usadoEm: c.usadoEm?.data ?? null,
      })),
  }
}

export function nomeDoArquivoDeDados(aluno: Aluno, hoje: DataISO): string {
  const nome = aluno.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `dados-${nome || 'aluno'}-${hoje}.json`
}

export interface Exclusao {
  /** turmas sem o aluno */
  turmas: Turma[]
  /**
   * aulas de hoje em diante sem o aluno (marcação e reposição) e, em qualquer data, a aula
   * experimental de onde o cadastro nasceu sem o nome e o telefone dele
   */
  registros: RegistroAula[]
  creditosRemovidos: Id[]
}

/** O que fica no lugar do nome de quem foi excluído (o mesmo que a tela mostra para o aluno removido). */
export const NOME_DE_QUEM_SAIU = 'Aluno removido'

/**
 * O que muda quando o aluno é excluído: sai das turmas, das aulas que ainda vão acontecer e
 * perde os créditos. O histórico de aulas passadas e os pagamentos ficam só com o código do
 * aluno (sem nome, telefone nem e-mail), porque o caixa do estúdio precisa fechar. Se o cadastro
 * nasceu de uma aula experimental, o registro daquela aula guardava o nome e o telefone em
 * texto: eles saem e fica só o código.
 */
export function exclusaoDoAluno(
  alunoId: Id,
  turmas: readonly Turma[],
  registrosConhecidos: readonly RegistroAula[],
  creditos: readonly CreditoReposicao[],
  hoje: DataISO,
  instante: Instante,
): Exclusao {
  const semOAluno = turmas
    .filter((t) => t.alunosFixos.includes(alunoId) || t.fixosDesde?.[alunoId] !== undefined)
    .map((t) => {
      const fixosDesde = { ...t.fixosDesde }
      delete fixosDesde[alunoId]
      return { ...t, alunosFixos: t.alunosFixos.filter((id) => id !== alunoId), fixosDesde }
    })
  const registros: RegistroAula[] = []
  for (const r of registrosConhecidos) {
    const futuro = r.data >= hoje && (alunoId in r.marcacoes || alunoId in r.reposicoes)
    const daExperimental = Object.entries(r.experimentais ?? {}).filter(([, e]) => e.alunoId === alunoId)
    if (!futuro && daExperimental.length === 0) continue
    const novo: RegistroAula = { ...r, marcacoes: { ...r.marcacoes }, reposicoes: { ...r.reposicoes }, atualizadoEm: instante }
    if (futuro) {
      delete novo.marcacoes[alunoId]
      delete novo.reposicoes[alunoId]
    }
    if (daExperimental.length) {
      novo.experimentais = { ...r.experimentais }
      for (const [id] of daExperimental) novo.experimentais[id] = { nome: NOME_DE_QUEM_SAIU, telefone: '', alunoId }
    }
    registros.push(novo)
  }
  return {
    turmas: semOAluno,
    registros,
    creditosRemovidos: creditos.filter((c) => c.alunoId === alunoId).map((c) => c.id),
  }
}
