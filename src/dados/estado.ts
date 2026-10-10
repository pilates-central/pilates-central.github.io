import { batch, computed, signal } from '@preact/signals'
import { agoraDoApp, momento } from '../app/relogio'
import { aulasDoDia, montarAula } from '../dominio/agenda'
import type { FiltroDoDia } from '../dominio/agenda'
import { registrarExperimental as registrarExperimentalNaAula, tirarExperimental as tirarExperimentalDaAula } from '../dominio/aulaExperimental'
import type { RascunhoExperimental } from '../dominio/aulaExperimental'
import { momentoDe, somarDias } from '../dominio/datas'
import { concederCredito, marcar, marcarTodosPresentes } from '../dominio/presenca'
import type { Alteracoes, Contexto } from '../dominio/presenca'
import { cancelarAula, candidatosAReposicao, desfazerEncaixe, encaixar, reabrirAula } from '../dominio/reposicao'
import type { OpcoesDeCancelamento } from '../dominio/reposicao'
import { aceito, recusado } from '../dominio/resultado'
import { NOME_DE_QUEM_SAIU } from '../dominio/privacidade'
import type { Resultado } from '../dominio/resultado'
import type {
  Aluno,
  Aula,
  Competencia,
  CreditoReposicao,
  DataISO,
  Experimental,
  FinanceiroDoAluno,
  Id,
  Marcacao,
  MembroEquipe,
  Pagamento,
  Participante,
  RegistroAula,
} from '../dominio/tipos'
import { avisar } from '../componentes/Avisos'
import { sessao } from '../app/sessao'
import { hoje } from '../app/relogio'
import { inversoDe } from './desfazer'
import { acessoMudou, FRASE_FILA_GRAVADA, FRASE_OUTRA, FRASE_SEM_ACESSO, FRASE_SEM_REDE, fraseDaFalha, fraseDoErro, tipoDaFalha } from './falhas'
import type { RetratoDoAcesso } from './falhas'
import { mesclarBase } from './mesclar'
import type { DadosBase, Gravacao, Intervalo, Repositorio } from './repositorio'

// Estado do app em sinais (@preact/signals): as telas leem e re-renderizam sozinhas.
// As ações aplicam a mudança na tela na hora (otimista), gravam no repositório e devolvem
// uma função de desfazer.

export const repositorio = signal<Repositorio | null>(null)
export const base = signal<DadosBase | null>(null)
export const registros = signal<ReadonlyMap<string, RegistroAula>>(new Map())
export const creditos = signal<ReadonlyMap<Id, CreditoReposicao>>(new Map())
export const situacao = signal<'carregando' | 'pronto' | 'erro'>('carregando')
/** true logo depois que os dados chegam: as listas entram em cascata só nessa hora */
export const cargaRecente = signal(false)

/** Financeiro (só a administração carrega): plano de cada aluno e pagamentos por competência. */
export const financeiro = signal<ReadonlyMap<Id, FinanceiroDoAluno>>(new Map())
export const pagamentos = signal<ReadonlyMap<Id, Pagamento>>(new Map())
export const situacaoFinanceira = signal<'fora' | 'carregando' | 'pronto' | 'erro'>('fora')
let competenciasCarregadas = new Set<Competencia>()

const MARGEM_DA_JANELA = 42
/** Datas cujos registros de aula já estão na memória. */
export const janela = signal<Intervalo | null>(null)

export const alunosPorId = computed(() => new Map<Id, Aluno>((base.value?.alunos ?? []).map((a) => [a.id, a])))
export const equipePorId = computed(() => new Map<Id, MembroEquipe>((base.value?.equipe ?? []).map((e) => [e.id, e])))
export const unidades = computed(() => (base.value?.unidades ?? []).filter((u) => u.ativa))
const ativos = computed(() => new Set((base.value?.alunos ?? []).filter((a) => a.situacao === 'ativo').map((a) => a.id)))

export function nomeDoAluno(id: Id): string {
  return alunosPorId.value.get(id)?.nome ?? NOME_DE_QUEM_SAIU
}

/** O nome de quem está na aula: aluno pelo cadastro, experimental pelo próprio registro. */
export function nomeDoParticipante(p: Participante): string {
  return p.origem === 'experimental' ? (p.experimental?.nome ?? 'Aula experimental') : nomeDoAluno(p.alunoId)
}

export function nomeDaEquipe(id: Id): string {
  return equipePorId.value.get(id)?.nome ?? 'Sem professor'
}

