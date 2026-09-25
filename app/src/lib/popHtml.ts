import { formatDateBR } from '@/lib/format'
import { htmlToPlain } from '@/lib/sanitizeHtml'
import type { Pop } from '@/lib/pops'

/** Título geral fixo, acima do título do procedimento. */
export const POP_TITULO_GERAL = 'PROCEDIMENTO OPERACIONAL PADRÃO – POP'
/** Texto legal do rodapé (em todos os POPs, em cada página). */
export const POP_RODAPE_TEXTO =
  'É expressamente proibida a cópia, reprodução, difusão, transmissão, venda, publicação ou distribuição, na totalidade ou em parte deste documento'

function escapeHtml(s: string): string {
  return (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

const vazio = (html: string) => htmlToPlain(html) === ''

/** CSS embutido no corpo — assim html2canvas (PDF) e a tela renderizam igual. */
const POP_STYLE = `
<style>
.pop-doc { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.45; }
.pop-doc .pop-sub { background: #0f766e; color: #fff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; padding: 5px 8px; margin: 14px 0 0; border-radius: 3px; }
.pop-doc table.pop-table { width: 100%; border-collapse: collapse; margin: 0 0 4px; }
.pop-doc table.pop-table td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
.pop-doc td.pop-c1 { width: 30%; font-weight: 600; background: #f1f5f9; }
.pop-doc .pop-rich ul { list-style: disc; padding-left: 1.4em; margin: .2em 0; }
.pop-doc .pop-rich ol { list-style: decimal; padding-left: 1.4em; margin: .2em 0; }
.pop-doc .pop-rich li { margin: .1em 0; }
.pop-doc .pop-rich p { margin: .3em 0; }
.pop-doc .pop-gestor { margin: 16px 0 6px; font-size: 11px; color: #475569; }
.pop-doc table.pop-aprov { width: 100%; border-collapse: collapse; margin-top: 10px; }
.pop-doc table.pop-aprov th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .02em; }
.pop-doc table.pop-aprov th, .pop-doc table.pop-aprov td { border: 1px solid #94a3b8; padding: 8px; text-align: left; vertical-align: top; width: 33.33%; font-size: 11px; }
.pop-doc table.pop-aprov td.assinatura { height: 30px; color: #64748b; }
</style>`

/** Nome do POP + estrutura + gestor + quadro de aprovação (sem cabeçalho/rodapé de página). */
export function buildPopBodyHtml(pop: Pop, nomeProf: (id: string | null) => string): string {
  const blocos = (pop.estrutura ?? []).map((b) => {
    const sub = b.subtitulo?.trim() ? `<div class="pop-sub">${escapeHtml(b.subtitulo)}</div>` : ''
    const linhas = (b.linhas ?? [])
      .map((l) => {
        if (vazio(l.col1)) {
          return `<tr><td colspan="2"><div class="pop-rich">${l.col2 || ''}</div></td></tr>`
        }
        return `<tr><td class="pop-c1"><div class="pop-rich">${l.col1}</div></td><td class="pop-c2"><div class="pop-rich">${l.col2 || ''}</div></td></tr>`
      })
      .join('')
    return `${sub}<table class="pop-table"><tbody>${linhas}</tbody></table>`
  }).join('')

  const gestor = pop.gestor_nome
    ? `<div class="pop-gestor">Gestor responsável pela edição: <strong>${escapeHtml(pop.gestor_nome)}</strong>${pop.gestor_conselho ? ` — ${escapeHtml(pop.gestor_conselho)}` : ''}</div>`
    : ''

  const aprov = `
<table class="pop-aprov"><tbody>
  <tr><th>POP Elaborado por:</th><th>POP Revisado por:</th><th>Data de aprovação do POP:</th></tr>
  <tr>
    <td>${escapeHtml(nomeProf(pop.elaborado_por))}</td>
    <td>${escapeHtml(nomeProf(pop.revisado_por))}</td>
    <td>${pop.data_aprovacao ? escapeHtml(formatDateBR(pop.data_aprovacao)) : '—'}</td>
  </tr>
  <tr><td class="assinatura">Assinatura:</td><td class="assinatura">Assinatura:</td><td></td></tr>
</tbody></table>`

  return `${POP_STYLE}<div class="pop-doc">${blocos}${gestor}${aprov}</div>`
}
