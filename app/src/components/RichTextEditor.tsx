import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Editor de texto rico enxuto (contentEditable + toolbar), sem dependências.
 * Suporta negrito, itálico, sublinhado, tachado, listas numeradas/marcadores,
 * recuo (indentação) e cor do texto. O HTML é sanitizado ao salvar (ver
 * sanitizeHtml) — aqui usamos os comandos nativos de edição do navegador.
 */
const CORES = ['#111827', '#b91c1c', '#c2410c', '#047857', '#1d4ed8', '#7c3aed', '#be185d']

function cmd(comando: string, valor?: string) {
  // styleWithCSS: emite <span style> em vez de <font>, casando com o allowlist do sanitizador.
  try { document.execCommand('styleWithCSS', false, 'true') } catch { /* navegadores antigos */ }
  document.execCommand(comando, false, valor)
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 90 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Sincroniza o DOM com o valor externo só quando o editor não está focado,
  // para não mover o cursor enquanto o usuário digita.
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value || ''
    }
  }, [value])

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const Btn = ({ acao, valor, titulo, children }: { acao: string; valor?: string; titulo: string; children: ReactNode }) => (
    <button
      type="button"
      title={titulo}
      // mousedown preventDefault: mantém a seleção do texto ao clicar no botão.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { cmd(acao, valor); emit() }}
      className="h-7 min-w-7 rounded px-1.5 text-xs font-semibold text-texto/70 hover:bg-black/10"
    >
      {children}
    </button>
  )

  return (
    <div className="rounded-lg border border-black/10 focus-within:border-primaria">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-black/10 bg-black/[0.02] px-1.5 py-1">
        <Btn acao="bold" titulo="Negrito"><span className="font-bold">B</span></Btn>
        <Btn acao="italic" titulo="Itálico"><span className="italic">I</span></Btn>
        <Btn acao="underline" titulo="Sublinhado"><span className="underline">U</span></Btn>
        <Btn acao="strikeThrough" titulo="Tachado"><span className="line-through">S</span></Btn>
        <span className="mx-1 h-4 w-px bg-black/10" />
        <Btn acao="insertUnorderedList" titulo="Lista com marcadores">• Lista</Btn>
        <Btn acao="insertOrderedList" titulo="Lista numerada">1. Lista</Btn>
        <Btn acao="outdent" titulo="Diminuir recuo">⇤</Btn>
        <Btn acao="indent" titulo="Aumentar recuo">⇥</Btn>
        <span className="mx-1 h-4 w-px bg-black/10" />
        {CORES.map((c) => (
          <button
            key={c}
            type="button"
            title="Cor do texto"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { cmd('foreColor', c); emit() }}
            className="h-5 w-5 rounded-full border border-black/10"
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-black/10" />
        <Btn acao="removeFormat" titulo="Limpar formatação">✕</Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        className="rte-content px-3 py-2 text-sm text-texto outline-none"
        style={{ minHeight }}
      />
    </div>
  )
}
