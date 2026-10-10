// Começar a usar, como a administração faria no primeiro dia, com o SDK de verdade contra os
// emuladores (EMULADOR=1), nos dois motores: entrar como responsável num estúdio vazio, passar
// pelo guia de primeiro uso, importar 30 alunos de um TSV colado, abrir a agenda, fazer a
// chamada, convidar uma administradora e entrar com ela em outro aparelho (outro contexto). No
// caminho, as mensagens de gravação: sem internet (fila), regras desatualizadas e conta sem
// acesso. Os toques de cada tarefa são contados (tocar num campo para escrever conta; digitar não).
import { readFileSync } from 'node:fs'
import { devices } from '@playwright/test'
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test'
import { BASE, aviso, esperarFolhaParada, esperarParado, folha } from './apoio'
import { expect, test } from './base'
import { lerDocumento, linkDeConfirmacao, listarDocumentos, projetoDoComeco, SENHA, trocarRegras } from './firebase/contas'
import { liberarEnderecoLocal } from './firebase/navegar'

test.skip(!process.env.EMULADOR, 'precisa dos emuladores do Firebase (EMULADOR=1)')
// um toque que não acha o alvo falha em 15 s, em vez de esperar o teste inteiro acabar
test.use({ bypassCSP: true, actionTimeout: 15_000 })
test.beforeEach(({ context, browserName }) => liberarEnderecoLocal(context, browserName))

/** Um dedo que conta os toques: cada toque é um dedo na tela (inclusive o que abre o teclado num campo). */
class Dedo {
  toques = 0
  async tocar(alvo: Locator): Promise<void> {
    this.toques++
    await alvo.click()
  }
  async escrever(campo: Locator, texto: string): Promise<void> {
    await this.tocar(campo)
    await campo.fill(texto)
  }
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const
const ABREVIADOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/** Agora em Campinas (o fuso do estúdio e do navegador do teste): dia da semana e minutos do dia. */
function agoraEmCampinas(): { dia: number; minutos: number; data: string } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday ?? '')
  return { dia, minutos: Number(partes.hour) * 60 + Number(partes.minute), data: `${partes.year}-${partes.month}-${partes.day}` }
}

const NOMES = ['Ana', 'Bruna', 'Carla', 'Diana', 'Elisa', 'Fábio', 'Gustavo', 'Heloísa', 'Igor', 'Júlia']
const SOBRENOMES = ['Souza', 'Lima', 'Rocha']

/** 30 alunos fictícios num TSV como o Excel copia: 5 na aula de hoje, 5 em duas turmas da Paula, 20 sem turma. */
function planilha(turmaDeHoje: string, turmasDaPaula: string): string {
  const linhas = ['Nome\tWhatsApp\tPlano\tTurmas\tMensalidade\tForma de pagamento']
  for (let i = 0; i < 30; i++) {
    const nome = `${NOMES[i % 10]} ${SOBRENOMES[Math.floor(i / 10)]}`
    const telefone = `(11) 90000-00${String(i + 1).padStart(2, '0')}`
    const turmas = i < 5 ? turmaDeHoje : i < 10 ? turmasDaPaula : ''
    const plano = i < 5 ? '1x' : '2x'
    linhas.push([nome, telefone, plano, turmas, i % 2 ? '280' : '250', i % 3 ? 'Pix' : 'dinheiro'].join('\t'))
  }
  return linhas.join('\n')
}

const DE_VERDADE = /^https?:\/\/([^/]+\.)?(googleapis\.com|firebaseapp\.com|firebaseio\.com|firebasestorage\.app|gstatic\.com|google\.com)(:\d+)?\//

const tentativasDeVerdade: string[] = []

