import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { localDateToday } from '@/lib/format'
import type { Clinic } from '@/lib/types'
import type { Quote } from '@/lib/finance'

const TEAL: [number, number, number] = [15, 118, 110]
const brl = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Monta o PDF do orçamento (cabeçalho da clínica, paciente, itens e totais). */
export function buildOrcamentoPdf(args: {
  clinic: Clinic | null
  pacienteNome: string
  quote: Quote
}): { blob: Blob; filename: string } {
  const { quote } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40

  // Cabeçalho
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(15)
  doc.text(args.clinic?.nome ?? 'Clínica', M, 40)
  doc.setTextColor(60)
  doc.setFontSize(11)
  doc.text('Orçamento', M, 58)
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Paciente: ${args.pacienteNome}`, M, 76)
  if (quote.numero) doc.text(`Nº ${quote.numero}`, M, 90)
  doc.text(`Emitido em: ${new Date(quote.created_at).toLocaleDateString('pt-BR')}`, M, quote.numero ? 104 : 90)

  const startY = quote.numero ? 124 : 110

  autoTable(doc, {
    startY,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: TEAL, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    head: [['Item', 'Qtd', 'Valor unit.', 'Total']],
    body: (quote.itens ?? []).map((it) => {
      const origemLabel: Record<string, string> = { procedimento: 'Procedimento', suplementacao: 'Suplementação', produto: 'Produto' }
      const desc = it.origem ? `${it.descricao}  ·  ${origemLabel[it.origem] ?? ''}`.trim() : it.descricao
      return [desc, String(it.qtd), brl(it.valor_unit), brl(it.total)]
    }),
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })

  const ft = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
  let y = (ft?.finalY ?? startY) + 18
  const right = W - M
  const linha = (label: string, valor: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(bold ? 30 : 90)
    doc.setFontSize(bold ? 12 : 10)
    doc.text(label, right - 160, y)
    doc.text(valor, right, y, { align: 'right' })
    y += bold ? 20 : 16
  }
  linha('Subtotal', brl(quote.valor_bruto))
  if (quote.desconto > 0) linha('Desconto', `- ${brl(quote.desconto)}`)
  linha('Total', brl(quote.valor_total), true)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130)
  doc.text('Documento gerado automaticamente. Validade e condições conforme acordado com a clínica.', M, y + 20)

  const ts = localDateToday()
  return { blob: doc.output('blob'), filename: `orcamento_${args.pacienteNome.replace(/\s+/g, '_')}_${ts}.pdf` }
}

