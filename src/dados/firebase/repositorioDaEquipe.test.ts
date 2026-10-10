import { describe, expect, it } from 'vitest'
import { lotesDeVagas } from './repositorioDaEquipe'

describe('lotes da janela de vagas do professor', () => {
  const vagas = (turma: string, datas: string[]) => datas.map((d) => `${turma}_${d}`)
  const datas = ['2026-10-12', '2026-10-19', '2026-10-26']

  it('não passa do número de turmas por lote (cada turma nova é uma leitura a mais nas regras)', () => {
    const ids = Array.from({ length: 30 }, (_, i) => vagas(`t-${i}`, datas)).flat()
    const lotes = lotesDeVagas(ids, 100, 12)
    expect(lotes.flat()).toEqual(ids)
    for (const lote of lotes) expect(new Set(lote.map((id) => id.slice(0, -11))).size).toBeLessThanOrEqual(12)
    expect(lotes).toHaveLength(3)
  })

  it('a mesma turma em várias datas conta uma vez, e o teto de vagas por lote também vale', () => {
    expect(lotesDeVagas(vagas('t_com_sublinhado', datas), 100, 1)).toEqual([vagas('t_com_sublinhado', datas)])
    expect(lotesDeVagas(vagas('t-1', datas), 2, 12)).toEqual([vagas('t-1', datas.slice(0, 2)), vagas('t-1', datas.slice(2))])
    expect(lotesDeVagas([], 100, 12)).toEqual([])
  })
})
