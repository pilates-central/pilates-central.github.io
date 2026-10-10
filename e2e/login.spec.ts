// O login explicando o que aconteceu, nos dois motores. A primeira parte simula as respostas do
// Firebase (não precisa de emulador): é o caso que o estúdio viveu no primeiro acesso, com o
// Authentication nunca iniciado no console. A segunda parte usa os emuladores (EMULADOR=1):
// confirmação do e-mail com reenvio, senha nova pelo link, troca de senha e a sessão que não
// fica no aparelho.
import { aviso, BASE, esperarFolhaParada, folha, irParaAba } from './apoio'
import { expect, test } from './base'
import { AUTH, CONTAS, contaDeSenhaDoMotor, definirSenhaPeloEmail, emailsEnviados, linkDeConfirmacao, SENHA } from './firebase/contas'
import { abrirLogin, entrarComo, liberarEnderecoLocal, preencherLogin } from './firebase/navegar'

// Sem service worker: no WebKit, pedido que passa pelo service worker (ele reivindica a página
// já na primeira visita) não é alcançado pela rota do Playwright, e aqui as respostas do Firebase
// são simuladas por rota. O teste do cache, lá embaixo, liga o service worker de novo.
test.use({ bypassCSP: true, serviceWorkers: 'block' })

test.beforeEach(({ context, browserName }) => liberarEnderecoLocal(context, browserName))

const API = `${AUTH}/identitytoolkit.googleapis.com/v1/`

/** A resposta de erro da API do Firebase, como ela vem de verdade. */
const respostaDeErro = (mensagem: string) => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({ error: { code: 400, message: mensagem, errors: [{ message: mensagem, domain: 'global', reason: 'invalid' }] } }),
})

const alerta = (page: Parameters<typeof abrirLogin>[0]) => page.getByRole('alert')