export function nomeDaUnidade(id: Id): string {
  return (base.value?.unidades ?? []).find((u) => u.id === id)?.nome ?? ''
}

/** Aulas de um dia, já com as exceções gravadas. Lê sinais: chamar dentro de componente. */
export function aulasNoDia(data: DataISO, filtro: FiltroDoDia = {}): Aula[] {
  const b = base.value
  if (!b) return []
  const mapa = registros.value
  const conjunto = ativos.value
  return aulasDoDia(data, b.turmas, (id) => mapa.get(id), filtro, { ehAtivo: (id) => conjunto.has(id) })
}

/** Uma aula pelo id `${turmaId}_${data}`. */
export function aulaPorId(idAula: string): Aula | undefined {
  const b = base.value
  const corte = idAula.lastIndexOf('_')
  if (!b || corte < 0) return undefined
  const turma = b.turmas.find((t) => t.id === idAula.slice(0, corte))
  if (!turma) return undefined
  const conjunto = ativos.value
  return montarAula(turma, idAula.slice(corte + 1), registros.value.get(idAula), { ehAtivo: (id) => conjunto.has(id) })
}

/** Créditos que podem ser usados nesta aula (um por aluno, o que vence primeiro). */
export function candidatosDaAula(aula: Aula): CreditoReposicao[] {
  return candidatosAReposicao(aula, creditos.value.values(), momento.value)
}

// ---------- carga ----------

export async function carregar(repo: Repositorio, hoje: DataISO): Promise<void> {
  situacao.value = 'carregando'
  try {
    const intervalo = { de: somarDias(hoje, -MARGEM_DA_JANELA), ate: somarDias(hoje, MARGEM_DA_JANELA) }
    const [dadosBase, lista, listaDeCreditos] = await Promise.all([
      repo.carregarBase(),
      repo.registros(intervalo),
      repo.creditos(),
    ])
    competenciasCarregadas = new Set()
    batch(() => {
      janela.value = intervalo
      repositorio.value = repo
      base.value = dadosBase
      registros.value = new Map(lista.map((r) => [r.id, r]))
      creditos.value = new Map(listaDeCreditos.map((c) => [c.id, c]))
      financeiro.value = new Map()
      pagamentos.value = new Map()
      situacaoFinanceira.value = 'fora'
      situacao.value = 'pronto'
      cargaRecente.value = true
    })
    setTimeout(() => (cargaRecente.value = false), 900)
  } catch {
    situacao.value = 'erro'
    return
  }
  // as cópias do aluno e da página pública podem esperar: a tela já está pronta
  void repo.depoisDeCarregar?.().catch(() => undefined)
}

/** Garante que os registros de `data` estão carregados (a agenda pode ir longe no calendário). */
export function garantirData(data: DataISO): Promise<void> {
  return garantirIntervalo(data, data, 14)
}

/** Garante que os registros de `de` até `ate` estão carregados (frequência de um mês inteiro). */
export async function garantirIntervalo(de: DataISO, ate: DataISO, folga = 0): Promise<void> {
  const repo = repositorio.peek()
  const atual = janela.peek()
  if (!repo || !atual || (de >= atual.de && ate <= atual.ate)) return
  const novo = {
    de: de < atual.de ? somarDias(de, -folga) : atual.de,
    ate: ate > atual.ate ? somarDias(ate, folga) : atual.ate,
  }
  const lista = await repo.registros(novo)
  const mapa = new Map(registros.peek())
  for (const r of lista) if (!mapa.has(r.id)) mapa.set(r.id, r)
  batch(() => {
    registros.value = mapa
    janela.value = novo
  })
}

export function intervaloCarregado(de: DataISO, ate: DataISO): boolean {
  const j = janela.value
  return j !== null && de >= j.de && ate <= j.ate
}

/**
 * Carrega o plano de cada aluno e os pagamentos das competências pedidas (as que ainda não
 * vieram). Só a administração chama: o professor nunca pede dado financeiro.
 */
export async function carregarFinanceiro(competencias: readonly Competencia[]): Promise<void> {
  const repo = repositorio.peek()
  if (!repo) return
  const faltam = competencias.filter((c) => !competenciasCarregadas.has(c))
  const primeiraVez = situacaoFinanceira.peek() === 'fora' || situacaoFinanceira.peek() === 'erro'
  if (!primeiraVez && faltam.length === 0) return
  if (primeiraVez) situacaoFinanceira.value = 'carregando'
  try {
    const [planos, lista] = await Promise.all([
      primeiraVez ? repo.financeiro() : Promise.resolve(null),
      faltam.length ? repo.pagamentos(faltam) : Promise.resolve([]),
    ])
    for (const c of faltam) competenciasCarregadas.add(c)
    batch(() => {
      if (planos) financeiro.value = new Map(planos.map((f) => [f.alunoId, f]))
      if (lista.length) {
        const mapa = new Map(pagamentos.peek())
        for (const p of lista) if (!mapa.has(p.id)) mapa.set(p.id, p)
        pagamentos.value = mapa
      }
      situacaoFinanceira.value = 'pronto'
    })
  } catch {
    situacaoFinanceira.value = 'erro'
  }
}

