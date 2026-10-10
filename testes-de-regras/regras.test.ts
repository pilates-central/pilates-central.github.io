// Regras do Firestore no emulador: cada papel contra cada coleção, permitindo e negando,
// e as tentativas de escalada (professor lendo pagamentos, aluno lendo outro aluno, aluno
// se colocando em aula cheia, convite forjado, e-mail não confirmado, mexer na posse).
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { AMANHA, aulaId, banco, CONFIG, credito, criarAmbiente, DEPOIS, EMAILS, expiraEm, LOGO, semear, turma, uidDe } from './cenario'
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

async function ajustar(caminho: string, dados: Record<string, unknown>) {
  await ambiente.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore() as unknown as Firestore, caminho), dados)
  })
}

const instante = '2026-10-09T12:00:00.000Z'

// ---------- leitura: papel x coleção ----------

type Esperado = Partial<Record<Quem, boolean>>

const LEITURAS: [string, Esperado][] = [
  ['estudio/posse', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: false }],
  ['configuracao/estudio', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: true }],
  ['unidades/u-centro', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: true }],
  ['equipe/e-prof', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: false }],
  [`convites/${EMAILS.convidado}`, { anonimo: false, estranho: false, titular: true, adm: true, prof: false, aluno: false, convidado: true }],
  ['acessos/uid-prof', { anonimo: false, estranho: false, titular: false, adm: false, prof: true, aluno: false }],
  ['alunos/a-1', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: false }],
  ['financeiroDosAlunos/a-1', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: false, aluno: false }],
  ['pagamentos/pg-1', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: false, aluno: false }],
  ['turmas/t-1', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: false }],
  ['registros/t-1_2026-09-01', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: false }],
  ['creditos/cr-a1', { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: true, aluno2: false }],
  [`vagas/t-1_${AMANHA.data}`, { anonimo: false, semConfirmar: false, estranho: false, titular: true, adm: true, prof: true, aluno: true }],
  ['portal/a-1', { anonimo: false, estranho: false, titular: true, adm: true, prof: true, aluno: true, aluno2: false }],
  ['publico/estudio', { anonimo: true, semConfirmar: true, estranho: true, titular: true, adm: true, prof: true, aluno: true }],
  ['qualquer/coisa', { anonimo: false, titular: false, adm: false }],
]

describe('leitura de cada documento por cada papel', () => {
  for (const [caminho, esperado] of LEITURAS) {
    for (const [quem, pode] of Object.entries(esperado) as [Quem, boolean][]) {
      it(`${quem} ${pode ? 'lê' : 'não lê'} ${caminho}`, async () => {
        const leitura = getDoc(doc(como(quem), caminho))
        await (pode ? assertSucceeds(leitura) : assertFails(leitura))
      })
    }
  }
})

describe('listas', () => {
  it('a administração lista pagamentos, o professor não', async () => {
    await assertSucceeds(getDocs(collection(como('adm'), 'pagamentos')))
    await assertFails(getDocs(collection(como('prof'), 'pagamentos')))
    await assertFails(getDocs(collection(como('prof'), 'financeiroDosAlunos')))
  })

  it('o aluno lista só os próprios créditos', async () => {
    const meus = query(collection(como('aluno'), 'creditos'), where('alunoId', '==', 'a-1'))
    await assertSucceeds(getDocs(meus))
    await assertFails(getDocs(collection(como('aluno'), 'creditos')))
    await assertFails(getDocs(query(collection(como('aluno'), 'creditos'), where('alunoId', '==', 'a-2'))))
  })

  it('o aluno não lista alunos, turmas nem registros; lista as vagas', async () => {
    await assertFails(getDocs(collection(como('aluno'), 'alunos')))
    await assertFails(getDocs(collection(como('aluno'), 'turmas')))
    await assertFails(getDocs(collection(como('aluno'), 'registros')))
    await assertSucceeds(getDocs(query(collection(como('aluno'), 'vagas'), where('data', '>=', AMANHA.data))))
  })

  it('ninguém de fora lista vagas nem convites', async () => {
    await assertFails(getDocs(collection(como('anonimo'), 'vagas')))
    await assertFails(getDocs(collection(como('estranho'), 'convites')))
    await assertFails(getDocs(collection(como('prof'), 'convites')))
  })
})

// ---------- escrita da equipe ----------

const alunoNovo = (extra: Record<string, unknown> = {}) => ({
  id: 'a-novo',
  nome: 'Aluno Novo',
  unidadeId: 'u-centro',
  telefone: '5511900000099',
  email: '',
  vezesPorSemana: 2,
  situacao: 'ativo',
  observacao: '',
  desde: '2026-10-09',
  ...extra,
})

