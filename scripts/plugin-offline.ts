import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'
import { linksDeAbertura } from './abertura.ts'

// Do que vai em public/, só o essencial para abrir o app sem internet.
// As fotos do espaço e as telas de abertura do iPhone ficam de fora: as fotos são da página
// pública e entram no cache quando usadas; as telas de abertura o iOS guarda ao instalar.
const PUBLICOS = /^(favicon\.svg|icones\/[^/]+\.png)$/

const MANIFESTO = 'manifest.webmanifest'

/**
 * O manifesto do app com a identidade, a página inicial e o escopo no caminho base do site
 * (src/pwa/manifest.webmanifest é o modelo). O caminho base muda conforme o repositório em que
 * o site é publicado (ver scripts/caminho-base.ts), então ele entra aqui, no build, em vez de
 * ficar escrito no arquivo.
 */
export function manifestoDoSite(modelo: string, base: string): string {
  const manifesto = JSON.parse(modelo) as Record<string, unknown>
  return JSON.stringify({ ...manifesto, id: base, start_url: base, scope: base }, null, 2)
}

// Fontes: só o subconjunto latino (português). Os outros só baixam se a página pedir.
const FONTE_DE_OUTRO_ALFABETO = /(latin-ext|cyrillic|vietnamese|greek)/

function listar(pasta: string): string[] {
  const saida: string[] = []
  const andar = (atual: string) => {
    for (const nome of readdirSync(atual)) {
      const caminho = join(atual, nome)
      if (statSync(caminho).isDirectory()) andar(caminho)
      else saida.push(relative(pasta, caminho).split(sep).join('/'))
    }
  }
  andar(pasta)
  return saida
}

export function precachear(nome: string): boolean {
  if (nome.endsWith('.map')) return false
  if (nome === 'sw.js') return false
  // o SDK do Firebase só é baixado quando o app tem projeto configurado
  if (/firebase/i.test(nome)) return false
  if (/\.woff2?$/.test(nome) && FONTE_DE_OUTRO_ALFABETO.test(nome)) return false
  return true
}

/**
 * Script embutido que pré-carrega as fontes. A pré-carga só é aproveitada se pedir a fonte do
 * mesmo jeito que o CSS pede, e os motores pedem diferente: o Chrome busca a fonte do CSS com
 * CORS (a pré-carga precisa de crossorigin); o WebKit (Safari e todo navegador do iPhone) busca
 * sem CORS (com crossorigin, não casa). Medido nos dois: com o atributo errado, a fonte baixa
 * duas vezes, 59 kB a mais na primeira visita. Por isso a pré-carga é montada aqui, conforme o
 * motor, e não numa <link> fixa no HTML.
 */
export function preCargaDasFontes(fontes: string[]): string {
  return [
    '(function (fontes) {',
    "  var semCors = navigator.vendor === 'Apple Computer, Inc.'",
    '  for (var i = 0; i < fontes.length; i++) {',
    "    var l = document.createElement('link')",
    "    l.rel = 'preload'",
    "    l.as = 'font'",
    "    l.type = 'font/woff2'",
    '    l.href = fontes[i]',
    "    if (!semCors) l.crossOrigin = 'anonymous'",
    '    document.head.appendChild(l)',
    '  }',
    `})(${JSON.stringify(fontes)})`,
  ].join('\n')
}

