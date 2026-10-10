// Guia de primeiro uso ("Montar o estúdio"): passos curtos, um por tela, com o progresso em cima
// e "Pular" em cada um. Abre sozinho para a administração quando o estúdio de verdade ainda está
// vazio (sem turma e sem aluno) e fica em Mais, Montar o estúdio. Na demonstração é uma prévia.
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { irPara, trocarTela } from '../../app/navegacao'
import { membro, papel, pode } from '../../app/perfil'
import { avisar } from '../../componentes/Avisos'
import { Botao } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { Icone } from '../../componentes/Icone'
import { Chip, Pilula } from '../../componentes/Pilula'
import { NOME_DO_PAPEL } from '../../dominio/permissoes'
import { ehPasso, indiceDoPasso, PASSOS, passoAnterior, passoSeguinte, resumoDaMontagem, TOTAL_DE_PASSOS } from '../../dominio/montagem'
import type { Passo } from '../../dominio/montagem'
import { ordenarEquipe } from '../../dominio/equipe'
import { plural, telefoneLegivel } from '../../dominio/texto'
import type { Id } from '../../dominio/tipos'
import { ImportarAlunos } from '../alunos/Importacao'
import { SemAcesso } from '../mais/SemAcesso'
import {
  adicionarProfessor,
  adicionarUnidade,
  dispensarGuia,
  limparRascunho,
  mudarRascunho,
  previa,
  rascunho,
  salvarEstudio,
  salvarGrade,
  visto,
} from './estadoDaMontagem'
import { PassoTurmas } from './PassoTurmas'

const TEXTOS: Record<Passo, string> = {
  estudio: 'Como o estúdio aparece no app e na página de aula experimental.',
  unidades: 'Onde as aulas acontecem. Com um endereço só, crie uma unidade: o nome do bairro serve.',
  equipe: 'Quem dá aula. O convite para entrar no app você manda depois, em Mais, Equipe; até lá, o nome já aparece na grade.',
  turmas: 'As turmas fixas da semana. Toque nos horários de um dia e copie para os outros.',
  alunos: 'Tem os alunos numa planilha? Copie as linhas e cole aqui: o app confere tudo antes de gravar.',
  fim: '',
}

function irAoPasso(p: Passo, direcao: 'frente' | 'tras' = 'frente'): void {
  trocarTela(['montar', p], direcao)
}

function sairDoGuia(destino: 'hoje' | 'agenda' | 'mais' = 'hoje', caminho: string[] = []): void {
  dispensarGuia()
  limparRascunho()
  irPara(destino, papel.peek(), caminho)
}

/** O topo de cada passo: sair, progresso, título e a frase do passo. */
function Cabeca({ passo, aoSair }: { passo: Passo; aoSair: () => void }) {
  const i = indiceDoPasso(passo)
  const fim = passo === 'fim'
  const titulo = fim ? (previa.value ? 'Prévia pronta.' : 'Pronto, o estúdio está montado.') : (PASSOS[i]?.titulo ?? '')
  return (
    <header class="cabecalho-de-tela guia-cabeca">
      <div class="guia-topo">
        <button type="button" class="voltar tocavel" onClick={aoSair}>
          <Icone nome="fechar" tamanho={22} traco={2} />
          <span>Sair do guia</span>
        </button>
        {!fim && (
          <p class="micro" id="guia-passo">
            Passo {i + 1} de {TOTAL_DE_PASSOS}
          </p>
        )}
      </div>
      <div
        class="guia-progresso"
        role="progressbar"
        aria-label="Montar o estúdio"
        aria-valuemin={0}
        aria-valuemax={TOTAL_DE_PASSOS}
        aria-valuenow={Math.min(i, TOTAL_DE_PASSOS)}
        aria-valuetext={fim ? 'Concluído' : `Passo ${i + 1} de ${TOTAL_DE_PASSOS}`}
      >
        <span class="guia-progresso-barra" style={{ transform: `scaleX(${Math.min(i + (fim ? 0 : 1), TOTAL_DE_PASSOS) / TOTAL_DE_PASSOS})` }} />
      </div>
      <p class="micro">Montar o estúdio</p>
      <h1 id="titulo-guia" class="titulo">
        {titulo}
      </h1>
      {TEXTOS[passo] && <p class="texto-secundario">{TEXTOS[passo]}</p>}
      {previa.value && !fim && (
        <p class="chamada-nota">
          <Icone nome="info" tamanho={20} />
          <span>Prévia: na demonstração o guia mostra cada passo, mas nada é gravado.</span>
        </p>
      )}
    </header>
  )
}

