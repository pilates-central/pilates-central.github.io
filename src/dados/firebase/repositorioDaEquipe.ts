// Camada de dados da equipe sobre o Firestore: o mesmo contrato do modo demonstração
// (Repositorio), mais as cópias que o aluno e a página pública leem (vagas, portal, página).
//
// Gravação: tudo de uma ação vai numa transação. O registro da aula é lido de novo dentro dela
// e recebe só o que esta ação mudou, aluno por aluno (duas pessoas fazendo a chamada ao mesmo
// tempo não se apagam). As vagas das aulas tocadas são recalculadas com esse registro fresco,
// então a contagem de lugares que o aluno vê não fica para trás. Cadastros mudam só nos campos
// alterados; alunos fixos entram e saem da turma com arrayUnion e arrayRemove.
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore/lite'
import type { Transaction } from 'firebase/firestore/lite'
import { vencimentoDoConvite } from '../../dominio/convites'
import { momentoDe, somarDias } from '../../dominio/datas'
import { ehAdministracao } from '../../dominio/permissoes'
import {
  DIAS_DA_JANELA,
  documentoDaPaginaPublica,
  mesmaProjecao,
  mudancasDeVagas,
  paginaPublica,
  portaisDosAlunos,
  vagasDaJanela,
} from '../../dominio/projecoes'
import type { DocumentoPublico, EstadoParaProjetar } from '../../dominio/projecoes'
import type {
  Aluno,
  Competencia,
  CreditoReposicao,
  FinanceiroDoAluno,
  Id,
  MembroEquipe,
  Pagamento,
  PortalDoAluno,
  RegistroAula,
  RegistroDeAuditoria,
  Turma,
  Unidade,
  VagaDaAula,
} from '../../dominio/tipos'
import { mesclarBase } from '../mesclar'
import type { DadosBase, Gravacao, Intervalo, Repositorio } from '../repositorio'
import { ErroDeConta } from './autenticacao'
import {
  APAGAR,
  camposAlterados,
  configuracaoDoDocumento,
  documentoDoMembro,
  documentoDoRegistro,
  membroDoDocumento,
  mesclarRegistro,
  mudancaDeLista,
  registroDoDocumento,
  semIndefinidos,
} from './conversao'
import type { Campos, DocumentoDeConvite } from './conversao'
import type { Sdk } from './sdk'

export interface SessaoDaEquipe {
  uid: string
  membroId: Id
  agora: () => Date
}

export interface RepositorioDaEquipe extends Repositorio {
  readonly modo: 'firebase'
}

function paraOBanco(campos: Campos): Record<string, unknown> {
  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(campos)) saida[chave] = valor === APAGAR ? deleteField() : valor
  return saida
}

const sem = <T extends object, K extends keyof T>(objeto: T, ...chaves: K[]): Omit<T, K> => {
  const copia = { ...objeto }
  for (const k of chaves) delete copia[k]
  return copia
}

function pedacos<T>(lista: readonly T[], tamanho: number): T[][] {
  const saida: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho))
  return saida
}

/**
 * Lotes de vagas (ids `turma_AAAA-MM-DD`) com no máximo `turmas` turmas diferentes em cada um.
 * A vaga que o professor cria faz as regras lerem a turma, e o Firestore aceita até 20 leituras
 * de documentos diferentes por lote (o emulador não confere esse teto): com poucas turmas por
 * lote, a conferência da janela do professor nunca passa dele.
 */
export function lotesDeVagas(ids: readonly string[], porLote: number, turmas: number): string[][] {
  const saida: string[][] = []
  let atual: string[] = []
  let doLote = new Set<string>()
  for (const id of ids) {
    const turma = id.slice(0, -11)
    if (atual.length >= porLote || (!doLote.has(turma) && doLote.size >= turmas)) {
      saida.push(atual)
      atual = []
      doLote = new Set()
    }
    atual.push(id)
    doLote.add(turma)
  }
  if (atual.length) saida.push(atual)
  return saida
}