describe('cadastros: só a administração grava', () => {
  it('configuração: administração sim, com esquema; professor e aluno não', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), 'configuracao/estudio'), { ...CONFIG, nomeEstudio: 'Outro nome' }))
    await assertFails(setDoc(doc(como('adm'), 'configuracao/estudio'), { ...CONFIG, extra: true }))
    await assertFails(setDoc(doc(como('adm'), 'configuracao/estudio'), { ...CONFIG, whatsapp: '19 9999' }))
    await assertFails(setDoc(doc(como('adm'), 'configuracao/estudio'), { ...CONFIG, antecedenciaAvisoHoras: 100 }))
    await assertFails(setDoc(doc(como('prof'), 'configuracao/estudio'), CONFIG))
    await assertFails(setDoc(doc(como('aluno'), 'configuracao/estudio'), { ...CONFIG, antecedenciaAvisoHoras: 0 }))
  })

  it('unidades: administração sim, professor não', async () => {
    const u = { id: 'u-nova', nome: 'Nova', endereco: '', ativa: true }
    await assertSucceeds(setDoc(doc(como('adm'), 'unidades/u-nova'), u))
    await assertFails(setDoc(doc(como('prof'), 'unidades/u-nova'), u))
    await assertFails(deleteDoc(doc(como('adm'), 'unidades/u-centro')))
  })

  it('alunos: administração cria, edita e exclui; professor e aluno não', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), 'alunos/a-novo'), alunoNovo()))
    await assertFails(setDoc(doc(como('adm'), 'alunos/a-novo2'), { ...alunoNovo(), id: 'a-novo2', cpf: '000' }))
    await assertFails(setDoc(doc(como('adm'), 'alunos/a-novo3'), { ...alunoNovo(), id: 'a-novo3', observacao: 'x'.repeat(501) }))
    await assertFails(setDoc(doc(como('adm'), 'alunos/a-novo4'), { ...alunoNovo(), id: 'a-novo4', situacao: 'vip' }))
    await assertFails(setDoc(doc(como('prof'), 'alunos/a-novo5'), { ...alunoNovo(), id: 'a-novo5' }))
    await assertFails(updateDoc(doc(como('aluno'), 'alunos/a-1'), { nome: 'Outro' }))
    await assertFails(deleteDoc(doc(como('prof'), 'alunos/a-1')))
    await assertSucceeds(deleteDoc(doc(como('adm'), 'alunos/a-1')))
  })

  it('financeiro e pagamentos: só a administração', async () => {
    const fin = { alunoId: 'a-1', unidadeId: 'u-centro', valorMensal: 30000, formaPreferida: 'gympass', diaVencimento: 5 }
    await assertSucceeds(setDoc(doc(como('adm'), 'financeiroDosAlunos/a-1'), fin))
    await assertFails(setDoc(doc(como('prof'), 'financeiroDosAlunos/a-1'), fin))
    await assertFails(setDoc(doc(como('adm'), 'financeiroDosAlunos/a-1'), { ...fin, formaPreferida: 'cheque' }))
    const pg = {
      id: 'pg-2',
      alunoId: 'a-1',
      unidadeId: 'u-centro',
      competencia: '2026-10',
      valor: 15000,
      forma: 'totalpass',
      pagoEm: '2026-10-09',
      observacao: '',
    }
    await assertSucceeds(setDoc(doc(como('titular'), 'pagamentos/pg-2'), pg))
    await assertFails(setDoc(doc(como('prof'), 'pagamentos/pg-3'), { ...pg, id: 'pg-3' }))
    await assertFails(setDoc(doc(como('aluno'), 'pagamentos/pg-4'), { ...pg, id: 'pg-4' }))
    await assertFails(setDoc(doc(como('adm'), 'pagamentos/pg-5'), { ...pg, id: 'pg-5', valor: -10 }))
    await assertFails(deleteDoc(doc(como('prof'), 'pagamentos/pg-1')))
  })

  it('turmas: administração sim, professor não', async () => {
    await assertSucceeds(setDoc(doc(como('adm'), 'turmas/t-1'), turma('t-1', ['a-1', 'a-2', 'a-4', 'a-5'], 4)))
    await assertFails(updateDoc(doc(como('prof'), 'turmas/t-1'), { capacidade: 10 }))
    await assertFails(setDoc(doc(como('adm'), 'turmas/t-2'), turma('t-2', [], 99)))
  })

  it('portal do aluno: administração grava, professor não', async () => {
    const p = { alunoId: 'a-4', nome: 'Aluno', unidadeId: 'u-centro', turmas: [], atualizadoEm: instante }
    await assertSucceeds(setDoc(doc(como('adm'), 'portal/a-4'), p))
    await assertFails(setDoc(doc(como('prof'), 'portal/a-4'), p))
    await assertFails(setDoc(doc(como('aluno'), 'portal/a-1'), { ...p, alunoId: 'a-1' }))
  })

  it('página pública: só a equipe grava; o professor só os horários', async () => {
    await assertSucceeds(updateDoc(doc(como('adm'), 'publico/estudio'), { whatsapp: '5511900000002' }))
    await assertSucceeds(updateDoc(doc(como('prof'), 'publico/estudio'), { horarios: [], atualizadoEm: instante }))
    await assertFails(updateDoc(doc(como('prof'), 'publico/estudio'), { whatsapp: '5511900000003' }))
    await assertFails(updateDoc(doc(como('aluno'), 'publico/estudio'), { horarios: [] }))
    await assertFails(updateDoc(doc(como('anonimo'), 'publico/estudio'), { horarios: [] }))
    await assertFails(updateDoc(doc(como('adm'), 'publico/estudio'), { script: '<script>' }))
  })

  it('coleção que não existe nas regras é negada até para a administração', async () => {
    await assertFails(setDoc(doc(como('titular'), 'qualquer/coisa'), { a: 1 }))
  })
})

