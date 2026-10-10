import { expect, test } from './base'
import type { Page } from '@playwright/test'
import { abrirApp, aviso, entrarComoAdministracao, entrarComoProfessor, esperarFolhaParada, esperarParado, folha, irParaAba } from './apoio'

// Aula experimental registrada na agenda, na demonstração. Sexta 9/10, 10h: a aula das 18h do
// Centro tem 5 de 6 lugares. Sábado 10/10, 9h: a semente já traz Juliana Prado registrada.

const cartao = (page: Page, hora: string) => page.locator('.cartao-aula', { has: page.locator('strong', { hasText: new RegExp(`^${hora}$`) }) })
const linhaDe = (page: Page, nome: string) => folha(page).locator('[data-aluno]', { hasText: nome })

async function numero(page: Page, rotulo: RegExp): Promise<number> {
  return Number(await page.locator('.numero-card', { hasText: rotulo }).locator('.so-leitor').textContent())
}

async function registrarNaFolha(page: Page, nome: string, telefone: string) {
  await folha(page).getByRole('button', { name: 'Registrar aula experimental' }).click()
  await folha(page).getByRole('textbox', { name: 'Nome' }).fill(nome)
  await folha(page).getByRole('textbox', { name: 'WhatsApp' }).fill(telefone)
  await folha(page).getByRole('button', { name: /^Registrar / }).click()
}

