// Importação de alunos e turmas a partir de uma planilha colada ou de um arquivo .csv: o estúdio
// tem os alunos no caderno ou numa planilha, e cadastrar um a um é o que faz desistir. Tudo aqui
// é puro: lê o texto, reconhece as colunas pelo nome em português, confere cada linha com as
// mesmas regras do cadastro (validarAluno, validarPlano, colocarNaTurma, validarTurma) e monta
// a gravação em lote. A tela só mostra o resultado e deixa corrigir linha a linha.
import { montarAluno, montarFinanceiro, validarAluno, validarPlano } from './alunos'
import type { RascunhoAluno, RascunhoPlano } from './alunos'
import { ehDataValida, ehHoraValida, horaDe, horaFalada, minutosDe } from './datas'
import { quemPodeDarAula } from './equipe'
import { FORMAS, lerValor, NOME_DA_FORMA } from './pagamentos'
import { ehEmailValido, normalizar, normalizarTelefone, primeiroNome } from './texto'
import type { Aluno, DataISO, DiaDaSemana, FinanceiroDoAluno, FormaPagamento, Hora, Id, MembroEquipe, Turma, Unidade } from './tipos'
import { colocarNaTurma, NOME_DO_DIA, nomeDaTurma, novaTurma, validarTurma } from './turmas'
import type { RascunhoTurma } from './turmas'

// ---------- ler o texto ----------

export type Separador = '\t' | ';' | ','

/** O separador mais frequente nas primeiras linhas: tabulação (colado do Excel ou do Google Planilhas), ponto e vírgula (CSV em português) ou vírgula. */
export function detectarSeparador(texto: string): Separador {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10)
  const contar = (s: string) => linhas.reduce((n, l) => n + l.split(s).length - 1, 0)
  const tab = contar('\t')
  const pontoEVirgula = contar(';')
  const virgula = contar(',')
  if (tab > 0 && tab >= pontoEVirgula && tab >= virgula) return '\t'
  if (pontoEVirgula > 0 && pontoEVirgula >= virgula) return ';'
  return ','
}

/**
 * Lê o texto como tabela: aspas no começo da célula protegem o separador e a quebra de linha
 * (como o Excel e o Google Planilhas copiam); uma aspa no meio do texto (Ana "Aninha") fica
 * como está. Linhas vazias saem.
 */
export function lerTabela(texto: string, separador: Separador = detectarSeparador(texto)): string[][] {
  const linhas: string[][] = []
  let linha: string[] = []
  let celula = ''
  let entreAspas = false
  const semMarca = texto.replace(/^\uFEFF/, '')
  for (let i = 0; i < semMarca.length; i++) {
    const c = semMarca[i] ?? ''
    if (entreAspas) {
      if (c === '"') {
        if (semMarca[i + 1] === '"') {
          celula += '"'
          i++
        } else entreAspas = false
      } else celula += c
      continue
    }
    if (c === '"' && celula.trim() === '') {
      celula = ''
      entreAspas = true
    } else if (c === separador) {
      linha.push(celula)
      celula = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && semMarca[i + 1] === '\n') i++
      linha.push(celula)
      celula = ''
      if (linha.some((x) => x.trim())) linhas.push(linha.map((x) => x.trim()))
      linha = []
    } else celula += c
  }
  linha.push(celula)
  if (linha.some((x) => x.trim())) linhas.push(linha.map((x) => x.trim()))
  return linhas
}

// ---------- reconhecer as colunas ----------

export type CampoDeAluno = 'nome' | 'telefone' | 'email' | 'vezesPorSemana' | 'turmas' | 'valorMensal' | 'formaPreferida' | 'observacao' | 'unidade' | 'desde'
export type CampoDeTurma = 'dia' | 'inicio' | 'duracaoMin' | 'capacidade' | 'professor' | 'unidade'
export type Campo = CampoDeAluno | CampoDeTurma | 'ignorar'

export const NOME_DO_CAMPO: Record<Campo, string> = {
  nome: 'Nome',
  telefone: 'WhatsApp',
  email: 'E-mail',
  vezesPorSemana: 'Vezes por semana',
  turmas: 'Turmas (dia e hora)',
  valorMensal: 'Mensalidade',
  formaPreferida: 'Forma de pagamento',
  observacao: 'Observação',
  unidade: 'Unidade',
  desde: 'Aluno desde',
  dia: 'Dia da semana',
  inicio: 'Horário',
  duracaoMin: 'Duração (min)',
  capacidade: 'Lugares',
  professor: 'Professor',
  ignorar: 'Ignorar esta coluna',
}

export const CAMPOS_DE_ALUNO: readonly CampoDeAluno[] = ['nome', 'telefone', 'email', 'vezesPorSemana', 'turmas', 'valorMensal', 'formaPreferida', 'observacao', 'unidade', 'desde']
export const CAMPOS_DE_TURMA: readonly CampoDeTurma[] = ['dia', 'inicio', 'duracaoMin', 'capacidade', 'professor', 'unidade']

