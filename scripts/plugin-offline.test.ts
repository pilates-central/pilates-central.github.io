import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hashesDosScriptsEmbutidos, manifestoDoSite, precachear, regrasDaPolitica } from './plugin-offline.ts'

describe('manifesto do app', () => {
  const modelo = readFileSync(new URL('../src/pwa/manifest.webmanifest', import.meta.url), 'utf8')

  it('identidade, página inicial e escopo seguem o caminho base do site', () => {
    const publicado = JSON.parse(manifestoDoSite(modelo, '/pilates-central-web/')) as Record<string, unknown>
    expect(publicado.id).toBe('/pilates-central-web/')
    expect(publicado.start_url).toBe('/pilates-central-web/')
    expect(publicado.scope).toBe('/pilates-central-web/')
    const naRaiz = JSON.parse(manifestoDoSite(modelo, '/')) as Record<string, unknown>
    expect(naRaiz.id).toBe('/')
    expect(naRaiz.start_url).toBe('/')
    expect(naRaiz.scope).toBe('/')
  })

  it('o resto do modelo fica como está', () => {
    const publicado = JSON.parse(manifestoDoSite(modelo, '/')) as Record<string, unknown>
    expect(publicado.name).toBe('Pilates Central')
    expect(publicado.display).toBe('standalone')
    expect(Array.isArray(publicado.icons)).toBe(true)
  })
})

describe('política de segurança do site', () => {
  it('sem projeto: tudo do próprio site, nada de inline em script, Trusted Types exigido', () => {
    const regras = regrasDaPolitica({ comFirebase: false, comAppCheck: false, hashes: ["'sha256-abc'"] })
    expect(regras).toContain("script-src 'self' 'sha256-abc'")
    expect(regras).toContain("connect-src 'self'")
    expect(regras).toContain("frame-src 'none'")
    expect(regras).toContain("require-trusted-types-for 'script'")
    expect(regras).toContain('trusted-types default')
    expect(regras.join('; ')).not.toMatch(/unsafe-inline|unsafe-eval|google|gstatic|recaptcha/)
  })

  it('com projeto: só o login, o token e o Firestore entram em connect-src', () => {
    const regras = regrasDaPolitica({ comFirebase: true, comAppCheck: false, hashes: [] })
    expect(regras).toContain(
      "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com",
    )
    expect(regras).toContain("script-src 'self'")
    expect(regras.join('; ')).not.toMatch(/recaptcha|appcheck|analytics|gtag/)
  })

  it('com App Check: o reCAPTCHA v3 e a troca de token, e nada além disso', () => {
    const regras = regrasDaPolitica({ comFirebase: true, comAppCheck: true, hashes: [] })
    expect(regras).toContain("script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/")
    expect(regras).toContain('frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/')
    expect(regras.find((r) => r.startsWith('connect-src'))).toContain('https://content-firebaseappcheck.googleapis.com')
    expect(regras).toContain("style-src 'self'")
    // a política própria do reCAPTCHA; sem ela, ele quebra na política padrão do app
    expect(regras).toContain('trusted-types default goog#html')
    expect(regras).toContain("require-trusted-types-for 'script'")
    expect(regras.join('; ')).not.toMatch(/unsafe-inline|googletagmanager|google-analytics|allow-duplicates/)
  })

  it('cada script embutido vira um hash', () => {
    const html = '<script>var a = 1</script><p>x</p><script>var b = 2</script>'
    const hashes = hashesDosScriptsEmbutidos(html)
    expect(hashes).toHaveLength(2)
    expect(hashes.every((h) => /^'sha256-[A-Za-z0-9+/=]+'$/.test(h))).toBe(true)
    expect(hashesDosScriptsEmbutidos('<script type="module" src="/x.js"></script>')).toEqual([])
  })
})

describe('o que o service worker guarda', () => {
  it('nunca o Firebase, os mapas nem o próprio sw.js', () => {
    expect(precachear('assets/principal-abc.js')).toBe(true)
    expect(precachear('assets/firebase-abc.js')).toBe(false)
    expect(precachear('assets/firebaseAppCheck-abc.js')).toBe(false)
    expect(precachear('assets/principal-abc.js.map')).toBe(false)
    expect(precachear('sw.js')).toBe(false)
    expect(precachear('assets/figtree-latin-wght-normal-abc.woff2')).toBe(true)
    expect(precachear('assets/figtree-cyrillic-wght-normal-abc.woff2')).toBe(false)
  })
})
