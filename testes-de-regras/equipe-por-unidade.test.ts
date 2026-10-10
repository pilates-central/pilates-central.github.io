// O que o professor grava fica preso à unidade e ao que aconteceu na aula, e a administração que
// não é titular não revoga convite de administração. Achado na revisão adversarial de segurança:
// com as regras anteriores, cada "ataque" abaixo passava.
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, deleteField, doc, getDoc, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { somarDias } from '../src/dominio/datas'
import { AMANHA, aulaId, banco, credito, criarAmbiente, daquiA, EMAILS, semear, vagaDe } from './cenario'
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

async function semRegras(acao: (db: Firestore) => Promise<unknown>) {
  await ambiente.withSecurityRulesDisabled(async (ctx) => {
    await acao(ctx.firestore() as unknown as Firestore)
  })
}

/** aula de t-1 (turma do Centro) daqui a três dias: ainda sem registro e sem vaga no banco */
const DAQUI_A_3 = daquiA(74)
const AULA_NOVA = aulaId('t-1', DAQUI_A_3.data)

function registroDe(aula: string, data: string, unidadeId: string, extra: Record<string, unknown> = {}) {
  return { id: aula, turmaId: 't-1', unidadeId, data, marcacoes: {}, reposicoes: {}, atualizadoEm: instante, ...extra }
}

describe('a aula que o professor cria é da unidade dele de verdade', () => {
  it('professor de outra unidade não cria o registro de uma aula do Centro dizendo que é do Jardim', async () => {
    await assertFails(setDoc(doc(como('profJardim'), `registros/${AULA_NOVA}`), registroDe(AULA_NOVA, DAQUI_A_3.data, 'u-jardim', { marcacoes: { 'a-1': 'faltou' } })))
    // com as regras anteriores esse registro ficava travado: o professor do Centro não marcava a
    // chamada, a administração não corrigia a unidade e ninguém apagava
    await assertSucceeds(setDoc(doc(como('prof'), `registros/${AULA_NOVA}`), registroDe(AULA_NOVA, DAQUI_A_3.data, 'u-centro', { marcacoes: { 'a-1': 'faltou' } })))
  })

  it('nem a vaga: a vaga de uma aula do Centro com a unidade do Jardim é recusada', async () => {
    await assertFails(setDoc(doc(como('profJardim'), `vagas/${AULA_NOVA}`), { ...vagaDe('t-1', DAQUI_A_3, 30, 0), unidadeId: 'u-jardim' }))
    await assertSucceeds(setDoc(doc(como('prof'), `vagas/${AULA_NOVA}`), vagaDe('t-1', DAQUI_A_3, 4, 3)))
  })

  it('turma que não existe também não vira registro nem vaga pela mão do professor', async () => {
    const aula = aulaId('t-fantasma', DAQUI_A_3.data)
    await assertFails(setDoc(doc(como('prof'), `registros/${aula}`), { ...registroDe(aula, DAQUI_A_3.data, 'u-centro'), turmaId: 't-fantasma' }))
    await assertFails(setDoc(doc(como('prof'), `vagas/${aula}`), vagaDe('t-fantasma', DAQUI_A_3, 4, 0)))
  })

  it('a administração continua criando registro e vaga (inclusive de turma nova no mesmo lote)', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), `registros/${AULA_NOVA}`), registroDe(AULA_NOVA, DAQUI_A_3.data, 'u-centro')))
    await assertSucceeds(setDoc(doc(como('adm'), `vagas/${AULA_NOVA}`), vagaDe('t-1', DAQUI_A_3, 4, 3)))
  })
})

