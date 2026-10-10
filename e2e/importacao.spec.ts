// Importar alunos e turmas de uma planilha, na demonstração (que grava no aparelho): colar,
// conferir, corrigir na prévia, importar em lote, ver o resumo e desfazer.
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { aviso, entrarComoAdministracao, esperarFolhaParada, esperarParado, folha, irParaAba, irParaSecao } from './apoio'
import { expect, test } from './base'

const titulo = (page: Page) => page.getByRole('heading', { level: 1 })
const linha = (page: Page, n: number) => page.locator(`[data-linha="${n}"]`)

async function abrirImportacao(page: Page) {
  await entrarComoAdministracao(page)
  await irParaAba(page, 'Alunos')
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(titulo(page)).toHaveText('Importar de uma planilha')
  await esperarParado(page, '.tela-quadro')
}

async function colar(page: Page, texto: string) {
  await page.getByLabel('Cole aqui as linhas da planilha').fill(texto)
  await page.getByRole('button', { name: 'Conferir' }).click()
}

// colado do Excel (tabulação), com cabeçalho, nomes de coluna do jeito de cada estúdio
const PLANILHA = [
  'Nome completo\tCelular\tPlano\tHorários\tValor (R$)\tComo paga\tObs',
  'Joana Prado\t(11) 90000-0071\t2x\tsáb 9h\t280\tPix\tjoelho',
  'Kátia Moura\t11 9000\t1\tsáb 9h\t250\tdinheiro\t',
  'Ana Almeida\t(11) 90000-0072\t2\t\t280\tPix\t',
  'Lucas Teles\t(11) 90000-0073\t1\tdom 10h\t260\tcartão de crédito\t',
  'Marta Siqueira\t(11) 90000-0074\t3 vezes\t\t\t\tvem de manhã',
].join('\n')

