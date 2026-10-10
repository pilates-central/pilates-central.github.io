import type { JSX } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { momento } from '../../app/relogio'
import { papel as papelDaSessao } from '../../app/perfil'
import { Avatar } from '../../componentes/Avatar'
import { avisar } from '../../componentes/Avisos'
import { Botao } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { Icone } from '../../componentes/Icone'
import type { NomeDoIcone } from '../../componentes/Icone'
import { Chip, Pilula } from '../../componentes/Pilula'
import { Vagas } from '../../componentes/Vagas'
import {
  alunosPorId,
  aulaPorId,
  cancelar,
  candidatosDaAula,
  creditos,
  darCreditoForaDoPrazo,
  encaixarReposicao,
  marcarPresenca,
  marcarTodosComoPresentes,
  nomeDaEquipe,
  nomeDaUnidade,
  nomeDoParticipante,
  reabrir,
  tirarExperimental,
  tirarReposicao,
} from '../../dados/estado'
import { faseDaAula } from '../../dominio/agenda'
import { dataCurta, horaDe, horaFalada, minutosDe } from '../../dominio/datas'
import { pode } from '../../dominio/permissoes'
import { ABERTURA_DA_CHAMADA_MIN, chamadaAberta, contarMarcacoes, idDoCredito } from '../../dominio/presenca'
import { linkDoWhatsApp, normalizar, plural, primeiroNome } from '../../dominio/texto'
import type { Aula, Marcacao, MotivoCancelamento, Papel, Participante } from '../../dominio/tipos'
import { abrirEm } from '../../app/navegacao'
import { cadastroDeExperimental } from '../alunos/estadoDaLista'
import { aulasDoCredito, confirmarEncaixe, ListaDeEncaixe, rotuloDoEncaixe } from '../reposicao/FolhaDeEncaixe'
import { aulaAberta, fecharAula } from './aulaAberta'
import { FormularioDeExperimental } from './FormularioDeExperimental'
import { textoDaMarcacao, tituloDaAula } from './textos'

type Etapa = 'chamada' | 'encaixe' | 'cancelar' | 'remarcar' | 'experimental'

const ICONE_DA_MARCACAO: Record<Marcacao, NomeDoIcone> = { presente: 'presente', faltou: 'faltou', avisou: 'avisou' }