// nomes de coluna como as pessoas escrevem (sem acento e em minúsculas, ver normalizar)
const SINONIMOS: Record<Exclude<Campo, 'ignorar'>, readonly string[]> = {
  nome: ['nome', 'aluno', 'aluna', 'nome completo', 'nome do aluno', 'nome da aluna', 'cliente'],
  telefone: ['telefone', 'whatsapp', 'whats', 'celular', 'fone', 'tel', 'contato', 'numero', 'zap'],
  email: ['email', 'e-mail', 'e mail', 'mail'],
  vezesPorSemana: ['vezes', 'vezes por semana', 'plano', 'frequencia', 'aulas por semana', 'x por semana', 'vezes/semana', 'aulas/semana', 'qtd aulas', 'quantidade de aulas'],
  turmas: ['turmas', 'turma', 'horarios', 'horario', 'dias', 'dias e horarios', 'dia e hora', 'dias/horarios', 'aulas', 'grade'],
  valorMensal: ['valor', 'mensalidade', 'valor mensal', 'valor da mensalidade', 'preco', 'r$', 'valor (r$)'],
  formaPreferida: ['forma', 'pagamento', 'forma de pagamento', 'forma pagamento', 'como paga', 'meio de pagamento'],
  observacao: ['observacao', 'observacoes', 'obs', 'obs.', 'nota', 'notas', 'comentario'],
  unidade: ['unidade', 'local', 'estudio', 'filial', 'sala'],
  desde: ['desde', 'inicio', 'data de inicio', 'aluno desde', 'entrada', 'desde quando', 'comecou'],
  dia: ['dia', 'dia da semana', 'semana'],
  inicio: ['horario', 'hora', 'inicio', 'comeca', 'comeca as', 'hora de inicio'],
  duracaoMin: ['duracao', 'duracao (min)', 'minutos', 'duracao em minutos', 'tempo'],
  capacidade: ['lugares', 'capacidade', 'vagas', 'alunos', 'maximo', 'max'],
  professor: ['professor', 'professora', 'quem da a aula', 'instrutor', 'instrutora', 'prof'],
}