export function criarRepositorioDaEquipe(sdk: Sdk, sessao: SessaoDaEquipe): RepositorioDaEquipe {
  const { db } = sdk
  let base: DadosBase | null = null
  let titularMembroId: Id | undefined
  const uidPorMembro = new Map<Id, string>()
  const registros = new Map<string, RegistroAula>()
  const creditos = new Map<Id, CreditoReposicao>()
  let publicoGravado: DocumentoPublico | null = null

  const eu = (): MembroEquipe | undefined => base?.equipe.find((m) => m.id === sessao.membroId)
  const souAdministracao = () => ehAdministracao(eu()?.papel)
  /** professor só grava vagas das unidades dele (as regras recusam o lote inteiro se não for) */
  const possoNaUnidade = (unidadeId: Id) => souAdministracao() || (eu()?.unidades ?? []).includes(unidadeId)

  function estadoDe(b: DadosBase, regs: ReadonlyMap<string, RegistroAula>): EstadoParaProjetar {
    return { configuracao: b.configuracao, unidades: b.unidades, alunos: b.alunos, turmas: b.turmas, registro: (id) => regs.get(id) }
  }

  function relogio() {
    const agora = sessao.agora()
    return { agora, momento: momentoDe(agora), instante: agora.toISOString() }
  }

  // ---------- leituras ----------

  async function carregarBase(): Promise<DadosBase> {
    const [posse, cfg, unidades, equipe, alunos, turmas] = await Promise.all([
      getDoc(doc(db, 'estudio', 'posse')),
      getDoc(doc(db, 'configuracao', 'estudio')),
      getDocs(collection(db, 'unidades')),
      getDocs(collection(db, 'equipe')),
      getDocs(collection(db, 'alunos')),
      getDocs(collection(db, 'turmas')),
    ])
    titularMembroId = posse.exists() ? (posse.data() as { titularMembroId: Id }).titularMembroId : undefined
    uidPorMembro.clear()
    for (const d of equipe.docs) {
      const uid = (d.data() as { uid?: string }).uid
      if (uid) uidPorMembro.set(d.id, uid)
    }
    base = {
      configuracao: configuracaoDoDocumento(cfg.exists() ? cfg.data() : undefined),
      unidades: unidades.docs.map((d) => d.data() as Unidade),
      equipe: equipe.docs.map((d) => membroDoDocumento(d.data(), titularMembroId)),
      alunos: alunos.docs.map((d) => d.data() as Aluno),
      turmas: turmas.docs.map((d) => d.data() as Turma),
    }
    return structuredClone(base)
  }

  async function lerRegistros({ de, ate }: Intervalo): Promise<RegistroAula[]> {
    const r = await getDocs(query(collection(db, 'registros'), where('data', '>=', de), where('data', '<=', ate)))
    const lista = r.docs.map((d) => registroDoDocumento(d.data()))
    for (const reg of lista) registros.set(reg.id, reg)
    return structuredClone(lista)
  }

  async function lerCreditos(): Promise<CreditoReposicao[]> {
    const r = await getDocs(collection(db, 'creditos'))
    creditos.clear()
    for (const d of r.docs) creditos.set(d.id, d.data() as CreditoReposicao)
    return structuredClone([...creditos.values()])
  }

  async function lerFinanceiro(): Promise<FinanceiroDoAluno[]> {
    const r = await getDocs(collection(db, 'financeiroDosAlunos'))
    return r.docs.map((d) => d.data() as FinanceiroDoAluno)
  }

  async function lerAuditoria(maximo: number): Promise<RegistroDeAuditoria[]> {
    const r = await getDocs(query(collection(db, 'auditoria'), orderBy('em', 'desc'), limit(maximo)))
    return r.docs.map((d) => d.data() as RegistroDeAuditoria)
  }

  async function lerPagamentos(competencias: Competencia[]): Promise<Pagamento[]> {
    const partes = await Promise.all(
      // o "in" do Firestore aceita até 30 valores
      pedacos(competencias, 30).map((c) => getDocs(query(collection(db, 'pagamentos'), where('competencia', 'in', c)))),
    )
    return partes.flatMap((p) => p.docs.map((d) => d.data() as Pagamento))
  }

  // ---------- gravação ----------

  function gravarCadastros(tx: Transaction, antes: DadosBase, g: Gravacao, instante: string): void {
    // o convite vale pelos dias da configuração (a que fica depois desta gravação); as regras
    // conferem o vencimento na hora do aceite
    const validadeDias = (g.configuracao ?? antes.configuracao).validadeDoConviteDias
    for (const a of g.alunos ?? []) {
      const anterior = antes.alunos.find((x) => x.id === a.id)
      const ref = doc(db, 'alunos', a.id)
      if (!anterior) tx.set(ref, semIndefinidos(a))
      else {
        const campos = camposAlterados(semIndefinidos(anterior), semIndefinidos(a))
        if (Object.keys(campos).length) tx.update(ref, paraOBanco(campos))
      }
      // convite do app do aluno: segue o acesso liberado e o e-mail; mandado de novo (data nova),
      // o prazo recomeça
      const tinha = anterior?.acesso && anterior.email ? anterior.email : null
      const tem = a.acesso && a.email ? a.email : null
      const renovado = tem !== null && tem === tinha && anterior?.acesso?.convidadoEm !== a.acesso?.convidadoEm
      if (tinha && tinha !== tem) tx.delete(doc(db, 'convites', tinha))
      if (tem && a.acesso && (tem !== tinha || renovado)) {
        const convite: DocumentoDeConvite = {
          email: tem,
          papel: 'aluno',
          pessoaId: a.id,
          porId: sessao.membroId,
          criadoEm: instante,
          expiraEm: vencimentoDoConvite(a.acesso.convidadoEm, validadeDias),
        }
        tx.set(doc(db, 'convites', tem), convite)
      }
    }
    // o financeiro sai por financeiroRemovido e o portal pela conferência dos portais (cada
    // documento só pode ser escrito uma vez na transação)
    for (const id of g.alunosRemovidos ?? []) {
      const anterior = antes.alunos.find((x) => x.id === id)
      tx.delete(doc(db, 'alunos', id))
      if (anterior?.acesso && anterior.email) tx.delete(doc(db, 'convites', anterior.email))
    }
    for (const f of g.financeiro ?? []) tx.set(doc(db, 'financeiroDosAlunos', f.alunoId), semIndefinidos(f))
    for (const id of g.financeiroRemovido ?? []) tx.delete(doc(db, 'financeiroDosAlunos', id))

    for (const t of g.turmas ?? []) {
      const anterior = antes.turmas.find((x) => x.id === t.id)
      const ref = doc(db, 'turmas', t.id)
      if (!anterior) {
        tx.set(ref, semIndefinidos(t))
        continue
      }
      const campos: Record<string, unknown> = paraOBanco(
        camposAlterados(semIndefinidos(sem(anterior, 'alunosFixos', 'fixosDesde')), semIndefinidos(sem(t, 'alunosFixos', 'fixosDesde'))),
      )
      const lista = mudancaDeLista(anterior.alunosFixos, t.alunosFixos)
      if (lista.adicionados.length && lista.removidos.length) campos.alunosFixos = t.alunosFixos
      else if (lista.adicionados.length) campos.alunosFixos = arrayUnion(...lista.adicionados)
      else if (lista.removidos.length) campos.alunosFixos = arrayRemove(...lista.removidos)
      const desdeAntes = anterior.fixosDesde ?? {}
      const desdeDepois = t.fixosDesde ?? {}
      for (const id of new Set([...Object.keys(desdeAntes), ...Object.keys(desdeDepois)])) {
        if (desdeAntes[id] === desdeDepois[id]) continue
        campos[`fixosDesde.${id}`] = desdeDepois[id] ?? deleteField()
      }
      if (Object.keys(campos).length) tx.update(ref, campos)
    }

    for (const u of g.unidades ?? []) tx.set(doc(db, 'unidades', u.id), semIndefinidos(u))
    if (g.configuracao) tx.set(doc(db, 'configuracao', 'estudio'), semIndefinidos(g.configuracao))

    for (const m of g.equipe ?? []) {
      const anterior = antes.equipe.find((x) => x.id === m.id)
      const depois = documentoDoMembro(m)
      const ref = doc(db, 'equipe', m.id)
      if (!anterior) tx.set(ref, depois)
      else {
        const campos = camposAlterados(documentoDoMembro(anterior), depois)
        if (Object.keys(campos).length) tx.update(ref, paraOBanco(campos))
      }
      // convite da equipe: enquanto a pessoa não entrou, o convite segue o e-mail do cadastro;
      // revogado (acesso desligado) some, mandado de novo (data nova) recomeça o prazo
      const pendenteAntes = anterior?.convite && anterior.ativo ? anterior.email : null
      const pendente = m.convite && m.ativo ? m.email : null
      const renovado = pendente !== null && pendente === pendenteAntes && anterior?.convite?.enviadoEm !== m.convite?.enviadoEm
      if (pendenteAntes && pendenteAntes !== pendente) tx.delete(doc(db, 'convites', pendenteAntes))
      if (pendente && m.convite && (pendente !== pendenteAntes || anterior?.papel !== m.papel || renovado)) {
        const convite: DocumentoDeConvite = {
          email: pendente,
          papel: m.papel === 'professor' ? 'professor' : 'administrador',
          pessoaId: m.id,
          porId: sessao.membroId,
          criadoEm: instante,
          expiraEm: vencimentoDoConvite(m.convite.enviadoEm, validadeDias),
        }
        tx.set(doc(db, 'convites', pendente), convite)
      }
    }

    // passar a conta: o titular mora na posse
    const novoTitular = mesclarBase(antes, g).equipe.find((m) => m.papel === 'titular')
    if (g.equipe?.length && novoTitular && novoTitular.id !== titularMembroId) {
      const uid = uidPorMembro.get(novoTitular.id)
      if (!uid) throw new ErroDeConta('Esta pessoa ainda não entrou no app com o e-mail confirmado.')
      tx.update(doc(db, 'estudio', 'posse'), { titularUid: uid, titularMembroId: novoTitular.id })
    }

    for (const c of g.creditos ?? []) tx.set(doc(db, 'creditos', c.id), semIndefinidos(c))
    for (const id of g.creditosRemovidos ?? []) tx.delete(doc(db, 'creditos', id))
    for (const p of g.pagamentos ?? []) tx.set(doc(db, 'pagamentos', p.id), semIndefinidos(p))
    for (const id of g.pagamentosRemovidos ?? []) tx.delete(doc(db, 'pagamentos', id))
    // o registro de alterações nunca muda: só entra
    for (const r of g.auditoria ?? []) tx.set(doc(db, 'auditoria', r.id), semIndefinidos(r))
  }

  /**
   * Grava `g` e recalcula as vagas das aulas afetadas (e as de `extras`), tudo numa transação.
   * Devolve os registros como ficaram no banco.
   */
  async function gravar(g: Gravacao, extras: readonly string[] = []): Promise<void> {
    if (!base) throw new Error('dados ainda não carregados')
    const antes = base
    const { momento, instante } = relogio()
    const hoje = momento.data
    const depois = mesclarBase(antes, g)
    const regDepois = new Map(registros)
    for (const r of g.registros ?? []) regDepois.set(r.id, r)

    const vagasAntes = vagasDaJanela(estadoDe(antes, registros), hoje, instante)
    const vagasDepois = vagasDaJanela(estadoDe(depois, regDepois), hoje, instante)
    const afetadas = new Set([...mudancasDeVagas(vagasAntes, vagasDepois).map((m) => m.id), ...extras])
    for (const r of g.registros ?? []) if (vagasDepois.has(r.id)) afetadas.add(r.id)
    for (const id of [...afetadas]) {
      const v = vagasDepois.get(id) ?? vagasAntes.get(id)
      if (!v || !possoNaUnidade(v.unidadeId)) afetadas.delete(id)
    }

    const portaisAntes = souAdministracao() ? portaisDosAlunos(estadoDe(antes, registros), instante) : new Map<Id, PortalDoAluno>()
    const portaisDepois = souAdministracao() ? portaisDosAlunos(estadoDe(depois, regDepois), instante) : new Map<Id, PortalDoAluno>()

    // quem pediu a exclusão (LGPD) perde também o documento que liga a conta dele ao cadastro (tem
    // o e-mail), e os pagamentos dele ficam só com o código, sem a observação; as consultas ficam
    // fora da transação, que só lê documentos pelo endereço
    const excluidos = g.alunosRemovidos ?? []
    const acessosDosExcluidos = (
      await Promise.all(excluidos.map((id) => getDocs(query(collection(db, 'acessos'), where('tipo', '==', 'aluno'), where('pessoaId', '==', id)))))
    ).flatMap((r) => r.docs.map((d) => d.ref))
    const pagamentosDosExcluidos = (
      await Promise.all(excluidos.map((id) => getDocs(query(collection(db, 'pagamentos'), where('alunoId', '==', id)))))
    ).flatMap((r) => r.docs.filter((d) => (d.data() as Pagamento).observacao).map((d) => d.ref))

    const gravados = await runTransaction(db, async (tx) => {
      // leituras primeiro (regra das transações): registros tocados e vagas a recalcular
      const ids = [...new Set([...(g.registros ?? []).map((r) => r.id), ...afetadas])]
      const frescos = new Map<string, RegistroAula | undefined>()
      for (const id of ids) {
        const s = await tx.get(doc(db, 'registros', id))
        frescos.set(id, s.exists() ? registroDoDocumento(s.data()) : undefined)
      }
      const vagasNoBanco = new Map<string, VagaDaAula | undefined>()
      for (const id of afetadas) {
        const s = await tx.get(doc(db, 'vagas', id))
        vagasNoBanco.set(id, s.exists() ? (s.data() as VagaDaAula) : undefined)
      }

      const mesclados = (g.registros ?? []).map((r) => mesclarRegistro(frescos.get(r.id), registros.get(r.id), r))
      const regFinal = new Map(regDepois)
      for (const [id, f] of frescos) {
        if (f) regFinal.set(id, f)
        else regFinal.delete(id)
      }
      for (const m of mesclados) regFinal.set(m.id, m)
      const vagasFinal = vagasDaJanela(estadoDe(depois, regFinal), hoje, instante)

      gravarCadastros(tx, antes, g, instante)
      for (const ref of acessosDosExcluidos) tx.delete(ref)
      for (const ref of pagamentosDosExcluidos) tx.update(ref, { observacao: '' })
      for (const m of mesclados) tx.set(doc(db, 'registros', m.id), documentoDoRegistro(m))
      for (const id of afetadas) {
        const noBanco = vagasNoBanco.get(id)
        const final = vagasFinal.get(id) ?? (noBanco ? { ...noBanco, cancelada: true, atualizadoEm: instante } : undefined)
        if (final && !mesmaProjecao(noBanco, final)) tx.set(doc(db, 'vagas', id), final)
      }
      for (const [id, p] of portaisDepois) if (!mesmaProjecao(portaisAntes.get(id), p)) tx.set(doc(db, 'portal', id), p)
      for (const id of portaisAntes.keys()) if (!portaisDepois.has(id)) tx.delete(doc(db, 'portal', id))
      return mesclados
    })

    // o que ficou no banco passa a ser a referência da próxima gravação
    base = depois
    const novoTitular = depois.equipe.find((m) => m.papel === 'titular')
    if (novoTitular) titularMembroId = novoTitular.id
    for (const r of gravados) registros.set(r.id, r)
    for (const id of g.creditosRemovidos ?? []) creditos.delete(id)
    for (const c of g.creditos ?? []) creditos.set(c.id, c)
    void atualizarPaginaPublica().catch(() => undefined)
  }

  // ---------- cópias para o aluno e a página pública ----------

  /** Página pública: grava só quando muda (o professor só pode mexer nos horários). */
  async function atualizarPaginaPublica(): Promise<void> {
    if (!base) return
    const { momento, instante } = relogio()
    const nova = documentoDaPaginaPublica(paginaPublica(estadoDe(base, registros), momento, instante))
    if (publicoGravado === null) {
      const s = await getDoc(doc(db, 'publico', 'estudio'))
      publicoGravado = s.exists() ? (s.data() as DocumentoPublico) : null
    }
    const gravado = publicoGravado
    if (mesmaProjecao(gravado ?? undefined, nova)) return
    if (souAdministracao()) {
      await setDoc(doc(db, 'publico', 'estudio'), nova)
      publicoGravado = nova
    } else if (gravado) {
      await updateDoc(doc(db, 'publico', 'estudio'), { horarios: nova.horarios, atualizadoEm: instante })
      publicoGravado = { ...gravado, horarios: nova.horarios, atualizadoEm: instante }
    }
  }

  /**
   * Ao abrir: as vagas dos próximos dias (a janela anda a cada dia), os portais dos alunos e a
   * página pública conferidos com o banco; grava só o que falta ou mudou.
   */
  async function depoisDeCarregar(): Promise<void> {
    if (!base) return
    const { momento, instante } = relogio()
    const hoje = momento.data
    const calculadas = vagasDaJanela(estadoDe(base, registros), hoje, instante)
    const noBanco = await getDocs(
      query(collection(db, 'vagas'), where('data', '>=', hoje), where('data', '<=', somarDias(hoje, DIAS_DA_JANELA))),
    )
    const gravadas = new Map(noBanco.docs.map((d) => [d.id, d.data() as VagaDaAula]))
    const diferentes = [...calculadas]
      .filter(([id, v]) => possoNaUnidade(v.unidadeId) && !mesmaProjecao(gravadas.get(id), v))
      .map(([id]) => id)
    // a administração grava a janela em lotes de 100; o professor, com no máximo 12 turmas por lote
    const lotes = souAdministracao() ? pedacos(diferentes, 100) : lotesDeVagas(diferentes, 100, 12)
    for (const lote of lotes) await gravar({}, lote)

    if (souAdministracao()) {
      const portais = portaisDosAlunos(estadoDe(base, registros), instante)
      const existentes = await getDocs(collection(db, 'portal'))
      const lote = writeBatch(db)
      let mudou = false
      for (const d of existentes.docs) {
        if (!portais.has(d.id)) {
          lote.delete(d.ref)
          mudou = true
        }
      }
      const gravadosPortal = new Map(existentes.docs.map((d) => [d.id, d.data() as PortalDoAluno]))
      for (const [id, p] of portais) {
        if (mesmaProjecao(gravadosPortal.get(id), p)) continue
        lote.set(doc(db, 'portal', id), p)
        mudou = true
      }
      if (mudou) await lote.commit()
    }
    await atualizarPaginaPublica()
  }

  return {
    modo: 'firebase',
    carregarBase,
    registros: lerRegistros,
    creditos: lerCreditos,
    financeiro: lerFinanceiro,
    pagamentos: lerPagamentos,
    auditoria: lerAuditoria,
    salvar: (g) => gravar(g),
    depoisDeCarregar,
  }
}