// ---------- gravação com desfazer ----------

function contexto(): Contexto {
  const agora = agoraDoApp()
  const config = base.peek()?.configuracao
  if (!config) throw new Error('dados ainda não carregados')
  return {
    agora: momentoDe(agora),
    instante: agora.toISOString(),
    config,
    creditosDoAluno: (alunoId) => [...creditos.peek().values()].filter((c) => c.alunoId === alunoId),
  }
}

function aplicarNaTela(a: Alteracoes): void {
  const mapaRegistros = new Map(registros.peek())
  for (const r of a.registros) mapaRegistros.set(r.id, r)
  const mapaCreditos = new Map(creditos.peek())
  for (const id of a.creditosRemovidos) mapaCreditos.delete(id)
  for (const c of a.creditos) mapaCreditos.set(c.id, c)
  batch(() => {
    registros.value = mapaRegistros
    creditos.value = mapaCreditos
  })
}

// ---------- sem internet: a fila ----------
// O Firestore "lite" não guarda nada fora da rede. Quando a gravação cai por falta de conexão,
// a tela fica como a pessoa deixou e a gravação entra numa fila, que anda sozinha quando a
// conexão volta (evento online, ou a cada 20 s). A fila mora só na memória: fechar o app antes
// de gravar perde o que estava nela, e a faixa no topo avisa enquanto houver algo esperando.

export const fila = signal<readonly Gravacao[]>([])
let processandoFila = false
let filaLigada = false
const ESPERA_ENTRE_TENTATIVAS_MS = 20_000

function ligarFila(): void {
  if (filaLigada || typeof window === 'undefined') return
  filaLigada = true
  window.addEventListener('online', () => void processarFila())
  setInterval(() => {
    if (fila.peek().length) void processarFila()
  }, ESPERA_ENTRE_TENTATIVAS_MS)
}

function enfileirar(g: Gravacao): void {
  ligarFila()
  const primeira = fila.peek().length === 0
  fila.value = [...fila.peek(), g]
  // depois do aviso da própria ação ("Cadastro feito"), para a fila ser a última palavra
  if (primeira) setTimeout(() => avisar({ texto: FRASE_SEM_REDE, icone: 'info', duracao: 7000 }), 400)
  if (navigator.onLine) void processarFila()
}

/** Como está o acesso de quem usa o app, para saber se uma recusa do banco é da conta ou das regras. */
function meuRetrato(b: DadosBase | null): RetratoDoAcesso | undefined {
  const membroId = sessao.peek()?.membroId
  const eu = b?.equipe.find((m) => m.id === membroId)
  return eu ? { ativo: eu.ativo, papel: eu.papel, unidades: eu.unidades } : undefined
}

/**
 * A frase de uma recusa do banco. Recusada pelas regras, relê os cadastros: se o acesso de quem
 * gravou mudou (desligado, outro papel, outras unidades), ou se nem a leitura passa mais, a
 * recusa é da conta; com a conta em dia, as regras publicadas estão velhas para esta versão do
 * app. A releitura também põe a tela em dia.
 */
async function fraseDaRecusa(repo: Repositorio, erro: unknown): Promise<string> {
  if (tipoDaFalha(erro) !== 'permissao') return fraseDoErro(erro)
  const antes = meuRetrato(base.peek())
  try {
    const b = await repo.carregarBase()
    base.value = b
    return fraseDaFalha('permissao', acessoMudou(antes, meuRetrato(b)))
  } catch (releitura) {
    return tipoDaFalha(releitura) === 'permissao' ? FRASE_SEM_ACESSO : FRASE_OUTRA
  }
}