/** Folha da aula: chamada, encaixe de reposição e (para a administração) cancelamento. */
export function FolhaDaAula() {
  const id = aulaAberta.value
  // mantém o conteúdo enquanto a folha anima a saída
  const [ultimoId, setUltimoId] = useState(id)
  const [etapa, setEtapa] = useState<Etapa>('chamada')
  // remarcar: o crédito de quem acabou de avisar e a aula escolhida para a reposição
  const [creditoParaRemarcar, setCreditoParaRemarcar] = useState<string | null>(null)
  const [aulaEscolhida, setAulaEscolhida] = useState<string | null>(null)
  useEffect(() => {
    if (id) {
      setUltimoId(id)
      setEtapa('chamada')
    }
  }, [id])

  const aula = ultimoId ? aulaPorId(ultimoId) : undefined
  const papel: Papel = papelDaSessao.value ?? 'professor'
  if (!aula) return null

  const fase = faseDaAula(aula, momento.value)
  const contagem = contarMarcacoes(aula)
  const podeTodos = !aula.cancelamento && chamadaAberta(aula, momento.value) && contagem.pendente > 0
  const podeEncaixar = !aula.cancelamento && aula.vagas > 0 && fase !== 'encerrada'
  // quem pediu a aula experimental entra numa aula com vaga, enquanto ela não terminou
  const podeRegistrarExperimental = podeEncaixar
  const podeCancelar = pode(papel, 'cancelar-aula') && !aula.cancelamento && fase === 'futura'

  const todosPresentes = async () => {
    const r = await marcarTodosComoPresentes(aula.id)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    avisar({
      texto: `${plural(r.valor.quantidade, 'presença marcada', 'presenças marcadas')}.`,
      icone: 'presente',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
  }

  let conteudo: JSX.Element
  let rodape: JSX.Element | undefined
  const credito = creditoParaRemarcar ? creditos.value.get(creditoParaRemarcar) : undefined
  if (etapa === 'remarcar' && credito) {
    const aulas = aulasDoCredito(credito)
    const destino = aulas.find((a) => a.id === aulaEscolhida)
    conteudo = (
      <div class="pilha">
        <Botao variante="terciario" icone="voltar" onClick={() => setEtapa('chamada')} class="botao--alinhado">
          Voltar para a chamada
        </Botao>
        <p class="subtitulo">Reposição de {primeiroNome(alunosPorId.value.get(credito.alunoId)?.nome ?? '')}</p>
        <ListaDeEncaixe aulas={aulas} escolhida={aulaEscolhida} aoEscolher={setAulaEscolhida} />
      </div>
    )
    rodape = destino ? (
      <Botao
        variante="primario"
        largo
        icone="reposicao"
        onClick={async () => {
          if (await confirmarEncaixe(destino, credito)) setEtapa('chamada')
        }}
      >
        {rotuloDoEncaixe(destino)}
      </Botao>
    ) : undefined
  } else if (etapa === 'encaixe') {
    conteudo = <Encaixe aula={aula} aoVoltar={() => setEtapa('chamada')} />
  } else if (etapa === 'cancelar') {
    conteudo = <Cancelamento aula={aula} aoVoltar={() => setEtapa('chamada')} />
  } else if (etapa === 'experimental') {
    conteudo = (
      <div class="pilha">
        <Botao variante="terciario" icone="voltar" onClick={() => setEtapa('chamada')} class="botao--alinhado">
          Voltar para a chamada
        </Botao>
        <FormularioDeExperimental aula={aula} aoRegistrar={() => setEtapa('chamada')} />
      </div>
    )
  } else {
    conteudo = (
      <>
        <Chamada
          aula={aula}
          papel={papel}
          aoRemarcar={(creditoId) => {
            setCreditoParaRemarcar(creditoId)
            setAulaEscolhida(null)
            setEtapa('remarcar')
          }}
        />
        {podeRegistrarExperimental && (
          <Botao variante="terciario" largo icone="convidar" onClick={() => setEtapa('experimental')} class="botao--fim">
            Registrar aula experimental
          </Botao>
        )}
        {podeCancelar && (
          <Botao variante="terciario" largo icone="folga" onClick={() => setEtapa('cancelar')} class={podeRegistrarExperimental ? '' : 'botao--fim'}>
            Cancelar esta aula
          </Botao>
        )}
      </>
    )
    rodape = (
      <>
        {podeTodos && (
          <Botao variante="primario" largo icone="presente" onClick={todosPresentes}>
            Todos presentes ({contagem.pendente})
          </Botao>
        )}
        {podeEncaixar && (
          <Botao variante="secundario" largo icone="reposicao" onClick={() => setEtapa('encaixe')}>
            Encaixar reposição
          </Botao>
        )}
        {aula.cancelamento && pode(papel, 'cancelar-aula') && (
          <Botao
            variante="secundario"
            largo
            onClick={async () => {
              const r = await reabrir(aula.id)
              if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
              avisar({ texto: 'Aula reaberta.', acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() } })
            }}
          >
            Reabrir aula
          </Botao>
        )}
      </>
    )
  }

  const temRodape =
    rodape && (etapa === 'remarcar' || podeTodos || podeEncaixar || (aula.cancelamento && pode(papel, 'cancelar-aula')))

  return (
    <FolhaInferior
      aberta={id !== null}
      aoFechar={fecharAula}
      rotulo={
        aula.cancelamento
          ? 'Aula cancelada'
          : etapa === 'encaixe'
            ? 'Encaixar reposição'
            : etapa === 'remarcar'
              ? 'Remarcar'
              : etapa === 'experimental'
                ? 'Aula experimental'
                : 'Chamada'
      }
      titulo={tituloDaAula(aula)}
      subtitulo={
        <span class="pilha" style={{ gap: '6px' }}>
          <span>
            {nomeDaUnidade(aula.unidadeId)}, com {primeiroNome(nomeDaEquipe(aula.professorId))}. {aula.duracaoMin} min.
          </span>
          <Vagas ocupadas={aula.ocupadas} capacidade={aula.capacidade} cancelada={Boolean(aula.cancelamento)} />
        </span>
      }
      rodape={temRodape ? rodape : undefined}
    >
      {conteudo}
    </FolhaInferior>
  )
}

function Chamada({ aula, papel, aoRemarcar }: { aula: Aula; papel: Papel; aoRemarcar: (creditoId: string) => void }) {
  const fase = faseDaAula(aula, momento.value)
  const contagem = contarMarcacoes(aula)
  const fechada = !chamadaAberta(aula, momento.value)

  if (aula.cancelamento) {
    return (
      <EstadoVazio
        icone="folga"
        rotulo={aula.cancelamento.motivo === 'feriado' ? 'Feriado' : 'Cancelada pelo estúdio'}
        texto={aula.cancelamento.observacao || 'Esta aula não vai acontecer.'}
      />
    )
  }
  if (aula.participantes.length === 0) {
    return <EstadoVazio icone="pessoa" rotulo="Turma vazia" texto="Ninguém nesta aula ainda. Dá para encaixar reposições." />
  }

  return (
    <>
      {fechada && (
        <p class="chamada-nota">
          <Icone nome="info" tamanho={20} />
          <span>
            A chamada abre meia hora antes da aula
            {momento.value.data === aula.data ? `, às ${horaFalada(horaDe(minutosDe(aula.inicio) - ABERTURA_DA_CHAMADA_MIN))}` : ''}. Antes
            disso, dá para registrar quem avisou que não vem.
          </span>
        </p>
      )}
      {fase === 'encerrada' && contagem.pendente > 0 && (
        <p class="chamada-nota">
          <Icone nome="relogio" tamanho={20} />
          <span>A aula já terminou e {plural(contagem.pendente, 'aluno está', 'alunos estão')} sem marcação.</span>
        </p>
      )}
      <div class="chamada-resumo" aria-label="Resumo da chamada">
        <Pilula tom="sucesso">{plural(contagem.presente, 'presente')}</Pilula>
        {contagem.faltou > 0 && <Pilula>{plural(contagem.faltou, 'falta')}</Pilula>}
        {contagem.avisou > 0 && <Pilula tom="alerta">{plural(contagem.avisou, 'avisou', 'avisaram')}</Pilula>}
        {contagem.pendente > 0 && <Pilula>{contagem.pendente} sem marcação</Pilula>}
      </div>
      <ul class="chamada-lista">
        {aula.participantes.map((p, i) =>
          p.origem === 'experimental' ? (
            <ExperimentalNaChamada key={p.alunoId} aula={aula} participante={p} indice={i} papel={papel} />
          ) : (
            <AlunoNaChamada key={p.alunoId} aula={aula} participante={p} indice={i} papel={papel} aoRemarcar={aoRemarcar} />
          ),
        )}
      </ul>
    </>
  )
}

/** Um segmento da chamada (Presente, Faltou, Avisou). */
function Segmento({ tipo, rotulo, pressionado, desativado, aoTocar }: { tipo: Marcacao; rotulo: string; pressionado: boolean; desativado: boolean; aoTocar: () => void }) {
  return (
    <button type="button" class={`segmento segmento--${tipo} tocavel`} aria-pressed={pressionado} disabled={desativado} onClick={aoTocar}>
      <Icone nome={ICONE_DA_MARCACAO[tipo]} tamanho={20} traco={2} />
      <span>{rotulo}</span>
    </button>
  )
}

/**
 * Quem veio experimentar: nome e WhatsApp registrados na aula, presença ou falta, "Tirar"
 * enquanto a aula não terminou e, para a administração, o cadastro já preenchido.
 */
function ExperimentalNaChamada({ aula, participante: p, indice, papel }: Omit<PropsAluno, 'aoRemarcar'>) {
  const nome = nomeDoParticipante(p)
  const fase = faseDaAula(aula, momento.value)
  const fechada = !chamadaAberta(aula, momento.value)
  const experimental = p.experimental
  const virouAluno = experimental?.alunoId ? alunosPorId.value.get(experimental.alunoId) : undefined

  const marcar = async (m: Marcacao) => {
    const nova = p.marcacao === m ? null : m
    const r = await marcarPresenca(aula.id, p.alunoId, nova)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    avisar({
      texto: textoDaMarcacao(nome, nova),
      icone: nova ? ICONE_DA_MARCACAO[nova] : 'desfazer',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
  }

  const tirar = async () => {
    const r = await tirarExperimental(aula.id, p.alunoId)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    avisar({
      texto: `${primeiroNome(nome)} saiu desta aula.`,
      icone: 'desfazer',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
  }

  const cadastrar = () => {
    if (!experimental) return
    cadastroDeExperimental.value = {
      aulaId: aula.id,
      experimentalId: p.alunoId,
      nome: experimental.nome,
      telefone: experimental.telefone,
      unidadeId: aula.unidadeId,
    }
    abrirEm('alunos', ['novo'])
    fecharAula()
  }

  return (
    <li class="chamada-aluno" style={{ '--i': indice } as JSX.CSSProperties} data-aluno={p.alunoId} data-experimental>
      <div class="chamada-nome">
        <Avatar nome={nome} tamanho={36} />
        {virouAluno ? (
          <button
            type="button"
            class="chamada-nome-botao tocavel"
            onClick={() => {
              abrirEm('alunos', [virouAluno.id])
              fecharAula()
            }}
            aria-label={`${nome}: abrir ficha`}
          >
            {nome}
          </button>
        ) : (
          <span class="chamada-nome-texto">{nome}</span>
        )}
        <Pilula tom="acento">experimental</Pilula>
        {experimental?.telefone && (
          <a
            class="botao-icone tocavel"
            href={linkDoWhatsApp(experimental.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp de ${primeiroNome(nome)}`}
          >
            <Icone nome="mensagem" tamanho={22} />
          </a>
        )}
      </div>
      <div class="segmentado" role="group" aria-label={`Presença de ${nome}`}>
        <Segmento tipo="presente" rotulo="Presente" pressionado={p.marcacao === 'presente'} desativado={fechada} aoTocar={() => void marcar('presente')} />
        <Segmento tipo="faltou" rotulo="Faltou" pressionado={p.marcacao === 'faltou'} desativado={fechada} aoTocar={() => void marcar('faltou')} />
        <button type="button" class="segmento tocavel" onClick={() => void tirar()} disabled={fase === 'encerrada'}>
          <Icone nome="desfazer" tamanho={20} traco={2} />
          <span>Tirar</span>
        </button>
      </div>
      {virouAluno ? (
        <p class="texto-secundario">Virou aluno: {primeiroNome(virouAluno.nome)} já está no cadastro.</p>
      ) : experimental?.alunoId ? null /* virou aluno e o cadastro foi excluído depois: fica só o código */ : (
        pode(papel, 'editar-alunos') && (
          <Botao variante="terciario" icone="adicionar" onClick={cadastrar}>
            Cadastrar como aluno
          </Botao>
        )
      )}
    </li>
  )
}

interface PropsAluno {
  aula: Aula
  participante: Participante
  indice: number
  papel: Papel
  aoRemarcar: (creditoId: string) => void
}

function AlunoNaChamada({ aula, participante: p, indice, papel, aoRemarcar }: PropsAluno) {
  const nome = alunosPorId.value.get(p.alunoId)?.nome ?? 'Aluno removido'
  const fase = faseDaAula(aula, momento.value)
  const fechada = !chamadaAberta(aula, momento.value)
  const creditoDoAviso =
    p.marcacao === 'avisou' ? creditos.value.get(idDoCredito(p.alunoId, aula.turmaId, aula.data)) : undefined

  const marcar = async (m: Marcacao) => {
    const nova = p.marcacao === m ? null : m
    const r = await marcarPresenca(aula.id, p.alunoId, nova)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    let texto = textoDaMarcacao(nome, nova)
    if (nova === 'avisou') {
      texto = r.valor.creditoGerado
        ? `${primeiroNome(nome)} avisou. Tem reposição até ${dataCurta(r.valor.creditoGerado.validoAte)}.`
        : r.valor.limiteAtingido
          ? `${primeiroNome(nome)} avisou, mas já usou as reposições do mês.`
          : `${primeiroNome(nome)} avisou em cima da hora: fica sem reposição.`
    }
    avisar({
      texto,
      icone: nova ? ICONE_DA_MARCACAO[nova] : 'desfazer',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
  }

  const tirar = async () => {
    const r = await tirarReposicao(aula.id, p.alunoId)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    avisar({
      texto: `${primeiroNome(nome)} saiu desta aula. O crédito voltou.`,
      icone: 'reposicao',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
  }

  const darCredito = async () => {
    const r = await darCreditoForaDoPrazo(aula.id, p.alunoId)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    avisar({
      texto: `${primeiroNome(nome)} ganhou reposição até ${dataCurta(r.valor.creditoGerado.validoAte)}.`,
      icone: 'reposicao',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
  }

  const segmento = (tipo: Marcacao, rotulo: string, desativado: boolean) => (
    <Segmento tipo={tipo} rotulo={rotulo} pressionado={p.marcacao === tipo} desativado={desativado} aoTocar={() => void marcar(tipo)} />
  )

  return (
    <li class="chamada-aluno" style={{ '--i': indice } as JSX.CSSProperties} data-aluno={p.alunoId}>
      <div class="chamada-nome">
        <Avatar nome={nome} tamanho={36} />
        <button
          type="button"
          class="chamada-nome-botao tocavel"
          onClick={() => {
            abrirEm('alunos', [p.alunoId])
            fecharAula()
          }}
          aria-label={`${nome}: abrir ficha`}
        >
          {nome}
        </button>
        {p.origem === 'reposicao' && <Pilula tom="acento">reposição</Pilula>}
        {p.marcacao === 'avisou' && !creditoDoAviso && <Pilula tom="alerta">sem reposição</Pilula>}
      </div>
      <div class="segmentado" role="group" aria-label={`Presença de ${nome}`}>
        {segmento('presente', 'Presente', fechada)}
        {segmento('faltou', 'Faltou', fechada)}
        {p.origem === 'fixo' ? (
          segmento('avisou', 'Avisou', fase === 'encerrada' && p.marcacao !== 'avisou')
        ) : (
          <button type="button" class="segmento tocavel" onClick={() => void tirar()} disabled={fase === 'encerrada'}>
            <Icone nome="desfazer" tamanho={20} traco={2} />
            <span>Tirar</span>
          </button>
        )}
      </div>
      {p.marcacao === 'avisou' && creditoDoAviso && !creditoDoAviso.usadoEm && pode(papel, 'encaixar-reposicao') && (
        <Botao variante="terciario" icone="reposicao" onClick={() => aoRemarcar(creditoDoAviso.id)}>
          Encaixar em outro horário
        </Botao>
      )}
      {p.marcacao === 'avisou' && creditoDoAviso?.usadoEm && (
        <p class="texto-secundario">Reposição marcada para {dataCurta(creditoDoAviso.usadoEm.data)}.</p>
      )}
      {pode(papel, 'dar-credito-fora-do-prazo') && p.marcacao === 'avisou' && !creditoDoAviso && (
        <Botao variante="terciario" icone="reposicao" onClick={() => void darCredito()}>
          Dar reposição mesmo assim
        </Botao>
      )}
    </li>
  )
}

function Encaixe({ aula, aoVoltar }: { aula: Aula; aoVoltar: () => void }) {
  const [busca, setBusca] = useState('')
  const candidatos = candidatosDaAula(aula)
  const alunos = alunosPorId.value
  const filtrados = useMemo(() => {
    const termo = normalizar(busca)
    return termo ? candidatos.filter((c) => normalizar(alunos.get(c.alunoId)?.nome ?? '').includes(termo)) : candidatos
  }, [busca, candidatos, alunos])

  const encaixar = async (creditoId: string, nome: string) => {
    const r = await encaixarReposicao(aula.id, creditoId)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    avisar({
      texto: `Reposição de ${primeiroNome(nome)} marcada para as ${horaFalada(aula.inicio)}.`,
      icone: 'reposicao',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
    aoVoltar()
  }

  return (
    <div class="pilha">
      <Botao variante="terciario" icone="voltar" onClick={aoVoltar} class="botao--alinhado">
        Voltar para a chamada
      </Botao>
      {candidatos.length === 0 ? (
        <EstadoVazio
          icone="reposicao"
          rotulo="Ninguém para repor"
          texto="Nenhum aluno desta unidade tem reposição válida para esta data."
        />
      ) : (
        <>
          {candidatos.length > 5 && (
            <Campo rotulo="Buscar aluno" icone="busca" valor={busca} aoMudar={setBusca} placeholder="Nome" type="search" />
          )}
          <p class="texto-secundario">
            {plural(aula.vagas, 'vaga livre', 'vagas livres')}. Quem tem reposição para usar:
          </p>
          <ul>
            {filtrados.map((c, i) => {
              const nome = alunos.get(c.alunoId)?.nome ?? 'Aluno'
              return (
                <li key={c.id} class="encaixe-item" style={{ '--i': i } as JSX.CSSProperties}>
                  <Avatar nome={nome} />
                  <span class="encaixe-texto">
                    <span class="lista-item-titulo">{nome}</span>
                    <span class="lista-item-sub">
                      {c.origem.data < momento.value.data ? 'Faltou em' : 'Vai faltar em'} {dataCurta(c.origem.data)}, vale
                      até {dataCurta(c.validoAte)}
                    </span>
                  </span>
                  <Botao variante="secundario" onClick={() => void encaixar(c.id, nome)}>
                    Encaixar
                  </Botao>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function Cancelamento({ aula, aoVoltar }: { aula: Aula; aoVoltar: () => void }) {
  const [motivo, setMotivo] = useState<MotivoCancelamento>('estudio')
  const [darCreditos, setDarCreditos] = useState(true)
  const [observacao, setObservacao] = useState('')
  const fixos = aula.participantes.filter((p) => p.origem === 'fixo' && p.marcacao !== 'avisou').length

  const confirmar = async () => {
    const r = await cancelar(aula.id, { motivo, observacao, gerarCreditos: darCreditos })
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info' })
    avisar({
      texto: r.valor.creditosGerados
        ? `Aula cancelada. ${plural(r.valor.creditosGerados, 'aluno ganhou', 'alunos ganharam')} reposição.`
        : 'Aula cancelada.',
      icone: 'folga',
      acao: { rotulo: 'Desfazer', executar: () => void r.valor.desfazer() },
    })
    aoVoltar()
  }

  return (
    <div class="pilha">
      <Botao variante="terciario" icone="voltar" onClick={aoVoltar} class="botao--alinhado">
        Voltar para a chamada
      </Botao>
      <p class="micro">Motivo</p>
      <div class="chips" role="radiogroup" aria-label="Motivo do cancelamento">
        <Chip papel="radio" ativo={motivo === 'estudio'} aoTocar={() => setMotivo('estudio')}>
          Imprevisto
        </Chip>
        <Chip papel="radio" ativo={motivo === 'feriado'} aoTocar={() => setMotivo('feriado')}>
          Feriado
        </Chip>
      </div>
      <div class="chips">
        <Chip ativo={darCreditos} aoTocar={() => setDarCreditos(!darCreditos)}>
          {darCreditos ? <Icone nome="presente" tamanho={18} traco={2} /> : null}
          Dar reposição aos {plural(fixos, 'aluno')}
        </Chip>
      </div>
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={80} />
      <Botao variante="perigo" largo icone="folga" onClick={() => void confirmar()}>
        Cancelar a aula das {horaFalada(aula.inicio)}
      </Botao>
    </div>
  )
}
