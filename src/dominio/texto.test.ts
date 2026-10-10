import { describe, expect, it } from 'vitest'
import {
  ehEmailValido,
  iniciais,
  linkDoWhatsApp,
  listaFalada,
  nomeCurto,
  normalizar,
  normalizarTelefone,
  plural,
  primeiroNome,
  telefoneLegivel,
} from './texto'

describe('texto da interface', () => {
  it('nomes', () => {
    expect(primeiroNome('  Ana Souza ')).toBe('Ana')
    expect(nomeCurto('Ana Maria Souza')).toBe('Ana S.')
    expect(nomeCurto('Ana')).toBe('Ana')
    expect(iniciais('Ana Maria Souza')).toBe('AS')
    expect(iniciais('bia')).toBe('B')
  })

  it('busca sem acento', () => {
    expect(normalizar(' Conceição ')).toBe('conceicao')
  })

  it('telefone e WhatsApp', () => {
    expect(telefoneLegivel('5511900000012')).toBe('(11) 90000-0012')
    expect(telefoneLegivel('1130000000')).toBe('(11) 3000-0000')
    expect(linkDoWhatsApp('5511900000012', 'Oi, tudo bem?')).toBe('https://wa.me/5511900000012?text=Oi%2C%20tudo%20bem%3F')
  })

  it('telefone como a pessoa digita vira só dígitos com DDI', () => {
    expect(normalizarTelefone('(11) 90000-0012')).toBe('5511900000012')
    expect(normalizarTelefone('+55 11 90000-0012')).toBe('5511900000012')
    expect(normalizarTelefone('5511900000012')).toBe('5511900000012')
    // fixo, com 10 dígitos
    expect(normalizarTelefone('(11) 0000-0000')).toHaveLength(12)
    expect(normalizarTelefone('0000-0012')).toBeNull()
    expect(normalizarTelefone('(01) 90000-0012')).toBeNull()
    // o zero de discagem antes do DDD do celular
    expect(normalizarTelefone('019 90000-0012')).toBe('5519900000012')
    expect(normalizarTelefone('(019) 90000-0012')).toBe('5519900000012')
    // celular de 11 dígitos começa com 9
    expect(normalizarTelefone('(11) 80000-0012')).toBeNull()
  })

  it('e-mail', () => {
    expect(ehEmailValido('ana@example.com')).toBe(true)
    expect(ehEmailValido('ana@example')).toBe(false)
    expect(ehEmailValido('ana example.com')).toBe(false)
  })

  it('plural e listas faladas', () => {
    expect(plural(1, 'vaga')).toBe('1 vaga')
    expect(plural(0, 'vaga')).toBe('0 vagas')
    expect(plural(2, 'reposição', 'reposições')).toBe('2 reposições')
    expect(listaFalada([])).toBe('')
    expect(listaFalada(['Ana'])).toBe('Ana')
    expect(listaFalada(['Ana', 'Bia', 'Caio'])).toBe('Ana, Bia e Caio')
  })
})