/** Tenta gravar o que está na fila, na ordem; para na primeira falta de rede e espera a próxima chance. */
export async function processarFila(): Promise<void> {
  const repo = repositorio.peek()
  if (processandoFila || !repo || fila.peek().length === 0) return
  processandoFila = true
  let recusada = false
  try {
    while (fila.peek().length) {
      const [g, ...resto] = fila.peek()
      if (!g) break
      try {
        await repo.salvar(g)
      } catch (erro) {
        if (tipoDaFalha(erro) === 'rede') return
        // recusada pelo banco: sai da fila, a pessoa fica sabendo e a tela é relida do banco
        fila.value = resto
        recusada = true
        avisar({ texto: await fraseDaRecusa(repo, erro), icone: 'info', duracao: 9000 })
        continue
      }
      fila.value = resto
    }
    if (!recusada) avisar({ texto: FRASE_FILA_GRAVADA, icone: 'presente' })
    else void carregar(repo, hoje.peek())
  } finally {
    processandoFila = false
  }
}

/**
 * Grava no repositório ou, sem rede, põe na fila (a tela já está como a pessoa deixou). Com
 * algo na fila, a gravação nova entra atrás, para manter a ordem. Recusada pelo banco, lança
 * o erro para quem chamou desfazer a tela e pedir a frase (fraseDaRecusa).
 */
async function salvarOuEnfileirar(repo: Repositorio, g: Gravacao): Promise<'gravado' | 'na-fila'> {
  // a demonstração grava no aparelho: não depende de rede nem tem fila
  if (repo.modo === 'demonstracao') {
    await repo.salvar(g)
    return 'gravado'
  }
  // com algo esperando, ou o aparelho sabidamente sem rede, nem tenta: o SDK insistiria por segundos
  if (fila.peek().length || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    enfileirar(g)
    return 'na-fila'
  }
  try {
    await repo.salvar(g)
    return 'gravado'
  } catch (erro) {
    if (tipoDaFalha(erro) !== 'rede') throw erro
    enfileirar(g)
    return 'na-fila'
  }
}

async function gravar(feito: Alteracoes): Promise<() => Promise<void>> {
  const repo = repositorio.peek()
  if (!repo) throw new Error('sem repositório')
  const antesRegistros = registros.peek()
  const antesCreditos = creditos.peek()
  const voltar = () =>
    inversoDe(
      feito,
      { registro: (id) => antesRegistros.get(id), credito: (id) => antesCreditos.get(id) },
      { registro: (id) => registros.peek().get(id) },
      agoraDoApp().toISOString(),
    )
  aplicarNaTela(feito)
  try {
    await salvarOuEnfileirar(repo, feito)
  } catch (erro) {
    aplicarNaTela(voltar())
    throw new Error(await fraseDaRecusa(repo, erro))
  }
  let desfeito = false
  return async () => {
    if (desfeito) return
    desfeito = true
    const inverso = voltar()
    aplicarNaTela(inverso)
    try {
      await salvarOuEnfileirar(repo, inverso)
    } catch (erro) {
      avisar({ texto: await fraseDaRecusa(repo, erro), icone: 'info', duracao: 8000 })
    }
  }
}

/** Aplica na tela uma gravação qualquer (cadastros, financeiro, registros e créditos). */
function aplicarGravacao(g: Gravacao): void {
  batch(() => {
    if (g.registros?.length || g.creditos?.length || g.creditosRemovidos?.length) {
      aplicarNaTela({ registros: g.registros ?? [], creditos: g.creditos ?? [], creditosRemovidos: g.creditosRemovidos ?? [] })
    }
    const b = base.peek()
    if (b) base.value = mesclarBase(b, g)
    if (g.financeiro?.length || g.financeiroRemovido?.length) {
      const mapa = new Map(financeiro.peek())
      for (const id of g.financeiroRemovido ?? []) mapa.delete(id)
      for (const f of g.financeiro ?? []) mapa.set(f.alunoId, f)
      financeiro.value = mapa
    }
    if (g.pagamentos?.length || g.pagamentosRemovidos?.length) {
      const mapa = new Map(pagamentos.peek())
      for (const id of g.pagamentosRemovidos ?? []) mapa.delete(id)
      for (const p of g.pagamentos ?? []) mapa.set(p.id, p)
      pagamentos.value = mapa
    }
  })
}

/**
 * Grava cadastros e lançamentos: aplica na tela, salva e, se o salvamento falhar, volta a tela
 * como estava. `inverso`, quando existe, calcula na hora de desfazer (sobre o estado de então)
 * só o contrário do que esta ação fez.
 */
