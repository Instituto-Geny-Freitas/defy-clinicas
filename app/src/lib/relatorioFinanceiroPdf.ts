import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { localDateToday } from '@/lib/format'
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
  serieAno?: number
}

const GREEN: [number, number, number] = [16, 185, 129]
const RED: [number, number, number] = [225, 29, 72]
const fmtK = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))

/** Desenha um gráfico de linhas (receita × despesa) com primitivas do jsPDF. */
function drawLineChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  serie: { mes: string; receita: number; despesa: number }[],
) {
  const padL = 34, padB = 16
  const innerW = w - padL
  const innerH = h - padB
  const max = Math.max(1, ...serie.map((s) => Math.max(s.receita, s.despesa)))
  const px = (i: number) => x + padL + (innerW / serie.length) * (i + 0.5)
  const py = (v: number) => y + innerH - (v / max) * innerH

  // Grades horizontais + rótulos do eixo Y
  doc.setFontSize(7)
  for (const f of [0, 0.5, 1]) {
    const yy = y + innerH - f * innerH
    doc.setDrawColor(229, 231, 235)
    doc.line(x + padL, yy, x + w, yy)
    doc.setTextColor(156, 163, 175)
    doc.text(fmtK(max * f), x + padL - 4, yy + 2, { align: 'right' })
  }

  // Linhas das séries
  const drawSerie = (sel: (s: { receita: number; despesa: number }) => number, cor: [number, number, number]) => {
    doc.setDrawColor(...cor)
    doc.setLineWidth(1.2)
    for (let i = 0; i < serie.length - 1; i++) {
      doc.line(px(i), py(sel(serie[i])), px(i + 1), py(sel(serie[i + 1])))
    }
    doc.setFillColor(...cor)
    for (let i = 0; i < serie.length; i++) doc.circle(px(i), py(sel(serie[i])), 1.4, 'F')
  }
  drawSerie((s) => s.receita, GREEN)
  drawSerie((s) => s.despesa, RED)
  doc.setLineWidth(0.2)

  // Rótulos dos meses
  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  serie.forEach((s, i) => doc.text(s.mes, px(i), y + h, { align: 'center' }))

  // Legenda
  doc.setFontSize(8)
  doc.setFillColor(...GREEN); doc.rect(x + padL, y - 8, 8, 4, 'F')
  doc.setTextColor(80); doc.text('Receitas', x + padL + 12, y - 5)
  doc.setFillColor(...RED); doc.rect(x + padL + 64, y - 8, 8, 4, 'F')
  doc.text('Despesas', x + padL + 76, y - 5)
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
    const H = doc.internal.pageSize.getHeight()
    let y = finalY() + 24
    const chartH = 150
    if (y + chartH + 30 > H - 40) { doc.addPage(); y = 50 }
    doc.setTextColor(15, 118, 110)
    doc.setFontSize(11)
    doc.text(`Evolução mês a mês${d.serieAno ? ` — ${d.serieAno}` : ''}`, M, y)
    y += 10
    drawLineChart(doc, M, y, W - M * 2, chartH, d.serie)

    autoTable(doc, {
      ...tableOpts(y + chartH + 24),
      head: [['Mês', 'Receitas', 'Despesas', 'Resultado']],
      body: d.serie.map((s) => [s.mes, brl(s.receita), brl(s.despesa), brl(s.receita - s.despesa)]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })
  }

  const ts = localDateToday()
  return { blob: doc.output('blob'), filename: `relatorio_financeiro_${ts}.pdf` }
}

