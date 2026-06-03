import type { Clinic } from '@/lib/types'
import { calcAge } from '@/lib/patients'

export interface PrintableDoc {
  nome: string
  corpo_final: string | null
  status: string
  assinado_em: string | null
  lido_em: string | null
  content_hash: string | null
  uso_imagem_autorizado?: boolean | null
}

export interface PrintPatient {
  nome: string
  cpf: string | null
  nascimento: string | null
}

export interface PrintProfessional {
  nome: string
  conselho_tipo?: string | null
  conselho_numero?: string | null
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
}

/**
 * Abre uma janela de impressão formatada do documento (Salvar como PDF).
 * Inclui identificação do paciente e do profissional. Zero dependências.
 */
export function printDocument(
  doc: PrintableDoc,
  clinic: Clinic | null,
  opts?: { patient?: PrintPatient | null; professional?: PrintProfessional | null },
) {
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

  const p = opts?.patient
  const idade = p ? calcAge(p.nascimento) : null
  const nasc = p?.nascimento ? new Date(p.nascimento).toLocaleDateString('pt-BR') : '—'
  const ident = p
    ? `<div class="ident">
         <div><b>Paciente:</b> ${esc(p.nome)}</div>
         <div><b>CPF:</b> ${esc(p.cpf ?? '—')} &nbsp;|&nbsp; <b>Nascimento:</b> ${nasc}${idade != null ? ` (${idade} anos)` : ''}</div>
       </div>`
    : ''

  const prof = opts?.professional
  const profLine = prof
    ? `<div style="margin-top:6px"><b>Profissional:</b> ${esc(prof.nome)}${
        prof.conselho_tipo ? ` — ${esc(prof.conselho_tipo)} ${esc(prof.conselho_numero ?? '')}` : ''
      }</div>`
    : ''

  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(doc.nome)}</title>
<style>
  * { box-sizing:border-box; }
  body { font-family: system-ui,'Segoe UI',Roboto,sans-serif; color:#111; margin:0; padding:40px; }
  header { display:flex; align-items:center; gap:14px; border-bottom:3px solid ${cor}; padding-bottom:14px; margin-bottom:18px; }
  header h1 { font-size:18px; margin:0; color:${cor}; }
  header .sub { font-size:12px; color:#666; }
  .ident { background:#f6f7f9; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; font-size:12px; margin-bottom:18px; line-height:1.6; }
  h2 { font-size:16px; margin:0 0 12px; }
  .corpo { white-space:pre-wrap; line-height:1.6; font-size:13px; text-align:justify; }
  .meta { margin-top:24px; border-top:1px solid #ddd; padding-top:14px; font-size:12px; color:#444; }
  .assinatura { margin-top:48px; }
  .linha { border-top:1px solid #333; width:320px; padding-top:6px; font-size:12px; }
  .hash { margin-top:14px; font-size:10px; color:#999; word-break:break-all; }
  @media print { body { padding:24px; } }
</style></head><body>
<header>${logo}<div><h1>${esc(clinic?.nome ?? 'Clínica')}</h1><div class="sub">Documento — ${statusLabel}</div></div></header>
${ident}
<h2>${esc(doc.nome)}</h2>
<div class="corpo">${esc(doc.corpo_final ?? '')}</div>
${doc.uso_imagem_autorizado != null ? `<p style="font-size:12px;margin-top:16px">Uso de imagem: <b>${doc.uso_imagem_autorizado ? 'AUTORIZADO' : 'NÃO autorizado'}</b></p>` : ''}
<div class="assinatura"><div class="linha">Assinatura do paciente</div></div>
${profLine}
<div class="meta">
  ${dataAceite ? `<div><b>Aceite eletrônico em:</b> ${dataAceite}</div>` : ''}
  <div class="hash"><b>Hash de integridade (SHA-256):</b> ${esc(doc.content_hash ?? '—')}</div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`)
  w.document.close()
}
