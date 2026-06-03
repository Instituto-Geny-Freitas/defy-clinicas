import type { Clinic } from '@/lib/types'

export interface PrintableDoc {
  nome: string
  corpo_final: string | null
  status: string
  assinado_em: string | null
  lido_em: string | null
  content_hash: string | null
  uso_imagem_autorizado?: boolean | null
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
}

/**
 * Abre uma janela de impressão formatada do documento e dispara o print
 * (o usuário pode "Salvar como PDF"). Zero dependências externas.
 */
export function printDocument(doc: PrintableDoc, clinic: Clinic | null) {
  const w = window.open('', '_blank', 'width=820,height=920')
  if (!w) return

  const cor = (clinic?.tema_cores?.primaria as string) || '#0f766e'
  const dataAceite = doc.assinado_em
    ? new Date(doc.assinado_em).toLocaleString('pt-BR')
    : doc.lido_em
      ? new Date(doc.lido_em).toLocaleString('pt-BR')
      : null
  const statusLabel = doc.assinado_em ? 'ASSINADO' : doc.lido_em ? 'LIDO/CIENTE' : 'PENDENTE'

  const logo = clinic?.logo_url ? `<img src="${esc(clinic.logo_url)}" alt="" style="height:48px;object-fit:contain" />` : ''

  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(doc.nome)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, 'Segoe UI', Roboto, sans-serif; color:#111; margin:0; padding:40px; }
  header { display:flex; align-items:center; gap:14px; border-bottom:3px solid ${cor}; padding-bottom:14px; margin-bottom:24px; }
  header h1 { font-size:18px; margin:0; color:${cor}; }
  header .sub { font-size:12px; color:#666; }
  h2 { font-size:16px; margin:0 0 12px; }
  .corpo { white-space:pre-wrap; line-height:1.6; font-size:13px; text-align:justify; }
  .meta { margin-top:28px; border-top:1px solid #ddd; padding-top:14px; font-size:12px; color:#444; }
  .meta b { color:#111; }
  .assinatura { margin-top:48px; }
  .linha { border-top:1px solid #333; width:320px; padding-top:6px; font-size:12px; }
  .hash { margin-top:18px; font-size:10px; color:#999; word-break:break-all; }
  @media print { body { padding:24px; } }
</style></head><body>
<header>${logo}<div><h1>${esc(clinic?.nome ?? 'Clínica')}</h1><div class="sub">Documento — ${statusLabel}</div></div></header>
<h2>${esc(doc.nome)}</h2>
<div class="corpo">${esc(doc.corpo_final ?? '')}</div>
${
  doc.uso_imagem_autorizado != null
    ? `<p style="font-size:12px;margin-top:16px">Uso de imagem: <b>${doc.uso_imagem_autorizado ? 'AUTORIZADO' : 'NÃO autorizado'}</b></p>`
    : ''
}
<div class="assinatura"><div class="linha">Assinatura do paciente</div></div>
<div class="meta">
  ${dataAceite ? `<div><b>Aceite eletrônico em:</b> ${dataAceite}</div>` : ''}
  <div class="hash"><b>Hash de integridade (SHA-256):</b> ${esc(doc.content_hash ?? '—')}</div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`)
  w.document.close()
}