export async function gravarComDesfazer(
  g: Gravacao,
  inverso?: () => Gravacao | null,
): Promise<Resultado<{ desfazer?: () => Promise<void> }>> {
  const repo = repositorio.peek()
  if (!repo) return recusado('nada-a-fazer', 'Os dados ainda não carregaram.')
  const antes = {
    base: base.peek(),
    registros: registros.peek(),
    creditos: creditos.peek(),
    financeiro: financeiro.peek(),
    pagamentos: pagamentos.peek(),
  }
  aplicarGravacao(g)
  try {
    await salvarOuEnfileirar(repo, g)
  } catch (erro) {
    batch(() => {
      base.value = antes.base
      registros.value = antes.registros
      creditos.value = antes.creditos
      financeiro.value = antes.financeiro
      pagamentos.value = antes.pagamentos
    })
    return recusado('nada-a-fazer', await fraseDaRecusa(repo, erro))
  }
  if (!inverso) return aceito({})
  let desfeito = false
  return aceito({
    desfazer: async () => {
      if (desfeito) return
      desfeito = true
      const volta = inverso()
      if (!volta) return
      aplicarGravacao(volta)
      try {
        await salvarOuEnfileirar(repo, volta)
      } catch (erro) {
        avisar({ texto: await fraseDaRecusa(repo, erro), icone: 'info', duracao: 8000 })
      }
    },
  })
}

export type Feito<T = object> = Resultado<T & { alteracoes: Alteracoes; desfazer: () => Promise<void> }>

async function executar<T extends object>(calcular: () => Resultado<T & { alteracoes: Alteracoes }>): Promise<Feito<T>> {
  const r = calcular()
  if (!r.ok) return r
  try {
    const desfazer = await gravar(r.valor.alteracoes)
    return aceito({ ...r.valor, desfazer })
  } catch (erro) {
    return recusado('nada-a-fazer', erro instanceof Error && erro.message ? erro.message : FRASE_OUTRA)
  }
}

const buscaCredito = (id: Id) => creditos.peek().get(id)
const semAula = () => recusado<never>('aluno-fora-da-aula', 'Esta aula não existe mais.')

export function marcarPresenca(idAula: string, alunoId: Id, marcacao: Marcacao | null) {
  return executar<{ creditoGerado?: CreditoReposicao; avisoForaDoPrazo: boolean; limiteAtingido: boolean }>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    return marcar(aula, registros.peek().get(idAula), alunoId, marcacao, buscaCredito, contexto())
  })
}

export function marcarTodosComoPresentes(idAula: string) {
  return executar<{ quantidade: number; alunos: Id[] }>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    return marcarTodosPresentes(aula, registros.peek().get(idAula), contexto())
  })
}

export function darCreditoForaDoPrazo(idAula: string, alunoId: Id) {
  return executar<{ creditoGerado: CreditoReposicao }>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    return concederCredito(aula, alunoId, buscaCredito, contexto())
  })
}

export function encaixarReposicao(idAula: string, creditoId: Id) {
  return executar<object>(() => {
    const aula = aulaPorId(idAula)
    const credito = creditos.peek().get(creditoId)
    if (!aula || !credito) return semAula()
    const r = encaixar(aula, registros.peek().get(idAula), credito, contexto())
    return r.ok ? aceito({ alteracoes: r.valor }) : r
  })
}

export function tirarReposicao(idAula: string, alunoId: Id) {
  return executar<object>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    const r = desfazerEncaixe(aula, registros.peek().get(idAula), alunoId, buscaCredito, contexto())
    return r.ok ? aceito({ alteracoes: r.valor }) : r
  })
}

export function cancelar(idAula: string, opcoes: OpcoesDeCancelamento) {
  return executar<{ creditosGerados: number }>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    return cancelarAula(aula, registros.peek().get(idAula), opcoes, buscaCredito, contexto())
  })
}

export function reabrir(idAula: string) {
  return executar<object>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    const r = reabrirAula(aula, registros.peek().get(idAula), buscaCredito, contexto())
    return r.ok ? aceito({ alteracoes: r.valor }) : r
  })
}

/** Registra quem vem fazer a aula experimental (nome e WhatsApp) numa aula com vaga. */
export function registrarExperimental(idAula: string, id: Id, rascunho: RascunhoExperimental) {
  return executar<{ experimental: Experimental }>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    return registrarExperimentalNaAula(aula, registros.peek().get(idAula), id, rascunho, contexto())
  })
}

export function tirarExperimental(idAula: string, id: Id) {
  return executar<object>(() => {
    const aula = aulaPorId(idAula)
    if (!aula) return semAula()
    const r = tirarExperimentalDaAula(aula, registros.peek().get(idAula), id, contexto())
    return r.ok ? aceito({ alteracoes: r.valor }) : r
  })
}