describe('chamada: presença, aviso e reposição da equipe', () => {
  const registro = `registros/t-1_2026-09-01`

  it('professor marca presença na unidade dele, não na dos outros', async () => {
    await assertSucceeds(updateDoc(doc(como('prof'), registro), { 'marcacoes.a-2': 'presente', atualizadoEm: instante }))
    await assertFails(updateDoc(doc(como('profJardim'), registro), { 'marcacoes.a-2': 'presente', atualizadoEm: instante }))
  })

  it('cancelar aula é só da administração', async () => {
    const cancelamento = { motivo: 'feriado', observacao: '' }
    await assertFails(updateDoc(doc(como('prof'), registro), { cancelamento, atualizadoEm: instante }))
    await assertSucceeds(updateDoc(doc(como('adm'), registro), { cancelamento, atualizadoEm: instante }))
  })

  it('marcação fora da lista é recusada', async () => {
    await assertFails(updateDoc(doc(como('prof'), registro), { 'marcacoes.a-2': 'talvez', atualizadoEm: instante }))
  })

  it('professor cria crédito de aviso, não de cortesia; a administração dá cortesia', async () => {
    // o professor marca "avisou" e o crédito daquela falta no mesmo lote, como o app grava
    const origem = { turmaId: 't-1', data: '2026-09-15' }
    const aula = `t-1_${origem.data}`
    const id = `cr_a-1_${aula}`
    const avisoCom = (quem: Quem, c: Record<string, unknown>) => {
      const db = como(quem)
      const b = writeBatch(db)
      b.set(doc(db, `registros/${aula}`), { id: aula, turmaId: 't-1', unidadeId: 'u-centro', data: origem.data, marcacoes: { 'a-1': 'avisou' }, reposicoes: {}, atualizadoEm: instante })
      b.set(doc(db, `creditos/${String(c.id)}`), c)
      return b.commit()
    }
    const validoAte = '2026-10-15'
    await assertSucceeds(avisoCom('prof', credito(id, 'a-1', origem, { validoAte })))
    await assertFails(setDoc(doc(como('prof'), 'creditos/cr-c'), credito('cr-c', 'a-1', origem, { motivo: 'cortesia' })))
    await assertSucceeds(setDoc(doc(como('adm'), 'creditos/cr-c'), credito('cr-c', 'a-1', origem, { motivo: 'cortesia' })))
    await assertFails(avisoCom('profJardim', credito(id, 'a-1', origem, { validoAte })))
  })

  it('a equipe atualiza a vaga da aula; o professor de outra unidade não', async () => {
    const vaga = `vagas/t-1_${AMANHA.data}`
    await assertSucceeds(updateDoc(doc(como('prof'), vaga), { ocupadas: increment(-1), atualizadoEm: instante }))
    await assertFails(updateDoc(doc(como('profJardim'), vaga), { ocupadas: increment(-1), atualizadoEm: instante }))
    await assertFails(updateDoc(doc(como('prof'), vaga), { capacidade: 99, atualizadoEm: instante }))
  })
})

// ---------- equipe e convites ----------

const convidadoNovo = (id: string, papel: string, email: string) => ({
  id,
  nome: `Pessoa ${id}`,
  papel,
  email,
  telefone: '',
  unidades: ['u-centro'],
  ativo: true,
  convite: { enviadoEm: instante, porId: 'e-adm' },
})

const conviteDe = (email: string, papel: string, pessoaId: string, porId: string) => ({
  email,
  papel,
  pessoaId,
  porId,
  criadoEm: instante,
  expiraEm: expiraEm(7),
})