/** Reconhece um título de coluna pelo nome em português; null quando não dá para saber. */
export function reconhecerCampo(titulo: string, entre: readonly Exclude<Campo, 'ignorar'>[]): Exclude<Campo, 'ignorar'> | null {
  const t = normalizar(titulo).replace(/[:*]/g, '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  for (const campo of entre) if (SINONIMOS[campo].includes(t)) return campo
  // "whatsapp (com ddd)", "valor mensal r$": o começo do título já diz
  for (const campo of entre) if (SINONIMOS[campo].some((s) => s.length >= 4 && t.startsWith(s))) return campo
  return null
}

const CAMPOS_POR_POSICAO_ALUNO: readonly CampoDeAluno[] = ['nome', 'telefone', 'email', 'vezesPorSemana', 'turmas', 'valorMensal', 'formaPreferida', 'observacao']
const CAMPOS_POR_POSICAO_TURMA: readonly CampoDeTurma[] = ['dia', 'inicio', 'duracaoMin', 'capacidade', 'professor', 'unidade']

export interface Mapeamento<C extends Campo> {
  /** campo de cada coluna, na ordem da planilha */
  colunas: (C | 'ignorar')[]
  /** a primeira linha é um cabeçalho (sai dos dados) */
  comCabecalho: boolean
  /** colunas que não foram reconhecidas pelo nome (a tela pede para a pessoa escolher) */
  naoReconhecidas: number[]
}

function parecePessoa(celulas: readonly string[]): boolean {
  // uma linha de dados tem telefone ou e-mail; um cabeçalho não
  return celulas.some((c) => normalizarTelefone(c) !== null || /@/.test(c))
}

/**
 * Decide se a primeira linha é cabeçalho e de qual campo é cada coluna. Com cabeçalho, pelo nome;
 * sem, pelo conteúdo (`inferir`, quando há) e, no que sobrar, pela posição do modelo.
 */
export function mapearColunas<C extends Exclude<Campo, 'ignorar'>>(
  linhas: readonly string[][],
  campos: readonly C[],
  porPosicao: readonly C[],
  inferir?: (linhas: readonly string[][]) => (C | null)[],
): Mapeamento<C> {
  const primeira = linhas[0] ?? []
  const reconhecidos = primeira.map((t) => reconhecerCampo(t, campos) as C | null)
  const quantos = reconhecidos.filter(Boolean).length
  const comCabecalho = quantos >= 1 && !parecePessoa(primeira)
  if (comCabecalho) {
    const vistos = new Set<C>()
    const colunas = reconhecidos.map((c) => {
      // a mesma coluna duas vezes: vale a primeira
      if (c === null || vistos.has(c)) return 'ignorar' as const
      vistos.add(c)
      return c
    })
    const naoReconhecidas = colunas.map((c, i) => (c === 'ignorar' && primeira[i] ? i : -1)).filter((i) => i >= 0)
    return { colunas, comCabecalho: true, naoReconhecidas }
  }
  const largura = Math.max(...linhas.map((l) => l.length), 0)
  if (inferir) {
    const inferidas = inferir(linhas)
    const colunas = Array.from({ length: largura }, (_, i) => inferidas[i] ?? ('ignorar' as const))
    // coluna com dados que ninguém reconheceu: a tela pede para a pessoa dizer o que é
    const naoReconhecidas = colunas.map((c, i) => (c === 'ignorar' && linhas.some((l) => (l[i] ?? '').trim()) ? i : -1)).filter((i) => i >= 0)
    return { colunas, comCabecalho: false, naoReconhecidas }
  }
  const colunas = Array.from({ length: largura }, (_, i) => porPosicao[i] ?? ('ignorar' as const))
  return { colunas, comCabecalho: false, naoReconhecidas: [] }
}

/**
 * Sem cabeçalho, cada coluna de alunos é reconhecida pelo que tem dentro: e-mail tem arroba,
 * WhatsApp é telefone com DDD, turmas são dia e hora, e assim por diante. A coluna vale para um
 * campo quando a maioria das células preenchidas parece com ele; o nome é a primeira coluna de
 * texto com nome e sobrenome, e a observação, a última de texto livre que sobrar.
 */
export function inferirColunasDeAlunos(linhas: readonly string[][]): (CampoDeAluno | null)[] {
  const largura = Math.max(...linhas.map((l) => l.length), 0)
  const amostra = linhas.slice(0, 30)
  const celulas = (i: number) => amostra.map((l) => (l[i] ?? '').trim()).filter(Boolean)
  const maioria = (i: number, teste: (c: string) => boolean) => {
    const cs = celulas(i)
    return cs.length > 0 && cs.filter(teste).length / cs.length >= 0.6
  }
  const testes: [CampoDeAluno, (c: string) => boolean][] = [
    ['email', (c) => ehEmailValido(c)],
    ['telefone', (c) => normalizarTelefone(c) !== null],
    ['turmas', (c) => {
      const h = lerTurmas(c)
      return h.length > 0 && h.every((x) => x !== null)
    }],
    ['formaPreferida', (c) => lerForma(c) !== null],
    ['desde', (c) => lerData(c) !== null],
    ['vezesPorSemana', (c) => lerVezes(c) !== null],
    ['valorMensal', (c) => /\d/.test(c) && c.replace(/\D/g, '').length <= 7 && lerValor(c) !== null],
  ]
  const saida: (CampoDeAluno | null)[] = Array.from({ length: largura }, () => null)
  for (const [campo, teste] of testes) {
    const i = saida.findIndex((c, j) => c === null && maioria(j, teste))
    if (i >= 0) saida[i] = campo
  }
  const nome = saida.findIndex((c, j) => c === null && maioria(j, (x) => !/\d/.test(x) && /\S\s+\S/.test(x)))
  if (nome >= 0) saida[nome] = 'nome'
  // o resto (observação, unidade, colunas que o estúdio inventou) a pessoa diz o que é
  return saida
}

/**
 * Planilha com os dias numa coluna e a hora em outra ("Dias: seg e qua", "Horário: 7h"): as duas
 * viram uma coluna só de turmas ("seg/qua 7h"), que é o que a importação lê. Só com cabeçalho, e
 * só quando uma coluna tem só dias (sem número) e a outra só horas; fora disso, nada muda.
 */
export function juntarDiasEHorario(linhas: readonly string[][]): string[][] {
  const [cabecalho = [], ...dados] = linhas
  if (parecePessoa(cabecalho)) return linhas.map((l) => [...l])
  const deTurmas = cabecalho.map((t, i) => (reconhecerCampo(t, CAMPOS_DE_ALUNO) === 'turmas' ? i : -1)).filter((i) => i >= 0)
  if (deTurmas.length < 2) return linhas.map((l) => [...l])
  const cheias = (i: number) => dados.map((l) => (l[i] ?? '').trim()).filter(Boolean)
  const soDias = deTurmas.find((i) => cheias(i).length > 0 && cheias(i).every((c) => !/\d/.test(c)))
  const soHoras = deTurmas.find((i) => i !== soDias && cheias(i).length > 0 && cheias(i).every((c) => lerHora(c.replace(/^(?:às|as)\s+/i, '')) !== null))
  if (soDias === undefined || soHoras === undefined) return linhas.map((l) => [...l])
  const juntar = (dias: string, hora: string) => {
    if (!dias.trim() || !hora.trim()) return dias.trim()
    // "seg, qua" e "seg e qua" viram "seg/qua", para a hora valer para os dois dias
    return `${dias.trim().replace(/\s*[,;/+&]\s*|\s+e\s+/gi, '/')} ${hora.trim()}`
  }
  const tirar = (l: readonly string[]) => l.filter((_, i) => i !== soHoras)
  return [
    tirar(cabecalho),
    ...dados.map((l) => tirar(l.map((c, i) => (i === soDias ? juntar(c, l[soHoras] ?? '') : c)))),
  ]
}

export const mapearColunasDeAlunos = (linhas: readonly string[][]) => mapearColunas(linhas, CAMPOS_DE_ALUNO, CAMPOS_POR_POSICAO_ALUNO, inferirColunasDeAlunos)
export const mapearColunasDeTurmas = (linhas: readonly string[][]) => mapearColunas(linhas, CAMPOS_DE_TURMA, CAMPOS_POR_POSICAO_TURMA)

function valorDe<C extends Campo>(celulas: readonly string[], colunas: readonly (C | 'ignorar')[], campo: C): string {
  const i = colunas.indexOf(campo)
  return i >= 0 ? (celulas[i] ?? '').trim() : ''
}

// ---------- pedaços de texto que as pessoas escrevem ----------

const DIAS: Record<string, DiaDaSemana> = {
  dom: 0,
  domingo: 0,
  seg: 1,
  segunda: 1,
  'segunda-feira': 1,
  ter: 2,
  terca: 2,
  'terca-feira': 2,
  qua: 3,
  quarta: 3,
  'quarta-feira': 3,
  qui: 4,
  quinta: 4,
  'quinta-feira': 4,
  sex: 5,
  sexta: 5,
  'sexta-feira': 5,
  sab: 6,
  sabado: 6,
}

export function lerDiaDaSemana(texto: string): DiaDaSemana | null {
  const t = normalizar(texto).replace(/\./g, '').replace(/\s+/g, ' ').trim()
  if (t in DIAS) return DIAS[t] ?? null
  // "2a", "3ª feira", "2a feira"
  const m = /^([2-7])\s*[aª]?\s*(feira)?$/.exec(t)
  if (m) return (Number(m[1]) - 1) as DiaDaSemana
  return null
}

/** "7h", "7h30", "07:00", "7:30", "19", "7 h" -> 'HH:MM'. */
export function lerHora(texto: string): Hora | null {
  const t = texto.trim().toLowerCase().replace(/\s+/g, '')
  const m = /^(\d{1,2})(?:[h:](\d{2})?)?(?:h|hs|s|min)?$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  const hora = horaDe(h * 60 + min)
  return ehHoraValida(hora) ? hora : null
}

// uma hora como as pessoas escrevem: "7h", "7 h", "7h30", "19hs", "07:00", "07:00h"
const HORA_ESCRITA = String.raw`(?:\d{1,2}\s*h(?:s|\d{2}(?:min)?)?|\d{1,2}:\d{2}h?)`

export interface HorarioLido {
  dia: DiaDaSemana
  inicio: Hora
  /** como estava escrito, para a mensagem de erro */
  texto: string
}

/**
 * "seg 7h, qua 7h", "segunda 07:00; quarta 07:00", "seg e qua 7h", "seg/qua 7h", "ter 18h30",
 * "seg às 18h", "Seg 8h / Qua 8h", "ter 18:00-18:50". Devolve null para o pedaço que não deu
 * para entender.
 */
export function lerTurmas(texto: string): (HorarioLido | null)[] {
  const pedacos = texto
    // "seg 7h às 7h50", "ter 18:00-18:50": com começo e fim, vale o começo
    .replace(new RegExp(`(${HORA_ESCRITA})\\s*(?:-|\u2013|a|às|as|até)\\s*(?:${HORA_ESCRITA})`, 'gi'), '$1')
    // "seg 7h e qua 7h", "seg 8h / qua 8h": o que vem depois de uma hora separa horários, como a vírgula
    .replace(new RegExp(`(${HORA_ESCRITA})\\s*(?:\\s[eE]\\s|[/+&|]|\\s-\\s)\\s*`, 'g'), '$1, ')
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const saida: (HorarioLido | null)[] = []
  for (const pedaco of pedacos) {
    const palavras = pedaco
      // "seg às 7h", "quarta a partir das 18h", "ter - 18h": as palavras entre o dia e a hora saem
      .replace(/(^|\s)(?:a partir d[ae]s?|às|as|das|-)(?=\s)/gi, '$1')
      // "qui 7 h": a hora com o h separado
      .replace(/(\d)\s+(hs?)$/i, '$1$2')
      .split(/\s+/)
    const ultima = palavras[palavras.length - 1] ?? ''
    const inicio = lerHora(ultima)
    const diasTexto = palavras.slice(0, -1).join(' ')
    const dias = diasTexto
      .split(/\s*(?:\/|\+|&|\be\b)\s*/i)
      .map((d) => d.trim())
      .filter(Boolean)
      .map(lerDiaDaSemana)
    if (inicio === null || dias.length === 0 || dias.some((d) => d === null)) {
      saida.push(null)
      continue
    }
    for (const dia of dias) if (dia !== null) saida.push({ dia, inicio, texto: pedaco })
  }
  return saida
}

const POR_EXTENSO: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 }

