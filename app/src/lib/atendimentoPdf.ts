import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ClinicFull } from '@/lib/settings'
import type { Patient, Professional } from '@/lib/types'
import type { ProcedureRecord } from '@/lib/procedures'
import type { Supplementation } from '@/lib/supplementations'
import { formatDateBR } from '@/lib/format'

const TEAL: [number, number, number] = [15, 118, 110]

/** Normaliza acentos decompostos e tipografia (mesma regra do PDF do plano). */
function txt(v?: string | null): string {
  if (!v) return ''
  return v.normalize('NFC').replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
}

/** Dados do profissional que assina o documento. */
export interface ProfissionalPdf {
  nome: string
  conselho?: string | null       // ex.: "CRBM 12345-SP"
  especialidade?: string | null
}

/** Monta ProfissionalPdf a partir do cadastro da equipe. */
export function profissionalPdf(p?: Professional | null): ProfissionalPdf | null {
  if (!p) return null
  const conselho = [p.conselho_tipo, p.conselho_numero, p.conselho_uf].filter(Boolean).join(' ')
  return { nome: p.nome, conselho: conselho || null, especialidade: p.formacao ?? null }
}

/** Cabeçalho padrão (clínica + título + paciente). Devolve o Y para o conteúdo. */
function cabecalho(doc: jsPDF, clinic: ClinicFull | null, titulo: string, paciente: Patient | null, data?: string | null): number {
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = 44

  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110); doc.setFontSize(15)
  doc.text(txt(clinic?.nome) || 'Clínica', M, y); y += 16

  doc.setTextColor(90); doc.setFontSize(9)
  const empresa = [
    clinic?.razao_social && clinic.razao_social !== clinic?.nome ? txt(clinic.razao_social) : null,
    clinic?.cnpj ? `CNPJ ${clinic.cnpj}` : null,
    clinic?.responsavel_tecnico ? `Resp. técnico: ${txt(clinic.responsavel_tecnico)}` : null,
  ].filter(Boolean).join('   ·   ')
  if (empresa) { doc.text(empresa, M, y); y += 12 }
  const contato = [clinic?.telefone, clinic?.whatsapp, clinic?.email].filter(Boolean).join('   ·   ')
  if (contato) { doc.text(contato, M, y); y += 12 }

  y += 6
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 22

  doc.setTextColor(40); doc.setFontSize(14)
  doc.text(titulo, M, y); y += 18
  doc.setFontSize(10); doc.setTextColor(60)
  doc.text(`Paciente: ${txt(paciente?.nome) || '—'}`, M, y); y += 14
  if (data) {
    doc.setFontSize(9); doc.setTextColor(90)
    doc.text(`Data do atendimento: ${formatDateBR(data)}`, M, y); y += 16
  }
  return y
}

/** Assinatura do profissional + data/hora de emissão, no pé da última página. */
function rodape(doc: jsPDF, prof: ProfissionalPdf | null) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const cx = W / 2
  let y = H - 96

  if (prof?.nome) {
    doc.setDrawColor(150); doc.line(cx - 120, y, cx + 120, y); y += 14
    doc.setTextColor(40); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    doc.text(txt(prof.nome), cx, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    const linha2 = [prof.especialidade, prof.conselho].filter(Boolean).map((s) => txt(String(s))).join('  ·  ')
    if (linha2) { y += 13; doc.setTextColor(90); doc.setFontSize(9); doc.text(linha2, cx, y, { align: 'center' }) }
    y += 13
  }
  const agora = new Date()
  doc.setTextColor(120); doc.setFontSize(8)
  doc.text(
    `Documento gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    cx, y, { align: 'center' },
  )
}

/** Escreve um bloco "rótulo: valor" e devolve o novo Y. */
function bloco(doc: jsPDF, y: number, rotulo: string, valor: string): number {
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  doc.setTextColor(40); doc.setFontSize(10); doc.text(rotulo, M, y); y += 13
  doc.setTextColor(70); doc.setFontSize(9)
  for (const linha of doc.splitTextToSize(valor || '—', W - 2 * M) as string[]) {
    if (y > doc.internal.pageSize.getHeight() - 130) { doc.addPage(); y = 44 }
    doc.text(linha, M, y); y += 12
  }
  return y + 8
}

const nomeArquivo = (base: string, paciente: Patient | null, data?: string | null) =>
  `${base} - ${(paciente?.nome ?? 'paciente').replace(/\s+/g, '_')}${data ? ` - ${data.slice(0, 10)}` : ''}.pdf`

/** PDF do procedimento realizado (registro clínico, sem valores financeiros). */
export function buildProcedimentoPdf(args: {
  clinic: ClinicFull | null
  paciente: Patient | null
  profissional: ProfissionalPdf | null
  proc: ProcedureRecord
}): { blob: Blob; filename: string } {
  const { clinic, paciente, profissional, proc } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 40
  let y = cabecalho(doc, clinic, 'Registro de Procedimento', paciente, proc.data)

  y = bloco(doc, y, 'Procedimento', txt(proc.procedimento))
  if (proc.regiao) y = bloco(doc, y, 'Região', txt(proc.regiao))
  if (proc.observacoes) y = bloco(doc, y, 'Observações', txt(proc.observacoes))

  const produtos = (proc.produtos_usados ?? []).filter((p) => p.produto)
  if (produtos.length > 0) {
    doc.setTextColor(40); doc.setFontSize(10); doc.text('Produtos utilizados', M, y); y += 6
    autoTable(doc, {
      startY: y + 4,
      head: [['Produto', 'Marca', 'Lote', 'Validade', 'Qtd']],
      body: produtos.map((p) => [
        txt(p.produto), txt(p.marca) || '—', txt(p.lote) || '—',
        p.validade ? formatDateBR(p.validade) : '—', String(p.qtd),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: TEAL, textColor: 255 },
      margin: { left: M, right: M },
      theme: 'grid',
    })
  }

  rodape(doc, profissional)
  return { blob: doc.output('blob'), filename: nomeArquivo('Procedimento', paciente, proc.data) }
}

/** PDF da suplementação aplicada (registro clínico, sem valores financeiros). */
export function buildSuplementacaoPdf(args: {
  clinic: ClinicFull | null
  paciente: Patient | null
  profissional: ProfissionalPdf | null
  supl: Supplementation
}): { blob: Blob; filename: string } {
  const { clinic, paciente, profissional, supl } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 40
  let y = cabecalho(doc, clinic, 'Registro de Suplementação', paciente, supl.data)

  y = bloco(doc, y, 'Medicação / ativo', txt(supl.medicacao))

  const linhas: [string, string][] = [
    ['Via / local', txt(supl.via_adm) || '—'],
    ['Quantidade', String(supl.quantidade ?? 1)],
    ['Lote', txt(supl.lote) || '—'],
    ['Validade', supl.validade ? formatDateBR(supl.validade) : '—'],
    ['Fornecedor', txt(supl.fornecedor) || '—'],
  ]
  autoTable(doc, {
    startY: y,
    body: linhas,
    columnStyles: { 0: { fontStyle: 'bold', textColor: 60, cellWidth: 130 }, 1: { textColor: 70 } },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: M, right: M },
    theme: 'grid',
  })
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 18

  if (supl.observacoes) bloco(doc, y, 'Observações', txt(supl.observacoes))

  rodape(doc, profissional)
  return { blob: doc.output('blob'), filename: nomeArquivo('Suplementacao', paciente, supl.data) }
}
