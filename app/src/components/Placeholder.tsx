interface PlaceholderProps {
  titulo: string
  descricao?: string
}

/** Página-esqueleto usada nos módulos ainda não implementados. */
export default function Placeholder({ titulo, descricao }: PlaceholderProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">{titulo}</h1>
      {descricao && <p className="mt-1 text-sm text-texto/60">{descricao}</p>}
      <div className="mt-6 rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-10 text-center text-sm text-texto/50">
        Módulo em construção — estrutura pronta para receber a implementação.
      </div>
    </div>
  )
}
