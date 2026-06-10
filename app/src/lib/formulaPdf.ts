import jsPDF from 'jspdf'
import type { Clinic } from '@/lib/types'
import type { FormulationPrescription } from '@/lib/formulations'

const TEAL: [number, number, number] = [15, 118, 110]

/**
 * Monta o PDF da receita de manipulação no formato do modelo:
 * cabeçalho da clínica + "<paciente> - Telefone: <whatsapp>" e, para cada
 * fórmula, um bloco "FÓRMULA MANIPULADA:" com a composição em tópicos e a
 * posologia. Devolve { blob, filename }.
 */
export function buildFormulaPdf(args: {
  clinic: Clinic | null
  pacienteNome: string
  pacienteWhatsapp?: string | null
  formulas: FormulationPrescription[]
}): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const maxW = W - M * 2

  // Cabeçalho da clínica
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(15)
  doc.text(args.clinic?.nome ?? 'Clínica', M, 42)
  doc.setTextColor(110)
  doc.setFontSize(9)
  doc.text('Receita — Fórmula Manipulada', M, 58)

  // Linha do paciente (igual ao modelo)
  doc.setDrawColor(225)
  doc.line(M, 72, W - M, 72)
  doc.setTextColor(30)
  doc.setFontSize(12)
  const tel = args.pacienteWhatsapp ? `   -   Telefone: ${args.pacienteWhatsapp}` : ''
  doc.text(`${args.pacienteNome}${tel}`, M, 92)

  let y = 124
  const ensureSpace = (h: number) => {
    if (y + h > H - 60) { doc.addPage(); y = 60 }
  }

  for (const f of args.formulas) {
    ensureSpace(40)
    doc.setTextColor(15, 118, 110)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('FÓRMULA MANIPULADA:', M, y)
    doc.setFont('helvetica', 'normal')
    y += 18

    const nome = f.nome ?? f.formulations?.nome
    if (nome) {
      doc.setTextColor(60)
      doc.setFontSize(10)
      const linhas = doc.splitTextToSize(nome, maxW)
      ensureSpace(linhas.length * 14)
      doc.text(linhas, M, y)
      y += linhas.length * 14 + 2
    }

    doc.setTextColor(40)
    doc.setFontSize(10)
    for (const a of f.composicao ?? []) {
      const txt = `${a.ativo}${a.quantidade ? `  ${a.quantidade}${a.unidade ?? ''}` : ''}`
      const linhas = doc.splitTextToSize(txt, maxW - 14)
      ensureSpace(linhas.length * 14)
      doc.text('●', M, y)
      doc.text(linhas, M + 14, y)
      y += linhas.length * 14
    }

    if (f.posologia) {
      const linhas = doc.splitTextToSize(`Posologia: ${f.posologia}`, maxW)
      ensureSpace(linhas.length * 14 + 6)
      doc.setTextColor(90)
      doc.text(linhas, M, y + 6)
      y += linhas.length * 14 + 6
    }
    y += 20
  }

  if ((args.formulas ?? []).length === 0) {
    doc.setFontSize(10); doc.setTextColor(120)
    doc.text('Nenhuma fórmula selecionada.', M, y)
  }

  const ts = new Date().toISOString().slice(0, 10)
  return { blob: doc.output('blob'), filename: `formula_${args.pacienteNome.replace(/\s+/g, '_')}_${ts}.pdf` }
}