/** Os botões do pé de cada passo: seguir (principal), voltar e pular. */
function Pe({ passo, principal, aoSeguir, ocupado = false, semPular = false }: { passo: Passo; principal: string; aoSeguir: () => void; ocupado?: boolean; semPular?: boolean }) {
  const anterior = passoAnterior(passo)
  return (
    <div class="pilha guia-pe">
      <Botao variante="primario" icone="avancar" largo disabled={ocupado} onClick={aoSeguir}>
        {ocupado ? 'Salvando...' : principal}
      </Botao>
      <div class="linha-acoes">
        {anterior && (
          <Botao variante="secundario" icone="voltar" onClick={() => irAoPasso(anterior, 'tras')}>
            Voltar
          </Botao>
        )}
        {!semPular && (
          <Botao variante="terciario" onClick={() => irAoPasso(passoSeguinte(passo))}>
            Pular este passo
          </Botao>
        )}
      </div>
    </div>
  )
}

export function MontarEstudio({ passo: pedido }: { passo?: string | undefined }) {
  const passo: Passo = ehPasso(pedido) ? pedido : 'estudio'
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  if (!pode('editar-configuracao')) return <SemAcesso titulo="Montar o estúdio" texto="Só a administração monta o estúdio." />

  const pedirSaida = () => {
    if (rascunho.peek().turmasNovas.length > 0 && !previa.peek()) setConfirmandoSaida(true)
    else sairDoGuia()
  }

  let conteudo: ComponentChildren
  if (passo === 'estudio') conteudo = <PassoEstudio />
  else if (passo === 'unidades') conteudo = <PassoUnidades />
  else if (passo === 'equipe') conteudo = <PassoEquipe />
  else if (passo === 'turmas') conteudo = <PassoDaGrade />
  else if (passo === 'alunos') conteudo = <PassoAlunos />
  else conteudo = <PassoFim />

  const novas = rascunho.value.turmasNovas.length
  return (
    <section class="tela guia" aria-labelledby="titulo-guia">
      <Cabeca passo={passo} aoSair={pedirSaida} />
      {conteudo}
      <FolhaInferior
        aberta={confirmandoSaida}
        aoFechar={() => setConfirmandoSaida(false)}
        rotulo="Sair do guia"
        titulo={`Salvar ${plural(novas, 'a turma', 'as turmas')} antes?`}
        rodape={
          <div class="linha-acoes">
            <Botao variante="secundario" onClick={() => sairDoGuia()}>
              Sair sem salvar
            </Botao>
            <Botao
              variante="primario"
              onClick={async () => {
                const r = await salvarGrade()
                if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info', duracao: 8000 })
                sairDoGuia()
              }}
            >
              Salvar e sair
            </Botao>
          </div>
        }
      >
        <p>
          {plural(novas, 'turma tocada na grade ainda não foi salva', 'turmas tocadas na grade ainda não foram salvas')}. Você volta ao guia
          quando quiser, em Mais, Montar o estúdio.
        </p>
      </FolhaInferior>
    </section>
  )
}

// ---------- 1. o estúdio ----------

