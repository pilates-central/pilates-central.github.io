import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { emailDaConta } from '../../app/conta'
import { abrir } from '../../app/navegacao'
import { membro, papel, pode } from '../../app/perfil'
import { hoje } from '../../app/relogio'
import { temProjeto, voltarAsPortas } from '../../app/modo'
import { sair } from '../../app/sessao'
import { escolherTema, tema } from '../../app/tema'
import type { Tema } from '../../app/tema'
import { ehIPhone, estaInstalado, instalar, podeInstalar } from '../../app/instalacao'
import { Avatar } from '../../componentes/Avatar'
import { avisar } from '../../componentes/Avisos'
import { Botao } from '../../componentes/Botao'
import { Card } from '../../componentes/Card'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { Chevrons, Icone } from '../../componentes/Icone'
import type { NomeDoIcone } from '../../componentes/Icone'
import { Chip } from '../../componentes/Pilula'
import { base, carregar, nomeDaUnidade, repositorio, unidades } from '../../dados/estado'
import { textoDasRegras } from '../../dominio/configuracao'
import { ehAdministracao, NOME_DO_PAPEL } from '../../dominio/permissoes'
import { listaFalada, plural, telefoneLegivel } from '../../dominio/texto'
import type { RepositorioDeDemonstracao } from '../../dados/repositorio'
import type { Configuracao } from '../../dominio/tipos'
import { FolhaDeTrocaDeSenha } from '../conta/FolhaDeTrocaDeSenha'

export const TEMAS: { id: Tema; rotulo: string }[] = [
  { id: 'automatico', rotulo: 'Automático' },
  { id: 'claro', rotulo: 'Claro' },
  { id: 'escuro', rotulo: 'Escuro' },
]

/** Linha de menu que abre uma tela de ajustes. */
function ItemDeMenu({ icone, titulo, sub, aoTocar }: { icone: NomeDoIcone; titulo: string; sub: string; aoTocar: () => void }) {
  return (
    <button type="button" class="lista-item tocavel" onClick={aoTocar}>
      <span class="item-icone" aria-hidden="true">
        <Icone nome={icone} tamanho={22} />
      </span>
      <span class="lista-item-texto">
        <span class="lista-item-titulo">{titulo}</span>
        <span class="lista-item-sub">{sub}</span>
      </span>
      <Chevrons tamanho={16} />
    </button>
  )
}

function resumoDoEstudio(config: Configuracao): string {
  const partes = [config.nomeEstudio]
  if (config.whatsapp) partes.push(telefoneLegivel(config.whatsapp))
  partes.push(config.acessoDoAluno ? 'app do aluno ligado' : 'app do aluno desligado')
  return partes.join(', ')
}

function resumoDaEquipe(): string {
  const equipe = (base.value?.equipe ?? []).filter((m) => m.ativo)
  const adm = equipe.filter((m) => ehAdministracao(m.papel)).length
  const prof = equipe.filter((m) => m.papel === 'professor').length
  return `${plural(adm, 'pessoa', 'pessoas')} na administração, ${plural(prof, 'professor', 'professores')}`
}

const ENDERECO_DA_EXPERIMENTAL = `${import.meta.env.BASE_URL}experimental/`

/**
 * O link da página de aula experimental, para pôr no Instagram e mandar a quem pergunta no
 * WhatsApp: no celular abre o compartilhar do sistema; sem ele, copia.
 */
