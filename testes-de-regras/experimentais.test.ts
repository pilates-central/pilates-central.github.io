// Aula experimental registrada pela equipe no registro da aula (nome e telefone de quem vem):
// quem grava, o que o banco confere no mapa, e o aluno, que mexe no mesmo documento por mescla,
// sem nunca tocar nesse mapa.
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, deleteField, doc, getDoc, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AMANHA, aulaId, banco, credito, criarAmbiente, semear } from './cenario'
import type { Quem } from './cenario'

let ambiente: RulesTestEnvironment

beforeAll(async () => {
  ambiente = await criarAmbiente()
})

afterAll(async () => {
  await ambiente?.cleanup()
})

beforeEach(async () => {
  await semear(ambiente)
})

const como = (quem: Quem): Firestore => banco(ambiente, quem)
const instante = '2026-10-09T12:00:00.000Z'
const AULA = aulaId('t-1', AMANHA.data)
const JOANA = 'Joana Prado|5511900000077'

/** validade do crédito dentro da combinada (30 dias a partir da aula) */
function validade(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function registroCom(experimentais: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { id: AULA, turmaId: 't-1', unidadeId: 'u-centro', data: AMANHA.data, marcacoes: {}, reposicoes: {}, experimentais, atualizadoEm: instante, ...extra }
}

describe('quem registra', () => {
  it('professor da unidade e administração registram; professor de outra unidade e aluno não', async () => {
    await assertSucceeds(setDoc(doc(como('prof'), `registros/${AULA}`), registroCom({ 'x-1': JOANA })))
    await assertSucceeds(setDoc(doc(como('adm'), `registros/${AULA}`), registroCom({ 'x-1': JOANA, 'x-2': 'Outra Pessoa|5511900000078' })))
    await assertFails(setDoc(doc(como('profJardim'), `registros/${AULA}`), registroCom({ 'x-1': JOANA })))
    await assertFails(setDoc(doc(como('aluno'), `registros/${AULA}`), registroCom({ 'x-1': JOANA })))
  })

  it('tira a pessoa, marca a presença dela e aponta o aluno que nasceu da experimental', async () => {
    await setDoc(doc(como('adm'), `registros/${AULA}`), registroCom({ 'x-1': JOANA, 'x-2': 'Outra Pessoa|5511900000078' }))
    await assertSucceeds(updateDoc(doc(como('prof'), `registros/${AULA}`), { 'experimentais.x-2': deleteField(), atualizadoEm: instante }))
    await assertSucceeds(updateDoc(doc(como('prof'), `registros/${AULA}`), { 'marcacoes.x-1': 'presente', atualizadoEm: instante }))
    await assertSucceeds(updateDoc(doc(como('adm'), `registros/${AULA}`), { 'experimentais.x-1': `${JOANA}|a-novo`, atualizadoEm: instante }))
    // quem veio experimentar não avisa falta: não há reposição por trás (o app nem oferece)
    await assertSucceeds(updateDoc(doc(como('prof'), `registros/${AULA}`), { 'marcacoes.x-1': 'faltou', atualizadoEm: instante }))
  })
})

describe('o que o banco confere no mapa', () => {
  const casos: [string, Record<string, unknown>][] = [
    ['item sem a barra', { 'x-1': 'Joana Prado' }],
    ['telefone com letra', { 'x-1': 'Joana Prado|onze' }],
    ['nome vazio', { 'x-1': '|5511900000077' }],
    ['nome com 81 letras', { 'x-1': `${'a'.repeat(81)}|5511900000077` }],
    ['barra a mais no nome', { 'x-1': 'Joana|Prado|5511900000077|a-1' }],
    ['aluno apontado com espaço', { 'x-1': `${JOANA}|a novo` }],
    ['código com espaço', { 'x 1': JOANA }],
    ['valor que não é texto', { 'x-1': { nome: 'Joana Prado', telefone: '5511900000077' } }],
    ['quebra de linha no nome', { 'x-1': 'Joana\nPrado|5511900000077' }],
  ]
  for (const [nome, experimentais] of casos) {
    it(`recusa ${nome}`, async () => {
      await assertFails(setDoc(doc(como('adm'), `registros/${AULA}`), registroCom(experimentais)))
    })
  }

  it('aceita dez pessoas e recusa a décima primeira', async () => {
    const dez = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`x-${i}`, `Pessoa ${i}|55119000000${String(i).padStart(2, '0')}`]))
    await assertSucceeds(setDoc(doc(como('adm'), `registros/${AULA}`), registroCom(dez)))
    await assertFails(setDoc(doc(como('adm'), `registros/${AULA}`), registroCom({ ...dez, 'x-10': JOANA })))
  })

  it('aceita o telefone vazio (pessoa sem WhatsApp) e o nome com acento', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), `registros/${AULA}`), registroCom({ 'x-1': 'Joana Conceição|' })))
  })

  it('a exclusão de quem virou aluno troca o nome e o telefone pelo texto fixo, sem telefone (como o app grava)', async () => {
    await setDoc(doc(como('adm'), `registros/${AULA}`), registroCom({ 'x-1': `${JOANA}|a-novo` }))
    await assertSucceeds(updateDoc(doc(como('adm'), `registros/${AULA}`), { 'experimentais.x-1': 'Aluno removido||a-novo', atualizadoEm: instante }))
  })
})