test.describe('importar de uma planilha', () => {
  test('cola, confere com os erros por linha, corrige na prévia e importa em lote', async ({ page }) => {
    await abrirImportacao(page)
    await colar(page, PLANILHA)

    // a prévia: cada coluna reconhecida pelo nome, as linhas com erro primeiro
    await expect(page.getByRole('heading', { name: '2 alunos prontos, 3 linhas com erro' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Colunas: Nome, WhatsApp, Vezes por semana, Turmas/ })).toBeVisible()
    await expect(linha(page, 2)).toContainText('Use DDD e número')
    await expect(linha(page, 3)).toContainText('Ana Almeida já está cadastrado com este nome.')
    await expect(linha(page, 4)).toContainText('Não existe turma de domingo às 10h nesta unidade.')
    await expect(linha(page, 1)).toContainText('pronto')
    await expect(linha(page, 5)).toContainText('Sem mensalidade na planilha')
    await expect(page.locator('[data-linha]').first()).toHaveAttribute('data-erro', 'sim')

    // telefone torto: corrige na folha
    await linha(page, 2).click()
    await esperarFolhaParada(page)
    await folha(page).getByLabel('WhatsApp').fill('(11) 90000-0075')
    await folha(page).getByRole('button', { name: 'Salvar correção' }).click()
    await expect(page.getByRole('heading', { name: '3 alunos prontos, 2 linhas com erro' })).toBeVisible()
    // a turma que não existe: escreve outra
    await linha(page, 4).click()
    await esperarFolhaParada(page)
    await expect(folha(page).getByText(/Turmas desta unidade: .*; sáb 9h\./)).toBeVisible()
    await folha(page).getByLabel('Turmas (dia e hora)').fill('sáb 9h')
    await folha(page).getByRole('button', { name: 'Salvar correção' }).click()
    // a Ana já existe: tira da lista
    await linha(page, 3).click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('button', { name: 'Tirar da lista' }).click()
    await expect(page.getByRole('heading', { name: '4 alunos prontos', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Importar 4 alunos' }).click()
    await expect(page.getByText('Importação feita')).toBeVisible()
    await expect(page.getByText('4 alunos entraram no cadastro; 3 já estão nas turmas; 1 está sem mensalidade (preencha na ficha).')).toBeVisible()
    await expect(aviso(page, '4 alunos importados.')).toBeVisible()

    // estão na lista e na turma de sábado
    await page.getByRole('button', { name: 'Ver os alunos' }).click()
    await expect(titulo(page)).toHaveText('Alunos')
    await page.getByRole('searchbox', { name: 'Buscar aluno' }).fill('joana prado')
    await page.locator('[data-aluno]', { hasText: 'Joana Prado' }).click()
    await expect(titulo(page)).toHaveText('Joana Prado')
    await expect(page.getByText('Sábado, 9h')).toBeVisible()
    await expect(page.getByText('R$ 280,00 por mês')).toBeVisible()
  })

  test('importa o que está pronto e depois corrige só o que ficou de fora; dias e hora em duas colunas', async ({ page }) => {
    await abrirImportacao(page)
    await colar(
      page,
      [
        'Nome\tCelular\tDias\tHorário\tValor',
        'Olga Prates\t(11) 90000-0083\tsáb\t9h\t280',
        'Pedro Quintas\t011 90000-0084\t\t\t280',
        'Quésia Rocha\t11 9000\t\t\t280',
        'Renan Souto\t(11) 90000-0086\tdom\tàs 10h\t280',
      ].join('\n'),
    )
    // os dias e a hora viraram uma coluna só de turmas; o zero antes do DDD não atrapalha
    await expect(page.getByRole('heading', { name: '2 alunos prontos, 2 linhas com erro' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Colunas: Nome, WhatsApp, Turmas \(dia e hora\), Mensalidade/ })).toBeVisible()
    await expect(linha(page, 1)).toContainText('sáb 9h')
    await expect(linha(page, 4)).toContainText('Não existe turma de domingo às 10h nesta unidade.')

    // a proprietária importa o que está pronto primeiro
    await page.getByRole('button', { name: 'Importar 2 alunos' }).click()
    await expect(page.getByText('2 alunos entraram no cadastro; 1 já está nas turmas.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ficaram de fora' })).toBeVisible()

    // e volta só para as duas linhas que ficaram de fora
    await page.getByRole('button', { name: 'Corrigir as 2 linhas que ficaram de fora' }).click()
    await expect(page.getByRole('heading', { name: '0 alunos prontos, 2 linhas com erro' })).toBeVisible()
    await expect(page.locator('[data-linha]')).toHaveCount(2)
    await linha(page, 3).click()
    await esperarFolhaParada(page)
    await folha(page).getByLabel('WhatsApp').fill('(11) 90000-0085')
    await folha(page).getByRole('button', { name: 'Salvar correção' }).click()
    await linha(page, 4).click()
    await esperarFolhaParada(page)
    await folha(page).getByRole('button', { name: 'Tirar da lista' }).click()
    await expect(page.getByRole('heading', { name: '1 aluno pronto', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Importar 1 aluno' }).click()
    await expect(page.getByText('1 aluno entrou no cadastro.')).toBeVisible()

    await page.getByRole('button', { name: 'Ver os alunos' }).click()
    await expect(titulo(page)).toHaveText('Alunos')
    for (const nome of ['olga prates', 'pedro quintas', 'quesia rocha']) {
      await page.getByRole('searchbox', { name: 'Buscar aluno' }).fill(nome)
      await expect(page.locator('[data-aluno]')).toHaveCount(1)
    }
  })

  test('sem cabeçalho e com ponto e vírgula: as colunas vêm do conteúdo, a que sobrar a pessoa diz o que é; e dá para desfazer', async ({ page }) => {
    await abrirImportacao(page)
    await colar(page, 'Paulo Viana;(11) 90000-0081;sáb 9h;1x;obs livre\nRita Lobo;(11) 90000-0082;;2;outra obs')
    await expect(page.getByRole('heading', { name: '2 alunos prontos', exact: true })).toBeVisible()
    await expect(page.getByText(/Não reconheci a coluna 5 \(obs livre\)/)).toBeVisible()
    await page.getByLabel('Coluna 5').selectOption('observacao')
    await expect(page.getByText(/Não reconheci/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Importar 2 alunos' }).click()
    await expect(page.getByText('2 alunos entraram no cadastro; 1 já está nas turmas; 2 estão sem mensalidade (preencha na ficha).')).toBeVisible()

    // coluna trocada, planilha errada: desfaz e os cadastros saem
    await page.getByRole('button', { name: 'Desfazer a importação' }).click()
    await expect(aviso(page, 'Importação desfeita: 2 cadastros saíram.')).toBeVisible()
    await irParaAba(page, 'Alunos')
    await page.getByRole('searchbox', { name: 'Buscar aluno' }).fill('rita lobo')
    await expect(page.locator('[data-aluno]')).toHaveCount(0)
  })

  test('escolhe um arquivo .csv do Excel (acentos em Windows-1252) e baixa o modelo em branco', async ({ page }) => {
    await abrirImportacao(page)
    // o Excel em português grava o .csv com ponto e vírgula e acentos em Windows-1252
    const conteudo = Buffer.from('Nome;WhatsApp;Observação\r\nSônia Araújo;(11) 90000-0091;não pode às segundas\r\n', 'latin1')
    await page.getByLabel('Escolher arquivo .csv').setInputFiles({ name: 'alunos.csv', mimeType: 'text/csv', buffer: conteudo })
    await expect(page.getByLabel('Cole aqui as linhas da planilha')).toHaveValue(/Sônia Araújo;\(11\) 90000-0091;não pode às segundas/)
    await page.getByRole('button', { name: 'Conferir' }).click()
    await expect(page.getByRole('heading', { name: '1 aluno pronto', exact: true })).toBeVisible()
    await expect(linha(page, 1)).toContainText('Sônia Araújo')

    await page.getByRole('button', { name: 'Voltar e colar de novo' }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar o modelo em branco' }).click()])
    expect(download.suggestedFilename()).toBe('alunos-modelo.csv')
    const modelo = readFileSync(await download.path(), 'utf8')
    // só o cabeçalho (uma linha de exemplo esquecida viraria aluno), com a marca que faz o Excel ler os acentos
    expect(modelo).toBe('\uFEFFNome;WhatsApp;E-mail;Vezes por semana;Turmas;Mensalidade;Forma de pagamento;Observação\r\n')
  })

  test('importa turmas pelo mesmo caminho, corrigindo o professor na prévia', async ({ page }) => {
    await entrarComoAdministracao(page)
    await irParaAba(page, 'Alunos')
    await irParaSecao(page, 'Turmas')
    await page.getByRole('button', { name: 'Importar', exact: true }).click()
    await expect(titulo(page)).toHaveText('Importar de uma planilha')
    await colar(page, 'Dia\tHorário\tDuração\tLugares\tProfessor\tUnidade\nsex\t12h\t55\t4\tCamila\tCentro\nsáb\t10h30\t\t\tFulana\tCentro')
    await expect(page.getByRole('heading', { name: '1 turma pronta, 1 linha com erro' })).toBeVisible()
    await expect(linha(page, 2)).toContainText('Não achei "Fulana" na equipe de Centro')
    await linha(page, 2).click()
    await esperarFolhaParada(page)
    await folha(page).getByLabel('Quem dá a aula').selectOption({ label: 'Rafael Moreira' })
    await folha(page).getByRole('button', { name: 'Salvar correção' }).click()
    await expect(page.getByRole('heading', { name: '2 turmas prontas', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Criar 2 turmas' }).click()
    await expect(page.getByText('2 turmas entraram na grade da semana.')).toBeVisible()
    await page.getByRole('button', { name: 'Ver as turmas' }).click()
    await expect(page.getByRole('button', { name: /Sábado, 10h30 com Rafael/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sexta, 12h com Camila/ })).toBeVisible()
  })
})
