/** Logo da clínica pronta para o jsPDF (dataURL + dimensões para manter proporção). */
export interface LogoData { dataUrl: string; w: number; h: number; fmt: 'PNG' | 'JPEG' }

/** Baixa a logo da clínica e devolve dataURL + dimensões. Falha silenciosa → null. */
export async function carregarLogo(url: string | null): Promise<LogoData | null> {
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

/** Dimensões da logo encaixada numa caixa máxima, preservando a proporção. */
export function encaixarLogo(logo: LogoData, maxW: number, maxH: number): { w: number; h: number } {
  const r = Math.min(maxW / logo.w, maxH / logo.h)
  return { w: logo.w * r, h: logo.h * r }
}