/** Outro aparelho: um contexto novo com o mesmo perfil do motor, a mesma trava do Firebase real. */
async function outroAparelho(browser: Browser, motor: string): Promise<BrowserContext> {
  const perfil = { ...devices[motor === 'webkit' ? 'iPhone 13' : 'Pixel 7'] } as Record<string, unknown>
  delete perfil.defaultBrowserType
  const ctx = await browser.newContext({
    ...perfil,
    baseURL: `http://127.0.0.1:${process.env.PORTA ?? 8887}${BASE}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    bypassCSP: true,
  })
  await ctx.route(DE_VERDADE, (rota) => {
    tentativasDeVerdade.push(rota.request().url())
    return rota.abort()
  })
  await liberarEnderecoLocal(ctx, motor)
  return ctx
}

/** Cria a conta (ou entra, se outro teste já criou) e confirma o e-mail pelo link do emulador. */
async function criarContaEConfirmar(page: Page, dedo: Dedo, email: string, destino: Locator) {
  await dedo.tocar(page.getByRole('button', { name: 'Entrar', exact: true }))
  await dedo.tocar(page.getByRole('button', { name: 'Primeiro acesso? Criar conta' }))
  await dedo.escrever(page.getByLabel('E-mail'), email)
  await dedo.escrever(page.getByLabel('Senha', { exact: true }), SENHA)
  await dedo.tocar(page.locator('form').getByRole('button', { name: 'Criar conta' }))
  const confirmar = page.getByRole('heading', { name: 'Falta só um passo.' })
  const erro = page.getByRole('alert')
  await expect(confirmar.or(erro)).toBeVisible({ timeout: 15_000 })
  if (await erro.isVisible()) {
    // a conta já existe (o emulador de login é um só para os dois motores): entra
    await page.getByRole('button', { name: 'Já tenho conta' }).click()
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(confirmar.or(destino)).toBeVisible({ timeout: 15_000 })
  }
  if (await confirmar.isVisible()) {
    expect((await page.request.get(await linkDeConfirmacao(email))).ok()).toBe(true)
    await dedo.tocar(page.getByRole('button', { name: 'Já confirmei' }))
  }
  await expect(destino).toBeVisible({ timeout: 15_000 })
}

test('começar a usar: primeiro uso, 30 alunos de uma planilha, chamada, convite da administração e os avisos de gravação', async ({ page, browser }, info) => {
  test.setTimeout(300_000)
  const motor = info.project.name
  const projeto = projetoDoComeco(motor)
  const agora = agoraEmCampinas()
  // a aula de hoje começa numa hora cheia que já passou (a chamada abre meia hora antes); antes
  // das 4h30 não há hora possível (as turmas vão das 5h às 22h30) e a chamada fica para outra vez
  const comChamada = agora.minutos >= 4 * 60 + 30
  const hora = Math.min(22, Math.max(5, Math.floor(agora.minutos / 60)))
  const horaDaGrade = hora === 12 ? 13 : 12
  // a grade da Paula num dia que não é hoje (copiar o dia levaria a aula de hoje junto)
  const copia = agora.dia === 1 ? { de: 2, para: [4, 6] } : { de: 1, para: [3, 5] }
  const toques: Record<string, number> = {}

  // ---------- 1. a responsável entra num estúdio vazio e passa pelo guia ----------
  await page.goto(`./?emulador=${projeto}`)
  const entrar = new Dedo()
  await criarContaEConfirmar(page, entrar, 'responsavel@example.com', page.getByRole('heading', { name: 'Vamos começar.' }))
  toques['criar a conta da responsável'] = entrar.toques

  const guia = new Dedo()
  await guia.escrever(page.getByLabel('Seu nome'), 'Helena Prado')
  await guia.escrever(page.getByLabel('Nome do estúdio'), 'Estúdio Começo')
  await guia.tocar(page.getByRole('button', { name: 'Começar' }))
  // o guia abre sozinho, em tela inteira
  await expect(page.getByRole('heading', { level: 1, name: 'O estúdio' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0)
  await guia.escrever(page.getByLabel('WhatsApp do estúdio (opcional)'), '(11) 90000-0050')
  await guia.tocar(page.getByRole('button', { name: 'Continuar' }))
  await expect(page.getByRole('heading', { level: 1, name: 'Unidades' })).toBeVisible()
  await guia.escrever(page.getByLabel('Nome da unidade'), 'Centro')
  await guia.tocar(page.getByRole('button', { name: 'Continuar' }))
  await expect(page.getByRole('heading', { level: 1, name: 'Professores' })).toBeVisible()
  await guia.escrever(page.getByLabel('Nome do professor'), 'Paula Reis')
  await guia.escrever(page.getByLabel('E-mail'), `paula-${motor}@example.com`)
  await guia.tocar(page.getByRole('button', { name: 'Continuar' }))
  await expect(page.getByRole('heading', { level: 1, name: 'Turmas da semana' })).toBeVisible()
  await esperarParado(page, '.tela-quadro')
  // a aula de hoje, com a responsável dando a aula
  if (agora.dia === 0) await guia.tocar(page.getByRole('button', { name: 'Tem aula no domingo' }))
  if (hora < 6 || hora > 21) {
    await guia.escrever(page.getByLabel('Outro horário'), `${String(hora).padStart(2, '0')}:00`)
    await guia.tocar(page.getByRole('button', { name: 'Pôr na grade' }))
  }
  await guia.tocar(page.getByRole('radiogroup', { name: 'Quem dá a aula' }).getByRole('radio', { name: 'Helena (você)' }))
  await guia.tocar(page.getByRole('button', { name: `${DIAS[agora.dia]}, ${hora}h: criar turma` }))
  // a Paula às 12h na segunda (na terça, se hoje é segunda), copiada para mais dois dias
  await guia.tocar(page.getByRole('radiogroup', { name: 'Quem dá a aula' }).getByRole('radio', { name: 'Paula' }))
  await guia.tocar(page.getByRole('button', { name: `${DIAS[copia.de]}, ${horaDaGrade}h: criar turma` }))
  if (copia.de !== 1) {
    await guia.tocar(page.getByLabel('Copiar a grade de'))
    await page.getByLabel('Copiar a grade de').selectOption(String(copia.de))
  }
  for (const d of copia.para) await guia.tocar(page.getByRole('group', { name: 'Para os dias' }).getByRole('button', { name: ABREVIADOS[d] }))
  await guia.tocar(page.getByRole('button', { name: /^Copiar (segunda|terça) para/ }))
  await expect(aviso(page, '2 turmas copiadas.')).toBeVisible()
  await guia.tocar(page.getByRole('button', { name: 'Salvar 4 turmas e continuar' }))
  await expect(page.getByRole('heading', { level: 1, name: 'Alunos' })).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => (await listarDocumentos('turmas', projeto)).length).toBe(4)

  // ---------- 2. 30 alunos de um TSV colado ----------
  const importar = new Dedo()
  await importar.tocar(page.getByRole('button', { name: 'Importar de uma planilha' }))
  await importar.escrever(page.getByLabel('Cole aqui as linhas da planilha'), planilha(`${ABREVIADOS[agora.dia]} ${hora}h`, `${ABREVIADOS[copia.de]} ${horaDaGrade}h, ${ABREVIADOS[copia.para[0] ?? 3]} ${horaDaGrade}h`))
  await importar.tocar(page.getByRole('button', { name: 'Conferir' }))
  await expect(page.getByRole('heading', { name: '30 alunos prontos', exact: true })).toBeVisible()
  // sem internet a planilha não vai para a fila (que só vive com o app aberto): a tela pede
  // conexão e nada sai dela
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Importar 30 alunos' }).click()
  await expect(aviso(page, 'Sem internet agora. A importação precisa de conexão: tente de novo quando a internet voltar.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '30 alunos prontos', exact: true })).toBeVisible()
  expect(await listarDocumentos('alunos', projeto)).toHaveLength(0)
  await page.context().setOffline(false)
  await importar.tocar(page.getByRole('button', { name: 'Importar 30 alunos' }))
  await expect(page.getByText('30 alunos entraram no cadastro; 10 já estão nas turmas.')).toBeVisible({ timeout: 20_000 })
  toques['importar 30 alunos'] = importar.toques
  expect((await listarDocumentos('alunos', projeto)).length).toBe(30)
  expect((await listarDocumentos('financeiroDosAlunos', projeto)).length).toBe(30)
  await guia.tocar(page.getByRole('button', { name: 'Continuar' }))

  await expect(page.getByRole('heading', { level: 1, name: 'Pronto, o estúdio está montado.' })).toBeVisible()
  const resumo = page.getByRole('definition')
  await expect(resumo.nth(0)).toHaveText('Estúdio Começo, (11) 90000-0050')
  await expect(resumo.nth(1)).toHaveText('1 unidade')
  await expect(resumo.nth(2)).toHaveText('1 professor, 1 convite para mandar')
  await expect(resumo.nth(3)).toHaveText('4 turmas na semana')
  await expect(resumo.nth(4)).toHaveText('30 alunos')
  await guia.tocar(page.getByRole('button', { name: 'Ir para a agenda' }))
  toques['primeiro uso (do Começar à agenda, sem a importação)'] = guia.toques

  // ---------- 3. a agenda e a chamada ----------
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()
  await esperarParado(page, '.tela-quadro')
  if (comChamada) {
    const chamada = new Dedo()
    const aula = page.getByRole('button', { name: new RegExp(`^Aula das ${hora}h de .*, com Helena`) })
    await chamada.tocar(aula)
    await esperarFolhaParada(page)
    await chamada.tocar(folha(page).getByRole('button', { name: /Todos presentes/ }))
    await expect(aviso(page, /5 presenças marcadas/)).toBeVisible()
    toques['chamada da turma inteira'] = chamada.toques
    const deHoje = async () => JSON.stringify((await listarDocumentos('registros', projeto)).filter((d) => JSON.stringify(d).includes(agora.data)))
    await expect.poll(async () => ((await deHoje()).match(/"presente"/g) ?? []).length, { timeout: 15_000 }).toBe(5)

    // sem internet: a falta fica na fila, com a faixa, e grava sozinha quando a conexão volta
    await page.context().setOffline(true)
    await folha(page).locator('[data-aluno]').first().getByRole('button', { name: 'Faltou' }).click()
    await expect(aviso(page, 'Sem internet agora. A mudança ficou na fila e entra no banco sozinha quando a conexão voltar.')).toBeVisible()
    await expect(page.getByText('1 mudança esperando a internet para gravar.')).toBeVisible()
    await page.context().setOffline(false)
    await expect(aviso(page, 'Conexão de volta: o que estava na fila foi gravado.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('1 mudança esperando a internet para gravar.')).toHaveCount(0)
    await expect.poll(async () => (await deHoje()).includes('"faltou"'), { timeout: 15_000 }).toBe(true)

    // regras publicadas de uma versão anterior (que não aceitam mudar a presença): a frase diz o
    // que fazer, e a tela volta ao que está no banco
    const regras = readFileSync('firestore.rules', 'utf8')
    await trocarRegras(projeto, regras.replace('allow update: if alterarRegistro(quemSou(), aulaId);', 'allow update: if false;'))
    try {
      await folha(page).locator('[data-aluno]').first().getByRole('button', { name: 'Presente' }).click()
      await expect(
        aviso(page, 'O banco recusou a gravação: as regras do Firebase estão desatualizadas para esta versão do app. Peça para a administração publicar as regras novas.'),
      ).toBeVisible({ timeout: 15_000 })
      await expect(folha(page).locator('[data-aluno]').first().getByRole('button', { name: 'Faltou' })).toHaveAttribute('aria-pressed', 'true')
    } finally {
      await trocarRegras(projeto, regras)
    }
    await page.keyboard.press('Escape')
    await expect(folha(page)).toHaveCount(0)
  } else {
    info.annotations.push({ type: 'sem chamada', description: 'antes das 4h30 em Campinas não há aula possível hoje (as turmas vão das 5h às 22h30)' })
  }

  // ---------- 4. convidar uma administradora ----------
  const convite = new Dedo()
  await convite.tocar(page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Mais' }))
  await esperarParado(page, '.tela-quadro')
  await convite.tocar(page.getByRole('button', { name: /^Equipe/ }))
  await esperarParado(page, '.tela-quadro')
  await convite.tocar(page.getByRole('button', { name: 'Convidar pessoa' }))
  await esperarParado(page, '.tela-quadro')
  const email = `administradora-${motor}@example.com`
  await convite.escrever(page.getByRole('textbox', { name: 'Nome' }), 'Bia Andrade')
  await convite.escrever(page.getByRole('textbox', { name: 'E-mail' }), email)
  await convite.escrever(page.getByRole('textbox', { name: 'Telefone (opcional)' }), '(11) 90000-0060')
  await convite.tocar(page.getByRole('radio', { name: 'Administração' }))
  await convite.tocar(page.getByRole('button', { name: 'Registrar convite' }))
  await expect(aviso(page, /Convite registrado para Bia/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mandar o convite pelo WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/5511900000060\?text=/)
  // mais um toque manda pelo WhatsApp (abre o app de mensagens, fora do teste)
  toques['convidar uma administradora (mais 1 para mandar pelo WhatsApp)'] = convite.toques
  await expect.poll(async () => JSON.stringify(await lerDocumento(`convites/${email}`, projeto))).toContain('administrador')

  // ---------- 5. ela entra em outro aparelho ----------
  const aparelho = await outroAparelho(browser, motor)
  const dela = await aparelho.newPage()
  try {
    await dela.goto(`./?emulador=${projeto}`)
    const entrada = new Dedo()
    await criarContaEConfirmar(dela, entrada, email, dela.getByRole('heading', { level: 1, name: /Bia/ }))
    toques['a administradora cria a conta e entra'] = entrada.toques
    await expect(dela.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Financeiro' })).toBeVisible()
    // o estúdio já está montado: o guia não abre para ela
    await expect(dela.getByRole('heading', { level: 1, name: 'O estúdio' })).toHaveCount(0)
    await dela.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Mais' }).click()
    await expect(dela.locator('.perfil')).toContainText('Administração')

    // a responsável tira o acesso dela; a próxima gravação dela diz que a conta não tem esse acesso.
    // O app não fica escutando o banco: o aceite do convite aparece para a responsável quando ela
    // abre o app de novo (aqui, recarregando a página)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Bia Andrade' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Convite pendente')).toHaveCount(0)
    await page.getByRole('button', { name: 'Tirar o acesso' }).click()
    await expect(aviso(page, 'Bia ficou sem acesso.')).toBeVisible()
    await dela.getByRole('button', { name: /^Estúdio/ }).click()
    await esperarParado(dela, '.tela-quadro')
    await dela.getByRole('textbox', { name: 'Nome do estúdio' }).fill('Estúdio Outro Nome')
    await dela.getByRole('button', { name: 'Salvar' }).click()
    await expect(aviso(dela, 'Sua conta não tem esse acesso. Fale com a administração do estúdio.')).toBeVisible({ timeout: 15_000 })
    expect(JSON.stringify(await lerDocumento('configuracao/estudio', projeto))).toContain('Estúdio Começo')
  } finally {
    await aparelho.close()
  }
  expect(tentativasDeVerdade, 'o outro aparelho tentou falar com o Firebase de verdade').toEqual([])

  console.log(`toques ${motor} ${JSON.stringify(toques)}`)
  for (const [tarefa, n] of Object.entries(toques)) info.annotations.push({ type: 'toques', description: `${tarefa}: ${n}` })
})