/** "2", "2x", "2 vezes", "2x por semana", "2x semana", "3 aulas/semana", "duas" -> 2 (o texto inteiro, para "280" não virar 2) */
export function lerVezes(texto: string): number | null {
  const t = normalizar(texto).replace(/\s+/g, ' ')
  const m = /^(\d|um|uma|dois|duas|tres|quatro|cinco|seis) ?(x|vez|vezes|aula|aulas)? ?(\/ ?semana|\/ ?sem|por semana|na semana|semana|semanais|semanal)?$/.exec(t)
  if (!m?.[1]) return null
  const n = /\d/.test(m[1]) ? Number(m[1]) : (POR_EXTENSO[m[1]] ?? 0)
  return n >= 1 && n <= 6 ? n : null
}

/**
 * As vezes por semana no meio de um texto maior, como os estúdios escrevem o plano: "Mensal 2x",
 * "Trimestral - 3 vezes". Só na leitura da linha; reconhecer a coluna pelo conteúdo usa lerVezes,
 * que pede o texto inteiro.
 */
export function lerVezesNoMeio(texto: string): number | null {
  const m = /(?:^|[^\d])([1-6]) ?(?:x|vez|vezes)\b/.exec(normalizar(texto))
  return m?.[1] ? Number(m[1]) : null
}

const FORMAS_ESCRITAS: Record<string, FormaPagamento> = {
  pix: 'pix',
  credito: 'cartao_credito',
  'cartao de credito': 'cartao_credito',
  'cartao credito': 'cartao_credito',
  cartao: 'cartao_credito',
  cc: 'cartao_credito',
  debito: 'cartao_debito',
  'cartao de debito': 'cartao_debito',
  'cartao debito': 'cartao_debito',
  dinheiro: 'dinheiro',
  especie: 'dinheiro',
  'em especie': 'dinheiro',
  transferencia: 'transferencia',
  ted: 'transferencia',
  doc: 'transferencia',
  deposito: 'transferencia',
  gympass: 'gympass',
  wellhub: 'gympass',
  totalpass: 'totalpass',
  'total pass': 'totalpass',
  outro: 'outro',
  outros: 'outro',
}

