import jsPDF from 'jspdf'
import { formatDateBR } from '@/lib/format'
import type { Clinic } from '@/lib/types'

const TEAL: [number, number, number] = [15, 118, 110]

function calcAge(nascimento?: string | null): number | null {
  if (!nascimento) return null
  const [y, m, d] = nascimento.split('-').map(Number)
  if (!y) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - y
  const mDiff = hoje.getMonth() + 1 - m
  if (mDiff < 0 || (mDiff === 0 && hoje.getDate() < d)) idade--
  return idade
}

export interface ExamesPdfArgs {
  clinic: Clinic | null
  paciente: { nome: string; nascimento?: string | null; cpf?: string | null; whatsapp?: string | null }
  exames: string[]
  outrosExames?: string | null
  observacoes?: string | null
  profissional?: { nome: string; conselho?: string | null } | null
  data?: string
}

/** Requisição de exames em A4: cabeçalho com dados do cliente, lista de exames,
 *  Outros Exames, Observações e duas linhas para carimbo/assinatura. */
export function buildExamesPdf(args: ExamesPdfArgs): { blob: Blob; filename: string } {
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
  doc.text(args.clinic?.nome ?? 'Clínica', M, 40)
  doc.setTextColor(90)
  doc.setFontSize(11)
  doc.text('Requisição de Exames', M, 58)

  // Dados do cliente
  doc.setDrawColor(225)
  doc.roundedRect(M, 72, maxW, 56, 4, 4)
  doc.setTextColor(40)
  doc.setFontSize(10)
  const idade = calcAge(args.paciente.nascimento)
  const linha1 = `Paciente: ${args.paciente.nome}`
  const linha2 = [
    args.paciente.nascimento ? `Nascimento: ${formatDateBR(args.paciente.nascimento)}${idade != null ? ` (${idade} anos)` : ''}` : null,
    args.paciente.cpf ? `CPF: ${args.paciente.cpf}` : null,
  ].filter(Boolean).join('     ')
  const linha3 = [
    args.paciente.whatsapp ? `Contato: ${args.paciente.whatsapp}` : null,
    `Data: ${formatDateBR(args.data ?? new Date().toISOString().slice(0, 10))}`,
  ].filter(Boolean).join('     ')
  doc.text(linha1, M + 12, 90)
  doc.setTextColor(90)
  doc.setFontSize(9)
  if (linha2) doc.text(linha2, M + 12, 105)
  doc.text(linha3, M + 12, 119)

  // Lista de exames (multi-coluna)
  let y = 152
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Exames solicitados', M, y)
  doc.setFont('helvetica', 'normal')
  y += 16

  doc.setTextColor(40)
  doc.setFontSize(10)
  const cols = 2
  const colW = maxW / cols
  const exames = args.exames.filter(Boolean)
  if (exames.length === 0) {
    doc.setTextColor(120); doc.text('Nenhum exame selecionado.', M, y); y += 16
  } else {
    const rows = Math.ceil(exames.length / cols)
    for (let rI = 0; rI < rows; rI++) {
      for (let cI = 0; cI < cols; cI++) {
        const idx = cI * rows + rI
        if (idx >= exames.length) continue
        const x = M + cI * colW
        doc.setFillColor(15, 118, 110)
        doc.circle(x + 3, y - 3, 1.6, 'F')
        doc.text(doc.splitTextToSize(exames[idx], colW - 18), x + 12, y)
      }
      y += 16
      if (y > H - 160) { doc.addPage(); y = 60 }
    }
  }

  // Outros exames
  if (args.outrosExames && args.outrosExames.trim()) {
    y += 8
    doc.setTextColor(15, 118, 110); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text('Outros exames', M, y); doc.setFont('helvetica', 'normal')
    y += 14
    doc.setTextColor(40); doc.setFontSize(10)
    const linhas = doc.splitTextToSize(args.outrosExames, maxW)
    doc.text(linhas, M, y); y += linhas.length * 13
  }

  // Observações
  if (args.observacoes && args.observacoes.trim()) {
    y += 10
    doc.setTextColor(15, 118, 110); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text('Observações', M, y); doc.setFont('helvetica', 'normal')
    y += 14
    doc.setTextColor(40); doc.setFontSize(10)
    const linhas = doc.splitTextToSize(args.observacoes, maxW)
    doc.text(linhas, M, y); y += linhas.length * 13
  }

  // Rodapé: duas linhas para carimbo/assinatura
  const baseY = H - 110
  doc.setDrawColor(120)
  doc.line(M, baseY, M + maxW * 0.62, baseY)
  doc.line(M, baseY + 34, M + maxW * 0.62, baseY + 34)
  doc.setTextColor(110)
  doc.setFontSize(9)
  doc.text('Carimbo e assinatura do profissional', M, baseY + 50)
  if (args.profissional?.nome) {
    doc.setTextColor(60); doc.setFontSize(10)
    doc.text(args.profissional.nome, M, baseY - 6)
    if (args.profissional.conselho) { doc.setTextColor(110); doc.setFontSize(9); doc.text(args.profissional.conselho, M, baseY + 8) }
  }

  const ts = new Date().toISOString().slice(0, 10)
  return { blob: doc.output('blob'), filename: `requisicao_exames_${args.paciente.nome.replace(/\s+/g, '_')}_${ts}.pdf` }
}
