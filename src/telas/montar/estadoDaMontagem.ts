// O rascunho do guia de primeiro uso. Com o estúdio de verdade, cada passo grava pelas ações de
// sempre (o que já foi feito não se perde se a pessoa fechar o app no meio); a grade da semana
// fica no rascunho até "Salvar a grade", porque tocar e destocar horários é rápido. Na
// demonstração o guia é uma prévia: tudo fica no rascunho e nada é gravado.
import { computed, signal } from '@preact/signals'
import { gravarLocal, lerLocal } from '../../app/armazenamento'
import { membro } from '../../app/perfil'
import { agoraDoApp } from '../../app/relogio'
import { base, repositorio } from '../../dados/estado'
import { convidarParaEquipe, criarTurmasEmLote, idNovo, salvarConfiguracao, salvarUnidade } from '../../dados/gestao'
import { CONFIGURACAO_PADRAO, validarConfiguracao } from '../../dominio/configuracao'
import { convidar, validarMembro } from '../../dominio/equipe'
import type { RascunhoMembro } from '../../dominio/equipe'
import type { PadraoDaGrade } from '../../dominio/montagem'
import { aceito, recusado, semErros } from '../../dominio/resultado'
import type { ErrosDeCampo, Resultado } from '../../dominio/resultado'
import { normalizarTelefone } from '../../dominio/texto'
import type { Configuracao, Hora, MembroEquipe, Turma, Unidade } from '../../dominio/tipos'
import type { RascunhoTurma } from '../../dominio/turmas'
import { montarUnidade, validarUnidade } from '../../dominio/unidades'
import type { CampoUnidade, RascunhoUnidade } from '../../dominio/unidades'

interface Rascunho {
  /** só na prévia (demonstração): o que a pessoa escreveu no passo do estúdio */
  estudio: Pick<Configuracao, 'nomeEstudio' | 'whatsapp'> | null
  /** só na prévia: unidades e professores "criados" */
  unidades: Unidade[]
  equipe: MembroEquipe[]
  /** a grade em montagem, nos dois modos, até "Salvar a grade" */
  turmasNovas: RascunhoTurma[]
  /** só na prévia: a grade "salva" */
  turmasDaPrevia: Turma[]
  /** horários quebrados pedidos em "Outro horário" */
  horasExtras: Hora[]
  comDomingo: boolean
  padrao: Partial<PadraoDaGrade>
  /** só na prévia: quantos alunos a importação conferiu */
  alunosDaPrevia: number
}

const vazio = (): Rascunho => ({
  estudio: null,
  unidades: [],
  equipe: [],
  turmasNovas: [],
  turmasDaPrevia: [],
  horasExtras: [],
  comDomingo: false,
  padrao: {},
  alunosDaPrevia: 0,
})

export const rascunho = signal<Rascunho>(vazio())

export function mudarRascunho(mudanca: Partial<Rascunho>): void {
  rascunho.value = { ...rascunho.peek(), ...mudanca }
}

/** Na demonstração o guia é uma prévia: mostra tudo e não grava nada. */
export const previa = computed(() => repositorio.value?.modo === 'demonstracao')

/** O estúdio como o guia mostra: o que está no banco mais o que a prévia "criou". */
export const visto = computed(() => {
  const b = base.value
  const r = rascunho.value
  const configuracao = { ...(b?.configuracao ?? CONFIGURACAO_PADRAO), ...(r.estudio ?? {}) }
  return {
    configuracao,
    unidades: [...(b?.unidades ?? []), ...r.unidades],
    equipe: [...(b?.equipe ?? []), ...r.equipe],
    turmas: [...(b?.turmas ?? []), ...r.turmasDaPrevia],
    alunos: b?.alunos ?? [],
    alunosDaPrevia: r.alunosDaPrevia,
  }
})

// ---------- o guia já foi visto neste aparelho ----------

const CHAVE_DO_GUIA = 'pilates-central:guia-do-estudio'

/** A pessoa saiu do guia (ou chegou ao fim) neste aparelho: ele não abre mais sozinho. */
export function guiaDispensado(): boolean {
  return lerLocal(CHAVE_DO_GUIA) === 'visto'
}

export function dispensarGuia(): void {
  gravarLocal(CHAVE_DO_GUIA, 'visto')
}