export function lerForma(texto: string): FormaPagamento | null {
  const t = normalizar(texto).replace(/\s+/g, ' ')
  if (!t) return null
  if (t in FORMAS_ESCRITAS) return FORMAS_ESCRITAS[t] ?? null
  for (const f of FORMAS) if (normalizar(NOME_DA_FORMA[f]) === t) return f
  return null
}

/** "10/03/2026", "2026-03-10", "10/3/26" -> 'AAAA-MM-DD' */
export function lerData(texto: string): DataISO | null {
  const t = texto.trim()
  if (ehDataValida(t)) return t
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t)
  if (!m) return null
  const ano = m[3]?.length === 2 ? `20${m[3]}` : (m[3] ?? '')
  const data = `${ano}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`
  return ehDataValida(data) ? data : null
}

// ---------- alunos: conferir linha a linha ----------

export interface ContextoDaImportacao {
  unidades: readonly Unidade[]
  turmas: readonly Turma[]
  alunos: readonly Aluno[]
  hoje: DataISO
  /** unidade de quem não tem a coluna (com uma unidade só, ela) */
  unidadePadrao: Id
}

export interface AlunoLido {
  /** linha na planilha (1 = primeira linha de dados) */
  linha: number
  rascunho: RascunhoAluno
  /** mensalidade, forma e vencimento; null = sem valor na planilha (fica para a ficha) */
  plano: RascunhoPlano | null
  /** como as turmas foram escritas ("seg 7h, qua 7h") */
  turmasTexto: string
  /** as turmas encontradas para os horários escritos */
  turmaIds: Id[]
  /** repetido (telefone ou nome) com alguém que já existe ou com outra linha, e a pessoa confirmou que é outra pessoa */
  mesmoAssim: boolean
  erros: Partial<Record<CampoDeAluno, string>>
  avisos: string[]
}

export interface ResultadoDaImportacao {
  lidos: AlunoLido[]
  validos: AlunoLido[]
  comErro: AlunoLido[]
  /** os cadastros, o financeiro e as turmas (com os fixos novos) prontos para gravar */
  gravacao: { alunos: Aluno[]; financeiro: FinanceiroDoAluno[]; turmas: Turma[] }
}

function unidadePorNome(nome: string, unidades: readonly Unidade[]): Unidade | undefined {
  const n = normalizar(nome)
  return unidades.find((u) => u.ativa && normalizar(u.nome) === n) ?? unidades.find((u) => u.ativa && normalizar(u.nome).startsWith(n))
}

/** Lê uma linha da planilha como um aluno, com o que der para entender; o que faltar vira erro na conferência. */
export function lerLinhaDeAluno(celulas: readonly string[], colunas: readonly (CampoDeAluno | 'ignorar')[], linha: number, ctx: ContextoDaImportacao): AlunoLido {
  const v = (campo: CampoDeAluno) => valorDe(celulas, colunas, campo)
  const erros: AlunoLido['erros'] = {}
  const avisos: string[] = []
  const unidadeTexto = v('unidade')
  const unidade = unidadeTexto ? unidadePorNome(unidadeTexto, ctx.unidades) : ctx.unidades.find((u) => u.id === ctx.unidadePadrao)
  if (unidadeTexto && !unidade) erros.unidade = `Não existe a unidade "${unidadeTexto}".`
  const vezesTexto = v('vezesPorSemana')
  const vezes = vezesTexto ? (lerVezes(vezesTexto) ?? lerVezesNoMeio(vezesTexto)) : null
  const turmasTexto = v('turmas')
  const horarios = turmasTexto ? lerTurmas(turmasTexto) : []
  const desdeTexto = v('desde')
  const desde = desdeTexto ? lerData(desdeTexto) : ctx.hoje
  if (desdeTexto && desde === null) erros.desde = `Não entendi a data "${desdeTexto}": use dia/mês/ano.`
  const valorTexto = v('valorMensal')
  const formaTexto = v('formaPreferida')
  const forma = formaTexto ? lerForma(formaTexto) : 'pix'
  if (formaTexto && forma === null) erros.formaPreferida = `Não entendi a forma "${formaTexto}": use Pix, cartão de crédito, cartão de débito, dinheiro, transferência, Gympass ou TotalPass.`
  const rascunho: RascunhoAluno = {
    nome: v('nome'),
    telefone: v('telefone'),
    email: v('email'),
    unidadeId: unidade?.id ?? '',
    vezesPorSemana: vezes ?? (horarios.filter(Boolean).length || 2),
    observacao: v('observacao'),
    desde: desde ?? ctx.hoje,
  }
  if (!vezesTexto && horarios.length === 0) avisos.push('Sem o plano na planilha: ficou 2x por semana.')
  // um plano que não diz as vezes ("Mensal") não segura a linha: fica o número de turmas (ou 2),
  // e a pessoa vê o aviso e muda na correção ou depois, na ficha
  if (vezesTexto && vezes === null) avisos.push(`Não entendi o plano "${vezesTexto}": ficou ${rascunho.vezesPorSemana}x por semana.`)
  const plano: RascunhoPlano | null = valorTexto ? { valorMensal: valorTexto, formaPreferida: forma ?? 'pix', diaVencimento: 10 } : null
  if (!valorTexto) avisos.push('Sem mensalidade na planilha: preencha depois, na ficha.')
  return { linha, rascunho, plano, turmasTexto, turmaIds: [], mesmoAssim: false, erros, avisos }
}