function PassoEstudio() {
  const config = visto.value.configuracao
  const [nome, setNome] = useState(config.nomeEstudio)
  const [whatsapp, setWhatsapp] = useState(config.whatsapp ? telefoneLegivel(config.whatsapp) : '')
  const [erros, setErros] = useState<{ nomeEstudio?: string | undefined; whatsapp?: string | undefined }>({})
  const [ocupado, setOcupado] = useState(false)
  const seguir = async () => {
    setOcupado(true)
    const r = await salvarEstudio(nome, whatsapp)
    setOcupado(false)
    if (!r.ok) {
      setErros(r.erros ?? {})
      return avisar({ texto: r.mensagem, icone: 'info' })
    }
    irAoPasso('unidades')
  }
  return (
    <>
      <form
        class="formulario pilha"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void seguir()
        }}
      >
        <Campo rotulo="Nome do estúdio" valor={nome} aoMudar={setNome} erro={erros.nomeEstudio} autocapitalize="words" />
        <Campo
          rotulo="WhatsApp do estúdio (opcional)"
          type="tel"
          inputMode="tel"
          placeholder="(19) 90000-0000"
          valor={whatsapp}
          aoMudar={setWhatsapp}
          erro={erros.whatsapp}
          ajuda="Para onde vão os pedidos de aula experimental. Dá para pôr depois, em Mais, Estúdio."
        />
      </form>
      <Pe passo="estudio" principal="Continuar" ocupado={ocupado} aoSeguir={() => void seguir()} />
    </>
  )
}

// ---------- 2. unidades ----------