export function servicoOffline(): Plugin {
  let pastaPublica = ''
  let raiz = ''
  let base = '/'
  const manifesto = () => manifestoDoSite(readFileSync(join(raiz, 'src/pwa', MANIFESTO), 'utf8'), base)
  return {
    name: 'servico-offline',
    enforce: 'post',
    configResolved(config) {
      pastaPublica = config.publicDir
      raiz = config.root
      base = config.base
    },
    // em desenvolvimento o manifesto não existe como arquivo: sai daqui, já com o caminho base
    configureServer(servidor) {
      servidor.middlewares.use((pedido, resposta, proximo) => {
        if (new URL(pedido.url ?? '/', 'http://x').pathname !== `${base}${MANIFESTO}`) return proximo()
        resposta.setHeader('content-type', 'application/manifest+json')
        resposta.end(manifesto())
      })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // as telas de abertura do app instalado no iPhone, só na página do app (a que se instala);
        // uma <link> por tamanho de tela e por tema, com o caminho base (ver scripts/abertura.ts)
        const comAbertura = html.includes('rel="apple-touch-icon"')
          ? html.replace(/(<link rel="apple-touch-icon"[^>]*>)/, (tag) => [tag, ...linksDeAbertura(base)].join('\n    '))
          : html
        if (!ctx.bundle) return comAbertura
        // pré-carrega as duas fontes latinas para o texto não "pular" na primeira visita
        // (endereço absoluto: as páginas em subpastas, como experimental/, também acham a fonte)
        const fontes = Object.keys(ctx.bundle)
          .filter((nome) => /latin-wght-normal.*\.woff2$/.test(nome) && !FONTE_DE_OUTRO_ALFABETO.test(nome))
          .map((nome) => `${base}${nome}`)
        if (fontes.length === 0) return comAbertura
        // logo depois do título, antes das folhas de estilo: um script embutido depois delas só
        // roda quando elas chegam, e a pré-carga atrasaria
        return comAbertura.replace('</title>', `</title>\n    <script>${preCargaDasFontes(fontes)}</script>`)
      },
    },
    generateBundle(_opcoes, bundle) {
      const doBundle = Object.keys(bundle).filter(precachear)
      const publicos = listar(pastaPublica).filter((nome) => PUBLICOS.test(nome))
      // páginas pelo endereço que a pessoa abre: experimental/index.html vira experimental/
      const paginas = doBundle.map((n) => (n === 'index.html' ? './' : n.endsWith('/index.html') ? n.slice(0, -'index.html'.length) : n))
      const conteudoDoManifesto = manifesto()
      const arquivos = [...new Set([...paginas, ...publicos, MANIFESTO])].sort()
      const hash = createHash('sha256')
      for (const nome of doBundle) {
        const item = bundle[nome]
        if (!item) continue
        hash.update(nome)
        hash.update(item.type === 'chunk' ? item.code : item.source)
      }
      for (const nome of publicos) hash.update(readFileSync(join(pastaPublica, nome)))
      hash.update(conteudoDoManifesto)
      this.emitFile({ type: 'asset', fileName: MANIFESTO, source: conteudoDoManifesto })
      const versao = hash.digest('hex').slice(0, 12)
      const modelo = readFileSync(join(raiz, 'src/pwa/sw.js'), 'utf8')
      const fonte = modelo
        .replace("/*VERSAO*/ 'dev'", JSON.stringify(versao))
        .replace('/*ARQUIVOS*/ []', JSON.stringify(arquivos))
      if (fonte === modelo) this.error('modelo do service worker sem os marcadores esperados')
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: fonte })
    },
  }
}

// Política de segurança de conteúdo para o site publicado. O GitHub Pages não deixa mandar
// cabeçalhos, então ela vai numa <meta>. Os scripts embutidos (o do tema e o da pré-carga das
// fontes) entram pelo hash; qualquer outro script embutido fica bloqueado. Com projeto Firebase
// configurado no build, o app conversa com o login e com o Firestore (por REST, no SDK "lite");
// sem projeto, nem isso é liberado. Com o App Check, entram só os endereços do reCAPTCHA v3 e
// da troca de token. Trusted Types: HTML e endereços de script por texto só passam pela
// política padrão do app (src/app/confianca.ts); quem não suporta ignora a diretiva. O script do
// reCAPTCHA cria a própria política ('goog#html', da biblioteca do Google) para montar o que
// ele desenha; sem ela no "trusted-types", ele caía na política padrão do app, que recusa HTML
// por texto, quebrava, e o App Check ficava sem token fora de localhost.
const DO_FIREBASE = [
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firestore.googleapis.com',
]

const DO_APP_CHECK = {
  script: ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
  frame: ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/'],
  connect: ['https://content-firebaseappcheck.googleapis.com'],
  politicas: ['goog#html'],
}

export interface OpcoesDaPolitica {
  comFirebase: boolean
  comAppCheck: boolean
  /** hashes dos scripts embutidos, já no formato 'sha256-...' */
  hashes: readonly string[]
}

/** As diretivas da política, uma por item. */
export function regrasDaPolitica({ comFirebase, comAppCheck, hashes }: OpcoesDaPolitica): string[] {
  const script = ["'self'", ...hashes, ...(comAppCheck ? DO_APP_CHECK.script : [])]
  const connect = ["'self'", ...(comFirebase ? DO_FIREBASE : []), ...(comAppCheck ? DO_APP_CHECK.connect : [])]
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${comAppCheck ? DO_APP_CHECK.frame.join(' ') : "'none'"}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    `trusted-types ${['default', ...(comAppCheck ? DO_APP_CHECK.politicas : [])].join(' ')}`,
  ]
}

export function hashesDosScriptsEmbutidos(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1] ?? '').digest('base64')}'`,
  )
}

export function politicaDeSeguranca(): Plugin {
  let comFirebase = false
  let comAppCheck = false
  return {
    name: 'politica-de-seguranca',
    apply: 'build',
    // depois do servico-offline (que embute o script da pré-carga das fontes): o hash de todo
    // script embutido precisa estar na política
    enforce: 'post',
    configResolved(config) {
      comFirebase = Boolean(config.env.VITE_FIREBASE_PROJECT_ID)
      comAppCheck = comFirebase && Boolean(String(config.env.VITE_FIREBASE_APPCHECK_SITE_KEY ?? '').trim())
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const regras = regrasDaPolitica({ comFirebase, comAppCheck, hashes: hashesDosScriptsEmbutidos(html) })
        const meta = `<meta http-equiv="Content-Security-Policy" content="${regras.join('; ')}" />`
        // logo depois do charset: a política vale antes de qualquer script
        return html.replace(/(<meta charset="utf-8" \/>)/, `$1\n    ${meta}`)
      },
    },
  }
}