/** Qual turma recebe quem escreveu "seg 7h": da unidade do aluno, ativa, naquele dia e hora; com mais de uma, a que tem lugar. */
function turmaDoHorario(h: HorarioLido, unidadeId: Id, turmas: readonly Turma[], reservados: (t: Turma) => number): Turma | undefined {
  const candidatas = turmas.filter((t) => t.ativa && t.unidadeId === unidadeId && t.diaDaSemana === h.dia && t.inicio === h.inicio)
  return candidatas.find((t) => reservados(t) < t.capacidade) ?? candidatas[0]
}

/**
 * Confere todos os alunos lidos com as regras do cadastro e simula a entrada nas turmas, na
 * ordem da planilha (a turma vai enchendo). Linha com erro fica de fora da gravação.
 */
export function conferirImportacao(lidos: readonly AlunoLido[], ctx: ContextoDaImportacao, idNovo: (prefixo: string) => Id): ResultadoDaImportacao {
  const turmasAgora = new Map(ctx.turmas.map((t) => [t.id, t]))
  const alunosAgora: Aluno[] = [...ctx.alunos]
  const situacaoDe = (id: Id) => alunosAgora.find((a) => a.id === id)?.situacao
  const alunosNovos: Aluno[] = []
  const financeiroNovo: FinanceiroDoAluno[] = []
  const turmasMudadas = new Set<Id>()
  const vistos = new Map<string, number>()
  const saida: AlunoLido[] = []

  for (const lido of lidos) {
    const r = lido.rascunho
    // o que a leitura já apontou vale mais que a regra genérica do cadastro
    const { unidadeId: semUnidade, ...doCadastro } = validarAluno(r, { unidades: ctx.unidades, turmas: [...turmasAgora.values()], hoje: ctx.hoje })
    const erros: AlunoLido['erros'] = { ...doCadastro, ...lido.erros }
    if (lido.plano) Object.assign(erros, validarPlano(lido.plano))
    if (semUnidade && !erros.unidade) erros.unidade = ctx.unidades.filter((u) => u.ativa).length > 1 ? 'Escreva a unidade do aluno (ou escolha uma acima).' : 'Escolha a unidade.'

    // repetidos: com quem já existe e com as linhas de cima (família que divide o número confirma na correção)
    const telefone = normalizarTelefone(r.telefone)
    const nome = normalizar(r.nome)
    if (!lido.mesmoAssim && !erros.nome) {
      const existente = ctx.alunos.find((a) => a.situacao !== 'inativo' && ((telefone && a.telefone === telefone) || (nome && normalizar(a.nome) === nome)))
      const repetida = (telefone && vistos.get(`t:${telefone}`)) || (nome && vistos.get(`n:${nome}`))
      if (existente) erros.nome = `${existente.nome} já está cadastrado com este ${telefone && existente.telefone === telefone ? 'WhatsApp' : 'nome'}.`
      else if (repetida) erros.nome = `Repetido: a mesma pessoa está na linha ${repetida}.`
    }

    // turmas: cada horário escrito precisa de uma turma da unidade
    const turmaIds: Id[] = []
    if (lido.turmasTexto && r.unidadeId && !erros.unidade) {
      for (const h of lerTurmas(lido.turmasTexto)) {
        if (h === null) {
          erros.turmas ??= 'Não entendi um dos horários: escreva como "seg 7h, qua 7h".'
          continue
        }
        const turma = turmaDoHorario(h, r.unidadeId, [...turmasAgora.values()], (t) => t.alunosFixos.filter((id) => situacaoDe(id) !== 'inativo').length)
        if (!turma) erros.turmas ??= `Não existe turma de ${NOME_DO_DIA[h.dia].toLowerCase()} às ${horaFalada(h.inicio)} nesta unidade.`
        else if (!turmaIds.includes(turma.id)) turmaIds.push(turma.id)
      }
    }

    if (Object.keys(erros).length === 0) {
      // simula a entrada nas turmas, que vão enchendo com as linhas de cima
      const aluno = montarAluno(r, idNovo('a'))
      const propostas = new Map(turmasAgora)
      for (const turmaId of turmaIds) {
        const t = propostas.get(turmaId)
        if (!t) continue
        const feito = colocarNaTurma(t, aluno, [...propostas.values()], situacaoDe, ctx.hoje)
        if (!feito.ok) {
          erros.turmas = feito.mensagem
          break
        }
        propostas.set(turmaId, feito.valor)
      }
      if (!erros.turmas) {
        for (const [k, t] of propostas) {
          if (t !== turmasAgora.get(k)) {
            turmasAgora.set(k, t)
            turmasMudadas.add(k)
          }
        }
        alunosNovos.push(aluno)
        alunosAgora.push(aluno)
        if (lido.plano) financeiroNovo.push(montarFinanceiro(lido.plano, aluno))
        if (telefone) vistos.set(`t:${telefone}`, lido.linha)
        if (nome) vistos.set(`n:${nome}`, lido.linha)
      }
    }
    saida.push({ ...lido, turmaIds, erros })
  }

  const validos = saida.filter((l) => Object.keys(l.erros).length === 0)
  return {
    lidos: saida,
    validos,
    comErro: saida.filter((l) => Object.keys(l.erros).length > 0),
    gravacao: {
      alunos: alunosNovos,
      financeiro: financeiroNovo,
      turmas: [...turmasMudadas].map((id) => turmasAgora.get(id)).filter((t): t is Turma => t !== undefined),
    },
  }
}