function PaginaDeExperimental() {
  const endereco = new URL(ENDERECO_DA_EXPERIMENTAL, location.href).href
  const podeCompartilhar = typeof navigator.share === 'function'
  const compartilhar = async () => {
    if (podeCompartilhar) {
      try {
        await navigator.share({ title: 'Aula experimental', url: endereco })
      } catch {
        // a pessoa fechou o compartilhar: nada a fazer
      }
      return
    }
    try {
      await navigator.clipboard.writeText(endereco)
      avisar({ texto: 'Link copiado. É só colar no Instagram ou no WhatsApp.', icone: 'compartilhar' })
    } catch {
      avisar({ texto: `Não deu para copiar. O link é ${endereco}`, icone: 'info', duracao: 8000 })
    }
  }
  return (
    <section class="secao" aria-labelledby="titulo-experimental">
      <h2 id="titulo-experimental" class="micro">
        Página de aula experimental
      </h2>
      <p class="texto-secundario">
        Quem quer conhecer o estúdio vê os horários com vaga e pede a aula pelo WhatsApp. Ponha o link no Instagram e mande para quem
        perguntar.
      </p>
      <p class="endereco-da-pagina">{endereco.replace(/^https?:\/\//, '')}</p>
      <div class="linha-acoes">
        <a class="botao botao--secundario tocavel" href={ENDERECO_DA_EXPERIMENTAL}>
          <span>Ver a página</span>
        </a>
        <Botao variante="secundario" icone="compartilhar" onClick={() => void compartilhar()}>
          {podeCompartilhar ? 'Compartilhar' : 'Copiar link'}
        </Botao>
      </div>
    </section>
  )
}

export function Ajustes() {
  const eu = membro.value
  const meuPapel = papel.value
  const config = base.value?.configuracao
  const [confirmando, setConfirmando] = useState(false)
  const repo = repositorio.value
  const demo = repo?.modo === 'demonstracao' ? (repo as RepositorioDeDemonstracao) : null

  const recomecar = async () => {
    if (!demo) return
    setConfirmando(false)
    await demo.recomecar()
    await carregar(demo, hoje.peek())
    avisar({ texto: 'Demonstração recomeçada com os dados do começo.', icone: 'recomecar' })
  }

  return (
    <section class="tela" aria-labelledby="titulo-mais">
      <header class="cabecalho-de-tela">
        <p class="micro">Mais</p>
        <h1 id="titulo-mais" class="titulo">
          Ajustes
        </h1>
      </header>

      {eu && meuPapel && (
        <Card class="perfil">
          <Avatar nome={eu.nome} tamanho={56} />
          <span class="lista-item-texto">
            <span class="subtitulo">{eu.nome}</span>
            <span class="lista-item-sub">
              {NOME_DO_PAPEL[meuPapel]},{' '}
              {ehAdministracao(meuPapel) ? 'todas as unidades' : listaFalada(eu.unidades.map(nomeDaUnidade))}
            </span>
            {eu.telefone && <span class="lista-item-sub">{telefoneLegivel(eu.telefone)}</span>}
          </span>
        </Card>
      )}

      <ul class="lista" aria-label="Ajuda">
        <li>
          <ItemDeMenu icone="ajuda" titulo="Ajuda" sub="Instalar, chamada, reposição, convites e o que cada um vê" aoTocar={() => abrir('ajuda')} />
        </li>
      </ul>

      {pode('editar-configuracao') && config ? (
        <section class="secao" aria-labelledby="titulo-estudio">
          <h2 id="titulo-estudio" class="micro">
            Estúdio
          </h2>
          <ul class="lista">
            {(
              [
                ['montar', 'Montar o estúdio', 'Passo a passo: unidades, professores, grade da semana e alunos', 'montar'],
                ['local', 'Estúdio', resumoDoEstudio(config), 'estudio'],
                ['regras', 'Regras de reposição', textoDasRegras(config), 'regras'],
                ['grade', 'Unidades', plural(unidades.value.length, 'unidade aberta', 'unidades abertas'), 'unidades'],
                ['alunos', 'Equipe', resumoDaEquipe(), 'equipe'],
                ['info', 'Registro de alterações', 'Quem lançou, apagou, excluiu ou mudou acesso, e quando', 'alteracoes'],
              ] as [NomeDoIcone, string, string, string][]
            ).map(([icone, titulo, sub, caminho], i) => (
              <li key={caminho} style={{ '--i': i } as JSX.CSSProperties}>
                <ItemDeMenu icone={icone} titulo={titulo} sub={sub} aoTocar={() => abrir(caminho)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        config && (
          <section class="secao" aria-labelledby="titulo-regras-prof">
            <h2 id="titulo-regras-prof" class="micro">
              Regras de reposição
            </h2>
            <p class="texto-secundario">{textoDasRegras(config)}</p>
          </section>
        )
      )}

      {config?.paginaExperimental && <PaginaDeExperimental />}

      <section class="secao" aria-labelledby="titulo-aparencia">
        <h2 id="titulo-aparencia" class="micro">
          Aparência
        </h2>
        <div class="chips" role="radiogroup" aria-label="Tema">
          {TEMAS.map((t) => (
            <Chip key={t.id} papel="radio" ativo={tema.value === t.id} aoTocar={() => escolherTema(t.id)}>
              {t.rotulo}
            </Chip>
          ))}
        </div>
        <p class="texto-secundario">No automático, o app acompanha o modo claro ou escuro do celular.</p>
      </section>

      <section class="secao" aria-labelledby="titulo-instalar">
        <h2 id="titulo-instalar" class="micro">
          Instalar no celular
        </h2>
        <Instalacao />
      </section>

      {demo && (
        <section class="secao" aria-labelledby="titulo-demo">
          <h2 id="titulo-demo" class="micro">
            Demonstração
          </h2>
          <p class="texto-secundario">
            Os alunos, as aulas e os pagamentos são fictícios e ficam guardados só neste aparelho.
            {demo.persistente ? '' : ' Este navegador não deixa guardar: ao fechar, tudo volta ao começo.'}
          </p>
          <Botao variante="secundario" icone="recomecar" largo onClick={() => setConfirmando(true)}>
            Recomeçar demonstração
          </Botao>
        </section>
      )}

      <section class="secao" aria-labelledby="titulo-privacidade">
        <h2 id="titulo-privacidade" class="micro">
          Privacidade
        </h2>
        <p class="texto-secundario">
          O que o app guarda, para quê e quem vê. A cópia dos dados de um aluno e a exclusão ficam na ficha dele.
        </p>
        <a class="botao botao--secundario botao--largo tocavel" href={`${import.meta.env.BASE_URL}privacidade/`}>
          <Icone nome="info" tamanho={20} />
          <span>Aviso de privacidade</span>
        </a>
      </section>

      {demo ? (
        <>
          <Botao variante="terciario" icone="sair" largo onClick={sair}>
            Trocar de perfil
          </Botao>
          {temProjeto && (
            <Botao variante="terciario" icone="voltar" largo onClick={voltarAsPortas}>
              Sair da demonstração
            </Botao>
          )}
        </>
      ) : (
        <SecaoDaConta />
      )}

      <p class="rodape-versao">Pilates Central, versão {__VERSAO__}</p>

      <FolhaInferior
        aberta={confirmando}
        aoFechar={() => setConfirmando(false)}
        rotulo="Recomeçar demonstração"
        titulo="Apagar o que você fez?"
        rodape={
          <div class="linha-acoes">
            <Botao variante="secundario" onClick={() => setConfirmando(false)}>
              Agora não
            </Botao>
            <Botao variante="primario" onClick={() => void recomecar()}>
              Recomeçar
            </Botao>
          </div>
        }
      >
        <p>As presenças, avisos e reposições que você marcou somem e os dados fictícios voltam ao começo.</p>
      </FolhaInferior>
    </section>
  )
}

/** Com login de verdade: o e-mail da conta, trocar a senha e sair (vale para a equipe e o aluno). */
export function SecaoDaConta() {
  const [trocando, setTrocando] = useState(false)
  const email = emailDaConta()
  return (
    <section class="secao" aria-labelledby="titulo-conta">
      <h2 id="titulo-conta" class="micro">
        Conta
      </h2>
      {email && (
        <p class="texto-secundario">
          Você entrou como <span class="quebra-livre">{email}</span>.
        </p>
      )}
      <Botao variante="secundario" icone="editar" largo onClick={() => setTrocando(true)}>
        Trocar a senha
      </Botao>
      <Botao variante="terciario" icone="sair" largo onClick={sair}>
        Sair da conta
      </Botao>
      <FolhaDeTrocaDeSenha aberta={trocando} aoFechar={() => setTrocando(false)} />
    </section>
  )
}

export function Instalacao() {
  if (estaInstalado()) return <p class="texto-secundario">O app já está instalado neste aparelho.</p>
  if (podeInstalar.value) {
    return (
      <Botao
        variante="primario"
        icone="instalar"
        largo
        onClick={async () => {
          if (await instalar()) avisar({ texto: 'Pronto! O app está na tela inicial.', icone: 'presente' })
        }}
      >
        Instalar o app
      </Botao>
    )
  }
  if (ehIPhone()) {
    return (
      <ol class="passos">
        <li class="passo">
          <span class="passo-numero">1</span>
          <span>
            No Safari, toque em <strong>Compartilhar</strong>{' '}
            <Icone nome="compartilhar" tamanho={20} class="icone-em-linha" rotulo="(ícone de compartilhar)" />. Se ele não estiver à
            vista, fica no botão de três pontinhos, ao lado do endereço.
          </span>
        </li>
        <li class="passo">
          <span class="passo-numero">2</span>
          <span>
            Escolha <strong>Adicionar à Tela de Início</strong> (se aparecer <strong>Abrir como App Web</strong>, deixe ligado)
          </span>
        </li>
        <li class="passo">
          <span class="passo-numero">3</span>
          <span>
            Toque em <strong>Adicionar</strong>. O app abre como os outros, sem a barra do navegador.
            {/* o app da tela inicial do iPhone guarda os dados à parte do Safari: a sessão não vem junto */}
            {emailDaConta() && ' Na primeira vez, entre de novo com o e-mail e a senha: o app da tela inicial não usa o que ficou no Safari.'}
          </span>
        </li>
      </ol>
    )
  }
  return (
    <p class="texto-secundario">
      No menu do navegador (os três pontinhos), escolha <strong>Instalar app</strong> ou{' '}
      <strong>Adicionar à tela inicial</strong>.
    </p>
  )
}
