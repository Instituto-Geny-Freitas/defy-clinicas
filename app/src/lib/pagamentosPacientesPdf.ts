import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDateBR, localDateToday } from '@/lib/format'
import { formaPagamentoLabel, formatCPF, type PatientPaymentRow } from '@/lib/paymentsReport'
import type { Clinic } from '@/lib/types'

const TEAL: [number, number, number] = [15, 118, 110]
const brl = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface PatientPaymentsPdfData {
  clinic: Clinic | null
  periodoLabel: string
  rows: PatientPaymentRow[]
}

/** Relatório de pagamentos dos pacientes (retrato A4) com filtro do período. */
export function buildPatientPaymentsPdf(d: PatientPaymentsPdfData): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const W = doc.internal.pageSize.getWidth()
  const M = 32

  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(14)
  doc.text(d.clinic?.nome ?? 'Clínica', M, 34)
  doc.setTextColor(60)
  doc.setFontSize(10)
  doc.text(`Pagamentos dos pacientes — ${d.periodoLabel}`, M, 50)

  const totalRecebido = d.rows.reduce((s, r) => s + r.valor, 0)
  // "A receber" é por paciente: soma dos saldos distintos entre os pacientes do relatório.
  const aReceberPorPaciente = new Map<string, number>()
  for (const r of d.rows) if (!aReceberPorPaciente.has(r.patientId)) aReceberPorPaciente.set(r.patientId, r.aReceber)
  const totalReceber = [...aReceberPorPaciente.values()].reduce((s, v) => s + v, 0)

  // "A receber" aparece uma vez por paciente (linhas ordenadas por nome).
  let ultimoPaciente = ''
  const body = d.rows.map((r) => {
    const mostraReceber = r.patientId !== ultimoPaciente
    ultimoPaciente = r.patientId
    return [
      r.nome,
      formatCPF(r.cpf),
      formatDateBR(r.data),
      brl(r.valor),
      formaPagamentoLabel(r),
      mostraReceber ? (r.aReceber > 0 ? brl(r.aReceber) : '—') : '',
    ]
  })

  autoTable(doc, {
    startY: 64,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
    head: [['Nome', 'CPF', 'Data', 'Valor', 'Forma de pagamento', 'A receber']],
    body: body.length > 0 ? body : [[{ content: 'Nenhum pagamento no período.', colSpan: 6, styles: { halign: 'center' } }]],
    foot: [['Total', '', '', brl(totalRecebido), '', brl(totalReceber)]],
    columnStyles: {
      1: { cellWidth: 78 },
      2: { cellWidth: 58, halign: 'center' },
      3: { cellWidth: 66, halign: 'right' },
      5: { cellWidth: 66, halign: 'right' },
    },
  })

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 64) + 14
  const H = doc.internal.pageSize.getHeight()
  if (y + 20 > H - 20) { doc.addPage(); y = 40 }
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    'Cartão parcelado é contabilizado no ato da venda pelo valor total. "A receber" é o saldo atual do paciente (todos os orçamentos).',
    M,
    y,
  )

  const ts = localDateToday()
  return { blob: doc.output('blob'), filename: `pagamentos_pacientes_${ts}.pdf` }
}