/** Lê a planilha inteira como alunos (sem conferir: ver conferirImportacao). */
export function lerAlunos(linhas: readonly string[][], mapa: Mapeamento<CampoDeAluno>, ctx: ContextoDaImportacao): AlunoLido[] {
  const dados = mapa.comCabecalho ? linhas.slice(1) : linhas
  return dados.map((celulas, i) => lerLinhaDeAluno(celulas, mapa.colunas, i + 1, ctx))
}

/** Quantos alunos cabem numa gravação só (uma transação do Firestore tem teto de escritas). */
export const ALUNOS_POR_LOTE = 60

/** Parte a gravação em lotes: alunos, o financeiro deles e as turmas que eles tocam. */
export function lotesDaImportacao(g: ResultadoDaImportacao['gravacao'], tamanho = ALUNOS_POR_LOTE): ResultadoDaImportacao['gravacao'][] {
  const lotes: ResultadoDaImportacao['gravacao'][] = []
  const turmas = new Map(g.turmas.map((t) => [t.id, t]))
  for (let i = 0; i < g.alunos.length; i += tamanho) {
    const alunos = g.alunos.slice(i, i + tamanho)
    const ids = new Set(alunos.map((a) => a.id))
    const todosAteAqui = new Set(g.alunos.slice(0, i + tamanho).map((a) => a.id))
    lotes.push({
      alunos,
      financeiro: g.financeiro.filter((f) => ids.has(f.alunoId)),
      // a turma vai com os fixos até este lote (os dos lotes seguintes entram depois)
      turmas: [...turmas.values()]
        .filter((t) => t.alunosFixos.some((id) => ids.has(id)))
        .map((t) => {
          const fixosDesde = { ...t.fixosDesde }
          for (const id of Object.keys(fixosDesde)) if (g.alunos.some((a) => a.id === id) && !todosAteAqui.has(id)) delete fixosDesde[id]
          return { ...t, alunosFixos: t.alunosFixos.filter((id) => !g.alunos.some((a) => a.id === id) || todosAteAqui.has(id)), fixosDesde }
        }),
    })
  }
  return lotes
}

// ---------- turmas ----------

export interface TurmaLida {
  linha: number
  rascunho: RascunhoTurma
  /** como o professor e a unidade estavam escritos */
  professorTexto: string
  unidadeTexto: string
  erros: Partial<Record<CampoDeTurma, string>>
}

export interface ContextoDeTurmas {
  unidades: readonly Unidade[]
  turmas: readonly Turma[]
  equipe: readonly MembroEquipe[]
  hoje: DataISO
  unidadePadrao: Id
  capacidadePadrao: number
}

function professorPorNome(nome: string, equipe: readonly MembroEquipe[], unidadeId: Id): MembroEquipe | undefined {
  const n = normalizar(nome)
  const quem = quemPodeDarAula(equipe, unidadeId)
  return quem.find((m) => normalizar(m.nome) === n) ?? quem.find((m) => normalizar(primeiroNome(m.nome)) === n) ?? quem.find((m) => normalizar(m.nome).startsWith(n))
}

export function lerLinhaDeTurma(celulas: readonly string[], colunas: readonly (CampoDeTurma | 'ignorar')[], linha: number, ctx: ContextoDeTurmas): TurmaLida {
  const v = (campo: CampoDeTurma) => valorDe(celulas, colunas, campo)
  const erros: TurmaLida['erros'] = {}
  const unidadeTexto = v('unidade')
  const unidade = unidadeTexto ? unidadePorNome(unidadeTexto, ctx.unidades) : ctx.unidades.find((u) => u.id === ctx.unidadePadrao)
  if (unidadeTexto && !unidade) erros.unidade = `Não existe a unidade "${unidadeTexto}".`
  const dia = lerDiaDaSemana(v('dia'))
  if (dia === null) erros.dia = `Não entendi o dia "${v('dia')}": escreva seg, ter, qua, qui, sex, sáb ou dom.`
  const inicio = lerHora(v('inicio'))
  if (inicio === null) erros.inicio = `Não entendi o horário "${v('inicio')}": escreva 7h, 7h30 ou 07:00.`
  const duracaoTexto = v('duracaoMin')
  const duracao = duracaoTexto ? Number(duracaoTexto.replace(/\D/g, '')) : 50
  const capacidadeTexto = v('capacidade')
  const capacidade = capacidadeTexto ? Number(capacidadeTexto.replace(/\D/g, '')) : ctx.capacidadePadrao
  const professorTexto = v('professor')
  const professor = unidade && professorTexto ? professorPorNome(professorTexto, ctx.equipe, unidade.id) : undefined
  if (professorTexto && !professor) erros.professor = `Não achei "${professorTexto}" na equipe${unidade ? ` de ${unidade.nome}` : ''}. Convide a pessoa antes, em Mais, Equipe.`
  if (!professorTexto) erros.professor = 'Escreva quem dá a aula.'
  return {
    linha,
    rascunho: {
      unidadeId: unidade?.id ?? '',
      diaDaSemana: dia ?? 1,
      inicio: inicio ?? '07:00',
      duracaoMin: duracao,
      capacidade,
      professorId: professor?.id ?? '',
    },
    professorTexto,
    unidadeTexto,
    erros,
  }
}

export interface ResultadoDeTurmas {
  lidas: TurmaLida[]
  validas: TurmaLida[]
  comErro: TurmaLida[]
  turmas: Turma[]
}