describe('equipe: quem convida e quem muda o papel de quem', () => {
  it('administração convida professor', async () => {
    const db = como('adm')
    const b = writeBatch(db)
    b.set(doc(db, 'equipe/e-p2'), convidadoNovo('e-p2', 'professor', 'p2@example.com'))
    b.set(doc(db, 'convites/p2@example.com'), conviteDe('p2@example.com', 'professor', 'e-p2', 'e-adm'))
    await assertSucceeds(b.commit())
  })

  it('administrador não convida administrador (escalada)', async () => {
    const db = como('adm')
    const b = writeBatch(db)
    b.set(doc(db, 'equipe/e-a2'), convidadoNovo('e-a2', 'administrador', 'a2@example.com'))
    b.set(doc(db, 'convites/a2@example.com'), conviteDe('a2@example.com', 'administrador', 'e-a2', 'e-adm'))
    await assertFails(b.commit())
  })

  it('titular convida administrador', async () => {
    const db = como('titular')
    const b = writeBatch(db)
    b.set(doc(db, 'equipe/e-a3'), { ...convidadoNovo('e-a3', 'administrador', 'a3@example.com'), unidades: [] })
    b.set(doc(db, 'convites/a3@example.com'), conviteDe('a3@example.com', 'administrador', 'e-a3', 'e-titular'))
    await assertSucceeds(b.commit())
  })

  it('convite forjado: professor e pessoa de fora não convidam ninguém', async () => {
    await assertFails(setDoc(doc(como('prof'), 'equipe/e-p3'), convidadoNovo('e-p3', 'professor', 'p3@example.com')))
    await assertFails(
      setDoc(doc(como('estranho'), `convites/${EMAILS.estranho}`), conviteDe(EMAILS.estranho, 'administrador', 'e-adm', 'e-adm')),
    )
    await assertFails(
      setDoc(doc(como('aluno'), `convites/${EMAILS.estranho}`), conviteDe(EMAILS.estranho, 'professor', 'e-convidado', 'a-1')),
    )
  })

  it('convite que não bate com o cadastro (outro e-mail ou outro papel) é recusado', async () => {
    await assertFails(
      setDoc(doc(como('adm'), `convites/${EMAILS.estranho}`), conviteDe(EMAILS.estranho, 'professor', 'e-convidado', 'e-adm')),
    )
    await assertFails(
      setDoc(doc(como('titular'), `convites/${EMAILS.convidado}`), conviteDe(EMAILS.convidado, 'administrador', 'e-convidado', 'e-titular')),
    )
  })

  it('ninguém nasce com a conta ligada: cadastro com uid é recusado', async () => {
    await assertFails(
      setDoc(doc(como('adm'), 'equipe/e-p4'), { ...convidadoNovo('e-p4', 'professor', 'p4@example.com'), uid: 'uid-estranho' }),
    )
  })

  it('administrador não promove professor; titular promove', async () => {
    await assertFails(updateDoc(doc(como('adm'), 'equipe/e-prof'), { papel: 'administrador' }))
    await assertSucceeds(updateDoc(doc(como('titular'), 'equipe/e-prof'), { papel: 'administrador' }))
  })

  it('administrador não tira outro administrador; titular tira', async () => {
    await assertFails(updateDoc(doc(como('adm'), 'equipe/e-convidado-adm'), { ativo: false }))
    await assertSucceeds(updateDoc(doc(como('titular'), 'equipe/e-adm'), { ativo: false }))
  })

  it('ninguém mexe no cadastro do titular, nem o próprio titular se desativa', async () => {
    await assertFails(updateDoc(doc(como('adm'), 'equipe/e-titular'), { ativo: false }))
    await assertFails(updateDoc(doc(como('adm'), 'equipe/e-titular'), { papel: 'professor' }))
    await assertFails(updateDoc(doc(como('titular'), 'equipe/e-titular'), { ativo: false }))
    await assertSucceeds(updateDoc(doc(como('titular'), 'equipe/e-titular'), { telefone: '5511900000077' }))
  })

  it('administração desativa professor; professor edita o próprio contato, não as unidades nem o papel', async () => {
    await assertSucceeds(updateDoc(doc(como('prof'), 'equipe/e-prof'), { nome: 'Nome Novo' }))
    await assertFails(updateDoc(doc(como('prof'), 'equipe/e-prof'), { unidades: ['u-centro', 'u-jardim'] }))
    await assertFails(updateDoc(doc(como('prof'), 'equipe/e-prof'), { papel: 'administrador' }))
    await assertFails(updateDoc(doc(como('prof'), 'equipe/e-jardim'), { nome: 'Outro' }))
    await assertSucceeds(updateDoc(doc(como('adm'), 'equipe/e-jardim'), { ativo: false }))
  })

  it('e-mail de quem já entrou não muda (é ele que liga a conta ao papel)', async () => {
    await assertFails(updateDoc(doc(como('adm'), 'equipe/e-prof'), { email: 'outro@example.com' }))
    await assertSucceeds(updateDoc(doc(como('adm'), 'equipe/e-convidado'), { email: 'corrigido@example.com' }))
    await assertFails(updateDoc(doc(como('adm'), 'equipe/e-prof'), { uid: 'uid-estranho' }))
  })

  it('professor desativado perde o acesso na hora', async () => {
    await ajustar('equipe/e-prof', { ativo: false })
    await assertFails(getDoc(doc(como('prof'), 'alunos/a-1')))
  })
})

