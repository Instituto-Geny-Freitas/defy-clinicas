import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDateBR, localDateToday } from '@/lib/format'
import type { Clinic } from '@/lib/types'
import type { ProcedureRecord } from '@/lib/procedures'
import type { FormulationPrescription } from '@/lib/formulations'
import type { BodyMeasurement } from '@/lib/measurements'
import type { Supplementation } from '@/lib/supplementations'

export interface ReportData {
  procedimentos?: ProcedureRecord[]
  manipulacoes?: FormulationPrescription[]
  medidas?: BodyMeasurement[]
  suplementacoes?: Supplementation[]
}

const d = (iso: string | null) => formatDateBR(iso)
const TEAL: [number, number, number] = [15, 118, 110]

/** Monta o PDF do relatório do paciente e devolve { blob, filename }. */
export function buildPatientReportPdf(args: {
  clinic: Clinic | null
  pacienteNome: string
  periodoInicio?: string | null
  periodoFim?: string | null
  data: ReportData
}): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()

  // Cabeçalho
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(15)
  doc.text(args.clinic?.nome ?? 'Clínica', 40, 40)
  doc.setTextColor(60)
  doc.setFontSize(11)
  doc.text('Relatório do Paciente', 40, 58)
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Paciente: ${args.pacienteNome}`, 40, 76)
  const periodo =
    args.periodoInicio || args.periodoFim
      ? `Período: ${args.periodoInicio ? new Date(args.periodoInicio + 'T12:00').toLocaleDateString('pt-BR') : '...'} a ${args.periodoFim ? new Date(args.periodoFim + 'T12:00').toLocaleDateString('pt-BR') : '...'}`
      : 'Período: completo'
  doc.text(periodo, 40, 90)
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 40, 104)

  let y = 124
  const head = (titulo: string) => {
    doc.setFontSize(12); doc.setTextColor(15, 118, 110); doc.text(titulo, 40, y); y += 6
  }
  const afterTable = () => {
    const ft = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    y = (ft?.finalY ?? y) + 24
  }
  const tableOpts = (startY: number) => ({
    startY, margin: { left: 40, right: 40 }, styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: TEAL, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
  })

  if (args.data.procedimentos?.length) {
    head('Procedimentos')
    autoTable(doc, { ...tableOpts(y + 6), head: [['Data', 'Procedimento', 'Região', 'Produtos utilizados']],
      body: args.data.procedimentos.map((p) => [d(p.data), p.procedimento, p.regiao ?? '—',
        (p.produtos_usados ?? []).map((u) => `${u.produto} x${u.qtd}${u.lote ? ` (lote ${u.lote}${u.validade ? `, val ${d(u.validade)}` : ''})` : ''}`).join(', ') || '—']) })
    afterTable()
  }
  if (args.data.manipulacoes?.length) {
    head('Fórmulas manipuladas')
    autoTable(doc, { ...tableOpts(y + 6), head: [['Data', 'Fórmula', 'Composição', 'Posologia']],
      body: args.data.manipulacoes.map((m) => [d(m.data), m.nome ?? m.formulations?.nome ?? '—',
        (m.composicao ?? []).map((a) => `${a.ativo} ${a.quantidade}${a.unidade}`).join('; '), m.posologia ?? '—']) })
    afterTable()
  }
  if (args.data.medidas?.length) {
    head('Medidas corporais')
    autoTable(doc, { ...tableOpts(y + 6), head: [['Sessão', 'Data', 'Peso', 'IMC', 'Gord.%', 'Músc.%', 'Visceral']],
      body: args.data.medidas.map((m) => [m.sessao ?? '—', d(m.data), m.peso_kg ?? '—', m.imc ?? '—',
        m.gordura_corporal_pct ?? '—', m.musculo_pct ?? '—', m.gordura_visceral ?? '—']) })
    afterTable()
  }
  if (args.data.suplementacoes?.length) {
    head('Suplementação')
    autoTable(doc, { ...tableOpts(y + 6), head: [['Data', 'Medicação', 'Via/Local', 'Validade', 'Lote']],
      body: args.data.suplementacoes.map((s) => [d(s.data), s.medicacao, s.via_adm ?? '—', d(s.validade), s.lote ?? '—']) })
    afterTable()
  }

  const nada = !args.data.procedimentos?.length && !args.data.manipulacoes?.length && !args.data.medidas?.length && !args.data.suplementacoes?.length
  if (nada) { doc.setFontSize(10); doc.setTextColor(120); doc.text('Sem registros no período/seções selecionados.', 40, y + 10) }

  const ts = localDateToday()
  return { blob: doc.output('blob'), filename: `relatorio_${args.pacienteNome.replace(/\s+/g, '_')}_${ts}.pdf` }
}

