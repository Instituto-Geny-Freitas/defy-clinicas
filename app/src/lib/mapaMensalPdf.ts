import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Clinic } from '@/lib/types'

const TEAL: [number, number, number] = [15, 118, 110]
const brl = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface Linha { descricao: string; valor: number }

export interface MapaMensalData {
  clinic: Clinic | null
  periodoLabel: string
  despesasFixas: Linha[]
  produtos: Linha[]
  pagamentos: Linha[]
  aReceber: Linha[]
}

const soma = (l: Linha[]) => l.reduce((s, x) => s + Number(x.valor), 0)

/** Monta o mapa mensal (4 colunas) em PDF paisagem, análogo à planilha. */
export function buildMapaMensalPdf(d: MapaMensalData): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const W = doc.internal.pageSize.getWidth()
  const M = 28

  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(14)
  doc.text(d.clinic?.nome ?? 'Clínica', M, 34)
  doc.setTextColor(60)
  doc.setFontSize(10)
  doc.text(`Mapa financeiro mensal — ${d.periodoLabel}`, M, 50)

  const totFixas = soma(d.despesasFixas)
  const totProd = soma(d.produtos)
  const totPag = soma(d.pagamentos)
  const totReceber = soma(d.aReceber)

  const colW = (W - M * 2 - 18) / 4
  const cols: { titulo: string; linhas: Linha[]; total: number; cor: [number, number, number] }[] = [
    { titulo: 'DESPESAS FIXAS', linhas: d.despesasFixas, total: totFixas, cor: [139, 92, 246] },
    { titulo: 'PRODUTOS E MATERIAIS', linhas: d.produtos, total: totProd, cor: [14, 165, 233] },
    { titulo: 'PAGAMENTOS DAS CLIENTES', linhas: d.pagamentos, total: totPag, cor: [16, 185, 129] },
    { titulo: 'A RECEBER DAS CLIENTES', linhas: d.aReceber, total: totReceber, cor: [245, 158, 11] },
  ]

  cols.forEach((c, i) => {
    const x = M + i * (colW + 6)
    autoTable(doc, {
      startY: 64,
      margin: { left: x, right: W - x - colW },
      tableWidth: colW,
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: c.cor, textColor: 255, fontSize: 8, halign: 'center' },
      footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: colW * 0.62 }, 1: { cellWidth: colW * 0.38, halign: 'right' } },
      head: [[{ content: c.titulo, colSpan: 2 }]],
      body: c.linhas.length > 0 ? c.linhas.map((l) => [l.descricao, brl(l.valor)]) : [[{ content: '—', colSpan: 2 }]],
      foot: [['TOTAL', brl(c.total)]],
    })
  })

  // Resumo
  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 64) + 20
  const H = doc.internal.pageSize.getHeight()
  if (y + 70 > H - 20) { doc.addPage(); y = 40 }
  const saldo = totPag - (totFixas + totProd)
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: TEAL, textColor: 255 },
    head: [['Resumo do mês', 'Valor']],
    body: [
      ['Total Despesas Fixas', brl(totFixas)],
      ['Total Produtos e Materiais', brl(totProd)],
      ['Total Pagamentos recebidos', brl(totPag)],
      ['Total a receber das clientes', brl(totReceber)],
      ['Saldo do mês (recebido − despesas pagas)', brl(saldo)],
    ],
    columnStyles: { 1: { halign: 'right' } },
  })

  const ts = new Date().toISOString().slice(0, 10)
  return { blob: doc.output('blob'), filename: `mapa_mensal_${ts}.pdf` }
}