describe('crédito que o professor cria é o de um aviso de verdade', () => {
  const AULA = aulaId('t-1', AMANHA.data)
  const ID = `cr_a-1_t-1_${AMANHA.data}`
  const origem = { turmaId: 't-1', data: AMANHA.data }
  const validoAte = somarDias(AMANHA.data, 30)

  /** a chamada do professor: a-1 avisou, o crédito do aviso e a vaga que abre, num lote */
  function avisoPeloProfessor(db: Firestore, c: Record<string, unknown>, marcacao = 'avisou') {
    const b = writeBatch(db)
    b.set(doc(db, `registros/${AULA}`), registroDe(AULA, AMANHA.data, 'u-centro', { marcacoes: { 'a-1': marcacao } }))
    b.set(doc(db, `creditos/${String(c.id)}`), c)
    b.update(doc(db, `vagas/${AULA}`), { ocupadas: increment(-1), atualizadoEm: instante })
    return b.commit()
  }

  it('o aviso marcado pelo professor gera o crédito, como o app grava', async () => {
    await assertSucceeds(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte })))
  })

  it('sem o aluno como "avisou" no registro, não há crédito (nem com o código da falta)', async () => {
    await assertFails(setDoc(doc(como('prof'), `creditos/${ID}`), credito(ID, 'a-1', origem, { validoAte })))
    await assertFails(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte }), 'faltou'))
  })

  it('código inventado, validade além da combinada, crédito já usado ou de outra unidade: recusados', async () => {
    await assertFails(avisoPeloProfessor(como('prof'), credito('cr-livre', 'a-1', origem, { validoAte })))
    await assertFails(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte: '2099-12-31' })))
    await assertFails(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte: somarDias(AMANHA.data, 31) })))
    await assertFails(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte: somarDias(AMANHA.data, -1) })))
    await assertFails(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte, usadoEm: { turmaId: 't-livre', data: AMANHA.data } })))
    await assertFails(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte, motivo: 'cortesia' })))
  })

  it('apagar o crédito do aviso só tirando o "avisou" (a pessoa veio, ou desfazer)', async () => {
    await assertSucceeds(avisoPeloProfessor(como('prof'), credito(ID, 'a-1', origem, { validoAte })))
    // sumir com a reposição do aluno e deixar o aviso lá: recusado
    await assertFails(deleteDoc(doc(como('prof'), `creditos/${ID}`)))
    // a pessoa veio afinal: presente no lugar do aviso, e o crédito sai junto
    const db = como('prof')
    const b = writeBatch(db)
    b.update(doc(db, `registros/${AULA}`), { 'marcacoes.a-1': 'presente', atualizadoEm: instante })
    b.delete(doc(db, `creditos/${ID}`))
    b.update(doc(db, `vagas/${AULA}`), { ocupadas: increment(1), atualizadoEm: instante })
    await assertSucceeds(b.commit())
  })

  it('a administração segue dando cortesia sem aviso', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), 'creditos/cr-cortesia'), credito('cr-cortesia', 'a-1', origem, { motivo: 'cortesia' })))
  })
})

describe('o professor usa e devolve crédito só junto com o encaixe', () => {
  const AULA = aulaId('t-livre', '2026-09-02')

  beforeEach(async () => {
    await semRegras(async (db) => {
      await updateDoc(doc(db, 'creditos/cr-a1'), { usadoEm: { turmaId: 't-livre', data: '2026-09-02' } })
      await setDoc(doc(db, `registros/${AULA}`), { ...registroDe(AULA, '2026-09-02', 'u-centro', { reposicoes: { 'a-1': 'cr-a1' } }), turmaId: 't-livre' })
    })
  })

  it('devolver o crédito usado sem tirar a reposição da aula é recusado', async () => {
    await assertFails(updateDoc(doc(como('prof'), 'creditos/cr-a1'), { usadoEm: deleteField() }))
  })

  it('desfazer o encaixe (a reposição sai e o crédito volta) passa', async () => {
    const db = como('prof')
    const b = writeBatch(db)
    b.update(doc(db, `registros/${AULA}`), { 'reposicoes.a-1': deleteField(), atualizadoEm: instante })
    b.update(doc(db, 'creditos/cr-a1'), { usadoEm: deleteField() })
    await assertSucceeds(b.commit())
  })

  it('marcar como usado um crédito livre sem pôr o aluno na aula é recusado; com o encaixe, passa', async () => {
    await assertFails(updateDoc(doc(como('prof'), 'creditos/cr-a2'), { usadoEm: { turmaId: 't-livre', data: '2026-09-02' } }))
    const db = como('prof')
    const b = writeBatch(db)
    b.update(doc(db, `registros/${AULA}`), { 'reposicoes.a-2': 'cr-a2', atualizadoEm: instante })
    b.update(doc(db, 'creditos/cr-a2'), { usadoEm: { turmaId: 't-livre', data: '2026-09-02' } })
    await assertSucceeds(b.commit())
  })
})

describe('convite de administração: só o titular revoga', () => {
  it('administrador que não é titular não apaga o convite de administração; o titular apaga', async () => {
    await assertFails(deleteDoc(doc(como('adm'), `convites/${EMAILS.convidadoAdm}`)))
    await assertSucceeds(deleteDoc(doc(como('titular'), `convites/${EMAILS.convidadoAdm}`)))
  })

  it('o convite de professor e o de aluno a administração revoga; convite que já não existe também', async () => {
    await assertSucceeds(deleteDoc(doc(como('adm'), `convites/${EMAILS.convidado}`)))
    await assertSucceeds(deleteDoc(doc(como('adm'), `convites/${EMAILS.aluno3}`)))
    await assertSucceeds(deleteDoc(doc(como('adm'), 'convites/ninguem@example.com')))
  })

  it('quem foi convidado apaga o próprio convite ao aceitar', async () => {
    await assertSucceeds(deleteDoc(doc(como('convidadoAdm'), `convites/${EMAILS.convidadoAdm}`)))
    let existe = true
    await semRegras(async (db) => {
      existe = (await getDoc(doc(db, `convites/${EMAILS.convidadoAdm}`))).exists()
    })
    expect(existe).toBe(false)
  })
})