/** Confere cada turma lida (horário, lugares, professor sem choque) contra as turmas que já existem e as linhas de cima. */
export function conferirTurmas(lidas: readonly TurmaLida[], ctx: ContextoDeTurmas, idNovo: (prefixo: string) => Id): ResultadoDeTurmas {
  const turmasAgora: Turma[] = [...ctx.turmas]
  const novas: Turma[] = []
  const saida: TurmaLida[] = []
  for (const lida of lidas) {
    const erros: TurmaLida['erros'] = { ...lida.erros }
    const r = lida.rascunho
    const v = validarTurma(r, { turmas: turmasAgora, equipe: ctx.equipe, unidades: ctx.unidades })
    if (v.inicio && !erros.inicio) erros.inicio = v.inicio
    if (v.duracaoMin) erros.duracaoMin = v.duracaoMin
    if (v.capacidade) erros.capacidade = v.capacidade
    if (v.professorId && !erros.professor) erros.professor = v.professorId
    if (v.unidadeId && !erros.unidade) erros.unidade = v.unidadeId
    // a mesma turma duas vezes (mesmo dia, hora, unidade e professor) é repetição, não choque
    const igual = turmasAgora.find((t) => t.ativa && t.unidadeId === r.unidadeId && t.diaDaSemana === r.diaDaSemana && t.inicio === r.inicio && t.professorId === r.professorId)
    if (igual) erros.inicio = `Já existe a turma de ${nomeDaTurma(igual).toLowerCase()} com esta pessoa.`
    if (Object.keys(erros).length === 0) {
      const t = novaTurma(r, idNovo('t'), ctx.hoje)
      novas.push(t)
      turmasAgora.push(t)
    }
    saida.push({ ...lida, erros })
  }
  return { lidas: saida, validas: saida.filter((l) => Object.keys(l.erros).length === 0), comErro: saida.filter((l) => Object.keys(l.erros).length > 0), turmas: novas }
}

export function lerTurmasDaPlanilha(linhas: readonly string[][], mapa: Mapeamento<CampoDeTurma>, ctx: ContextoDeTurmas): TurmaLida[] {
  const dados = mapa.comCabecalho ? linhas.slice(1) : linhas
  return dados.map((celulas, i) => lerLinhaDeTurma(celulas, mapa.colunas, i + 1, ctx))
}

// ---------- modelos vazios para preencher ----------

function csv(linhas: readonly (readonly string[])[]): string {
  // ponto e vírgula e a marca de ordem de bytes: o Excel em português abre direto, com acentos
  const celula = (c: string) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
  return `\uFEFF${linhas.map((l) => l.map(celula).join(';')).join('\r\n')}\r\n`
}

// Só o cabeçalho: uma linha de exemplo esquecida na planilha viraria um aluno de mentira. Como
// escrever cada coluna fica na tela de importar (COMO_PREENCHER).
export const CABECALHO_DE_ALUNOS = ['Nome', 'WhatsApp', 'E-mail', 'Vezes por semana', 'Turmas', 'Mensalidade', 'Forma de pagamento', 'Observação'] as const
export const CABECALHO_DE_TURMAS = ['Dia', 'Horário', 'Duração', 'Lugares', 'Professor', 'Unidade'] as const

/** Planilha de alunos em branco, só com o cabeçalho que a importação reconhece. */
export function modeloDeAlunos(): string {
  return csv([[...CABECALHO_DE_ALUNOS]])
}

/** Planilha de turmas em branco: uma linha por turma (uma turma por dia da semana). */
export function modeloDeTurmas(): string {
  return csv([[...CABECALHO_DE_TURMAS]])
}

/** Como escrever cada coluna, para a tela de importar. */
export const COMO_PREENCHER: Record<'alunos' | 'turmas', readonly [string, string][]> = {
  alunos: [
    ['Nome', 'nome e sobrenome'],
    ['WhatsApp', 'com DDD, por exemplo (19) 90000-0000'],
    ['E-mail', 'opcional; é por ele que o aluno entra no app'],
    ['Vezes por semana', '2, 2x ou 2 vezes'],
    ['Turmas', 'dia e hora, por exemplo seg 7h, qua 7h ou seg e qua às 18h (a turma precisa existir); os dias e a hora também podem vir em duas colunas'],
    ['Mensalidade', 'em reais, por exemplo 280 ou 280,00'],
    ['Forma de pagamento', 'Pix, cartão de crédito, cartão de débito, dinheiro, transferência, Gympass ou TotalPass'],
    ['Observação', 'opcional, só a equipe vê'],
  ],
  turmas: [
    ['Dia', 'seg, ter, qua, qui, sex, sáb ou dom (uma linha por dia)'],
    ['Horário', '7h, 7h30 ou 07:00'],
    ['Duração', 'em minutos; sem nada, 50'],
    ['Lugares', 'quantos alunos cabem; sem nada, o padrão do estúdio'],
    ['Professor', 'o nome de quem dá a aula, como está na equipe'],
    ['Unidade', 'só com mais de uma unidade'],
  ],
}

/** Só para a tela: "seg 7h" a partir da turma. */
export function textoDaTurma(t: Pick<Turma, 'diaDaSemana' | 'inicio'>): string {
  return `${NOME_DO_DIA[t.diaDaSemana].slice(0, 3).toLowerCase()} ${horaFalada(t.inicio)}`
}

/** Minutos de uma hora escrita de qualquer jeito (para ordenar na tela). */
export function minutosDaHoraEscrita(texto: string): number {
  const h = lerHora(texto)
  return h ? minutosDe(h) : 0
}
