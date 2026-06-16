import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Clinic } from '@/lib/types'

const TEAL: [number, number, number] = [15, 118, 110]
const brl = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface RelatorioPdfData {
  clinic: Clinic | null
  periodoLabel: string
  totalReceitas: number
  totalDespesasPagas: number
  resultado: number
  totalDespesas: number
  totalEmAberto: number
  lancamentos: number
  itens: number
  porClassificacao: { rotulo: string; valor: number }[]
  porForma: { rotulo: string; valor: number }[]
  porTipo: { nome: string; lanc: number; itens: number; valor: number }[]
  serie?: { mes: string; receita: number; despesa: number }[]
}

/** Monta o PDF do relatório financeiro de despesas e comparativo receita × despesa. */
export function buildRelatorioFinanceiroPdf(d: RelatorioPdfData): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40

  // Cabeçalho
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(15)
  doc.text(d.clinic?.nome ?? 'Clínica', M, 40)
  doc.setTextColor(60)
  doc.setFontSize(11)
  doc.text('Relatório financeiro', M, 58)
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Período: ${d.periodoLabel}`, M, 74)
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, M, 88)

  // Resumo (receita x despesa)
  const tableOpts = (startY: number) => ({
    startY,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: TEAL, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
  })
  const finalY = () => ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0)

  autoTable(doc, {
    ...tableOpts(108),
    head: [['Resumo (realizado no período)', 'Valor']],
    body: [
      ['Receitas recebidas', brl(d.totalReceitas)],
      ['Despesas pagas', brl(d.totalDespesasPagas)],
      ['Resultado', brl(d.resultado)],
      ['Despesas totais (lançadas)', brl(d.totalDespesas)],
      ['Despesas em aberto', brl(d.totalEmAberto)],
      ['Lançamentos / itens', `${d.lancamentos} / ${d.itens}`],
    ],
    columnStyles: { 1: { halign: 'right' } },
  })

  autoTable(doc, {
    ...tableOpts(finalY() + 18),
    head: [['Por classificação', 'Valor']],
    body: d.porClassificacao.map((r) => [r.rotulo, brl(r.valor)]),
    columnStyles: { 1: { halign: 'right' } },
  })

  autoTable(doc, {
    ...tableOpts(finalY() + 18),
    head: [['Por forma de pagamento', 'Valor']],
    body: d.porForma.map((r) => [r.rotulo, brl(r.valor)]),
    columnStyles: { 1: { halign: 'right' } },
  })

  autoTable(doc, {
    ...tableOpts(finalY() + 18),
    head: [['Tipo de despesa', 'Lanç.', 'Itens', 'Valor']],
    body: d.porTipo.map((r) => [r.nome, String(r.lanc), String(r.itens), brl(r.valor)]),
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
  })

  if (d.serie && d.serie.length > 0) {
    autoTable(doc, {
      ...tableOpts(finalY() + 18),
      head: [['Mês', 'Receitas', 'Despesas', 'Resultado']],
      body: d.serie.map((s) => [s.mes, brl(s.receita), brl(s.despesa), brl(s.receita - s.despesa)]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })
  }

  const ts = new Date().toISOString().slice(0, 10)
  return { blob: doc.output('blob'), filename: `relatorio_financeiro_${ts}.pdf` }
}
