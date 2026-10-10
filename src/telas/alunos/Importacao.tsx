// Importar alunos (e turmas) de uma planilha: colar o texto ou escolher um .csv, ver a prévia
// linha a linha com os erros, corrigir ali mesmo e gravar em lote. A lógica mora em
// src/dominio/importacao.ts; aqui é só a tela.
import { Fragment } from 'preact'
import type { ComponentChildren, JSX } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { baixarArquivo } from '../../app/baixar'
import { voltar } from '../../app/navegacao'
import { pode } from '../../app/perfil'
import { hoje } from '../../app/relogio'
import { AreaDeTexto } from '../../componentes/AreaDeTexto'
import { avisar } from '../../componentes/Avisos'
import { Botao } from '../../componentes/Botao'
import { CabecalhoDeSubtela } from '../../componentes/CabecalhoDeSubtela'
import { Campo } from '../../componentes/Campo'
import { Contador } from '../../componentes/Contador'
import { useEmPartes } from '../../componentes/emPartes'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { Icone } from '../../componentes/Icone'
import { Interruptor } from '../../componentes/Interruptor'
import { Chip, Pilula } from '../../componentes/Pilula'
import { Seletor } from '../../componentes/Seletor'
import { base, repositorio, unidades } from '../../dados/estado'
import { desfazerImportacao, idNovo, importarAlunos, importarTurmas } from '../../dados/gestao'
import { quemPodeDarAula } from '../../dominio/equipe'
import {
  CAMPOS_DE_ALUNO,
  CAMPOS_DE_TURMA,
  COMO_PREENCHER,
  conferirImportacao,
  conferirTurmas,
  juntarDiasEHorario,
  lerAlunos,
  lerTabela,
  lerTurmasDaPlanilha,
  lotesDaImportacao,
  mapearColunasDeAlunos,
  mapearColunasDeTurmas,
  modeloDeAlunos,
  modeloDeTurmas,
  NOME_DO_CAMPO,
  textoDaTurma,
} from '../../dominio/importacao'
import type { AlunoLido, Campo as CampoDaPlanilha, CampoDeAluno, CampoDeTurma, Mapeamento, TurmaLida } from '../../dominio/importacao'
import { FORMAS, NOME_DA_FORMA } from '../../dominio/pagamentos'
import { NOME_DO_PAPEL } from '../../dominio/permissoes'
import { plural, primeiroNome, telefoneLegivel } from '../../dominio/texto'
import type { DiaDaSemana, FormaPagamento, Id } from '../../dominio/tipos'
import { DIAS_DA_GRADE, NOME_DO_DIA, nomeDaTurma } from '../../dominio/turmas'
import type { RascunhoTurma } from '../../dominio/turmas'
import { SemAcesso } from '../mais/SemAcesso'

type Etapa = 'colar' | 'previa' | 'feito'

