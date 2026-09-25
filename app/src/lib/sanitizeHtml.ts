/**
 * Sanitizador de HTML por allowlist para o texto rico dos POPs.
 * Mantém apenas formatação segura (negrito, itálico, sublinhado, tachado,
 * listas, parágrafos/quebras) e um subconjunto de estilos (cor, alinhamento,
 * recuo). Remove scripts, atributos de evento, links e qualquer outra tag.
 *
 * Roda no cliente (DOMParser). O conteúdo é sempre re-sanitizado ao salvar E ao
 * exibir, então dados legados/adulterados não escapam.
 */

const TAGS_PERMITIDAS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'DIV', 'SPAN', 'OL', 'UL', 'LI'])
const ESTILOS_PERMITIDOS = new Set(['color', 'text-align', 'margin-left', 'font-weight', 'font-style', 'text-decoration'])

function estiloSeguro(decl: string): string {
  const out: string[] = []
  for (const parte of decl.split(';')) {
    const [propRaw, ...restos] = parte.split(':')
    if (!propRaw || restos.length === 0) continue
    const prop = propRaw.trim().toLowerCase()
    const valor = restos.join(':').trim()
    if (!ESTILOS_PERMITIDOS.has(prop)) continue
    // Barra url()/expression()/javascript: em qualquer valor de estilo.
    if (/url\(|expression|javascript:|@import/i.test(valor)) continue
    out.push(`${prop}: ${valor}`)
  }
  return out.join('; ')
}

function limparNo(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as HTMLElement
  const tag = el.tagName.toUpperCase()
  const filhos: Node[] = []
  el.childNodes.forEach((f) => {
    const limpo = limparNo(f, doc)
    if (limpo) filhos.push(limpo)
  })

  // <font color="..."> (alguns navegadores no execCommand) → <span style="color:...">.
  if (tag === 'FONT') {
    const span = doc.createElement('span')
    const cor = el.getAttribute('color')
    if (cor && !/url\(|expression|javascript:/i.test(cor)) span.setAttribute('style', `color: ${cor}`)
    filhos.forEach((f) => span.appendChild(f))
    return span
  }

  if (!TAGS_PERMITIDAS.has(tag)) {
    // Tag não permitida: descarta a tag, preserva os filhos (desembrulha).
    const frag = doc.createElement('span')
    frag.setAttribute('data-unwrap', '1')
    filhos.forEach((f) => frag.appendChild(f))
    return frag
  }

  const novo = doc.createElement(tag.toLowerCase())
  const estilo = estiloSeguro(el.getAttribute('style') ?? '')
  if (estilo) novo.setAttribute('style', estilo)
  filhos.forEach((f) => novo.appendChild(f))
  return novo
}

/** Devolve HTML sanitizado (string). Entrada nula/vazia → ''. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, 'text/html')
  const raiz = doc.getElementById('raiz')
  if (!raiz) return ''
  const saida = doc.createElement('div')
  raiz.childNodes.forEach((f) => {
    const limpo = limparNo(f, doc)
    if (limpo) saida.appendChild(limpo)
  })
  // Desembrulha os spans-marcadores (tags removidas) preservando o conteúdo.
  saida.querySelectorAll('span[data-unwrap="1"]').forEach((s) => {
    const pai = s.parentNode
    if (!pai) return
    while (s.firstChild) pai.insertBefore(s.firstChild, s)
    pai.removeChild(s)
  })
  return saida.innerHTML
}

/** Texto puro (sem tags) — útil para pré-visualizações curtas. */
export function htmlToPlain(html: string | null | undefined): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
