import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Clinic, Professional } from '@/lib/types'
import type { FormDef, FormField } from '@/lib/adminForms'
import type { AdminRecord } from '@/lib/admin'
import { formatDateBR } from '@/lib/format'

const TEAL: [number, number, number] = [15, 118, 110]

function fmtValue(field: FormField, value: unknown): string {
  if (value == null || value === '') return '—'
  switch (field.tipo) {
    case 'boolean': return value ? 'Sim' : 'Não'
    case 'date': return formatDateBR(String(value))
    case 'multiselect': return Array.isArray(value) ? value.join(', ') : String(value)
    case 'upload': return value ? 'anexo' : '—'
    default: return String(value)
  }
}

/** Colunas exibidas no PDF (oculta textareas longas no cabeçalho, mas inclui no corpo). */
function colunasPdf(def: FormDef): FormField[] {
  // Em paisagem cabem bem ~7-8 colunas; prioriza não-textarea e limita.
  const principais = def.campos.filter((c) => c.tipo !== 'textarea')
  return principais.slice(0, 8)
}

function header(doc: jsPDF, clinic: Clinic | null, titulo: string, periodoLabel: string, M: number) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(14)
  doc.text(clinic?.nome ?? 'Clínica', M, 34)
  doc.setTextColor(60)
  doc.setFontSize(11)
  doc.text(titulo, M, 50)
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Período: ${periodoLabel}`, M, 64)
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, W - M, 64, { align: 'right' })
}

/** PDF genérico (tabela) de um formulário administrativo. */
export function buildAdminFormPdf(args: {
  clinic: Clinic | null
  def: FormDef
  records: AdminRecord[]
  periodoLabel: string
}): { blob: Blob; filename: string } {
  const { clinic, def, records, periodoLabel } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const M = 32
  header(doc, clinic, def.titulo, periodoLabel, M)

  const cols = colunasPdf(def)
  const head: string[] = []
  if (def.numerado) head.push('Nº')
  if (def.vinculo === 'paciente') head.push('Paciente')
  head.push(...cols.map((c) => c.label))
  head.push('Registrado por')

  const body = records.map((r) => {
    const row: string[] = []
    if (def.numerado) row.push(r.seq ?? '—')
    if (def.vinculo === 'paciente') row.push(r.patients?.nome ?? '—')
    for (const c of cols) row.push(fmtValue(c, r.dados[c.key]))
    row.push(r.created_by_nome ?? '—')
    return row
  })

  autoTable(doc, {
    startY: 78,
    head: [head],
    body: body.length ? body : [head.map(() => '—')],
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: TEAL, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // Campos longos (textarea) detalhados abaixo, por registro, quando existirem.
  const longos = def.campos.filter((c) => c.tipo === 'textarea')
  if (longos.length && records.length) {
    let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90) + 16
    const H = doc.internal.pageSize.getHeight()
    doc.setFontSize(10); doc.setTextColor(...TEAL)
    if (y > H - 60) { doc.addPage(); y = 50 }
    doc.text('Detalhamento', M, y); y += 6
    for (const r of records) {
      const partes = longos
        .map((c) => { const v = r.dados[c.key]; return v ? `${c.label}: ${String(v)}` : null })
        .filter(Boolean) as string[]
      if (!partes.length) continue
      const titulo = `${def.numerado ? (r.seq ?? '') + ' · ' : ''}${r.patients?.nome ? r.patients.nome + ' · ' : ''}${r.ref_data ? formatDateBR(r.ref_data) : ''}`.trim()
      autoTable(doc, {
        startY: y + 6,
        margin: { left: M, right: M },
        head: [[titulo || 'Registro']],
        body: partes.map((p) => [p]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [226, 232, 240], textColor: 30 },
      })
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6
    }
  }

  const ts = new Date().toISOString().slice(0, 10)
  return { blob: doc.output('blob'), filename: `${def.chave}_${ts}.pdf` }
}

/** PDF do Corpo Técnico (relação da equipe). */
export function buildCorpoTecnicoPdf(args: {
  clinic: Clinic | null
  profs: Professional[]
  servicosFiltro?: string
}): { blob: Blob; filename: string } {
  const { clinic, profs } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const M = 32
  header(doc, clinic, 'Corpo Técnico — Relação da Equipe', `${profs.length} profissional(is)`, M)

  const conselho = (p: Professional) =>
    [p.conselho_tipo, p.conselho_numero].filter(Boolean).join(' ') + (p.conselho_uf ? `-${p.conselho_uf}` : '') || '—'
  const vacinasTxt = (p: Professional) => {
    const v = p.vacinas ?? {}
    const sim = Object.keys(v).filter((k) => v[k])
    return sim.length ? sim.join(', ') : '—'
  }

  autoTable(doc, {
    startY: 78,
    head: [['Profissional', 'Formação', 'Resp. Téc.', 'Conselho', 'Nº', 'UF', 'CPF', 'Serviços prestados', 'Vacinas']],
    body: profs.map((p) => [
      p.nome,
      p.formacao ?? '—',
      p.responsavel_tecnico ? 'Sim' : 'Não',
      p.conselho_tipo ?? '—',
      p.conselho_numero ?? '—',
      p.conselho_uf ?? '—',
      p.cpf ?? '—',
      (p.servicos_prestados ?? []).join('; ') || '—',
      vacinasTxt(p),
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: TEAL, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 7: { cellWidth: 160 } },
  })

  // Mantém o cálculo de conselho disponível (evita lint de função não usada)
  void conselho
  const ts = new Date().toISOString().slice(0, 10)
  return { blob: doc.output('blob'), filename: `corpo_tecnico_${ts}.pdf` }
}