/** Um .csv do Excel em português costuma vir em Windows-1252: tenta UTF-8 e cai para ele. */
async function lerArquivo(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Escolha de unidade em pílulas (só aparece com mais de uma unidade aberta). */
function EscolhaDeUnidade({ rotulo, valor, aoMudar, erro }: { rotulo: string; valor: Id; aoMudar: (id: Id) => void; erro?: string | undefined }) {
  if (unidades.value.length < 2) return null
  return (
    <fieldset class="grupo">
      <legend class="campo-rotulo">{rotulo}</legend>
      <div class="chips" role="radiogroup" aria-label={rotulo}>
        {unidades.value.map((u) => (
          <Chip key={u.id} papel="radio" ativo={valor === u.id} aoTocar={() => aoMudar(u.id)}>
            {u.nome}
          </Chip>
        ))}
      </div>
      {erro && <p class="campo-erro">{erro}</p>}
    </fieldset>
  )
}

/** Colar o texto, escolher o arquivo ou baixar o modelo: a primeira tela das duas importações. */
function Entrada({
  texto,
  aoMudar,
  aoConferir,
  modelo,
  como,
  oQue,
}: {
  texto: string
  aoMudar: (t: string) => void
  aoConferir: () => void
  modelo: { nome: string; conteudo: () => string }
  como: readonly [string, string][]
  oQue: string
}) {
  const [lendo, setLendo] = useState(false)
  const [comoAberto, setComoAberto] = useState(false)
  const escolherArquivo = async (e: Event) => {
    const entrada = e.currentTarget as HTMLInputElement
    const arquivo = entrada.files?.[0]
    entrada.value = ''
    if (!arquivo) return
    setLendo(true)
    try {
      aoMudar(await lerArquivo(arquivo))
      avisar({ texto: `Arquivo ${arquivo.name} lido. Toque em Conferir.`, icone: 'arquivo' })
    } catch {
      avisar({ texto: 'Não deu para ler o arquivo. Tente copiar as linhas da planilha e colar aqui.', icone: 'info' })
    } finally {
      setLendo(false)
    }
  }
  return (
    <div class="pilha formulario">
      <p class="texto-secundario">
        Na planilha, selecione as linhas ({oQue}), copie e cole aqui. Pode vir com o cabeçalho ou sem: as colunas são reconhecidas
        pelo nome ou pelo que têm dentro, e na prévia você confere tudo antes de gravar.
      </p>
      <AreaDeTexto rotulo="Cole aqui as linhas da planilha" valor={texto} aoMudar={aoMudar} linhas={6} />
      {/* logo abaixo do campo: com o teclado aberto no celular, o botão fica à vista depois de colar */}
      <Botao variante="primario" icone="busca" largo disabled={!texto.trim()} onClick={aoConferir}>
        Conferir
      </Botao>
      {/* o campo de arquivo cobre o botão inteiro (transparente): o toque cai nele, com 48 px ou mais */}
      <label class="botao botao--secundario botao--largo tocavel botao-arquivo">
        <Icone nome="arquivo" tamanho={20} />
        <span>{lendo ? 'Lendo...' : 'Escolher arquivo .csv'}</span>
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          aria-label="Escolher arquivo .csv"
          onChange={(e) => void escolherArquivo(e)}
        />
      </label>
      <Botao variante="secundario" icone="baixar" largo onClick={() => baixarArquivo(modelo.nome, modelo.conteudo(), 'text/csv;charset=utf-8')}>
        Baixar o modelo em branco
      </Botao>
      <Botao variante="terciario" icone={comoAberto ? 'menos' : 'info'} class="botao--alinhado" onClick={() => setComoAberto(!comoAberto)} aria-expanded={comoAberto}>
        Como escrever cada coluna
      </Botao>
      {comoAberto && (
        <dl class="dados">
          {como.map(([coluna, explicacao]) => (
            <div key={coluna}>
              <dt>{coluna}</dt>
              <dd>{explicacao}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** De qual campo é cada coluna, para quando o nome não foi reconhecido (ou a pessoa quer trocar). */
function Colunas<C extends CampoDaPlanilha>({
  linhas,
  mapa,
  campos,
  aoMudar,
}: {
  linhas: readonly string[][]
  mapa: Mapeamento<Exclude<C, 'ignorar'>>
  campos: readonly Exclude<C, 'ignorar'>[]
  aoMudar: (m: Mapeamento<Exclude<C, 'ignorar'>>) => void
}) {
  const [aberto, setAberto] = useState(mapa.naoReconhecidas.length > 0)
  const primeira = linhas[0] ?? []
  const amostra = linhas[mapa.comCabecalho ? 1 : 0] ?? []
  const nomeDaColuna = (i: number) => (mapa.comCabecalho && primeira[i] ? `"${primeira[i]}"` : `a coluna ${i + 1} (${amostra[i] ?? ''})`)
  const resumo = mapa.colunas
    .map((c) => (c === 'ignorar' ? '' : NOME_DO_CAMPO[c]))
    .filter(Boolean)
    .join(', ')
  return (
    <section class="secao" aria-label="Colunas">
      {mapa.naoReconhecidas.length > 0 && (
        <p class="nota-alerta">
          <Icone nome="alerta" tamanho={20} />
          <span>
            Não reconheci {mapa.naoReconhecidas.map(nomeDaColuna).join(', ')}. Diga abaixo o que é, ou deixe em "Ignorar esta coluna".
          </span>
        </p>
      )}
      <Botao variante="terciario" icone={aberto ? 'menos' : 'editar'} class="botao--alinhado botao--texto-longo" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? 'Fechar as colunas' : `Colunas: ${resumo || 'nenhuma reconhecida'}`}
      </Botao>
      {aberto && (
        <div class="pilha formulario">
          <Interruptor
            rotulo="A primeira linha é o cabeçalho"
            ligado={mapa.comCabecalho}
            aoMudar={(v) => aoMudar({ ...mapa, comCabecalho: v })}
            ajuda={`Primeira linha: ${primeira.slice(0, 3).join(', ')}${primeira.length > 3 ? '...' : ''}`}
          />
          {mapa.colunas.map((c, i) => (
            <Seletor
              key={i}
              rotulo={`Coluna ${i + 1}${mapa.comCabecalho && primeira[i] ? `: ${primeira[i]}` : ''}`}
              valor={c}
              aoMudar={(v) => {
                // um campo vale para uma coluna só: a que tinha ele antes fica ignorada
                const colunas = mapa.colunas.map((atual, j) => (j === i ? (v as Exclude<C, 'ignorar'> | 'ignorar') : atual === v ? 'ignorar' : atual))
                aoMudar({ ...mapa, colunas, naoReconhecidas: mapa.naoReconhecidas.filter((n) => n !== i) })
              }}
              opcoes={[{ valor: 'ignorar', rotulo: NOME_DO_CAMPO.ignorar }, ...campos.map((campo) => ({ valor: campo, rotulo: NOME_DO_CAMPO[campo] }))]}
              ajuda={amostra[i] ? `Exemplo: ${amostra[i]}` : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** Primeiro as linhas com erro (é o que a pessoa precisa olhar), depois as prontas, cada grupo na ordem da planilha. */
function errosPrimeiro<T extends { linha: number; erros: object }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => Number(Object.keys(b.erros).length > 0) - Number(Object.keys(a.erros).length > 0) || a.linha - b.linha)
}

function NotaDaPrevia({ children }: { children: ComponentChildren }) {
  return (
    <p class="chamada-nota">
      <Icone nome="info" tamanho={20} />
      <span>{children}</span>
    </p>
  )
}

// ---------- alunos ----------

const PLANOS = [1, 2, 3, 4, 5]

interface FeitoDaImportacao {
  ids: Id[]
  comTurma: number
  semMensalidade: number
  deFora: AlunoLido[]
  /** as linhas da planilha que entraram (para corrigir só as que ficaram de fora) */
  linhasQueEntraram: number[]
}

/**
 * Importar alunos. `previa`: confere e mostra, mas não grava (o guia de primeiro uso na
 * demonstração). `embutido`: dentro do guia, sem o cabeçalho de tela e com "Continuar" no fim.
 */
export function ImportarAlunos({ embutido = false, previa = false, aoConcluir }: { embutido?: boolean; previa?: boolean; aoConcluir?: (quantos: number) => void }) {
  const [etapa, setEtapa] = useState<Etapa>('colar')
  const [texto, setTexto] = useState('')
  const [linhas, setLinhas] = useState<string[][]>([])
  const [mapa, setMapa] = useState<Mapeamento<CampoDeAluno> | null>(null)
  const [ajustes, setAjustes] = useState<Map<number, Partial<AlunoLido>>>(new Map())
  const [tirados, setTirados] = useState<Set<number>>(new Set())
  const [unidadePadrao, setUnidadePadrao] = useState<Id>(() => unidades.peek()[0]?.id ?? '')
  const [corrigindo, setCorrigindo] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [feito, setFeito] = useState<FeitoDaImportacao | null>(null)
  const b = base.value

  const ctx = useMemo(
    () => ({ unidades: b?.unidades ?? [], turmas: b?.turmas ?? [], alunos: b?.alunos ?? [], hoje: hoje.value, unidadePadrao }),
    [b, unidadePadrao],
  )
  const resultado = useMemo(() => {
    if (!mapa) return null
    const lidos = lerAlunos(linhas, mapa, ctx)
      .filter((l) => !tirados.has(l.linha))
      .map((l) => ({ ...l, ...ajustes.get(l.linha) }))
    return conferirImportacao(lidos, ctx, idNovo)
  }, [linhas, mapa, ctx, ajustes, tirados])
  const ordenados = useMemo(() => (resultado ? errosPrimeiro(resultado.lidos) : []), [resultado])
  const visiveisAgora = useEmPartes(ordenados.length, 12, 12)

  if (!pode('editar-alunos') || !b) return <SemAcesso titulo="Importar alunos" texto="Só a administração cadastra alunos." />

  const conferir = () => {
    const lidas = juntarDiasEHorario(lerTabela(texto))
    if (lidas.length === 0) return avisar({ texto: 'Não achei nenhuma linha no texto.', icone: 'info' })
    setLinhas(lidas)
    setMapa(mapearColunasDeAlunos(lidas))
    setAjustes(new Map())
    setTirados(new Set())
    setEtapa('previa')
  }

  const importar = async () => {
    if (!resultado || ocupado) return
    const comTurma = resultado.validos.filter((l) => l.turmaIds.length > 0).length
    const semMensalidade = resultado.validos.filter((l) => !l.plano).length
    const linhasQueEntraram = resultado.validos.map((l) => l.linha)
    if (previa) {
      setFeito({ ids: [], comTurma, semMensalidade, deFora: resultado.comErro, linhasQueEntraram })
      setEtapa('feito')
      return
    }
    // sem internet, a gravação esperaria numa fila que só vive enquanto o app está aberto: uma
    // planilha inteira não deve ficar nela
    if (repositorio.peek()?.modo !== 'demonstracao' && navigator.onLine === false) {
      return avisar({ texto: 'Sem internet agora. A importação precisa de conexão: tente de novo quando a internet voltar.', icone: 'info', duracao: 7000 })
    }
    setOcupado(true)
    const r = await importarAlunos(lotesDaImportacao(resultado.gravacao))
    setOcupado(false)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info', duracao: 9000 })
    setFeito({ ids: r.valor.importados, comTurma, semMensalidade, deFora: resultado.comErro, linhasQueEntraram })
    setEtapa('feito')
    avisar({ texto: `${plural(r.valor.importados.length, 'aluno importado', 'alunos importados')}.`, icone: 'presente' })
  }

  const desfazer = async () => {
    if (!feito || ocupado) return
    setOcupado(true)
    const r = await desfazerImportacao(feito.ids)
    setOcupado(false)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info', duracao: 9000 })
    const ficou = r.valor.ficaram ? ` ${plural(r.valor.ficaram, 'aluno já tinha', 'alunos já tinham')} presença ou pagamento e ${r.valor.ficaram === 1 ? 'ficou' : 'ficaram'}.` : ''
    avisar({ texto: `Importação desfeita: ${plural(r.valor.tirados, 'cadastro saiu', 'cadastros saíram')}.${ficou}`, icone: 'recomecar', duracao: 7000 })
    setFeito(null)
    setEtapa('previa')
  }

  const corrigir = (linha: number, mudanca: Partial<AlunoLido>) => {
    const atual = ajustes.get(linha) ?? {}
    setAjustes(new Map(ajustes).set(linha, { ...atual, ...mudanca }))
  }

  const emCorrecao = corrigindo !== null ? resultado?.lidos.find((l) => l.linha === corrigindo) : undefined

  let conteudo: JSX.Element
  if (etapa === 'colar') {
    conteudo = (
      <>
        <EscolhaDeUnidade rotulo="Unidade de quem não tem a coluna Unidade" valor={unidadePadrao} aoMudar={setUnidadePadrao} />
        <Entrada
          texto={texto}
          aoMudar={setTexto}
          aoConferir={conferir}
          modelo={{ nome: 'alunos-modelo.csv', conteudo: modeloDeAlunos }}
          como={COMO_PREENCHER.alunos}
          oQue="nome, WhatsApp, e-mail, vezes por semana, turmas, mensalidade, forma de pagamento, observação"
        />
      </>
    )
  } else if (etapa === 'previa' && resultado && mapa) {
    const prontos = resultado.validos.length
    const comErro = resultado.comErro.length
    conteudo = (
      <>
        <Colunas linhas={linhas} mapa={mapa} campos={CAMPOS_DE_ALUNO} aoMudar={setMapa} />
        <section class="secao" aria-labelledby="titulo-previa">
          <h2 id="titulo-previa" class="subtitulo" aria-live="polite">
            {plural(prontos, 'aluno pronto', 'alunos prontos')}
            {comErro > 0 ? `, ${plural(comErro, 'linha com erro', 'linhas com erro')}` : ''}
          </h2>
          {comErro > 0 && (
            <p class="texto-secundario">As linhas com erro vêm primeiro. Toque numa para corrigir ali mesmo ou tirar da lista; o que tiver erro fica de fora.</p>
          )}
          <ul class="lista" aria-label="Prévia da planilha">
            {ordenados.slice(0, visiveisAgora).map((l) => (
              <li key={l.linha}>
                <LinhaDeAlunoLido lido={l} aoTocar={() => setCorrigindo(l.linha)} />
              </li>
            ))}
          </ul>
        </section>
        <Botao variante="primario" icone="alunos" largo disabled={prontos === 0 || ocupado} onClick={() => void importar()}>
          {ocupado ? 'Importando...' : `Importar ${plural(prontos, 'aluno')}`}
        </Botao>
        <Botao variante="terciario" icone="voltar" largo onClick={() => setEtapa('colar')}>
          Voltar e colar de novo
        </Botao>
      </>
    )
  } else {
    const n = previa ? (resultado?.validos.length ?? 0) : (feito?.ids.length ?? 0)
    const partes = [
      previa ? `${plural(n, 'aluno entraria', 'alunos entrariam')} no cadastro` : `${plural(n, 'aluno entrou', 'alunos entraram')} no cadastro`,
      feito?.comTurma ? `${plural(feito.comTurma, 'já está', 'já estão')} nas turmas` : '',
      feito?.semMensalidade ? `${plural(feito.semMensalidade, 'está', 'estão')} sem mensalidade (preencha na ficha)` : '',
    ].filter(Boolean)
    conteudo = (
      <>
        <EstadoVazio icone="presente" rotulo={previa ? 'Prévia conferida' : 'Importação feita'} texto={`${partes.join('; ')}.`}>
          {embutido ? (
            <Botao variante="primario" icone="avancar" onClick={() => aoConcluir?.(n)}>
              Continuar
            </Botao>
          ) : (
            <Botao variante="primario" icone="alunos" onClick={voltar}>
              Ver os alunos
            </Botao>
          )}
          <Botao variante="terciario" icone="adicionar" onClick={() => setEtapa('colar')}>
            Importar mais
          </Botao>
        </EstadoVazio>
        {feito && feito.deFora.length > 0 && (
          <section class="secao" aria-labelledby="titulo-de-fora">
            <h2 id="titulo-de-fora" class="micro">
              Ficaram de fora
            </h2>
            <ul class="lista">
              {feito.deFora.map((l) => (
                <li key={l.linha} class="lista-item">
                  <span class="lista-item-texto">
                    <span class="lista-item-titulo">
                      Linha {l.linha}: {l.rascunho.nome || 'sem nome'}
                    </span>
                    <span class="campo-erro">{Object.values(l.erros)[0]}</span>
                  </span>
                </li>
              ))}
            </ul>
            {/* de volta à prévia só com o que ficou de fora: quem já entrou sai da lista */}
            <Botao
              variante="secundario"
              icone="editar"
              largo
              onClick={() => {
                setTirados(new Set([...tirados, ...feito.linhasQueEntraram]))
                setEtapa('previa')
              }}
            >
              {feito.deFora.length === 1 ? 'Corrigir a linha que ficou de fora' : `Corrigir as ${feito.deFora.length} linhas que ficaram de fora`}
            </Botao>
          </section>
        )}
        {!previa && feito && feito.ids.length > 0 && (
          <Botao variante="terciario" icone="recomecar" largo disabled={ocupado} onClick={() => void desfazer()}>
            Desfazer a importação
          </Botao>
        )}
      </>
    )
  }

  return (
    <section class={embutido ? 'pilha' : 'tela'} aria-labelledby={embutido ? undefined : 'titulo-importar'}>
      {!embutido && <CabecalhoDeSubtela voltarPara="Alunos" rotulo="Alunos" titulo="Importar de uma planilha" idTitulo="titulo-importar" />}
      {previa && etapa !== 'feito' && <NotaDaPrevia>Prévia: na demonstração dá para colar, conferir e corrigir, mas nada é gravado.</NotaDaPrevia>}
      {conteudo}
      <CorrecaoDeAluno
        lido={emCorrecao}
        aberta={corrigindo !== null}
        aoFechar={() => setCorrigindo(null)}
        aoSalvar={(mudanca) => {
          if (corrigindo !== null) corrigir(corrigindo, mudanca)
          setCorrigindo(null)
        }}
        aoTirar={() => {
          if (corrigindo !== null) setTirados(new Set(tirados).add(corrigindo))
          setCorrigindo(null)
        }}
      />
    </section>
  )
}

function LinhaDeAlunoLido({ lido, aoTocar }: { lido: AlunoLido; aoTocar: () => void }) {
  const erro = Object.values(lido.erros)[0]
  const r = lido.rascunho
  const partes = [`Linha ${lido.linha}`, r.telefone ? telefoneLegivel(r.telefone) : 'sem WhatsApp', `${r.vezesPorSemana}x`, lido.turmasTexto || 'sem turma']
  return (
    <button type="button" class="lista-item tocavel" onClick={aoTocar} data-linha={lido.linha} data-erro={erro ? 'sim' : undefined}>
      <span class={`marca-presenca ${erro ? 'marca-presenca--avisou' : 'marca-presenca--presente'}`} aria-hidden="true">
        <Icone nome={erro ? 'alerta' : 'presente'} tamanho={18} traco={2} />
      </span>
      <span class="lista-item-texto">
        <span class="lista-item-titulo">{r.nome || 'Sem nome'}</span>
        <span class="lista-item-sub">
          {partes.map((parte, i) => (
            // o pedaço não quebra no meio; entre um pedaço e outro, sim (o espaço fica fora)
            <Fragment key={i}>
              <span class="sem-quebra">{i < partes.length - 1 ? `${parte},` : parte}</span>
              {i < partes.length - 1 ? ' ' : ''}
            </Fragment>
          ))}
        </span>
        {erro ? <span class="campo-erro">{erro}</span> : lido.avisos[0] && <span class="lista-item-sub">{lido.avisos[0]}</span>}
      </span>
      <Pilula tom={erro ? 'alerta' : 'sucesso'}>{erro ? 'corrigir' : 'pronto'}</Pilula>
    </button>
  )
}

/** "Turmas desta unidade: seg 7h, qua 7h, ter 18h30", para a pessoa saber o que escrever. */
function turmasDaUnidade(unidadeId: Id): string {
  const lista = (base.peek()?.turmas ?? []).filter((t) => t.ativa && t.unidadeId === unidadeId).sort((a, c) => a.diaDaSemana - c.diaDaSemana || a.inicio.localeCompare(c.inicio))
  if (lista.length === 0) return 'Esta unidade ainda não tem turma: monte a grade antes, ou importe sem turma.'
  // um dia por vez ("seg 7h, 8h, 18h; ter 7h, 12h"): cabe a semana inteira sem cortar
  const porDia = new Map<string, string[]>()
  for (const t of lista) {
    const [dia = '', hora = ''] = textoDaTurma(t).split(' ')
    const horas = porDia.get(dia) ?? []
    if (!horas.includes(hora)) horas.push(hora)
    porDia.set(dia, horas)
  }
  return `Turmas desta unidade: ${[...porDia].map(([dia, horas]) => `${dia} ${horas.join(', ')}`).join('; ')}.`
}

/** A linha numa folha, com os campos do cadastro: corrigir o telefone, a turma, o nome. */
function CorrecaoDeAluno({
  lido,
  aberta,
  aoFechar,
  aoSalvar,
  aoTirar,
}: {
  lido: AlunoLido | undefined
  aberta: boolean
  aoFechar: () => void
  aoSalvar: (mudanca: Partial<AlunoLido>) => void
  aoTirar: () => void
}) {
  const [r, setR] = useState(lido?.rascunho)
  const [turmasTexto, setTurmasTexto] = useState(lido?.turmasTexto ?? '')
  const [valor, setValor] = useState(lido?.plano?.valorMensal ?? '')
  const [forma, setForma] = useState<FormaPagamento>(lido?.plano?.formaPreferida ?? 'pix')
  const [mesmoAssim, setMesmoAssim] = useState(lido?.mesmoAssim ?? false)
  const [ultima, setUltima] = useState<number | null>(null)
  // cada linha aberta começa com os valores dela
  if (lido && lido.linha !== ultima) {
    setUltima(lido.linha)
    setR(lido.rascunho)
    setTurmasTexto(lido.turmasTexto)
    setValor(lido.plano?.valorMensal ?? '')
    setForma(lido.plano?.formaPreferida ?? 'pix')
    setMesmoAssim(lido.mesmoAssim)
  }
  if (!lido || !r) {
    return (
      <FolhaInferior aberta={false} aoFechar={aoFechar} titulo="">
        {null}
      </FolhaInferior>
    )
  }
  const erros = lido.erros
  const repetido = Boolean(erros.nome && /já está cadastrad|Repetido/.test(erros.nome))
  const mudar = <K extends keyof typeof r>(campo: K, v: (typeof r)[K]) => setR({ ...r, [campo]: v })
  const salvar = () =>
    aoSalvar({
      rascunho: r,
      turmasTexto,
      plano: valor.trim() ? { valorMensal: valor, formaPreferida: forma, diaVencimento: lido.plano?.diaVencimento ?? 10 } : null,
      mesmoAssim,
      // o que a leitura apontou (unidade, data, forma) a pessoa corrigiu aqui: a conferência refaz
      erros: {},
    })
  return (
    <FolhaInferior
      aberta={aberta}
      aoFechar={aoFechar}
      rotulo={`Linha ${lido.linha}`}
      titulo={r.nome || 'Corrigir a linha'}
      rodape={
        <div class="linha-acoes">
          <Botao variante="perigo" onClick={aoTirar}>
            Tirar da lista
          </Botao>
          <Botao variante="primario" icone="presente" onClick={salvar}>
            Salvar correção
          </Botao>
        </div>
      }
    >
      <div class="pilha formulario">
        <Campo rotulo="Nome e sobrenome" valor={r.nome} aoMudar={(v) => mudar('nome', v)} erro={repetido ? undefined : erros.nome} autocapitalize="words" />
        {repetido && (
          <>
            <p class="campo-erro">{erros.nome}</p>
            <Interruptor rotulo="É outra pessoa" ligado={mesmoAssim} aoMudar={setMesmoAssim} ajuda="Família que divide o número, ou xará: importa mesmo assim." />
          </>
        )}
        <Campo rotulo="WhatsApp" type="tel" inputMode="tel" valor={r.telefone} aoMudar={(v) => mudar('telefone', v)} erro={erros.telefone} placeholder="(19) 90000-0000" />
        <Campo rotulo="E-mail (opcional)" type="email" inputMode="email" autocapitalize="none" valor={r.email} aoMudar={(v) => mudar('email', v)} erro={erros.email} />
        <EscolhaDeUnidade rotulo="Unidade" valor={r.unidadeId} aoMudar={(id) => mudar('unidadeId', id)} erro={erros.unidade} />
        <fieldset class="grupo">
          <legend class="campo-rotulo">Vezes por semana</legend>
          <div class="chips" role="radiogroup" aria-label="Vezes por semana">
            {PLANOS.map((n) => (
              <Chip key={n} papel="radio" ativo={r.vezesPorSemana === n} aoTocar={() => mudar('vezesPorSemana', n)}>
                {n}x
              </Chip>
            ))}
          </div>
          {erros.vezesPorSemana && <p class="campo-erro">{erros.vezesPorSemana}</p>}
        </fieldset>
        <Campo
          rotulo="Turmas (dia e hora)"
          valor={turmasTexto}
          aoMudar={setTurmasTexto}
          erro={erros.turmas}
          placeholder="seg 7h, qua 7h"
          autocapitalize="none"
        />
        {/* com erro ou sem, a lista do que existe ajuda a escrever certo */}
        <p class="campo-ajuda">{turmasDaUnidade(r.unidadeId)}</p>
        <Campo rotulo="Mensalidade (R$, opcional)" inputMode="decimal" valor={valor} aoMudar={setValor} erro={erros.valorMensal} />
        <Seletor rotulo="Forma de pagamento" valor={forma} aoMudar={(v) => setForma(v as FormaPagamento)} opcoes={FORMAS.map((f) => ({ valor: f, rotulo: NOME_DA_FORMA[f] }))} erro={erros.formaPreferida} />
        <Campo rotulo="Aluno desde" type="date" valor={r.desde} max={hoje.value} aoMudar={(v) => mudar('desde', v)} erro={erros.desde} />
        <AreaDeTexto rotulo="Observação (opcional)" valor={r.observacao} aoMudar={(v) => mudar('observacao', v)} maxLength={500} linhas={2} erro={erros.observacao} />
      </div>
    </FolhaInferior>
  )
}

// ---------- turmas ----------

export function ImportarTurmas() {
  const [etapa, setEtapa] = useState<Etapa>('colar')
  const [texto, setTexto] = useState('')
  const [linhas, setLinhas] = useState<string[][]>([])
  const [mapa, setMapa] = useState<Mapeamento<CampoDeTurma> | null>(null)
  const [ajustes, setAjustes] = useState<Map<number, RascunhoTurma>>(new Map())
  const [tiradas, setTiradas] = useState<Set<number>>(new Set())
  const [unidadePadrao, setUnidadePadrao] = useState<Id>(() => unidades.peek()[0]?.id ?? '')
  const [corrigindo, setCorrigindo] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [quantas, setQuantas] = useState(0)
  const b = base.value
  const ctx = useMemo(
    () => ({
      unidades: b?.unidades ?? [],
      turmas: b?.turmas ?? [],
      equipe: b?.equipe ?? [],
      hoje: hoje.value,
      unidadePadrao,
      capacidadePadrao: b?.configuracao.capacidadePadrao ?? 5,
    }),
    [b, unidadePadrao],
  )
  const resultado = useMemo(() => {
    if (!mapa) return null
    const lidas = lerTurmasDaPlanilha(linhas, mapa, ctx)
      .filter((l) => !tiradas.has(l.linha))
      .map((l) => {
        const corrigida = ajustes.get(l.linha)
        // corrigida na folha: vale o que a pessoa escolheu, e a conferência refaz os erros
        return corrigida ? { ...l, rascunho: corrigida, erros: {} } : l
      })
    return conferirTurmas(lidas, ctx, idNovo)
  }, [linhas, mapa, ctx, tiradas, ajustes])
  const ordenadas = useMemo(() => (resultado ? errosPrimeiro(resultado.lidas) : []), [resultado])

  if (!pode('editar-turmas') || !b) return <SemAcesso titulo="Importar turmas" texto="Só a administração cria turmas." />

  const conferir = () => {
    const lidas = lerTabela(texto)
    if (lidas.length === 0) return avisar({ texto: 'Não achei nenhuma linha no texto.', icone: 'info' })
    setLinhas(lidas)
    setMapa(mapearColunasDeTurmas(lidas))
    setAjustes(new Map())
    setTiradas(new Set())
    setEtapa('previa')
  }

  const importar = async () => {
    if (!resultado || ocupado) return
    if (repositorio.peek()?.modo !== 'demonstracao' && navigator.onLine === false) {
      return avisar({ texto: 'Sem internet agora. A importação precisa de conexão: tente de novo quando a internet voltar.', icone: 'info', duracao: 7000 })
    }
    setOcupado(true)
    const r = await importarTurmas(resultado.turmas)
    setOcupado(false)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info', duracao: 9000 })
    setQuantas(r.valor.quantas)
    setEtapa('feito')
    avisar({ texto: `${plural(r.valor.quantas, 'turma criada', 'turmas criadas')}.`, icone: 'presente' })
  }

  const emCorrecao = corrigindo !== null ? resultado?.lidas.find((l) => l.linha === corrigindo) : undefined

  let conteudo: JSX.Element
  if (etapa === 'colar') {
    conteudo = (
      <>
        <EscolhaDeUnidade rotulo="Unidade de quem não tem a coluna Unidade" valor={unidadePadrao} aoMudar={setUnidadePadrao} />
        <Entrada
          texto={texto}
          aoMudar={setTexto}
          aoConferir={conferir}
          modelo={{ nome: 'turmas-modelo.csv', conteudo: modeloDeTurmas }}
          como={COMO_PREENCHER.turmas}
          oQue="dia da semana, horário, duração, lugares, professor e unidade; uma linha por dia"
        />
        <p class="texto-secundario">Quem dá aula hoje: {quemDaAula()}.</p>
      </>
    )
  } else if (etapa === 'previa' && resultado && mapa) {
    const prontas = resultado.validas.length
    const comErro = resultado.comErro.length
    conteudo = (
      <>
        <Colunas linhas={linhas} mapa={mapa} campos={CAMPOS_DE_TURMA} aoMudar={setMapa} />
        <section class="secao" aria-labelledby="titulo-previa-turmas">
          <h2 id="titulo-previa-turmas" class="subtitulo" aria-live="polite">
            {plural(prontas, 'turma pronta', 'turmas prontas')}
            {comErro > 0 ? `, ${plural(comErro, 'linha com erro', 'linhas com erro')}` : ''}
          </h2>
          {comErro > 0 && <p class="texto-secundario">As linhas com erro vêm primeiro. Toque numa para corrigir ou tirar da lista.</p>}
          <ul class="lista" aria-label="Prévia da planilha">
            {ordenadas.map((l) => (
              <li key={l.linha}>
                <LinhaDeTurmaLida lida={l} aoTocar={() => setCorrigindo(l.linha)} />
              </li>
            ))}
          </ul>
        </section>
        <Botao variante="primario" icone="grade" largo disabled={prontas === 0 || ocupado} onClick={() => void importar()}>
          {ocupado ? 'Criando...' : `Criar ${plural(prontas, 'turma')}`}
        </Botao>
        <Botao variante="terciario" icone="voltar" largo onClick={() => setEtapa('colar')}>
          Voltar e colar de novo
        </Botao>
      </>
    )
  } else {
    conteudo = (
      <EstadoVazio icone="grade" rotulo="Grade montada" texto={`${plural(quantas, 'turma entrou', 'turmas entraram')} na grade da semana.`}>
        <Botao variante="primario" icone="grade" onClick={voltar}>
          Ver as turmas
        </Botao>
        <Botao variante="terciario" icone="adicionar" onClick={() => setEtapa('colar')}>
          Importar mais
        </Botao>
      </EstadoVazio>
    )
  }

  return (
    <section class="tela" aria-labelledby="titulo-importar-turmas">
      <CabecalhoDeSubtela voltarPara="Turmas" rotulo="Turmas" titulo="Importar de uma planilha" idTitulo="titulo-importar-turmas" />
      {conteudo}
      <CorrecaoDeTurma
        lida={emCorrecao}
        aberta={corrigindo !== null}
        aoFechar={() => setCorrigindo(null)}
        aoSalvar={(r) => {
          if (corrigindo !== null) setAjustes(new Map(ajustes).set(corrigindo, r))
          setCorrigindo(null)
        }}
        aoTirar={() => {
          if (corrigindo !== null) setTiradas(new Set(tiradas).add(corrigindo))
          setCorrigindo(null)
        }}
      />
    </section>
  )
}

function quemDaAula(): string {
  const nomes = (base.peek()?.equipe ?? []).filter((m) => m.ativo).map((m) => primeiroNome(m.nome))
  return nomes.length ? nomes.join(', ') : 'ninguém ainda (convide a equipe em Mais, Equipe)'
}

function LinhaDeTurmaLida({ lida, aoTocar }: { lida: TurmaLida; aoTocar: () => void }) {
  const erro = Object.values(lida.erros)[0]
  const r = lida.rascunho
  const professor = base.value?.equipe.find((m) => m.id === r.professorId)
  const titulo = lida.erros.dia || lida.erros.inicio?.startsWith('Não entendi') ? 'Dia ou horário por corrigir' : nomeDaTurma(r)
  const partes = [
    `Linha ${lida.linha}`,
    professor ? primeiroNome(professor.nome) : lida.professorTexto || 'sem professor',
    `${r.duracaoMin} min`,
    plural(r.capacidade, 'lugar', 'lugares'),
    unidades.value.length > 1 ? (unidades.value.find((u) => u.id === r.unidadeId)?.nome ?? lida.unidadeTexto) : '',
  ].filter(Boolean)
  return (
    <button type="button" class="lista-item tocavel" onClick={aoTocar} data-linha={lida.linha} data-erro={erro ? 'sim' : undefined}>
      <span class={`marca-presenca ${erro ? 'marca-presenca--avisou' : 'marca-presenca--presente'}`} aria-hidden="true">
        <Icone nome={erro ? 'alerta' : 'presente'} tamanho={18} traco={2} />
      </span>
      <span class="lista-item-texto">
        <span class="lista-item-titulo">{titulo}</span>
        <span class="lista-item-sub">{partes.join(', ')}</span>
        {erro && <span class="campo-erro">{erro}</span>}
      </span>
      <Pilula tom={erro ? 'alerta' : 'sucesso'}>{erro ? 'corrigir' : 'pronta'}</Pilula>
    </button>
  )
}

/** A turma da linha numa folha: dia, horário, duração, lugares, professor e unidade. */
function CorrecaoDeTurma({
  lida,
  aberta,
  aoFechar,
  aoSalvar,
  aoTirar,
}: {
  lida: TurmaLida | undefined
  aberta: boolean
  aoFechar: () => void
  aoSalvar: (r: RascunhoTurma) => void
  aoTirar: () => void
}) {
  const [r, setR] = useState(lida?.rascunho)
  const [ultima, setUltima] = useState<number | null>(null)
  if (lida && lida.linha !== ultima) {
    setUltima(lida.linha)
    setR(lida.rascunho)
  }
  if (!lida || !r) {
    return (
      <FolhaInferior aberta={false} aoFechar={aoFechar} titulo="">
        {null}
      </FolhaInferior>
    )
  }
  const erros = lida.erros
  const mudar = <K extends keyof RascunhoTurma>(campo: K, v: RascunhoTurma[K]) => setR({ ...r, [campo]: v })
  const equipe = base.value?.equipe ?? []
  const professores = quemPodeDarAula(equipe, r.unidadeId)
  return (
    <FolhaInferior
      aberta={aberta}
      aoFechar={aoFechar}
      rotulo={`Linha ${lida.linha}`}
      titulo={nomeDaTurma(r)}
      rodape={
        <div class="linha-acoes">
          <Botao variante="perigo" onClick={aoTirar}>
            Tirar da lista
          </Botao>
          <Botao variante="primario" icone="presente" onClick={() => aoSalvar(r)}>
            Salvar correção
          </Botao>
        </div>
      }
    >
      <div class="pilha formulario">
        {Object.values(erros)[0] && <p class="campo-erro">{Object.values(erros)[0]}</p>}
        <EscolhaDeUnidade rotulo="Unidade" valor={r.unidadeId} aoMudar={(id) => mudar('unidadeId', id)} />
        <fieldset class="grupo">
          <legend class="campo-rotulo">Dia da semana</legend>
          <div class="chips chips--dias" role="radiogroup" aria-label="Dia da semana">
            {DIAS_DA_GRADE.map((d: DiaDaSemana) => (
              <Chip key={d} papel="radio" ativo={r.diaDaSemana === d} aoTocar={() => mudar('diaDaSemana', d)}>
                {NOME_DO_DIA[d].slice(0, 3)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Campo rotulo="Começa às" type="time" valor={r.inicio} aoMudar={(v) => mudar('inicio', v)} />
        <Contador rotulo="Duração" valor={r.duracaoMin} aoMudar={(v) => mudar('duracaoMin', v)} min={15} max={180} passo={5} formatar={(v) => `${v} min`} />
        <Contador rotulo="Lugares" valor={r.capacidade} aoMudar={(v) => mudar('capacidade', v)} min={1} max={20} formatar={(v) => plural(v, 'aluno')} />
        <Seletor
          rotulo="Quem dá a aula"
          valor={r.professorId}
          aoMudar={(v) => mudar('professorId', v)}
          opcoes={[
            { valor: '', rotulo: 'Escolha' },
            ...professores.map((m) => ({ valor: m.id, rotulo: m.papel === 'professor' ? m.nome : `${m.nome} (${NOME_DO_PAPEL[m.papel]})` })),
          ]}
        />
      </div>
    </FolhaInferior>
  )
}