test.describe('aula experimental na agenda', () => {
  test('a equipe registra quem vem experimentar: ocupa a vaga, entra na chamada, aparece no Hoje e some da página pública', async ({ page }) => {
    await entrarComoAdministracao(page)
    const esperados = await numero(page, /alunos esperados/)
    await irParaAba(page, 'Agenda')
    await expect(cartao(page, '18h').getByRole('img', { name: /5 de 6 lugares ocupados, 1 vaga/ })).toBeVisible()
    await cartao(page, '18h').click()
    await esperarFolhaParada(page)

    await registrarNaFolha(page, 'Marina Lopes', '(19) 90000-0050')
    await expect(aviso(page, 'Marina vem experimentar hoje, às 18h.')).toBeVisible()
    const marina = linhaDe(page, 'Marina Lopes')
    await expect(marina).toBeVisible()
    await expect(marina.locator('.pilula')).toHaveText('experimental')
    await expect(marina.getByRole('link', { name: 'WhatsApp de Marina' })).toHaveAttribute('href', 'https://wa.me/5519900000050')
    // sem aviso de falta para quem vem experimentar, e sem reposição
    await expect(marina.getByRole('button', { name: 'Avisou' })).toHaveCount(0)
    await expect(marina.getByRole('button', { name: 'Tirar' })).toBeVisible()
    // a aula lotou: não dá para registrar outra
    await expect(folha(page).getByRole('img', { name: /6 de 6 lugares ocupados, lotada/ })).toBeVisible()
    await expect(folha(page).getByRole('button', { name: 'Registrar aula experimental' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(folha(page)).toHaveCount(0)
    await expect(cartao(page, '18h').locator('.pilula', { hasText: '1 experimental' })).toBeVisible()

    await irParaAba(page, 'Hoje')
    await expect.poll(() => numero(page, /alunos esperados/)).toBe(esperados + 1)
    const secao = page.locator('section', { has: page.getByRole('heading', { name: 'Aulas experimentais de hoje' }) })
    await expect(secao.getByRole('button', { name: /Marina Lopes/ })).toBeVisible()

    // a página pública lê os mesmos dados: a vaga das 18h de hoje sumiu
    await page.goto('./experimental/?demo&agora=2026-10-09T10:00')
    await page.locator('[data-dia="2026-10-09"]').click()
    await expect(page.locator('.horario').first()).toBeVisible()
    await expect(page.locator('.horario', { hasText: /^18h/ })).toHaveCount(0)
  })

  test('na chamada: presente ou faltou, tirar com desfazer', async ({ page }) => {
    // sábado 8h45: a chamada das 9h já abriu
    await abrirApp(page, '2026-10-10T08:45')
    await page.getByRole('button', { name: 'Explorar como administração' }).click()
    await expect(page.locator('.destaque .titulo')).toHaveText('9h, Centro')
    await page.getByRole('button', { name: 'Abrir chamada', exact: true }).click()
    await esperarFolhaParada(page)
    const juliana = linhaDe(page, 'Juliana Prado')
    await expect(juliana.locator('.pilula')).toHaveText('experimental')
    await juliana.getByRole('button', { name: 'Presente' }).click()
    await expect(aviso(page, 'Juliana: presente.')).toBeVisible()
    await expect(juliana.getByRole('button', { name: 'Presente' })).toHaveAttribute('aria-pressed', 'true')
    await juliana.getByRole('button', { name: 'Faltou' }).click()
    await expect(juliana.getByRole('button', { name: 'Faltou' })).toHaveAttribute('aria-pressed', 'true')

    await juliana.getByRole('button', { name: 'Tirar' }).click()
    await expect(aviso(page, 'Juliana saiu desta aula.')).toBeVisible()
    await expect(juliana).toHaveCount(0)
    await aviso(page, 'Juliana saiu desta aula.').getByRole('button', { name: 'Desfazer' }).click()
    await expect(linhaDe(page, 'Juliana Prado')).toBeVisible()
  })

  test('vira aluno com um toque: o cadastro abre com nome e WhatsApp, e a chamada passa a apontar a ficha', async ({ page }) => {
    await abrirApp(page, '2026-10-10T08:45')
    await page.getByRole('button', { name: 'Explorar como administração' }).click()
    await page.getByRole('button', { name: 'Abrir chamada', exact: true }).click()
    await esperarFolhaParada(page)
    await linhaDe(page, 'Juliana Prado').getByRole('button', { name: 'Cadastrar como aluno' }).click()
    await expect(folha(page)).toHaveCount(0)
    await esperarParado(page, '.tela-quadro')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Novo aluno')
    await expect(page.getByText(/Juliana fez a aula experimental e vai ficar/)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Nome e sobrenome' })).toHaveValue('Juliana Prado')
    await expect(page.getByRole('textbox', { name: 'Telefone (WhatsApp)' })).toHaveValue('(11) 90000-0090')
    await expect(page.getByRole('radio', { name: 'Centro' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('textbox', { name: 'Valor por mês (R$)' })).not.toHaveValue('')
    await page.getByRole('button', { name: 'Cadastrar aluno' }).click()
    await expect(aviso(page, /Cadastro de Juliana feito/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Juliana Prado')

    // de volta à chamada: ela continua na aula, agora como aluna com ficha
    await irParaAba(page, 'Hoje')
    await page.getByRole('button', { name: 'Abrir chamada', exact: true }).click()
    await esperarFolhaParada(page)
    const juliana = linhaDe(page, 'Juliana Prado')
    await expect(juliana.getByText(/Virou aluno/)).toBeVisible()
    await expect(juliana.getByRole('button', { name: 'Cadastrar como aluno' })).toHaveCount(0)
    await juliana.getByRole('button', { name: 'Juliana Prado: abrir ficha' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Juliana Prado')
  })

  test('quem virou aluno e pediu a exclusão some também da aula experimental (fica só o código)', async ({ page }) => {
    await abrirApp(page, '2026-10-10T08:45')
    await page.getByRole('button', { name: 'Explorar como administração' }).click()
    await page.getByRole('button', { name: 'Abrir chamada', exact: true }).click()
    await esperarFolhaParada(page)
    await linhaDe(page, 'Juliana Prado').getByRole('button', { name: 'Presente' }).click()
    await linhaDe(page, 'Juliana Prado').getByRole('button', { name: 'Cadastrar como aluno' }).click()
    await expect(folha(page)).toHaveCount(0)
    await esperarParado(page, '.tela-quadro')
    await page.getByRole('button', { name: 'Cadastrar aluno' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Juliana Prado')

    await page.getByRole('button', { name: 'Excluir o cadastro' }).click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('button', { name: 'Excluir de vez' }).click()
    await expect(aviso(page, 'Cadastro de Juliana excluído.')).toBeVisible()

    // na chamada do sábado a presença dela continua contando, sem o nome nem o WhatsApp
    await irParaAba(page, 'Hoje')
    await page.getByRole('button', { name: 'Abrir chamada', exact: true }).click()
    await esperarFolhaParada(page)
    await expect(folha(page).getByText('Juliana Prado')).toHaveCount(0)
    await expect(linhaDe(page, 'Aluno removido')).toBeVisible()
    await expect(linhaDe(page, 'Aluno removido').getByRole('link', { name: /WhatsApp/ })).toHaveCount(0)
    await expect(linhaDe(page, 'Aluno removido').getByRole('button', { name: 'Cadastrar como aluno' })).toHaveCount(0)
    await expect(linhaDe(page, 'Aluno removido').getByRole('button', { name: 'Presente' })).toHaveAttribute('aria-pressed', 'true')
    const guardado = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))))
    expect(guardado).not.toContain('Juliana')
    expect(guardado).not.toContain('5511900000090')
  })

  test('o professor registra pelo Hoje, escolhendo a aula com vaga', async ({ page }) => {
    await entrarComoProfessor(page)
    await page.getByRole('button', { name: 'Registrar aula experimental' }).click()
    await esperarFolhaParada(page)
    await expect(folha(page).getByRole('heading', { name: 'Em que aula?' })).toBeVisible()
    // só as unidades da professora (Centro), sem a opção de outra
    await expect(folha(page).locator('.opcao-aula', { hasText: 'Jardim' })).toHaveCount(0)
    await folha(page).locator('.opcao-aula').first().click()
    await folha(page).getByRole('textbox', { name: 'Nome' }).fill('Paulo Mendes')
    await folha(page).getByRole('textbox', { name: 'WhatsApp' }).fill('11900000051')
    await folha(page).getByRole('button', { name: /^Registrar / }).click()
    await expect(aviso(page, /^Paulo vem experimentar /)).toBeVisible()
    await expect(folha(page)).toHaveCount(0)
  })

  test('sem nome ou sem WhatsApp, o formulário aponta o campo', async ({ page }) => {
    await entrarComoAdministracao(page)
    await irParaAba(page, 'Agenda')
    await cartao(page, '18h').click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('button', { name: 'Registrar aula experimental' }).click()
    await folha(page).getByRole('button', { name: /^Registrar / }).click()
    await expect(folha(page).getByText('Escreva o nome da pessoa.')).toBeVisible()
    await expect(folha(page).getByText('Use DDD e número, por exemplo (19) 90000-0000.')).toBeVisible()
    await expect(folha(page).getByRole('textbox', { name: 'Nome' })).toBeFocused()
  })
})