test.describe('login: o que o Firebase respondeu, em português', () => {
  test('Authentication não iniciado no console: diz o que falta, com o código só em Detalhes', async ({ page }) => {
    // o que a API devolve enquanto ninguém tocou em "Começar" no Authentication do projeto
    await page.route(`${API}accounts:*`, (rota) => rota.fulfill(respostaDeErro('CONFIGURATION_NOT_FOUND')))
    await abrirLogin(page)
    await page.getByRole('button', { name: 'Primeiro acesso? Criar conta' }).click()
    await preencherLogin(page, 'responsavel@example.com')
    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click()
    await expect(alerta(page)).toHaveText(/O login por e-mail e senha ainda não foi ativado no Firebase deste projeto/)
    await expect(alerta(page)).toContainText('docs/firebase.md')
    await expect(alerta(page)).not.toContainText('auth/')
    await page.getByRole('button', { name: 'Detalhes' }).click()
    await expect(page.locator('.erro-detalhe')).toContainText('auth/configuration-not-found')
    await page.getByRole('button', { name: 'Esconder os detalhes' }).click()
    await expect(page.locator('.erro-detalhe')).toHaveCount(0)

    // entrar responde a mesma coisa
    await page.getByRole('button', { name: 'Já tenho conta' }).click()
    await preencherLogin(page, 'responsavel@example.com')
    await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(alerta(page)).toHaveText(/ainda não foi ativado no Firebase/)
  })

  test('método desligado, sem rede, tentativas demais, e-mail inválido e senha fraca: cada um com a sua frase', async ({ page }) => {
    await abrirLogin(page)
    await preencherLogin(page, CONTAS.professor.email)
    const entrar = page.locator('form').getByRole('button', { name: 'Entrar', exact: true })

    const casos: [string, RegExp][] = [
      ['OPERATION_NOT_ALLOWED', /ainda não foi ativado no Firebase/],
      ['TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled.', /Muitas tentativas seguidas/],
      ['INVALID_LOGIN_CREDENTIALS', /^E-mail ou senha não conferem\.$/],
      ['INVALID_EMAIL', /Confira o e-mail/],
    ]
    for (const [mensagem, frase] of casos) {
      await page.route(`${API}accounts:signInWithPassword*`, (rota) => rota.fulfill(respostaDeErro(mensagem)))
      await entrar.click()
      await expect(alerta(page), mensagem).toHaveText(frase)
      await expect(alerta(page)).not.toContainText('auth/')
      await page.unroute(`${API}accounts:signInWithPassword*`)
    }

    // a rede caiu (ou um bloqueador cortou o pedido)
    await page.route(`${API}accounts:signInWithPassword*`, (rota) => rota.abort('failed'))
    await entrar.click()
    await expect(alerta(page)).toHaveText(/Sem conexão com o login/)
    await page.unroute(`${API}accounts:signInWithPassword*`)

    // criar conta: senha fraca pelo projeto e e-mail já usado (frase que não revela a conta)
    await page.getByRole('button', { name: 'Primeiro acesso? Criar conta' }).click()
    await preencherLogin(page, 'alguem@example.com')
    const criar = page.locator('form').getByRole('button', { name: 'Criar conta' })
    await page.route(`${API}accounts:signUp*`, (rota) => rota.fulfill(respostaDeErro('WEAK_PASSWORD : Password should be at least 6 characters')))
    await criar.click()
    await expect(alerta(page)).toHaveText(/pelo menos 8 caracteres/)
    await page.unroute(`${API}accounts:signUp*`)
    await page.route(`${API}accounts:signUp*`, (rota) => rota.fulfill(respostaDeErro('EMAIL_EXISTS')))
    await criar.click()
    await expect(alerta(page)).toHaveText(/Não deu para criar a conta com este e-mail\. Se você já tem conta/)
    await expect(alerta(page)).not.toContainText(/já (está em uso|existe|cadastrad)/)
  })

  test('chave do projeto restrita a outro site e domínio fora da lista do Firebase: cada um com a sua frase', async ({ page }) => {
    await abrirLogin(page)
    await preencherLogin(page, CONTAS.professor.email)
    // a chave de API restrita por site (Google Cloud) sem este endereço: a API responde 403 com o
    // texto do próprio Google, que o SDK transforma em "auth/requests-from-referer-..."
    const bloqueado = `Requests from referer ${new URL(page.url()).origin}/ are blocked.`
    await page.route(`${API}accounts:signInWithPassword*`, (rota) =>
      rota.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 403,
            message: bloqueado,
            errors: [{ message: bloqueado, domain: 'global', reason: 'forbidden' }],
            status: 'PERMISSION_DENIED',
            details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_HTTP_REFERRER_BLOCKED' }],
          },
        }),
      }),
    )
    await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(alerta(page)).toHaveText(/A chave do projeto Firebase não vale para este site/)
    await expect(alerta(page)).not.toContainText('auth/')
    await page.getByRole('button', { name: 'Detalhes' }).click()
    await expect(page.locator('.erro-detalhe')).toContainText('auth/requests-from-referer')
    await page.unroute(`${API}accounts:signInWithPassword*`)

    // o endereço do site fora de "Domínios autorizados" (o Firebase recusa o pedido do e-mail)
    await page.route(`${API}accounts:sendOobCode*`, (rota) => rota.fulfill(respostaDeErro('UNAUTHORIZED_DOMAIN : Domain not allowlisted by project')))
    await page.getByRole('button', { name: 'Esqueci a senha' }).click()
    await esperarFolhaParada(page)
    await folha(page).getByLabel('E-mail').fill(CONTAS.professor.email)
    await folha(page).getByRole('button', { name: 'Enviar o link' }).click()
    await expect(folha(page).getByRole('alert')).toHaveText(/Este endereço do site não está autorizado no Firebase/)
    await expect(folha(page).getByRole('alert')).not.toContainText('auth/')
  })

  test('a força da senha aparece ao criar a conta, sem exigir símbolo', async ({ page }) => {
    await abrirLogin(page)
    await page.getByRole('button', { name: 'Primeiro acesso? Criar conta' }).click()
    const senha = page.getByLabel('Senha', { exact: true })
    await expect(page.locator('.medidor-senha')).toHaveCount(0)
    await senha.fill('abc')
    await expect(page.locator('.medidor-senha')).toHaveAttribute('data-nivel', '0')
    await expect(page.locator('.medidor-senha')).toContainText('Faltam 5 caracteres')
    await senha.fill('12345678')
    await expect(page.locator('.medidor-senha')).toHaveAttribute('data-nivel', '1')
    await senha.fill('girassol7')
    await expect(page.locator('.medidor-senha')).toHaveAttribute('data-nivel', '2')
    await senha.fill('gato no sofa de manha')
    await expect(page.locator('.medidor-senha')).toHaveAttribute('data-nivel', '3')
    await expect(page.locator('.medidor-senha')).toContainText('Forte')
  })
})