describe('o aluno no mesmo documento', () => {
  const vaga = `vagas/${AULA}`
  const creditoDoAviso = `cr_a-1_t-1_${AMANHA.data}`

  beforeEach(async () => {
    await setDoc(doc(como('adm'), `registros/${AULA}`), registroCom({ 'x-1': JOANA }))
  })

  it('avisa a própria falta por mescla sem tocar em quem veio experimentar', async () => {
    const db = como('aluno')
    const b = writeBatch(db)
    b.set(
      doc(db, `registros/${AULA}`),
      { id: AULA, turmaId: 't-1', unidadeId: 'u-centro', data: AMANHA.data, marcacoes: { 'a-1': 'avisou' }, atualizadoEm: instante },
      { merge: true },
    )
    b.set(doc(db, `creditos/${creditoDoAviso}`), credito(creditoDoAviso, 'a-1', { turmaId: 't-1', data: AMANHA.data }, { validoAte: validade(AMANHA.data, 30) }))
    b.update(doc(db, vaga), { ocupadas: increment(-1), atualizadoEm: instante })
    await assertSucceeds(b.commit())
    let guardado: Record<string, unknown> | undefined
    await ambiente.withSecurityRulesDisabled(async (ctx) => {
      guardado = (await getDoc(doc(ctx.firestore() as unknown as Firestore, `registros/${AULA}`))).data()
    })
    expect(guardado?.experimentais).toEqual({ 'x-1': JOANA })
    expect(guardado?.marcacoes).toEqual({ 'a-1': 'avisou' })
  })

  it('não registra, não tira nem muda quem veio experimentar', async () => {
    const db = como('aluno')
    const tentar = (campos: Record<string, unknown>) => {
      const b = writeBatch(db)
      b.set(
        doc(db, `registros/${AULA}`),
        { id: AULA, turmaId: 't-1', unidadeId: 'u-centro', data: AMANHA.data, marcacoes: { 'a-1': 'avisou' }, atualizadoEm: instante, ...campos },
        { merge: true },
      )
      b.set(doc(db, `creditos/${creditoDoAviso}`), credito(creditoDoAviso, 'a-1', { turmaId: 't-1', data: AMANHA.data }, { validoAte: validade(AMANHA.data, 30) }))
      b.update(doc(db, vaga), { ocupadas: increment(-1), atualizadoEm: instante })
      return b.commit()
    }
    await assertFails(tentar({ experimentais: { 'x-1': JOANA, 'x-2': 'Amiga Dela|5511900000079' } }))
    await assertFails(tentar({ experimentais: { 'x-1': 'Outro Nome|5511900000077' } }))
    await assertFails(tentar({ experimentais: {} }))
    await assertFails(updateDoc(doc(db, `registros/${AULA}`), { 'experimentais.x-1': deleteField(), atualizadoEm: instante }))
    // nem marca a presença de quem veio experimentar
    await assertFails(updateDoc(doc(db, `registros/${AULA}`), { 'marcacoes.x-1': 'presente', atualizadoEm: instante }))
  })

  it('não cria um registro já com alguém para experimentar', async () => {
    const outra = aulaId('t-1', AMANHA.data)
    // o registro some: o aluno vai criar um do zero
    await ambiente.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore() as unknown as Firestore, `registros/${outra}`))
    })
    const db = como('aluno')
    const b = writeBatch(db)
    b.set(doc(db, `registros/${outra}`), {
      id: outra,
      turmaId: 't-1',
      unidadeId: 'u-centro',
      data: AMANHA.data,
      marcacoes: { 'a-1': 'avisou' },
      experimentais: { 'x-9': JOANA },
      atualizadoEm: instante,
    })
    b.set(doc(db, `creditos/${creditoDoAviso}`), credito(creditoDoAviso, 'a-1', { turmaId: 't-1', data: AMANHA.data }, { validoAte: validade(AMANHA.data, 30) }))
    b.update(doc(db, vaga), { ocupadas: increment(-1), atualizadoEm: instante })
    await assertFails(b.commit())
  })
})
