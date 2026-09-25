import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { localDateToday } from '@/lib/format'
import { buildPopBodyHtml, POP_RODAPE_TEXTO, POP_TITULO_GERAL } from '@/lib/popHtml'
import type { Pop } from '@/lib/pops'
import type { Clinic } from '@/lib/types'

const TEAL: [number, number, number] = [15, 118, 110]

interface LogoData { dataUrl: string; w: number; h: number; fmt: 'PNG' | 'JPEG' }

/** Baixa a logo da clínica e devolve dataURL + dimensões (para manter proporção). */
async function carregarLogo(url: string | null): Promise<LogoData | null> {
  if (!url) return null
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const fmt: 'PNG' | 'JPEG' = /jpe?g/i.test(blob.type) ? 'JPEG' : 'PNG'
    const dataUrl: string = await new Promise((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = rej
      fr.readAsDataURL(blob)
    })
    const dims: { w: number; h: number } = await new Promise((res) => {
      const img = new Image()
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => res({ w: 0, h: 0 })
      img.src = dataUrl
    })
    return { dataUrl, w: dims.w, h: dims.h, fmt }
  } catch {
    return null
  }
}

/** Renderiza o corpo (HTML) num canvas fora da tela. */
async function renderBodyCanvas(html: string): Promise<HTMLCanvasElement> {
  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:760px;background:#ffffff;padding:0;'
  holder.innerHTML = html
  document.body.appendChild(holder)
  try {
    return await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 760 })
  } finally {
    document.body.removeChild(holder)
  }
}

/** Gera o PDF do POP (retrato A4) com cabeçalho (logo + títulos) e rodapé legal
 *  + numeração repetidos em cada página. */
export async function buildPopPdf(args: {
  pop: Pop
  clinic: Clinic | null
  nomeProf: (id: string | null) => string
}): Promise<{ blob: Blob; filename: string }> {
  const { pop, clinic } = args
  const [canvas, logo] = await Promise.all([
    renderBodyCanvas(buildPopBodyHtml(pop, args.nomeProf)),
    carregarLogo(clinic?.logo_url ?? null),
  ])

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 40
  const contentW = W - M * 2
  const headerH = 74
  const footerH = 46
  const usableTop = headerH
  const usableH = H - headerH - footerH

  // Fatiamento do canvas em páginas.
  const pxPorPt = canvas.width / contentW
  const pageSlicePx = Math.floor(usableH * pxPorPt)
  const totalPaginas = Math.max(1, Math.ceil(canvas.height / pageSlicePx))

  for (let i = 0; i < totalPaginas; i++) {
    if (i > 0) pdf.addPage()
    const offset = i * pageSlicePx
    const sliceH = Math.min(pageSlicePx, canvas.height - offset)

    const tmp = document.createElement('canvas')
    tmp.width = canvas.width
    tmp.height = sliceH
    const ctx = tmp.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, tmp.width, tmp.height)
      ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    }
    const sliceHpt = sliceH / pxPorPt
    pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', M, usableTop, contentW, sliceHpt)
  }

  // Cabeçalho + rodapé em cada página.
  const nPag = pdf.getNumberOfPages()
  for (let p = 1; p <= nPag; p++) {
    pdf.setPage(p)
    // Faixa e logo
    pdf.setFillColor(...TEAL)
    pdf.rect(0, 0, W, 6, 'F')
    if (logo && logo.w > 0) {
      const maxH = 34, maxW = 90
      let lw = logo.w, lh = logo.h
      const r = Math.min(maxW / lw, maxH / lh)
      lw *= r; lh *= r
      try { pdf.addImage(logo.dataUrl, logo.fmt, M, 12, lw, lh) } catch { /* ignora logo inválida */ }
    }
    // Títulos centralizados
    pdf.setTextColor(15, 118, 110); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11)
    pdf.text(POP_TITULO_GERAL, W / 2, 30, { align: 'center' })
    pdf.setTextColor(20); pdf.setFontSize(12)
    pdf.text(pop.titulo.toUpperCase(), W / 2, 48, { align: 'center', maxWidth: contentW - 100 })
    pdf.setFont('helvetica', 'normal')
    pdf.setDrawColor(203, 213, 225)
    pdf.line(M, headerH - 8, W - M, headerH - 8)

    // Rodapé
    const fy = H - footerH + 10
    pdf.setDrawColor(203, 213, 225)
    pdf.line(M, fy - 6, W - M, fy - 6)
    pdf.setTextColor(120); pdf.setFontSize(7)
    pdf.text(POP_RODAPE_TEXTO, W / 2, fy + 4, { align: 'center', maxWidth: contentW })
    pdf.setFontSize(8); pdf.setTextColor(90)
    pdf.text(`Página ${p} de ${nPag}`, W - M, H - 12, { align: 'right' })
  }

  const ts = localDateToday()
  const nome = (pop.titulo || 'POP').replace(/[^\w]+/g, '_').slice(0, 40)
  return { blob: pdf.output('blob'), filename: `POP_${nome}_${ts}.pdf` }
}