function PassoUnidades() {
  const abertas = visto.value.unidades.filter((u) => u.ativa)
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  const [ocupado, setOcupado] = useState(false)

  const adicionar = async (): Promise<boolean> => {
    setOcupado(true)
    const r = await adicionarUnidade({ nome, endereco })
    setOcupado(false)
    if (!r.ok) {
      setErro(r.erros?.nome ?? r.mensagem)
      return false
    }
    setErro(undefined)
    setNome('')
    setEndereco('')
    avisar({ texto: `Unidade ${r.valor.unidade.nome} criada.`, icone: 'presente' })
    return true
  }
  const seguir = async () => {
    // o que ficou escrito no campo também vale: ninguém precisa lembrar de tocar em Adicionar
    if (nome.trim() && !(await adicionar())) return
    if (!nome.trim() && visto.peek().unidades.filter((u) => u.ativa).length === 0) {
      setErro('Escreva o nome da unidade: alunos e turmas ficam numa unidade.')
      return
    }
    irAoPasso('equipe')
  }
  return (
    <>
      {abertas.length > 0 && (
        <ul class="lista" aria-label="Unidades do estúdio">
          {abertas.map((u) => (
            <li key={u.id} class="lista-item">
              <span class="item-icone" aria-hidden="true">
                <Icone nome="local" tamanho={22} />
              </span>
              <span class="lista-item-texto">
                <span class="lista-item-titulo">{u.nome}</span>
                <span class="lista-item-sub">{u.endereco || 'Sem endereço'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        class="formulario pilha"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void adicionar()
        }}
      >
        <Campo rotulo={abertas.length ? 'Outra unidade' : 'Nome da unidade'} valor={nome} aoMudar={setNome} erro={erro} placeholder="Ex.: Centro" autocapitalize="words" />
        <Campo rotulo="Endereço (opcional)" valor={endereco} aoMudar={setEndereco} ajuda="Aparece na página de aula experimental." />
        <Botao variante="secundario" icone="adicionar" type="submit" largo disabled={ocupado || !nome.trim()}>
          Adicionar unidade
        </Botao>
      </form>
      <Pe passo="unidades" principal="Continuar" ocupado={ocupado} aoSeguir={() => void seguir()} />
    </>
  )
}

// ---------- 3. professores ----------

function PassoEquipe() {
  const v = visto.value
  const abertas = v.unidades.filter((u) => u.ativa)
  const eu = membro.value?.id
  const equipe = ordenarEquipe(v.equipe.filter((m) => m.ativo))
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [escolhidas, setEscolhidas] = useState<Id[]>([])
  const [erros, setErros] = useState<{ nome?: string | undefined; email?: string | undefined; telefone?: string | undefined; unidades?: string | undefined }>({})
  const [ocupado, setOcupado] = useState(false)
  // com uma unidade só, o professor é dela; com mais, a pessoa escolhe
  const unidades = abertas.length === 1 ? abertas.map((u) => u.id) : escolhidas

  const adicionar = async (): Promise<boolean> => {
    setOcupado(true)
    const r = await adicionarProfessor({ nome, email, telefone, papel: 'professor', unidades })
    setOcupado(false)
    if (!r.ok) {
      setErros(r.erros ?? { nome: r.mensagem })
      return false
    }
    setErros({})
    setNome('')
    setEmail('')
    setTelefone('')
    setEscolhidas([])
    avisar({ texto: `${r.valor.membro.nome} entrou na equipe. O convite você manda depois.`, icone: 'presente' })
    return true
  }
  const preenchido = Boolean(nome.trim() || email.trim())
  const seguir = async () => {
    if (preenchido && !(await adicionar())) return
    irAoPasso('turmas')
  }
  return (
    <>
      <ul class="lista" aria-label="Equipe">
        {equipe.map((m) => (
          <li key={m.id} class="lista-item">
            <span class="lista-item-texto">
              <span class="lista-item-titulo">
                {m.nome}
                {m.id === eu ? ' (você)' : ''}
              </span>
              <span class="lista-item-sub">{NOME_DO_PAPEL[m.papel]}</span>
            </span>
            {m.convite && <Pilula>convite a mandar</Pilula>}
          </li>
        ))}
      </ul>
      <p class="texto-secundario">Você também dá aula? Não precisa se cadastrar de novo: na grade, escolha o seu nome.</p>
      <form
        class="formulario pilha"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void adicionar()
        }}
      >
        <Campo rotulo="Nome do professor" valor={nome} aoMudar={setNome} erro={erros.nome} autocapitalize="words" />
        <Campo
          rotulo="E-mail"
          type="email"
          inputMode="email"
          autocapitalize="none"
          valor={email}
          aoMudar={setEmail}
          erro={erros.email}
          ajuda="É por ele que a pessoa vai entrar no app."
        />
        <Campo rotulo="WhatsApp (opcional)" type="tel" inputMode="tel" placeholder="(19) 90000-0000" valor={telefone} aoMudar={setTelefone} erro={erros.telefone} />
        {abertas.length > 1 && (
          <fieldset class="grupo">
            <legend class="campo-rotulo">Dá aula em</legend>
            <div class="chips" role="group" aria-label="Unidades">
              {abertas.map((u) => (
                <Chip
                  key={u.id}
                  ativo={escolhidas.includes(u.id)}
                  aoTocar={() => setEscolhidas(escolhidas.includes(u.id) ? escolhidas.filter((x) => x !== u.id) : [...escolhidas, u.id])}
                >
                  {u.nome}
                </Chip>
              ))}
            </div>
            {erros.unidades && <p class="campo-erro">{erros.unidades}</p>}
          </fieldset>
        )}
        <Botao variante="secundario" icone="adicionar" type="submit" largo disabled={ocupado || !preenchido}>
          Adicionar professor
        </Botao>
      </form>
      <Pe passo="equipe" principal="Continuar" ocupado={ocupado} aoSeguir={() => void seguir()} />
    </>
  )
}

// ---------- 4. turmas ----------

function PassoDaGrade() {
  const novas = rascunho.value.turmasNovas.length
  const [ocupado, setOcupado] = useState(false)
  const seguir = async () => {
    setOcupado(true)
    const r = await salvarGrade()
    setOcupado(false)
    if (!r.ok) return avisar({ texto: r.mensagem, icone: 'info', duracao: 8000 })
    if (r.valor.criadas) {
      const recusadas = r.valor.recusadas.length ? ` ${plural(r.valor.recusadas.length, 'ficou', 'ficaram')} de fora: ${r.valor.recusadas[0]}` : ''
      const feitas = previa.peek() ? plural(r.valor.criadas, 'turma na grade da prévia', 'turmas na grade da prévia') : plural(r.valor.criadas, 'turma salva', 'turmas salvas')
      avisar({ texto: `${feitas}.${recusadas}`, icone: 'presente', duracao: recusadas ? 8000 : 3500 })
    }
    irAoPasso('alunos')
  }
  return (
    <>
      <PassoTurmas />
      <Pe passo="turmas" principal={novas ? `Salvar ${plural(novas, 'turma')} e continuar` : 'Continuar'} ocupado={ocupado} aoSeguir={() => void seguir()} />
    </>
  )
}

// ---------- 5. alunos ----------

function PassoAlunos() {
  const [importando, setImportando] = useState(false)
  const turmas = visto.value.turmas.filter((t) => t.ativa).length
  if (importando) {
    return (
      <ImportarAlunos
        embutido
        previa={previa.value}
        aoConcluir={(quantos) => {
          if (previa.peek()) mudarRascunho({ alunosDaPrevia: rascunho.peek().alunosDaPrevia + quantos })
          irAoPasso('fim')
        }}
      />
    )
  }
  return (
    <>
      {turmas === 0 && (
        <p class="chamada-nota">
          <Icone nome="info" tamanho={20} />
          <span>Ainda não há turma na grade: os alunos entram no cadastro e você os põe nas turmas depois.</span>
        </p>
      )}
      <div class="pilha">
        <Botao variante="primario" icone="planilha" largo onClick={() => setImportando(true)}>
          Importar de uma planilha
        </Botao>
        <p class="texto-secundario">
          Sem planilha? Cadastre um a um depois, em Alunos, Novo aluno. Com a planilha, as colunas são reconhecidas pelo nome (nome,
          WhatsApp, vezes por semana, turmas, mensalidade) e você confere tudo antes.
        </p>
      </div>
      <Pe passo="alunos" principal="Cadastrar depois" aoSeguir={() => irAoPasso('fim')} semPular />
    </>
  )
}

// ---------- fim ----------

function PassoFim() {
  const v = visto.value
  const r = resumoDaMontagem(v)
  const alunos = r.alunos + v.alunosDaPrevia
  const linhas: [string, string][] = [
    ['Estúdio', [v.configuracao.nomeEstudio, v.configuracao.whatsapp ? telefoneLegivel(v.configuracao.whatsapp) : 'sem WhatsApp'].join(', ')],
    ['Unidades', plural(r.unidades, 'unidade', 'unidades')],
    ['Professores', `${plural(r.professores, 'professor', 'professores')}${r.convitesPendentes ? `, ${plural(r.convitesPendentes, 'convite para mandar', 'convites para mandar')}` : ''}`],
    ['Turmas', plural(r.turmas, 'turma na semana', 'turmas na semana')],
    ['Alunos', plural(alunos, 'aluno', 'alunos')],
    // os dois começam desligados: quem chega ao fim do guia fica sabendo onde ligar
    ['Página de aula experimental', v.configuracao.paginaExperimental ? 'ligada' : 'desligada; ligue em Mais, Estúdio, quando quiser'],
    ['App do aluno', v.configuracao.acessoDoAluno ? 'ligado' : 'desligado; ligue em Mais, Estúdio, quando quiser'],
  ]
  const naPrevia = previa.value
  return (
    <>
      <dl class="dados" aria-label="O que ficou pronto">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      {naPrevia ? (
        <>
          <p class="chamada-nota">
            <Icone nome="info" tamanho={20} />
            <span>Prévia: nada foi gravado. Com o estúdio de verdade, é assim que a administração começa.</span>
          </p>
          <Botao variante="primario" icone="voltar" largo onClick={() => sairDoGuia('mais')}>
            Voltar para Mais
          </Botao>
        </>
      ) : (
        <>
          <Botao variante="primario" icone="agenda" largo onClick={() => sairDoGuia('agenda')}>
            Ir para a agenda
          </Botao>
          {r.convitesPendentes > 0 && (
            <>
              <p class="texto-secundario">
                Os professores entram no app pelo convite: em Mais, Equipe, toque na pessoa e mande pelo WhatsApp. O convite vale{' '}
                {plural(v.configuracao.validadeDoConviteDias, 'dia', 'dias')}.
              </p>
              <Botao variante="secundario" icone="convidar" largo onClick={() => sairDoGuia('mais', ['equipe'])}>
                Mandar os convites
              </Botao>
            </>
          )}
        </>
      )}
    </>
  )
}
