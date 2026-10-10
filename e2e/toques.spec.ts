// Quantos toques as tarefas do dia a dia pedem, numa tela de iPhone SE (375 x 667), com uma mão.
// Digitar na busca não conta como toque; rolar também não. Cada `tocar` é um dedo na tela.
import type { Locator, Page } from '@playwright/test'
import { abrirApp, aviso, entrarComoAdministracao, entrarComoProfessor, esperarFolhaParada, esperarParado, folha } from './apoio'
import { expect, test } from './base'

test.use({ viewport: { width: 375, height: 667 } })

class Dedo {
  toques = 0
  constructor(private readonly page: Page) {}

  async tocar(alvo: Locator): Promise<void> {
    this.toques++
    await alvo.click()
  }

  aba(nome: string): Locator {
    return this.page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: nome })
  }
}

/** Alunos, Importar: o caminho até o campo de colar (os toques que contam são os depois de colar). */
async function dedoAteImportar(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Alunos' }).click()
  await esperarParado(page, '.tela-quadro')
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Importar de uma planilha')
  await esperarParado(page, '.tela-quadro')
}

test.describe('toques por tarefa no iPhone SE', () => {
  test('professor entre uma aula e outra: chamada da turma inteira em 3 toques, com uma falta', async ({ page }) => {
    await entrarComoProfessor(page, 'Camila Nunes', '2026-10-09T18:05')
    const dedo = new Dedo(page)
    await dedo.tocar(page.getByRole('button', { name: 'Abrir chamada', exact: true }))
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).getByRole('button', { name: /Todos presentes/ }))
    await expect(aviso(page, /presenças marcadas/)).toBeVisible()
    // quem não veio: um toque na linha dele
    await dedo.tocar(folha(page).locator('[data-aluno]').first().getByRole('button', { name: 'Faltou' }))
    await expect(folha(page).getByLabel('Resumo da chamada')).toContainText('1 falta')
    await expect(folha(page).getByLabel('Resumo da chamada')).not.toContainText('sem marcação')
    expect(dedo.toques).toBeLessThanOrEqual(3)
  })

  test('achar um aluno em 3 toques', async ({ page }) => {
    await entrarComoAdministracao(page)
    const dedo = new Dedo(page)
    await dedo.tocar(dedo.aba('Alunos'))
    await esperarParado(page, '.tela-quadro')
    await dedo.tocar(page.getByRole('searchbox', { name: 'Buscar aluno' }))
    await page.keyboard.type('natal')
    await dedo.tocar(page.locator('[data-aluno]', { hasText: 'Natália Pereira' }))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Natália Pereira')
    expect(dedo.toques).toBeLessThanOrEqual(3)
  })

  test('lançar pagamento em 4 toques: quem está em aberto vem primeiro na escolha', async ({ page }) => {
    await entrarComoAdministracao(page)
    const dedo = new Dedo(page)
    await dedo.tocar(dedo.aba('Financeiro'))
    await esperarParado(page, '.tela-quadro')
    await dedo.tocar(page.getByRole('button', { name: 'Lançar pagamento', exact: true }))
    await esperarFolhaParada(page)
    const primeiro = folha(page).locator('.lista-item').first()
    // o primeiro da lista deve o mês (atrasado ou em aberto), não é só o primeiro do alfabeto
    await expect(primeiro).toContainText(/atrasado|em aberto/)
    const nome = ((await primeiro.locator('.lista-item-titulo').textContent()) ?? '').split(' ')[0] ?? ''
    await dedo.tocar(primeiro)
    await dedo.tocar(folha(page).getByRole('button', { name: /^Lançar R\$/ }))
    await expect(aviso(page, new RegExp(`de ${nome} lançado`))).toBeVisible()
    expect(dedo.toques).toBeLessThanOrEqual(4)
  })

  test('lançar pela lista de em aberto em 3 toques', async ({ page }) => {
    await entrarComoAdministracao(page)
    const dedo = new Dedo(page)
    await dedo.tocar(dedo.aba('Financeiro'))
    await esperarParado(page, '.tela-quadro')
    await dedo.tocar(page.getByRole('button', { name: /^Lançar pagamento de / }).first())
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).getByRole('button', { name: /^Lançar R\$/ }))
    await expect(aviso(page, /lançado/)).toBeVisible()
    expect(dedo.toques).toBeLessThanOrEqual(3)
  })

  test('encaixar reposição em 5 toques, pela central', async ({ page }) => {
    await entrarComoAdministracao(page)
    const dedo = new Dedo(page)
    await dedo.tocar(dedo.aba('Alunos'))
    await esperarParado(page, '.tela-quadro')
    await dedo.tocar(page.getByRole('navigation', { name: 'Seções' }).getByRole('button', { name: 'Reposições' }))
    await esperarParado(page, '.tela-quadro')
    await dedo.tocar(page.getByRole('button', { name: 'Encaixar', exact: true }).first())
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).getByRole('radio').first())
    await dedo.tocar(folha(page).getByRole('button', { name: /^Encaixar .*, às / }))
    await expect(aviso(page, /Reposição de .* marcada/)).toBeVisible()
    expect(dedo.toques).toBeLessThanOrEqual(5)
  })

  test('aluno avisou: tirar do dia e encaixar em outro horário em 5 toques, pela chamada', async ({ page }) => {
    await entrarComoAdministracao(page)
    const dedo = new Dedo(page)
    await dedo.tocar(page.getByRole('button', { name: 'Ver quem vem', exact: true }))
    await esperarFolhaParada(page)
    const linha = folha(page).locator('[data-aluno]').nth(1)
    await dedo.tocar(linha.getByRole('button', { name: 'Avisou' }))
    await dedo.tocar(linha.getByRole('button', { name: 'Encaixar em outro horário' }))
    await dedo.tocar(folha(page).getByRole('radio').first())
    await dedo.tocar(folha(page).getByRole('button', { name: /^Encaixar .*, às / }))
    await expect(aviso(page, /Reposição de .* marcada/)).toBeVisible()
    expect(dedo.toques).toBeLessThanOrEqual(5)
  })

  test('o próprio aluno remarca a aula em 5 toques', async ({ page }) => {
    await abrirApp(page)
    await page.getByRole('button', { name: 'Explorar como aluno' }).click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('button', { name: /Beatriz Barbosa/ }).click()
    await esperarParado(page, '.tela-quadro')
    const dedo = new Dedo(page)
    await dedo.tocar(page.getByRole('button', { name: 'Não vou poder ir' }))
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).getByRole('button', { name: 'Avisar que não vou' }))
    await expect(aviso(page, /Falta avisada/)).toBeVisible()
    await dedo.tocar(page.getByRole('button', { name: /reposiç(ão|ões) para marcar/ }))
    await esperarParado(page, '.tela-quadro')
    await dedo.tocar(page.getByRole('list', { name: 'Aulas com vaga' }).locator('.opcao-aula').first())
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).getByRole('button', { name: 'Confirmar reposição' }))
    await expect(aviso(page, /Reposição marcada/)).toBeVisible()
    expect(dedo.toques).toBeLessThanOrEqual(5)
  })

  test('registrar quem pediu a aula experimental em 5 toques, pelo Hoje', async ({ page }) => {
    await entrarComoAdministracao(page)
    const dedo = new Dedo(page)
    await dedo.tocar(page.getByRole('button', { name: 'Registrar aula experimental' }))
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).locator('.opcao-aula').first())
    await dedo.tocar(folha(page).getByLabel('Nome'))
    await page.keyboard.type('Laura Mendes')
    await dedo.tocar(folha(page).getByLabel('WhatsApp'))
    await page.keyboard.type('11900000091')
    await dedo.tocar(folha(page).getByRole('button', { name: /^Registrar / }))
    await expect(aviso(page, /Laura vem experimentar/)).toBeVisible()
    expect(dedo.toques).toBeLessThanOrEqual(5)
  })

  test('importar 30 alunos de uma planilha em até 8 toques depois de colar, corrigindo uma linha e tirando outra', async ({ page }) => {
    await entrarComoAdministracao(page)
    await dedoAteImportar(page)
    // 30 linhas como o Excel copia; a 5a sem DDD e a 9a repetindo a 1a
    const linhas = ['Nome\tCelular\tPlano\tValor']
    for (let i = 0; i < 30; i++) {
      const telefone = i === 4 ? '9000-0054' : i === 8 ? '(11) 90000-0050' : `(11) 90000-00${50 + i}`
      linhas.push(`${i === 8 ? 'Aluna Planilha 0' : `Aluna Planilha ${i}`}\t${telefone}\t2x\t280`)
    }
    await page.getByLabel('Cole aqui as linhas da planilha').fill(linhas.join('\n'))
    const dedo = new Dedo(page)
    await dedo.tocar(page.getByRole('button', { name: 'Conferir' }))
    await expect(page.getByRole('heading', { name: '28 alunos prontos, 2 linhas com erro' })).toBeVisible()
    // o WhatsApp sem DDD: corrige ali mesmo
    await dedo.tocar(page.locator('[data-linha="5"]'))
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).getByLabel('WhatsApp'))
    await folha(page).getByLabel('WhatsApp').fill('(11) 90000-0054')
    await dedo.tocar(folha(page).getByRole('button', { name: 'Salvar correção' }))
    // a linha repetida sai da lista
    await dedo.tocar(page.locator('[data-linha="9"]'))
    await esperarFolhaParada(page)
    await dedo.tocar(folha(page).getByRole('button', { name: 'Tirar da lista' }))
    await expect(page.getByRole('heading', { name: '29 alunos prontos', exact: true })).toBeVisible()
    await dedo.tocar(page.getByRole('button', { name: 'Importar 29 alunos' }))
    await expect(page.getByText(/^29 alunos entraram no cadastro/)).toBeVisible()
    expect(dedo.toques).toBeLessThanOrEqual(8)
  })

  test('quem nunca foi ao estúdio chega ao pedido no WhatsApp em 2 toques', async ({ page }) => {
    await page.goto('./experimental/?demo&agora=2026-10-09T10:00')
    await expect(page.getByRole('heading', { level: 1, name: /Venha conhecer o estúdio/ })).toBeVisible()
    // o pedido pelo WhatsApp fica sempre à vista, preso no rodapé
    const whats = page.getByRole('link', { name: /WhatsApp/ })
    await expect(whats).toBeInViewport()
    // e os horários estão a um toque da capa
    const dedo = new Dedo(page)
    await dedo.tocar(page.getByRole('link', { name: 'Ver os horários com vaga' }))
    await expect(page.getByRole('heading', { name: 'Escolha o horário' })).toBeInViewport()
    await dedo.tocar(page.locator('.horario').first())
    await expect(whats).toHaveText(/^Pedir hoje, \d+h, no WhatsApp$/)
    await expect(whats).toBeInViewport()
    // o toque no botão abre o WhatsApp com a mensagem pronta (aqui só confere o endereço)
    expect(decodeURIComponent((await whats.getAttribute('href')) ?? '')).toContain('quero marcar uma aula experimental: sexta, 9 de outubro')
    expect(dedo.toques + 1).toBeLessThanOrEqual(3)
    // quem nunca fez aula sabe o que esperar
    await expect(page.getByRole('heading', { name: 'Primeira vez?' })).toBeAttached()
    await expect(page.getByText('As aulas duram de 50 a 60 minutos.')).toBeAttached()
  })
})