describe('aceitar convite', () => {
  const aceitar = (quem: Quem, membroId: string, email: string) => {
    const db = como(quem)
    const uid = uidDe(quem as Exclude<Quem, 'anonimo'>)
    const b = writeBatch(db)
    b.set(doc(db, `acessos/${uid}`), { tipo: 'equipe', pessoaId: membroId, email, criadoEm: instante })
    b.update(doc(db, `equipe/${membroId}`), { uid, convite: deleteField() })
    b.delete(doc(db, `convites/${email}`))
    return b.commit()
  }

  it('quem foi convidado aceita com o e-mail confirmado e passa a ver a equipe', async () => {
    await assertFails(getDoc(doc(como('convidado'), 'equipe/e-prof')))
    await assertSucceeds(aceitar('convidado', 'e-convidado', EMAILS.convidado))
    await assertSucceeds(getDoc(doc(como('convidado'), 'equipe/e-prof')))
    await assertFails(getDoc(doc(como('convidado'), 'pagamentos/pg-1')))
  })

  it('administrador convidado pelo titular aceita e vê o financeiro', async () => {
    await assertSucceeds(aceitar('convidadoAdm', 'e-convidado-adm', EMAILS.convidadoAdm))
    await assertSucceeds(getDoc(doc(como('convidadoAdm'), 'pagamentos/pg-1')))
  })

  it('e-mail não confirmado não aceita convite', async () => {
    const db = ambiente
      .authenticatedContext('uid-convidado', { email: EMAILS.convidado, email_verified: false })
      .firestore() as unknown as Firestore
    const b = writeBatch(db)
    b.set(doc(db, 'acessos/uid-convidado'), { tipo: 'equipe', pessoaId: 'e-convidado', email: EMAILS.convidado, criadoEm: instante })
    b.update(doc(db, 'equipe/e-convidado'), { uid: 'uid-convidado', convite: deleteField() })
    await assertFails(b.commit())
  })

  it('pessoa de fora não toma o convite de outra (e-mail diferente)', async () => {
    const db = como('estranho')
    const b = writeBatch(db)
    b.set(doc(db, 'acessos/uid-estranho'), { tipo: 'equipe', pessoaId: 'e-convidado', email: EMAILS.estranho, criadoEm: instante })
    b.update(doc(db, 'equipe/e-convidado'), { uid: 'uid-estranho', convite: deleteField() })
    await assertFails(b.commit())
    await assertFails(
      setDoc(doc(db, 'acessos/uid-estranho'), { tipo: 'equipe', pessoaId: 'e-titular', email: EMAILS.estranho, criadoEm: instante }),
    )
  })

  it('ao aceitar, o convidado não muda o próprio papel', async () => {
    const db = como('convidado')
    const b = writeBatch(db)
    b.set(doc(db, 'acessos/uid-convidado'), { tipo: 'equipe', pessoaId: 'e-convidado', email: EMAILS.convidado, criadoEm: instante })
    b.update(doc(db, 'equipe/e-convidado'), { uid: 'uid-convidado', convite: deleteField(), papel: 'administrador' })
    await assertFails(b.commit())
  })

  it('professor não troca o próprio acesso por um que aponte para o titular', async () => {
    const db = como('prof')
    await assertSucceeds(deleteDoc(doc(db, 'acessos/uid-prof')))
    await assertFails(setDoc(doc(db, 'acessos/uid-prof'), { tipo: 'equipe', pessoaId: 'e-titular', email: EMAILS.prof, criadoEm: instante }))
    await assertFails(updateDoc(doc(como('adm'), 'acessos/uid-adm'), { pessoaId: 'e-titular' }))
  })

  it('aluno convidado aceita e passa a ver os próprios créditos', async () => {
    const db = como('aluno3')
    const b = writeBatch(db)
    b.set(doc(db, 'acessos/uid-aluno3'), { tipo: 'aluno', pessoaId: 'a-3', email: EMAILS.aluno3, criadoEm: instante })
    b.delete(doc(db, `convites/${EMAILS.aluno3}`))
    await assertSucceeds(b.commit())
    await assertSucceeds(getDocs(query(collection(db, 'creditos'), where('alunoId', '==', 'a-3'))))
    await assertFails(getDoc(doc(db, 'alunos/a-3')))
  })

  it('aluno não vira equipe nem pega o cadastro de outro aluno', async () => {
    const db = como('aluno3')
    await assertFails(setDoc(doc(db, 'acessos/uid-aluno3'), { tipo: 'equipe', pessoaId: 'a-3', email: EMAILS.aluno3, criadoEm: instante }))
    await assertFails(setDoc(doc(db, 'acessos/uid-aluno3'), { tipo: 'aluno', pessoaId: 'a-1', email: EMAILS.aluno3, criadoEm: instante }))
  })

  it('com o acesso dos alunos desligado, o convite de aluno não vale', async () => {
    await ajustar('configuracao/estudio', { acessoDoAluno: false })
    const db = como('aluno3')
    await assertFails(setDoc(doc(db, 'acessos/uid-aluno3'), { tipo: 'aluno', pessoaId: 'a-3', email: EMAILS.aluno3, criadoEm: instante }))
  })
})

