import jsPDF from 'jspdf'
import { formatDateBR } from '@/lib/format'
import type { Clinic } from '@/lib/types'

const TEAL: [number, number, number] = [15, 118, 110]

export interface DocumentoPdfArgs {
  clinic: Clinic | null
  paciente: { nome: string; cpf?: string | null; nascimento?: string | null }
  profissional?: { nome: string; conselho?: string | null } | null
  doc: {
    nome: string
    corpo_final: string | null
    status: string
    assinado_em?: string | null
    lido_em?: string | null
    hash?: string | null
    uso_imagem_autorizado?: boolean | null
  }
}

/** Gera o PDF do documento (mesmo conteúdo do comprovante) e devolve { blob, filename }. */
export function buildDocumentoPdf(args: DocumentoPdfArgs): { blob: Blob; filename: string } {
  const { doc, paciente } = args
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 48
  const maxW = W - M * 2

  pdf.setFillColor(...TEAL)
  pdf.rect(0, 0, W, 6, 'F')
  pdf.setTextColor(15, 118, 110)
  pdf.setFontSize(14)
  pdf.text(args.clinic?.nome ?? 'Clínica', M, 38)
  const statusLabel = doc.assinado_em ? 'ASSINADO' : doc.lido_em ? 'LIDO / CIENTE' : 'PENDENTE'
  pdf.setTextColor(110); pdf.setFontSize(9)
  pdf.text(`Documento — ${statusLabel}`, M, 54)

  // Identificação do paciente
  pdf.setDrawColor(225)
  pdf.roundedRect(M, 66, maxW, 40, 4, 4)
  pdf.setTextColor(40); pdf.setFontSize(10)
  pdf.text(`Paciente: ${paciente.nome}`, M + 12, 84)
  pdf.setTextColor(90); pdf.setFontSize(9)
  const linha2 = [paciente.cpf ? `CPF: ${paciente.cpf}` : null, paciente.nascimento ? `Nascimento: ${formatDateBR(paciente.nascimento)}` : null].filter(Boolean).join('     ')
  if (linha2) pdf.text(linha2, M + 12, 98)

  // Título + corpo
  let y = 130
  pdf.setTextColor(20); pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
  pdf.text(doc.nome, M, y); pdf.setFont('helvetica', 'normal')
  y += 18
  pdf.setTextColor(40); pdf.setFontSize(10.5)
  const linhas = pdf.splitTextToSize(doc.corpo_final ?? '', maxW)
  for (const ln of linhas) {
    if (y > H - 130) { pdf.addPage(); y = 60 }
    pdf.text(ln, M, y); y += 15
  }

  if (doc.uso_imagem_autorizado != null) {
    y += 6
    pdf.setFontSize(10); pdf.setTextColor(40)
    pdf.text(`Uso de imagem: ${doc.uso_imagem_autorizado ? 'AUTORIZADO' : 'NÃO autorizado'}`, M, y)
    y += 8
  }

  // Assinatura + meta
  y = Math.max(y + 24, H - 110)
  if (y > H - 90) { pdf.addPage(); y = H - 110 }
  pdf.setDrawColor(120)
  pdf.line(M, y, M + 280, y)
  pdf.setTextColor(90); pdf.setFontSize(9)
  pdf.text('Assinatura do paciente', M, y + 14)
  if (args.profissional?.nome) {
    pdf.setTextColor(60); pdf.text(`Profissional: ${args.profissional.nome}${args.profissional.conselho ? ` — ${args.profissional.conselho}` : ''}`, M, y + 34)
  }
  const aceite = doc.assinado_em ?? doc.lido_em
  pdf.setTextColor(110); pdf.setFontSize(8)
  if (aceite) pdf.text(`Aceite eletrônico em: ${new Date(aceite).toLocaleString('pt-BR')}`, M, y + 50)
  if (doc.hash) pdf.text(`Hash de autenticidade (SHA-256): ${doc.hash}`, M, y + 62, { maxWidth: maxW })

  const ts = new Date().toISOString().slice(0, 10)
  return { blob: pdf.output('blob'), filename: `documento_${paciente.nome.replace(/\s+/g, '_')}_${ts}.pdf` }
}
