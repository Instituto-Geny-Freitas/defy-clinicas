import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Clinic } from '@/lib/types'
import { calcNps, npsPorMes, type NpsQuestion, type NpsResponse } from '@/lib/nps'
import { formatDateBR } from '@/lib/format'

const TEAL: [number, number, number] = [15, 118, 110]
const faixa = (s: number) => (s >= 9 ? 'Promotor' : s >= 7 ? 'Passivo' : 'Detrator')

/** Relatório de satisfação (NPS): indicadores, evolução mensal e respostas. */
export function buildNpsPdf(args: {
  clinic: Clinic | null
  respostas: NpsResponse[]
  perguntas: NpsQuestion[]
  periodoLabel: string
}) {
  const { clinic, respostas, perguntas, periodoLabel } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = 44

  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110); doc.setFontSize(14)
  doc.text(clinic?.nome ?? 'Clínica', M, y); y += 18
  doc.setTextColor(40); doc.setFontSize(12)
  doc.text('Pesquisa de satisfação (NPS)', M, y); y += 15
  doc.setTextColor(90); doc.setFontSize(9)
  doc.text(`Período: ${periodoLabel}`, M, y); y += 18

  // Indicadores
  const c = calcNps(respostas)
  const pct = (n: number) => (c.total > 0 ? `${Math.round((n / c.total) * 100)}%` : '0%')
  autoTable(doc, {
    startY: y,
    head: [['NPS', 'Respostas', 'Promotores (9-10)', 'Passivos (7-8)', 'Detratores (0-6)']],
    body: [[
      String(c.nps),
      String(c.total),
      `${c.promotores} (${pct(c.promotores)})`,
      `${c.passivos} (${pct(c.passivos)})`,
      `${c.detratores} (${pct(c.detratores)})`,
    ]],
    styles: { fontSize: 10, cellPadding: 6, halign: 'center' },
    headStyles: { fillColor: TEAL, textColor: 255 },
    margin: { left: M, right: M },
    theme: 'grid',
  })
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 18

  // Evolução mensal
  const meses = npsPorMes(respostas)
  if (meses.length > 1) {
    autoTable(doc, {
      startY: y,
      head: [['Mês', 'NPS', 'Respostas']],
      body: meses.map((m) => {
        const [ano, mes] = m.mes.split('-')
        return [`${mes}/${ano}`, String(m.nps), String(m.total)]
      }),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [240, 240, 240], textColor: 40 },
      margin: { left: M, right: M },
      theme: 'grid',
    })
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 18
  }

  // Respostas
  autoTable(doc, {
    startY: y,
    head: [['Data', 'Paciente', 'Nota', 'Faixa', 'Comentário', ...perguntas.map((p) => p.label)]],
    body: respostas.map((r) => [
      formatDateBR(r.created_at.slice(0, 10)),
      r.patients?.nome ?? '—',
      String(r.score),
      faixa(r.score),
      r.comentario ?? '',
      ...perguntas.map((p) => String(r.respostas?.[p.id] ?? '')),
    ]),
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: TEAL, textColor: 255 },
    margin: { left: M, right: M },
    theme: 'grid',
  })

  doc.save(`NPS - ${periodoLabel}.pdf`)
}