describe('e-mail não confirmado', () => {
  it('a conta com o e-mail da responsável, sem confirmar, não lê nem grava nada', async () => {
    const db = como('semConfirmar')
    await assertFails(getDoc(doc(db, 'alunos/a-1')))
    await assertFails(getDoc(doc(db, 'pagamentos/pg-1')))
    await assertFails(getDoc(doc(db, 'configuracao/estudio')))
    await assertFails(setDoc(doc(db, 'unidades/u-x'), { id: 'u-x', nome: 'X', endereco: '', ativa: true }))
  })
})

// ---------- posse do estúdio ----------

describe('posse: quem é responsável pela conta', () => {
  it('ninguém apaga nem reescreve a posse por fora', async () => {
    await assertFails(deleteDoc(doc(como('titular'), 'estudio/posse')))
    await assertFails(updateDoc(doc(como('adm'), 'estudio/posse'), { titularUid: 'uid-adm', titularMembroId: 'e-adm' }))
    await assertFails(
      setDoc(doc(como('estranho'), 'estudio/posse'), { titularUid: 'uid-estranho', titularMembroId: 'e-x', criadoEm: serverTimestamp() }),
    )
  })

  it('titular passa a conta para um administrador que já entrou', async () => {
    await assertSucceeds(updateDoc(doc(como('titular'), 'estudio/posse'), { titularUid: 'uid-adm', titularMembroId: 'e-adm' }))
    // agora quem convida administrador é o novo titular
    const db = como('adm')
    const b = writeBatch(db)
    b.set(doc(db, 'equipe/e-a9'), { ...convidadoNovo('e-a9', 'administrador', 'a9@example.com'), unidades: [] })
    b.set(doc(db, 'convites/a9@example.com'), conviteDe('a9@example.com', 'administrador', 'e-a9', 'e-adm'))
    await assertSucceeds(b.commit())
    await assertFails(updateDoc(doc(como('titular'), 'estudio/posse'), { titularUid: 'uid-titular', titularMembroId: 'e-titular' }))
  })

  it('a conta não passa para professor, para convite pendente nem com uid trocado', async () => {
    const db = como('titular')
    await assertFails(updateDoc(doc(db, 'estudio/posse'), { titularUid: 'uid-prof', titularMembroId: 'e-prof' }))
    await assertFails(updateDoc(doc(db, 'estudio/posse'), { titularUid: 'uid-convidado-adm', titularMembroId: 'e-convidado-adm' }))
    await assertFails(updateDoc(doc(db, 'estudio/posse'), { titularUid: 'uid-estranho', titularMembroId: 'e-adm' }))
  })
})

describe('primeiro acesso: reivindicar o estúdio', () => {
  beforeEach(async () => {
    await ambiente.clearFirestore()
  })

  const reivindicar = (db: Firestore, uid: string, email: string, membroId = 'e-primeira') => {
    const b = writeBatch(db)
    b.set(doc(db, 'estudio/posse'), { titularUid: uid, titularMembroId: membroId, criadoEm: serverTimestamp() })
    b.set(doc(db, `equipe/${membroId}`), {
      id: membroId,
      nome: 'Responsável',
      papel: 'administrador',
      email,
      telefone: '',
      unidades: [],
      ativo: true,
      uid,
    })
    b.set(doc(db, `acessos/${uid}`), { tipo: 'equipe', pessoaId: membroId, email, criadoEm: instante })
    return b.commit()
  }

  it('a conta com o e-mail combinado reivindica, uma vez só', async () => {
    await assertSucceeds(reivindicar(como('titular'), 'uid-titular', EMAILS.titular))
    await assertFails(reivindicar(como('titular'), 'uid-titular', EMAILS.titular, 'e-outra'))
    // e já é administração
    await assertSucceeds(setDoc(doc(como('titular'), 'configuracao/estudio'), CONFIG))
  })

  it('outra conta não reivindica (mesmo sendo a primeira)', async () => {
    await assertFails(reivindicar(como('estranho'), 'uid-estranho', EMAILS.estranho))
  })

  it('sem e-mail confirmado não reivindica', async () => {
    await assertFails(reivindicar(como('semConfirmar'), 'uid-titular', EMAILS.titular))
  })

  it('posse sem o cadastro e o acesso juntos é recusada', async () => {
    await assertFails(
      setDoc(doc(como('titular'), 'estudio/posse'), { titularUid: 'uid-titular', titularMembroId: 'e-primeira', criadoEm: serverTimestamp() }),
    )
  })
})

// ---------- o aluno sozinho ----------

