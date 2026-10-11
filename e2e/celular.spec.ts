import { gzipSync } from 'node:zlib'
import { expect, test } from './base'
import { abrirApp, arrastar, entrarComoAdministracao, esperarFolhaParada, esperarParado, esperarSemAnimacao, folha, irPara, irParaAba, servidorDoDist } from './apoio'

// Coisas de celular que o resto da suíte não pega, cada uma achada na revisão no iPhone e no
// Android (vídeo quadro a quadro, medição na tela) e conferida aqui nos dois motores.

test.describe('celular', () => {
  test('teclado aberto num campo da folha: a folha sobe até ele e o campo fica à vista', async ({ page }) => {
    // O Playwright não abre teclado de verdade; a janela visual (visualViewport) é trocada por
    // uma que encolhe como no iPhone quando o teclado sobe, sem mudar o tamanho da página
    await page.addInitScript(() => {
      const visual = new EventTarget()
      let teclado = 0
      Object.defineProperties(visual, {
        height: { get: () => window.innerHeight - teclado },
        width: { get: () => window.innerWidth },
        offsetTop: { get: () => 0 },
        offsetLeft: { get: () => 0 },
        scale: { get: () => 1 },
      })
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => visual })
      ;(window as unknown as { __teclado: (px: number) => void }).__teclado = (px: number) => {
        teclado = px
        visual.dispatchEvent(new Event('resize'))
      }
    })
    await entrarComoAdministracao(page)
    await irParaAba(page, 'Financeiro')
    await page.getByRole('button', { name: 'Lançar pagamento', exact: true }).click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('button').filter({ hasText: 'Ana Almeida' }).click()
    const observacao = folha(page).getByLabel('Observação (opcional)')
    await observacao.focus()
    const altura = await page.evaluate(() => window.innerHeight)
    const TECLADO = Math.round(altura * 0.4)
    await page.evaluate((px) => (window as unknown as { __teclado: (px: number) => void }).__teclado(px), TECLADO)
    await expect(page.locator('.folha[data-teclado]')).toHaveCount(1)
    await esperarFolhaParada(page)
    const pe = await page.evaluate(() => document.querySelector('.folha')?.getBoundingClientRect().bottom ?? 0)
    expect(Math.abs(pe - (altura - TECLADO))).toBeLessThan(2)
    // o campo e o botão de lançar ficam acima do teclado
    const campo = await observacao.boundingBox()
    expect((campo?.y ?? 0) + (campo?.height ?? 0)).toBeLessThanOrEqual(altura - TECLADO + 1)
    const lancar = await folha(page).getByRole('button', { name: /^Lançar/ }).boundingBox()
    expect((lancar?.y ?? 0) + (lancar?.height ?? 0)).toBeLessThanOrEqual(altura - TECLADO + 1)
    // e a folha inteira cabe no que sobrou da tela
    const topo = await page.evaluate(() => document.querySelector('.folha')?.getBoundingClientRect().top ?? -1)
    expect(topo).toBeGreaterThanOrEqual(0)

    // teclado fecha (o foco sai do campo): a folha volta para o pé da tela
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.evaluate(() => (window as unknown as { __teclado: (px: number) => void }).__teclado(0))
    await expect(page.locator('.folha[data-teclado]')).toHaveCount(0)
    await esperarFolhaParada(page)
    const peDepois = await page.evaluate(() => document.querySelector('.folha')?.getBoundingClientRect().bottom ?? 0)
    expect(Math.abs(peDepois - altura)).toBeLessThan(2)
  })

  test('teclado na folha de correção da importação: o WhatsApp e o Salvar correção ficam acima dele', async ({ page }) => {
    // a mesma janela visual falsa do teste de cima: no iPhone o teclado só encolhe a janela visual
    await page.addInitScript(() => {
      const visual = new EventTarget()
      let teclado = 0
      Object.defineProperties(visual, {
        height: { get: () => window.innerHeight - teclado },
        width: { get: () => window.innerWidth },
        offsetTop: { get: () => 0 },
        offsetLeft: { get: () => 0 },
        scale: { get: () => 1 },
      })
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => visual })
      ;(window as unknown as { __teclado: (px: number) => void }).__teclado = (px: number) => {
        teclado = px
        visual.dispatchEvent(new Event('resize'))
      }
    })
    await entrarComoAdministracao(page)
    await irPara(page, '#/alunos/importar')
    await page.getByLabel('Cole aqui as linhas da planilha').fill('Nome\tWhatsApp\nAna Teclado\t9000-0060\nBia Teclado\t(11) 90000-0061')
    await page.getByRole('button', { name: 'Conferir' }).click()
    await page.locator('[data-erro="sim"]').first().click()
    await esperarFolhaParada(page)
    const whatsapp = folha(page).getByLabel('WhatsApp')
    await whatsapp.focus()
    const altura = await page.evaluate(() => window.innerHeight)
    const TECLADO = Math.round(altura * 0.4)
    await page.evaluate((px) => (window as unknown as { __teclado: (px: number) => void }).__teclado(px), TECLADO)
    await expect(page.locator('.folha[data-teclado]')).toHaveCount(1)
    await esperarFolhaParada(page)
    const campo = await whatsapp.boundingBox()
    expect(campo?.y ?? -1).toBeGreaterThanOrEqual(0)
    expect((campo?.y ?? 0) + (campo?.height ?? 0)).toBeLessThanOrEqual(altura - TECLADO + 1)
    const salvar = await folha(page).getByRole('button', { name: 'Salvar correção' }).boundingBox()
    expect((salvar?.y ?? 0) + (salvar?.height ?? 0)).toBeLessThanOrEqual(altura - TECLADO + 1)
    // corrige com o teclado aberto e a linha fica pronta
    await whatsapp.fill('(11) 90000-0060')
    await folha(page).getByRole('button', { name: 'Salvar correção' }).click()
    await expect(page.getByRole('heading', { name: '2 alunos prontos', exact: true })).toBeVisible()
  })

  test('as fontes baixam uma vez só (a pré-carga casa com o pedido do CSS em cada motor)', async ({ page }) => {
    const pedidos: string[] = []
    page.on('request', (r) => {
      if (r.url().endsWith('.woff2')) pedidos.push(new URL(r.url()).pathname)
    })
    const avisos: string[] = []
    page.on('console', (m) => {
      if (/preload/i.test(m.text())) avisos.push(m.text())
    })
    await entrarComoAdministracao(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const repetidos = pedidos.filter((p, i) => pedidos.indexOf(p) !== i)
    expect(pedidos.length).toBeGreaterThanOrEqual(2)
    expect(repetidos).toEqual([])
    expect(avisos).toEqual([])
  })

  test('a demonstração abre sem baixar o Firebase, com menos de 170 kB de JS comprimido', async ({ page }) => {
    const scripts: string[] = []
    page.on('response', (r) => {
      if (new URL(r.url()).pathname.endsWith('.js')) scripts.push(r.url())
    })
    await entrarComoAdministracao(page)
    await irParaAba(page, 'Agenda')
    expect(scripts.filter((s) => /firebase/i.test(s))).toEqual([])
    let comprimido = 0
    for (const s of new Set(scripts)) {
      const corpo = await (await page.request.get(s)).body()
      comprimido += gzipSync(corpo, { level: 9 }).length
    }
    console.log(JSON.stringify({ scripts: new Set(scripts).size, jsComprimidoKB: Math.round(comprimido / 1024) }))
    expect(comprimido).toBeGreaterThan(20_000)
    expect(comprimido).toBeLessThan(170 * 1024)
  })

  test('campos com 16px ou mais: o iPhone não dá zoom ao tocar para digitar', async ({ page }) => {
    const pequenos = async () =>
      page.evaluate(() =>
        [...document.querySelectorAll('input, select, textarea')]
          .filter((c) => (c as HTMLElement).offsetParent !== null && parseFloat(getComputedStyle(c).fontSize) < 16)
          .map((c) => `${c.nodeName} ${(c as HTMLInputElement).name || c.id}: ${getComputedStyle(c).fontSize}`),
      )
    await entrarComoAdministracao(page)
    let vistos = 0
    for (const tela of ['#/alunos', '#/alunos/novo', '#/alunos/turmas/nova', '#/mais/estudio', '#/mais/equipe/convidar']) {
      await page.evaluate((h) => (location.hash = h), tela)
      await esperarParado(page, '.tela-quadro')
      vistos += await page.locator('input:visible, select:visible, textarea:visible').count()
      expect(await pequenos(), tela).toEqual([])
    }
    await irParaAba(page, 'Financeiro')
    await page.getByRole('button', { name: 'Lançar pagamento', exact: true }).click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('button').filter({ hasText: 'Ana Almeida' }).click()
    expect(await pequenos(), 'folha de pagamento').toEqual([])
    expect(vistos).toBeGreaterThan(5)
  })

  test('no modo escuro, a barra do sistema já vem escura antes de o app carregar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    // sem o script do app: vale só o que a página faz antes da primeira pintura
    await page.route(/\/assets\/principal-[^/]+\.js$/, (rota) => rota.abort())
    await page.goto('./?demo')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1C120D')
  })

  test('com o servidor fora do ar, o app instalado abre do service worker', async ({ page }) => {
    // um servidor só deste teste, para poder desligá-lo de verdade (o modo sem rede do
    // Playwright não passa pelo service worker no WebKit)
    const servidor = await servidorDoDist()
    try {
      await page.goto(`${servidor.endereco}?demo&agora=2026-10-09T10:00`)
      await page.getByRole('button', { name: 'Explorar como administração' }).click()
      await expect(page.getByRole('heading', { name: /Helena/ })).toBeVisible()
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready
      })
      await page.reload()
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
    } finally {
      await servidor.fechar()
    }
    // sem servidor nenhum: a página, os scripts, os estilos e as fontes vêm da cópia guardada
    await page.reload()
    await expect(page.getByRole('heading', { name: /Helena/ })).toBeVisible()
    await expect(page.getByText('Próxima aula')).toBeVisible()
    await irParaAba(page, 'Agenda')
    await expect(page.locator('.cartao-aula').first()).toBeVisible()
  })

  test.describe('no iPhone SE', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('trocar de dia não mexe a faixa de dias (o título não quebra linha)', async ({ page }) => {
      await entrarComoAdministracao(page)
      await irParaAba(page, 'Agenda')
      // a posição na página, e não na janela: o toque do Playwright pode rolar a página para
      // alcançar o dia (no CI, sob carga, rolou 85 px), e o que importa é o título não empurrar a faixa
      const topoDaFaixa = () =>
        page.evaluate(() => Math.round((document.querySelector('.faixa')?.getBoundingClientRect().top ?? -1) + window.scrollY))
      const antes = await topoDaFaixa()
      // dias com nome comprido e o botão "Hoje" aparecendo: nada abaixo do título se mexe
      for (const dia of ['2026-10-10', '2026-10-14', '2026-10-05', '2026-09-27', '2026-10-09']) {
        await page.locator(`[data-dia="${dia}"]`).click()
        await expect(page.locator(`[data-dia="${dia}"]`)).toHaveAttribute('aria-pressed', 'true')
        expect(await topoDaFaixa(), dia).toBe(antes)
        const cortado = await page.locator('#titulo-agenda').evaluate((h) => h.scrollWidth > h.clientWidth)
        expect(cortado, dia).toBe(false)
      }
    })
  })

  test('a folha desce com o conteúdo que tinha, e não responde enquanto sai', async ({ page }) => {
    await abrirApp(page)
    await page.getByRole('button', { name: 'Explorar como professor' }).click()
    await esperarFolhaParada(page)
    // anota cada texto que a folha mostrar dali em diante, até ela sair da página
    await page.evaluate(() => {
      const w = window as unknown as { __textos: string[]; __inerte: boolean[] }
      w.__textos = []
      w.__inerte = []
      const f = document.querySelector('.folha')
      if (!f) return
      new MutationObserver(() => {
        w.__textos.push(f.textContent ?? '')
        w.__inerte.push((f as HTMLElement).inert)
      }).observe(f, { subtree: true, childList: true, characterData: true, attributes: true })
    })
    await page.keyboard.press('Escape')
    await expect(folha(page)).toHaveCount(0)
    const { textos, inerte } = await page.evaluate(() => {
      const w = window as unknown as { __textos: string[]; __inerte: boolean[] }
      return { textos: w.__textos, inerte: w.__inerte }
    })
    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) {
      expect(t).toContain('Explorar como professor')
      // a lista da equipe inteira (com a responsável) nunca aparece no lugar da dos professores
      expect(t).not.toContain('Helena Prado')
    }
    expect(inerte.every(Boolean)).toBe(true)
  })

  test('confirmar o encaixe: a folha desce com a aula escolhida, sem virar "sem vaga" no caminho', async ({ page }) => {
    await entrarComoAdministracao(page)
    await irPara(page, '#/alunos/reposicoes')
    await page.locator('[data-credito]').first().getByRole('button', { name: 'Encaixar' }).click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('radio').first().click()
    const confirmar = folha(page).getByRole('button', { name: /^Encaixar / })
    await expect(confirmar).toBeVisible()
    // a ação muda os dados (o crédito foi usado) um instante antes de a folha fechar; o que
    // importa é o que chega à tela, então a folha é lida a cada quadro até sumir
    await page.evaluate(() => {
      const w = window as unknown as { __textos: string[] }
      w.__textos = []
      const quadro = () => {
        const f = document.querySelector('.folha')
        if (!f) return
        w.__textos.push(f.textContent ?? '')
        requestAnimationFrame(quadro)
      }
      requestAnimationFrame(quadro)
    })
    await confirmar.click()
    await expect(folha(page)).toHaveCount(0)
    const textos = await page.evaluate(() => (window as unknown as { __textos: string[] }).__textos)
    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) expect(t).not.toMatch(/sem vaga/i)
  })

  test('o aviso que estava no alto com a folha aberta reaparece embaixo quando ela fecha', async ({ page }) => {
    await entrarComoAdministracao(page, '2026-10-09T17:45')
    await page.getByRole('button', { name: 'Abrir chamada', exact: true }).click()
    await esperarFolhaParada(page)
    await folha(page).locator('[data-aluno]').nth(1).getByRole('button', { name: 'Presente' }).click()
    await expect(page.locator('.avisos--topo .aviso')).toBeVisible()
    // o aviso já terminou de entrar no alto
    await page.waitForFunction(() => document.querySelector('.aviso')?.getAnimations().every((a) => a.playState !== 'running'))
    await page.evaluate(() => {
      const w = window as unknown as { __entrou: boolean }
      w.__entrou = false
      const caixa = document.querySelector('.avisos')
      if (!caixa) return
      // quando o aviso troca de lugar, ele entra de novo (opacidade e deslocamento), sem saltar
      new MutationObserver(() => {
        if (caixa.classList.contains('avisos--topo')) return
        const aviso = caixa.querySelector<HTMLElement>('.aviso')
        const quadros =
          aviso
            ?.getAnimations()
            .filter((a) => a.playState === 'running')
            .flatMap((a) => (a.effect as KeyframeEffect | null)?.getKeyframes() ?? []) ?? []
        if (quadros.some((k) => Number(k.opacity) === 0)) w.__entrou = true
      }).observe(caixa, { attributes: true, attributeFilter: ['class'] })
    })
    await page.keyboard.press('Escape')
    await expect(folha(page)).toHaveCount(0)
    await expect(page.locator('.avisos:not(.avisos--topo) .aviso')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __entrou: boolean }).__entrou)).toBe(true)
  })

  test('soltar o dedo depois de arrastar o dia: a lista continua para o mesmo lado, sem voltar', async ({ page }) => {
    await entrarComoAdministracao(page)
    await irParaAba(page, 'Agenda')
    await page.evaluate(() => {
      const w = window as unknown as { __x: number[]; __solto: boolean }
      w.__x = []
      w.__solto = false
      document.addEventListener('pointerup', () => (w.__solto = true), { capture: true })
      const quadro = () => {
        const el = document.querySelector('.agenda-dia-conteudo')
        if (w.__solto && el) {
          const t = getComputedStyle(el).transform
          w.__x.push(t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41)
        }
        if (w.__x.length < 40) requestAnimationFrame(quadro)
      }
      requestAnimationFrame(quadro)
    })
    const caixa = await page.locator('.agenda-dia').boundingBox()
    if (!caixa) throw new Error('lista sem caixa')
    const y = caixa.y + 60
    // arraste longo, para além da metade: antes, a lista largada voltava um pedaço antes de sumir
    await arrastar(page, { x: caixa.x + caixa.width * 0.9, y }, { x: caixa.x + caixa.width * 0.1, y: y + 4 }, 16)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sábado, 10 de outubro')
    await esperarParado(page, '.agenda-dia-conteudo')
    const x = await page.evaluate(() => (window as unknown as { __x: number[] }).__x)
    // até o dia novo entrar (quando o x pula para o outro lado), só anda para a esquerda
    const saida = x.slice(0, Math.max(1, x.findIndex((v) => v > 0)))
    for (let i = 1; i < saida.length; i++) expect(saida[i], `quadro ${i}: ${saida.join(', ')}`).toBeLessThanOrEqual((saida[i - 1] ?? 0) + 0.5)
  })

  test('trocar de seção: o cabeçalho fica, a marca desliza até a seção nova e só o conteúdo entra', async ({ page, browserName }) => {
    await entrarComoAdministracao(page)
    await irParaAba(page, 'Alunos')
    const secoes = page.getByRole('navigation', { name: 'Seções' })
    // a mesma nav antes e depois (marcada aqui), e a marca a partir do lugar antigo
    await secoes.evaluate((el) => el.setAttribute('data-mesma', '1'))
    const antes = await page.locator('.secoes-marca').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)
    await page.evaluate(() => {
      const w = window as unknown as { __marca: number[] }
      w.__marca = []
      const marca = document.querySelector('.secoes-marca') as HTMLElement
      const quadro = () => {
        w.__marca.push(new DOMMatrixReadOnly(getComputedStyle(marca).transform).m41)
        if (w.__marca.length < 40) requestAnimationFrame(quadro)
      }
      requestAnimationFrame(quadro)
    })
    await secoes.getByRole('button', { name: 'Reposições' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reposições')
    await expect(secoes).toHaveAttribute('data-mesma', '1')
    await esperarSemAnimacao(page, '.secoes-marca')
    await esperarParado(page, '.secao-quadro')
    const depois = await page.locator('.secoes-marca').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)
    expect(depois).toBeGreaterThan(antes + 100)
    // passou por posições do meio: deslizou, em vez de aparecer já no lugar. Só no Chromium: no
    // WebKit do contêiner (sem GPU) um quadro pode levar mais que a transição inteira, e a
    // amostra só vê o começo e o fim (4, 4, 4, 237, 237 numa rodada)
    const x = await page.evaluate(() => (window as unknown as { __marca: number[] }).__marca)
    if (browserName === 'chromium') expect(x.some((v) => v > antes + 10 && v < depois - 10), x.join(', ')).toBe(true)
    // o conteúdo da seção tem o quadro dele; a tela (com o cabeçalho) é a mesma
    await expect(page.locator('.tela-quadro .secao-quadro')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Para encaixar' })).toBeVisible()
  })

  test('a lista de alunos monta em partes: os primeiros no primeiro quadro, o resto logo depois', async ({ page }) => {
    await entrarComoAdministracao(page)
    const noPrimeiroQuadro = await page.evaluate(() => {
      const botao = [...document.querySelectorAll('nav[aria-label="Principal"] button')].find((b) => b.textContent?.includes('Alunos')) as HTMLButtonElement
      botao.click()
      // depois que o Preact pintou a tela nova (um quadro), antes de a parte seguinte entrar
      return new Promise<number>((r) => requestAnimationFrame(() => r(document.querySelectorAll('[data-aluno]').length)))
    })
    expect(noPrimeiroQuadro).toBeGreaterThan(0)
    expect(noPrimeiroQuadro).toBeLessThanOrEqual(16)
    const total = Number(((await page.locator('.secao > .texto-secundario').first().textContent()) ?? '0').replace(/\D/g, ''))
    expect(total).toBeGreaterThan(16)
    await expect(page.locator('[data-aluno]')).toHaveCount(total)
  })
})