test.describe('login com os emuladores', () => {
  test.skip(!process.env.EMULADOR, 'precisa dos emuladores do Firebase (EMULADOR=1)')

  test('confirmar o e-mail: o endereço na tela, reenviar com espera de 60 s e "Já confirmei" só depois do link', async ({ page }, info) => {
    test.setTimeout(90_000)
    const email = `confirma-${info.project.name}@example.com`
    // o relógio da página fica sob controle: a espera de 60 segundos anda sem esperar de verdade
    await page.clock.install()
    await abrirLogin(page)
    await page.getByRole('button', { name: 'Primeiro acesso? Criar conta' }).click()
    await preencherLogin(page, email)

    // a conta sai, mas o primeiro e-mail falha (cota do dia): a tela diz o motivo e deixa reenviar
    await page.route(`${API}accounts:sendOobCode*`, (rota) => rota.fulfill(respostaDeErro('QUOTA_EXCEEDED')))
    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByRole('heading', { name: 'Falta só um passo.' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(email)).toBeVisible()
    await expect(page.getByText(/caixa de spam/)).toBeVisible()
    await expect(alerta(page)).toHaveText(/limite de e-mails do dia/)
    await page.getByRole('button', { name: 'Detalhes' }).click()
    await expect(page.locator('.erro-detalhe')).toContainText('auth/quota-exceeded')
    await page.unroute(`${API}accounts:sendOobCode*`)
    expect((await emailsEnviados()).filter((c) => c.email === email)).toHaveLength(0)

    // reenviar: sai de verdade, e a espera de 60 segundos começa
    const reenviar = page.getByRole('button', { name: /^Reenviar/ })
    await expect(reenviar).toBeEnabled()
    await reenviar.click()
    await expect(page.getByRole('status')).toHaveText(`Enviamos de novo para ${email}. Olhe também a caixa de spam.`)
    await expect(reenviar).toHaveText(/Reenviar em (60|59|58) s/)
    await expect(reenviar).toBeDisabled()
    expect((await emailsEnviados()).filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL')).toHaveLength(1)

    // sem tocar no link, "Já confirmei" recarrega a conta e explica
    await page.getByRole('button', { name: 'Já confirmei' }).click()
    await expect(page.getByRole('status')).toHaveText(/Ainda não aparece como confirmado/)

    // a contagem anda e o botão volta
    await page.clock.fastForward(30_000)
    await expect(reenviar).toHaveText(/Reenviar em (30|29|28) s/)
    await page.clock.fastForward(31_000)
    await expect(reenviar).toHaveText('Reenviar o e-mail')
    await expect(reenviar).toBeEnabled()
    await reenviar.click()
    await expect(page.getByRole('status')).toHaveText(/Enviamos de novo/)
    await expect(reenviar).toBeDisabled()
    expect((await emailsEnviados()).filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL')).toHaveLength(2)

    // o link do e-mail (o mais novo) confirma; sem convite, a conta para na tela certa
    expect((await page.request.get(await linkDeConfirmacao(email))).ok()).toBe(true)
    await page.getByRole('button', { name: 'Já confirmei' }).click()
    await expect(page.getByRole('heading', { name: 'Ainda não dá para entrar.' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Este e-mail ainda não tem convite.')).toBeVisible()
  })

  test('senha nova pelo link do e-mail, e trocar a senha pelo app com a atual conferida', async ({ page }, info) => {
    test.setTimeout(90_000)
    const conta = contaDeSenhaDoMotor(info.project.name)
    const senhaDoLink = 'frase comprida do link 1'

    await abrirLogin(page)
    await page.getByRole('button', { name: 'Esqueci a senha' }).click()
    await esperarFolhaParada(page)
    await folha(page).getByLabel('E-mail').fill(conta.email)
    await folha(page).getByRole('button', { name: 'Enviar o link' }).click()
    await expect(folha(page).getByRole('status')).toContainText('Se houver uma conta com este e-mail')
    await expect(folha(page).getByRole('status')).toContainText(conta.email)
    // o que a pessoa faz na página do link: escolhe a senha nova
    await definirSenhaPeloEmail(conta.email, senhaDoLink)
    await folha(page).getByRole('button', { name: 'Voltar para entrar' }).click()
    await expect(folha(page)).toHaveCount(0)

    const entrar = page.locator('form').getByRole('button', { name: 'Entrar', exact: true })
    await preencherLogin(page, conta.email, SENHA)
    await entrar.click()
    await expect(alerta(page)).toHaveText('E-mail ou senha não conferem.')
    await preencherLogin(page, conta.email, senhaDoLink)
    await entrar.click()
    await expect(page.getByRole('heading', { level: 1, name: /Olivia|Otavio/ })).toBeVisible({ timeout: 15_000 })

    // trocar pelo app: a senha atual errada é recusada com a frase certa
    await irParaAba(page, 'Mais')
    await expect(page.getByText(`Você entrou como ${conta.email}.`)).toBeVisible()
    await page.getByRole('button', { name: 'Trocar a senha' }).click()
    await esperarFolhaParada(page)
    await folha(page).getByLabel('Senha atual').fill('nao-e-esta-senha')
    await folha(page).getByLabel('Senha nova').fill(SENHA)
    await expect(folha(page).locator('.medidor-senha')).toBeVisible()
    await folha(page).getByRole('button', { name: 'Trocar a senha' }).click()
    await expect(folha(page).getByRole('alert')).toHaveText('A senha atual não confere.')
    await folha(page).getByLabel('Senha atual').fill(senhaDoLink)
    await folha(page).getByRole('button', { name: 'Trocar a senha' }).click()
    await expect(aviso(page, /Senha trocada/)).toBeVisible()
    await expect(folha(page)).toHaveCount(0)

    // sair, e entrar com a senha trocada
    await page.getByRole('button', { name: 'Sair da conta' }).click()
    await expect(page.getByRole('heading', { name: 'Que bom ver você.' })).toBeVisible({ timeout: 15_000 })
    await preencherLogin(page, conta.email, SENHA)
    await entrar.click()
    await expect(page.getByRole('heading', { level: 1, name: /Olivia|Otavio/ })).toBeVisible({ timeout: 15_000 })
  })

  test('"Lembrar neste aparelho" desligado: a sessão fica só nesta aba', async ({ page, context }) => {
    await abrirLogin(page)
    await preencherLogin(page, CONTAS.professor.email)
    const lembrar = page.getByRole('switch', { name: 'Lembrar neste aparelho' })
    await expect(lembrar).toHaveAttribute('aria-checked', 'true')
    await lembrar.click()
    await expect(lembrar).toHaveAttribute('aria-checked', 'false')
    await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: /Camila/ })).toBeVisible({ timeout: 15_000 })

    // outra aba do mesmo navegador: sem sessão
    const outra = await context.newPage()
    await outra.goto('./?emulador=1')
    await expect(outra.getByRole('heading', { name: 'Que bom ver você.' })).toBeVisible({ timeout: 15_000 })
    await outra.close()

    // com "lembrar" ligado (o padrão), a aba nova abre direto no app
    await irParaAba(page, 'Mais')
    await page.getByRole('button', { name: 'Sair da conta' }).click()
    await expect(page.getByRole('heading', { name: 'Que bom ver você.' })).toBeVisible({ timeout: 15_000 })
    await preencherLogin(page, CONTAS.professor.email)
    await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: /Camila/ })).toBeVisible({ timeout: 15_000 })
    const terceira = await context.newPage()
    await terceira.goto('./?emulador=1')
    await expect(terceira.getByRole('heading', { level: 1, name: /Camila/ })).toBeVisible({ timeout: 15_000 })
    await terceira.close()
  })

  test.describe('com o service worker', () => {
    test.use({ serviceWorkers: 'allow' })

    test('o cache do service worker fica só com arquivos do site: nada do login nem do banco', async ({ page }) => {
      await entrarComo(page, CONTAS.responsavel.email)
      await expect(page.getByRole('heading', { level: 1, name: /Helena/ })).toBeVisible({ timeout: 15_000 })
      await irParaAba(page, 'Financeiro')
      await expect(page.locator('.resumo-mes')).toContainText(/R\$/, { timeout: 15_000 })
      await page.evaluate(() => navigator.serviceWorker.ready)
      const guardados = await page.evaluate(async () => {
        const urls: string[] = []
        for (const nome of await caches.keys()) urls.push(...(await (await caches.open(nome)).keys()).map((r) => r.url))
        return urls
      })
      const site = `${new URL(page.url()).origin}${BASE}`
      expect(guardados.length).toBeGreaterThan(0)
      expect(guardados.filter((u) => !u.startsWith(site))).toEqual([])
      expect(guardados.filter((u) => /googleapis|identitytoolkit|firestore|:88[0-9][0-9]\/v1\//.test(u))).toEqual([])
    })
  })
})