const AULA = aulaId('t-1', AMANHA.data)
const CREDITO_DO_AVISO = `cr_a-1_t-1_${AMANHA.data}`
const validade = (data: string, dias: number) => {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function avisar(db: Firestore, opcoes: { alunoId?: string; aula?: string; turmaId?: string; data?: string; semVaga?: boolean; validoAte?: string } = {}) {
  const alunoId = opcoes.alunoId ?? 'a-1'
  const turmaId = opcoes.turmaId ?? 't-1'
  const data = opcoes.data ?? AMANHA.data
  const aula = opcoes.aula ?? aulaId(turmaId, data)
  const b = writeBatch(db)
  // como o app faz: o aluno não lê o registro, então grava só a marcação dele, por mescla
  b.set(
    doc(db, `registros/${aula}`),
    { id: aula, turmaId, unidadeId: 'u-centro', data, marcacoes: { [alunoId]: 'avisou' }, atualizadoEm: instante },
    { merge: true },
  )
  const id = `cr_${alunoId}_${turmaId}_${data}`
  b.set(doc(db, `creditos/${id}`), credito(id, alunoId, { turmaId, data }, { validoAte: opcoes.validoAte ?? validade(data, 30) }))
  if (!opcoes.semVaga) b.update(doc(db, `vagas/${aula}`), { ocupadas: increment(-1), atualizadoEm: instante })
  return b.commit()
}

function encaixar(db: Firestore, creditoId: string, turmaId: string, quando: { data: string }, alunoId = 'a-1', extra = 1) {
  const aula = aulaId(turmaId, quando.data)
  const b = writeBatch(db)
  b.set(
    doc(db, `registros/${aula}`),
    { id: aula, turmaId, unidadeId: 'u-centro', data: quando.data, reposicoes: { [alunoId]: creditoId }, atualizadoEm: instante },
    { merge: true },
  )
  b.update(doc(db, `creditos/${creditoId}`), { usadoEm: { turmaId, data: quando.data } })
  b.update(doc(db, `vagas/${aula}`), { ocupadas: increment(extra), atualizadoEm: instante })
  return b.commit()
}

describe('aluno: avisar a própria falta', () => {
  it('avisa no prazo: registro, crédito e vaga mudam juntos', async () => {
    await assertSucceeds(avisar(como('aluno')))
    const vaga = await getDoc(doc(como('aluno'), `vagas/${AULA}`))
    if (vaga.data()?.ocupadas !== 2) throw new Error('a vaga deveria ter aberto')
    await assertSucceeds(getDoc(doc(como('aluno'), `creditos/${CREDITO_DO_AVISO}`)))
  })

  it('fora do prazo (aula começa em menos de 3 horas) é recusado', async () => {
    await assertFails(avisar(como('aluno'), { data: LOGO.data, aula: aulaId('t-1', LOGO.data) }))
  })

  it('não avisa a falta de outro aluno', async () => {
    await assertFails(avisar(como('aluno'), { alunoId: 'a-2' }))
  })

  it('não avisa falta numa turma que não é dele', async () => {
    await assertFails(avisar(como('aluno'), { turmaId: 't-livre', data: DEPOIS.data }))
  })

  it('não avisa sem abrir a vaga, nem cria crédito sem avisar', async () => {
    await assertFails(avisar(como('aluno'), { semVaga: true }))
    const db = como('aluno')
    await assertFails(
      setDoc(doc(db, `creditos/${CREDITO_DO_AVISO}`), credito(CREDITO_DO_AVISO, 'a-1', { turmaId: 't-1', data: AMANHA.data })),
    )
  })

  it('não ganha crédito com validade maior que a combinada', async () => {
    await assertFails(avisar(como('aluno'), { validoAte: validade(AMANHA.data, 90) }))
  })

  it('dois alunos avisam na mesma aula (o segundo mescla no registro do primeiro)', async () => {
    await assertSucceeds(avisar(como('aluno')))
    await assertSucceeds(avisar(como('aluno2'), { alunoId: 'a-2' }))
    let marcacoes: Record<string, string> = {}
    await ambiente.withSecurityRulesDisabled(async (ctx) => {
      const r = await getDoc(doc(ctx.firestore() as unknown as Firestore, `registros/${AULA}`))
      marcacoes = (r.data()?.marcacoes ?? {}) as Record<string, string>
    })
    if (marcacoes['a-1'] !== 'avisou' || marcacoes['a-2'] !== 'avisou') throw new Error('um aviso apagou o outro')
  })

  it('a mescla do aluno não apaga a chamada que a equipe já fez', async () => {
    await ambiente.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, `registros/${AULA}`), {
        id: AULA,
        turmaId: 't-1',
        unidadeId: 'u-centro',
        data: AMANHA.data,
        marcacoes: { 'a-4': 'avisou' },
        reposicoes: { 'a-5': 'cr-x' },
        atualizadoEm: instante,
      })
    })
    await assertSucceeds(avisar(como('aluno')))
  })

  it('não marca presença em si mesmo nem troca o aviso por presença', async () => {
    const db = como('aluno')
    await assertFails(
      setDoc(doc(db, `registros/${AULA}`), {
        id: AULA,
        turmaId: 't-1',
        unidadeId: 'u-centro',
        data: AMANHA.data,
        marcacoes: { 'a-1': 'presente' },
        reposicoes: {},
        atualizadoEm: instante,
      }),
    )
    await assertSucceeds(avisar(db))
    const b = writeBatch(db)
    b.update(doc(db, `registros/${AULA}`), { 'marcacoes.a-1': 'presente', atualizadoEm: instante })
    b.update(doc(db, `vagas/${AULA}`), { ocupadas: increment(1), atualizadoEm: instante })
    await assertFails(b.commit())
  })

  it('não mexe na vaga à toa', async () => {
    await assertFails(updateDoc(doc(como('aluno'), `vagas/${AULA}`), { ocupadas: 0, atualizadoEm: instante }))
    await assertFails(updateDoc(doc(como('aluno'), `vagas/${AULA}`), { ocupadas: increment(-1), atualizadoEm: instante }))
  })

  it('desfaz o aviso dentro do prazo: crédito sai e o lugar volta', async () => {
    await assertSucceeds(avisar(como('aluno')))
    const db = como('aluno')
    const b = writeBatch(db)
    b.update(doc(db, `registros/${AULA}`), { [`marcacoes.a-1`]: deleteField(), atualizadoEm: instante })
    b.delete(doc(db, `creditos/${CREDITO_DO_AVISO}`))
    b.update(doc(db, `vagas/${AULA}`), { ocupadas: increment(1), atualizadoEm: instante })
    await assertSucceeds(b.commit())
  })

  it('aluno com acesso desligado (pela ficha ou pelo estúdio) não avisa', async () => {
    await ajustar('alunos/a-1', { acesso: deleteField() })
    await assertFails(avisar(como('aluno')))
    await assertFails(getDoc(doc(como('aluno'), `vagas/${AULA}`)))
  })

  it('com o acesso dos alunos desligado nas configurações, o aluno não vê nada', async () => {
    await ajustar('configuracao/estudio', { acessoDoAluno: false })
    await assertFails(getDoc(doc(como('aluno'), `vagas/${AULA}`)))
    await assertFails(getDoc(doc(como('aluno'), 'portal/a-1')))
  })
})

