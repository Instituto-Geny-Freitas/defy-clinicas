import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { anamnesisSchema } from '@/forms/anamnesisSchema'
import { visivel } from '@/forms/visibility'
import type { FormField, FormValues } from '@/forms/types'
import type { AnamnesisRecord } from '@/lib/anamnesis'
import type { Clinic, Patient } from '@/lib/types'
import { formatCPF, formatDateBR, localDateToday, parseLocalDate } from '@/lib/format'
import { carregarLogo, encaixarLogo } from '@/lib/pdfLogo'

const TEAL: [number, number, number] = [15, 118, 110]

/** Texto da declaração aceita pelo paciente no portal (fonte única: tela e PDF). */
export const DECLARACAO_VERACIDADE =
  'Declaro que todas as informações acima são verdadeiras e me comprometo a informar qualquer alteração no meu estado de saúde, gravidez ou uso de novas medicações durante o tratamento.'

type PacientePdf = Pick<Patient, 'nome' | 'cpf' | 'nascimento' | 'sexo' | 'telefone' | 'whatsapp' | 'email'>

const vazio = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const numBR = (v: unknown) => String(v).replace('.', ',')

/** Resposta de um campo por extenso (Sim/Não, rótulos das opções, sufixos). Vazio → null. */
function respostaDe(f: FormField, v: unknown): string | null {
  if (f.type === 'grid') {
    const cfg = f.grid
    const data = (v as Record<string, Record<string, string>>) ?? {}
    if (!cfg) return null
    const linhas = cfg.rows
      .map((row) => {
        const cels = cfg.columns.filter((c) => !vazio(data[row]?.[c.key])).map((c) => `${c.label}: ${numBR(data[row][c.key])}`)
        return cels.length ? `${row} — ${cels.join(' · ')}` : null
      })
      .filter(Boolean)
    return linhas.length ? linhas.join('\n') : null
  }
  if (vazio(v)) return null
  const rotulo = (val: unknown) => f.options?.find((o) => o.value === val)?.label ?? String(val)
  switch (f.type) {
    case 'boolean': return v === true ? 'Sim' : v === false ? 'Não' : String(v)
    case 'radio':
    case 'select': return rotulo(v)
    case 'multiselect': return (Array.isArray(v) ? v : [v]).map(rotulo).join(', ')
    case 'number': return `${numBR(v)}${f.suffix ? ` ${f.suffix}` : ''}`
    case 'date': return formatDateBR(String(v))
    default: return String(v)
  }
}

function idadeDe(nascimento?: string | null): number | null {
  const d = parseLocalDate(nascimento)
  if (!d) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - d.getFullYear()
  if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) idade--
  return idade >= 0 ? idade : null
}

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Gera o PDF da ficha de anamnese SALVA (registro do banco), no mesmo layout para
 * paciente e profissional: logo, identificação, respostas por seção (só os campos
 * visíveis pela regra da tela), declaração de veracidade, assinaturas e rodapé.
 */