/** Fim do guia: o rascunho volta ao começo. */
export function limparRascunho(): void {
  rascunho.value = vazio()
}

// ---------- cada passo ----------

export async function salvarEstudio(nomeEstudio: string, whatsapp: string): Promise<Resultado<object> & { erros?: ErrosDeCampo<'nomeEstudio' | 'whatsapp'> }> {
  const atual = visto.peek().configuracao
  const nova = { ...atual, nomeEstudio, whatsapp }
  const erros = validarConfiguracao(nova)
  if (!semErros(erros)) {
    return { ...recusado('dados-invalidos', Object.values(erros)[0] ?? 'Confira os dados.'), erros: { nomeEstudio: erros.nomeEstudio, whatsapp: erros.whatsapp } }
  }
  if (previa.peek()) {
    mudarRascunho({ estudio: { nomeEstudio: nomeEstudio.trim(), whatsapp: whatsapp ? (normalizarTelefone(whatsapp) ?? '') : '' } })
    return aceito({})
  }
  // nada mudou: não grava de novo
  if (nomeEstudio.trim() === atual.nomeEstudio && (normalizarTelefone(whatsapp) ?? '') === atual.whatsapp) return aceito({})
  return salvarConfiguracao(nova)
}

export async function adicionarUnidade(r: RascunhoUnidade): Promise<Resultado<{ unidade: Unidade }> & { erros?: ErrosDeCampo<CampoUnidade> }> {
  const erros = validarUnidade(r, visto.peek().unidades)
  if (!semErros(erros)) return { ...recusado('dados-invalidos', Object.values(erros)[0] ?? 'Confira os dados.'), erros }
  if (previa.peek()) {
    const unidade = montarUnidade(r, idNovo('u'))
    mudarRascunho({ unidades: [...rascunho.peek().unidades, unidade] })
    return aceito({ unidade })
  }
  return salvarUnidade(r)
}

export async function adicionarProfessor(r: RascunhoMembro): Promise<Resultado<{ membro: MembroEquipe }> & { erros?: ErrosDeCampo<'nome' | 'email' | 'telefone' | 'unidades'> }> {
  const v = visto.peek()
  const erros = validarMembro(r, v.equipe, v.unidades)
  if (!semErros(erros)) return { ...recusado('dados-invalidos', Object.values(erros)[0] ?? 'Confira os dados.'), erros }
  const ator = membro.peek()
  if (!ator) return recusado('sem-permissao', 'Os dados ainda não carregaram.')
  if (previa.peek()) {
    const c = convidar(ator, r, v.equipe, v.unidades, idNovo('e'), agoraDoApp().toISOString())
    if (!c.ok) return c
    mudarRascunho({ equipe: [...rascunho.peek().equipe, c.valor] })
    return aceito({ membro: c.valor })
  }
  return convidarParaEquipe(ator, r)
}

/** Grava a grade montada (as turmas novas do rascunho), numa gravação só. */
export async function salvarGrade(): Promise<Resultado<{ criadas: number; recusadas: string[] }>> {
  const novas = rascunho.peek().turmasNovas
  if (novas.length === 0) return aceito({ criadas: 0, recusadas: [] })
  if (previa.peek()) {
    const turmas = novas.map((r) => ({ ...r, id: idNovo('t'), alunosFixos: [], fixosDesde: {}, ativa: true, desde: agoraDoApp().toISOString().slice(0, 10) }))
    mudarRascunho({ turmasDaPrevia: [...rascunho.peek().turmasDaPrevia, ...turmas], turmasNovas: [] })
    return aceito({ criadas: turmas.length, recusadas: [] })
  }
  // sem internet, a grade esperaria numa fila que só vive enquanto o app está aberto: melhor ficar
  // no rascunho, na tela, até a conexão voltar
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return recusado('nada-a-fazer', 'Sem internet agora. A grade continua aqui: toque em Salvar de novo quando a internet voltar.')
  }
  const r = await criarTurmasEmLote(novas)
  if (!r.ok) return r
  mudarRascunho({ turmasNovas: [] })
  return aceito({ criadas: r.valor.criadas.length, recusadas: r.valor.recusadas.map((x) => x.motivo) })
}
