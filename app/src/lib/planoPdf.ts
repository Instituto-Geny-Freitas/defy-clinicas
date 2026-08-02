import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ClinicFull } from '@/lib/settings'
import type { Patient, Professional } from '@/lib/types'
import type { PlanItem, TreatmentPlan } from '@/lib/treatmentPlans'
import { brl } from '@/lib/finance'
import { formatDateBR } from '@/lib/format'

const TEAL: [number, number, number] = [15, 118, 110]

/**
 * Normaliza texto para o PDF. Textos colados de Word/PDF costumam vir com acentos
 * DECOMPOSTOS (a + ˜ ) — as fontes padrão do jsPDF (WinAnsi) renderizam isso como
 * "Aplicac`a o". NFC recompõe em um único caractere ("Aplicação"). Também troca
 * aspas/traços tipográficos e remove caracteres de controle invisíveis.
 */
function pdfTexto(v?: string | null): string {
  if (!v) return ''
  return v
    .normalize('NFC')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
}

/** Gera o PDF de um plano de tratamento: cabeçalho com dados da clínica, o plano
 *  e seus itens, e no rodapé os dados do profissional + data/hora de geração.
 *  modo 'imprimir' abre em nova aba com diálogo de impressão; 'download' baixa. */
export function buildPlanoPdf(
  args: { clinic: ClinicFull | null; paciente: Patient | null; profissional: Professional | null | undefined; plano: TreatmentPlan; itens: PlanItem[]; valorOrcamento?: number },
  modo: 'download' | 'imprimir' = 'download',
) {
  const { clinic, paciente, profissional, plano, itens, valorOrcamento = 0 } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  let y = 44

  // Cabeçalho — dados da clínica
  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 6, 'F')
  doc.setTextColor(15, 118, 110); doc.setFontSize(15)
  doc.text(pdfTexto(clinic?.nome) || 'Clínica', M, y); y += 16
  doc.setTextColor(90); doc.setFontSize(9)
  const linhaEmpresa = [
    clinic?.razao_social && clinic.razao_social !== clinic?.nome ? pdfTexto(clinic.razao_social) : null,
    clinic?.cnpj ? `CNPJ ${clinic.cnpj}` : null,
    clinic?.responsavel_tecnico ? `Resp. técnico: ${pdfTexto(clinic.responsavel_tecnico)}` : null,
  ].filter(Boolean).join('   ·   ')
  if (linhaEmpresa) { doc.text(linhaEmpresa, M, y); y += 12 }
  const contato = [clinic?.telefone, clinic?.whatsapp, clinic?.email].filter(Boolean).join('   ·   ')
  if (contato) { doc.text(contato, M, y); y += 12 }
  y += 6
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 22

  // Título + paciente
  doc.setTextColor(40); doc.setFontSize(14)
  doc.text('Plano de Tratamento', M, y); y += 18
  doc.setFontSize(10); doc.setTextColor(60)
  doc.text(`Paciente: ${pdfTexto(paciente?.nome) || '—'}`, M, y); y += 14
  doc.setFontSize(9); doc.setTextColor(90)
  doc.text(`Data do plano: ${plano.data ? formatDateBR(plano.data) : '—'}`, M, y); y += 16

  if (plano.titulo) { doc.setTextColor(40); doc.setFontSize(11); doc.text(pdfTexto(plano.titulo), M, y); y += 16 }

  // Descrição (texto do plano)
  if (plano.texto && plano.texto.trim()) {
    doc.setTextColor(40); doc.setFontSize(10); doc.text('Descrição', M, y); y += 14
    doc.setTextColor(70); doc.setFontSize(9)
    for (const line of doc.splitTextToSize(pdfTexto(plano.texto), W - 2 * M) as string[]) {
      if (y > H - 90) { doc.addPage(); y = 44 }
      doc.text(line, M, y); y += 12
    }
    y += 8
  }

  // Itens do plano (tabela)
  if (itens.length > 0) {
    const total = itens.reduce((s, it) => s + Number(it.preco_unit) * it.sessoes, 0)
    autoTable(doc, {
      startY: y,
      head: [['Item', 'Tipo', 'Sessões', 'Frequência', 'Valor unit.', 'Subtotal']],
      body: itens.map((it) => [
        pdfTexto(it.nome),
        it.tipo === 'procedimento' ? 'Procedimento' : 'Suplementação',
        String(it.sessoes),
        pdfTexto(it.frequencia) || '—',
        brl(Number(it.preco_unit)),
        brl(Number(it.preco_unit) * it.sessoes),
      ]),
      foot: [['', '', '', '', 'Total', brl(total)]],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: TEAL, textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 40, fontStyle: 'bold' },
      margin: { left: M, right: M },
      theme: 'grid',
    })
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 16

    // Valor negociado (orçamento vinculado, já com desconto) — é o que vale para o paciente.
    if (valorOrcamento > 0) {
      if (y > H - 110) { doc.addPage(); y = 44 }
      const desconto = total - valorOrcamento
      doc.setTextColor(40); doc.setFontSize(10)
      doc.text('Orçamento vinculado', M, y); y += 14
      doc.setTextColor(70); doc.setFontSize(9)
      if (desconto > 0.005) { doc.text(`Desconto: ${brl(desconto)}`, M, y); y += 12 }
      doc.setTextColor(15, 118, 110); doc.setFontSize(11)
      doc.text(`Valor negociado: ${brl(valorOrcamento)}`, M, y); y += 18
    } else {
      y += 4
    }
  }

  // Rodapé — profissional + data/hora de geração (no fim da última página)
  if (y > H - 80) doc.addPage()
  const footY = H - 60
  const conselho = profissional ? [profissional.conselho_tipo, profissional.conselho_numero, profissional.conselho_uf].filter(Boolean).join(' ') : ''
  doc.setDrawColor(220); doc.line(M, footY - 14, W - M, footY - 14)
  doc.setTextColor(60); doc.setFontSize(9)
  doc.text(`Profissional: ${profissional?.nome ?? '—'}${conselho ? ` · ${conselho}` : ''}`, M, footY)
  const agora = new Date()
  doc.setTextColor(120); doc.setFontSize(8)
  doc.text(`Documento gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, M, footY + 12)

  const arquivo = `Plano - ${paciente?.nome ?? 'paciente'}.pdf`
  if (modo === 'imprimir') {
    doc.autoPrint()
    const win = window.open(String(doc.output('bloburl')), '_blank')
    if (!win) doc.save(arquivo)
  } else {
    doc.save(arquivo)
  }
}