export async function buildAnamnesePdf(args: {
  clinic: Clinic | null
  paciente: PacientePdf
  registro: AnamnesisRecord
  profissionalNome?: string | null
}): Promise<{ blob: Blob; filename: string }> {
  const { clinic, paciente, registro } = args
  const dados: FormValues = registro.dados ?? {}
  const logo = await carregarLogo(clinic?.logo_url ?? null)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  const maxW = W - M * 2

  // Cabeçalho
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 6, 'F')
  let xNome = M
  if (logo && logo.w > 0) {
    const { w, h } = encaixarLogo(logo, 80, 34)
    try { doc.addImage(logo.dataUrl, logo.fmt, M, 16, w, h); xNome = M + w + 10 } catch { /* logo inválida */ }
  }
  doc.setTextColor(...TEAL); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(clinic?.nome ?? 'Clínica', xNome, 34)
  doc.setTextColor(20); doc.setFontSize(12)
  doc.text('FICHA DE ANAMNESE', W - M, 34, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  // Identificação do paciente
  const idade = idadeDe(paciente.nascimento)
  const contato = [paciente.whatsapp || paciente.telefone, paciente.email].filter(Boolean).join(' · ')
  autoTable(doc, {
    startY: 60,
    margin: { left: M, right: M },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 6, right: 6 }, textColor: 40 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70, textColor: 90 }, 2: { fontStyle: 'bold', cellWidth: 70, textColor: 90 } },
    body: [
      ['Paciente', paciente.nome, 'CPF', paciente.cpf ? formatCPF(paciente.cpf) : '—'],
      ['Nascimento', paciente.nascimento ? `${formatDateBR(paciente.nascimento)}${idade != null ? ` (${idade} anos)` : ''}` : '—', 'Sexo', paciente.sexo || '—'],
      ['Contato', { content: contato || '—', colSpan: 3 }],
    ],
    tableLineColor: [225, 225, 225],
    tableLineWidth: 0.6,
  })

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60) + 10
  const quem = registro.preenchido_por === 'paciente'
    ? 'pelo paciente'
    : `pelo profissional${args.profissionalNome ? ` (${args.profissionalNome})` : ''}`
  doc.setFontSize(8.5); doc.setTextColor(100)
  doc.text(`Preenchida ${quem} · Última atualização: ${dataHora(registro.updated_at)}`, M, y)
  y += 10

  // Respostas por seção
  for (const sec of anamnesisSchema.sections) {
    const linhas = sec.fields
      .filter((f) => visivel(f.showIf, dados))
      .map((f) => {
        const r = respostaDe(f, dados[f.key])
        return [f.label, r ?? { content: 'Não informado', styles: { textColor: 160, fontStyle: 'italic' as const } }]
      })
    if (sec.title.startsWith('Triagem') && registro.imc != null) linhas.push(['IMC (calculado)', numBR(registro.imc)])
    if (linhas.length === 0) continue
    autoTable(doc, {
      startY: y + 6,
      margin: { left: M, right: M, top: 40, bottom: 40 },
      styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'top', textColor: 30 },
      headStyles: { fillColor: TEAL, textColor: 255, fontSize: 9.5 },
      columnStyles: { 0: { cellWidth: maxW * 0.45, textColor: 70 } },
      head: [[{ content: sec.title, colSpan: 2 }]],
      body: linhas,
      tableLineColor: [230, 230, 230],
      tableLineWidth: 0.5,
    })
    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  }

  // Declaração de veracidade (aceite no portal)
  if (registro.consentimento_em) {
    const txt = doc.splitTextToSize(DECLARACAO_VERACIDADE, maxW - 20)
    const alt = txt.length * 11 + 30
    if (y + alt + 20 > H - 50) { doc.addPage(); y = 40 }
    y += 14
    doc.setDrawColor(200); doc.setFillColor(247, 250, 249)
    doc.roundedRect(M, y, maxW, alt, 4, 4, 'FD')
    doc.setFontSize(9); doc.setTextColor(40)
    doc.text(txt, M + 10, y + 15)
    doc.setFontSize(8); doc.setTextColor(...TEAL)
    doc.text(`Aceita eletronicamente pelo paciente em ${dataHora(registro.consentimento_em)}.`, M + 10, y + alt - 8)
    y += alt
  }

  // Assinaturas
  if (y + 80 > H - 50) { doc.addPage(); y = 40 }
  y += 55
  const larg = (maxW - 40) / 2
  doc.setDrawColor(120)
  doc.line(M, y, M + larg, y)
  doc.line(M + larg + 40, y, W - M, y)
  doc.setFontSize(8.5); doc.setTextColor(90)
  doc.text('Assinatura do paciente', M, y + 12)
  doc.text(`Assinatura do profissional${args.profissionalNome ? ` — ${args.profissionalNome}` : ''}`, M + larg + 40, y + 12, { maxWidth: larg })

  // Rodapé em todas as páginas
  const n = doc.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5); doc.setTextColor(140)
    doc.text('Documento confidencial — contém dados de saúde (LGPD, Lei 13.709/2018).', M, H - 18)
    doc.text(`Gerado em ${formatDateBR(localDateToday())} · Página ${p} de ${n}`, W - M, H - 18, { align: 'right' })
  }

  const nome = paciente.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  return { blob: doc.output('blob'), filename: `anamnese_${nome || 'paciente'}_${localDateToday()}.pdf` }
}
