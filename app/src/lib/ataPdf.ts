import jsPDF from 'jspdf'
import type { Clinic } from '@/lib/types'
import type { InternalMeeting } from '@/lib/internalMeetings'
import { formatDateBR } from '@/lib/format'

const TEAL: [number, number, number] = [15, 118, 110]

/** Gera e baixa o PDF da ata de uma reunião interna. */
export function buildAtaPdf(meeting: InternalMeeting, participantes: string[], clinic: Clinic | null) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  let y = 40

  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110); doc.setFontSize(14)
  doc.text(clinic?.nome ?? 'Clínica', M, y); y += 22
  doc.setTextColor(40); doc.setFontSize(13)
  doc.text('Ata de Reunião', M, y); y += 20
  doc.setFontSize(11); doc.setTextColor(60)
  doc.text(meeting.titulo, M, y); y += 16

  const quando = [meeting.data ? formatDateBR(meeting.data) : null, meeting.hora ? meeting.hora.slice(0, 5) : null].filter(Boolean).join(' · ')
  doc.setFontSize(9); doc.setTextColor(90)
  if (quando) { doc.text(quando, M, y); y += 14 }

  const bloco = (titulo: string, texto: string) => {
    y += 8
    if (y > H - 60) { doc.addPage(); y = 40 }
    doc.setTextColor(40); doc.setFontSize(10); doc.text(titulo, M, y); y += 14
    doc.setTextColor(70); doc.setFontSize(9)
    const linhas = doc.splitTextToSize(texto || '—', W - 2 * M) as string[]
    for (const line of linhas) {
      if (y > H - 40) { doc.addPage(); y = 40 }
      doc.text(line, M, y); y += 12
    }
  }

  if (participantes.length) bloco('Participantes', participantes.join(', '))
  if (meeting.topicos) bloco('Tópicos', meeting.topicos)
  bloco('Ata', meeting.ata || '—')

  doc.save(`Ata - ${meeting.titulo}.pdf`)
}