describe('aluno: encaixar a própria reposição', () => {
  it('encaixa numa aula com vaga usando o próprio crédito', async () => {
    await assertSucceeds(encaixar(como('aluno'), 'cr-a1', 't-livre', DEPOIS))
  })

  it('não se coloca em aula cheia', async () => {
    await assertFails(encaixar(como('aluno'), 'cr-a1', 't-cheia', DEPOIS))
  })

  it('não usa o crédito de outro aluno', async () => {
    await assertFails(encaixar(como('aluno'), 'cr-a2', 't-livre', DEPOIS))
    await assertFails(encaixar(como('aluno'), 'cr-a2', 't-livre', DEPOIS, 'a-2'))
  })

  it('não entra sem gastar o crédito, nem ocupa dois lugares', async () => {
    const db = como('aluno')
    const aula = aulaId('t-livre', DEPOIS.data)
    const b = writeBatch(db)
    b.set(doc(db, `registros/${aula}`), {
      id: aula,
      turmaId: 't-livre',
      unidadeId: 'u-centro',
      data: DEPOIS.data,
      marcacoes: {},
      reposicoes: { 'a-1': 'cr-a1' },
      atualizadoEm: instante,
    })
    b.update(doc(db, `vagas/${aula}`), { ocupadas: increment(1), atualizadoEm: instante })
    await assertFails(b.commit())
    await assertFails(encaixar(como('aluno'), 'cr-a1', 't-livre', DEPOIS, 'a-1', 2))
  })

  it('crédito vencido ou já usado não serve', async () => {
    await ajustar('creditos/cr-a1', { validoAte: '2026-01-01' })
    await assertFails(encaixar(como('aluno'), 'cr-a1', 't-livre', DEPOIS))
    await ajustar('creditos/cr-a1', { validoAte: '2099-12-31', usadoEm: { turmaId: 't-1', data: '2026-09-10' } })
    await assertFails(encaixar(como('aluno'), 'cr-a1', 't-livre', DEPOIS))
  })

  it('desiste da reposição dentro do prazo e o crédito volta', async () => {
    await assertSucceeds(encaixar(como('aluno'), 'cr-a1', 't-livre', DEPOIS))
    const db = como('aluno')
    const aula = aulaId('t-livre', DEPOIS.data)
    const b = writeBatch(db)
    b.update(doc(db, `registros/${aula}`), { 'reposicoes.a-1': deleteField(), atualizadoEm: instante })
    b.update(doc(db, 'creditos/cr-a1'), { usadoEm: deleteField() })
    b.update(doc(db, `vagas/${aula}`), { ocupadas: increment(-1), atualizadoEm: instante })
    await assertSucceeds(b.commit())
  })

  it('aluno inativo não encaixa', async () => {
    await ajustar('alunos/a-1', { situacao: 'inativo' })
    await assertFails(encaixar(como('aluno'), 'cr-a1', 't-livre', DEPOIS))
  })
})
