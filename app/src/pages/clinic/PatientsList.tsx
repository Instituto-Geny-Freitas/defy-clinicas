import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deletePatient, listPatients } from '@/lib/patients'
import { useAuth } from '@/auth/AuthProvider'
import type { Patient } from '@/lib/types'
import PatientFormModal from './PatientFormModal'

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const OPCOES_QTD = [20, 50, 100]

/** Normaliza (sem acento, maiúsculo) para comparar a inicial do nome. */
function inicial(nome: string): string {
  const c = nome.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

export default function PatientsList() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Patient | null>(null)
  const [letra, setLetra] = useState<string | null>(null)   // filtro por inicial
  const [porPagina, setPorPagina] = useState(20)             // quantidade por página
  const [qtdCustom, setQtdCustom] = useState('')             // valor digitado pelo usuário
  const [pagina, setPagina] = useState(0)                    // índice da página (0-based)

  const clinicId = profile?.professional?.clinic_id

  async function excluir(p: Patient) {
    if (!confirm(`Remover o paciente "${p.nome}"? O histórico é preservado, mas ele deixa de aparecer na lista.`)) return
    await deletePatient(p.id)
    recarregar()
  }

  function recarregar() {
    listPatients()
      .then(setPacientes)
      .catch(() => {})
      .finally(() => setCarregando(false))
  }

  useEffect(recarregar, [])

  // Iniciais que realmente existem (para desabilitar letras vazias)
  const iniciaisExistentes = useMemo(() => {
    const s = new Set<string>()
    pacientes.forEach((p) => s.add(inicial(p.nome)))
    return s
  }, [pacientes])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return pacientes.filter((p) => {
      if (termo && !p.nome.toLowerCase().includes(termo)) return false
      if (letra && inicial(p.nome) !== letra) return false
      return true
    })
  }, [pacientes, busca, letra])

  // Volta à primeira página sempre que o filtro ou o tamanho mudarem
  useEffect(() => { setPagina(0) }, [busca, letra, porPagina])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const inicio = paginaSegura * porPagina
  const visiveis = filtrados.slice(inicio, inicio + porPagina)

  function aplicarCustom() {
    const n = Number(qtdCustom)
    if (n > 0) setPorPagina(Math.floor(n))
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-texto">Pacientes</h1>
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Novo paciente
        </button>
      </div>

      {modalAberto && clinicId && (
        <PatientFormModal
          clinicId={clinicId}
          onClose={() => setModalAberto(false)}
          onSaved={(id) => {
            setModalAberto(false)
            navigate(`/clinica/pacientes/${id}`)
          }}
        />
      )}

      {editando && clinicId && (
        <PatientFormModal
          clinicId={clinicId}
          patient={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar() }}
        />
      )}

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome…"
        className="mt-4 w-full max-w-sm rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
      />

      {/* Filtro por letra inicial */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <button
          onClick={() => setLetra(null)}
          className={`rounded-md px-2 py-1 text-xs font-semibold transition ${letra === null ? 'bg-primaria text-white' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}
        >
          Todos
        </button>
        {ALFABETO.map((l) => {
          const existe = iniciaisExistentes.has(l)
          const ativo = letra === l
          return (
            <button
              key={l}
              disabled={!existe}
              onClick={() => setLetra(ativo ? null : l)}
              className={`h-7 w-7 rounded-md text-xs font-semibold transition ${
                ativo
                  ? 'bg-primaria text-white'
                  : existe
                    ? 'bg-black/5 text-texto/70 hover:bg-black/10'
                    : 'cursor-default text-texto/20'
              }`}
            >
              {l}
            </button>
          )
        })}
        {iniciaisExistentes.has('#') && (
          <button
            onClick={() => setLetra(letra === '#' ? null : '#')}
            className={`h-7 w-7 rounded-md text-xs font-semibold transition ${letra === '#' ? 'bg-primaria text-white' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}
            title="Outros (número/símbolo)"
          >
            #
          </button>
        )}
      </div>

      {/* Controle de quantidade por página */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-texto/70">
        <span>Mostrar</span>
        {OPCOES_QTD.map((n) => (
          <button
            key={n}
            onClick={() => { setPorPagina(n); setQtdCustom('') }}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${porPagina === n && qtdCustom === '' ? 'bg-primaria text-white' : 'bg-black/5 text-texto/70 hover:bg-black/10'}`}
          >
            {n}
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={qtdCustom}
          onChange={(e) => setQtdCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') aplicarCustom() }}
          onBlur={aplicarCustom}
          placeholder="outro"
          className="w-20 rounded-md border border-black/10 px-2 py-1 text-xs outline-none focus:border-primaria"
        />
        <span className="text-xs text-texto/50">registros por página</span>
      </div>

      {/* Card com scroll horizontal CONFINADO (não arrasta a página inteira) */}
      <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
        {carregando ? (
          <p className="p-6 text-sm text-texto/50">Carregando…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-6 text-sm text-texto/50">Nenhum paciente encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-black/[0.02] text-left text-texto/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">CPF</th>
                  <th className="px-4 py-2 font-medium">WhatsApp</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/clinica/pacientes/${p.id}`)}
                    className="cursor-pointer border-t border-black/5 hover:bg-black/[0.02]"
                  >
                    <td className="px-4 py-2 text-texto">{p.nome}</td>
                    <td className="px-4 py-2 text-texto/70">{p.cpf ?? '—'}</td>
                    <td className="px-4 py-2 text-texto/70">{p.whatsapp ?? '—'}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => navigate(`/clinica/pacientes/${p.id}`)} className="text-xs font-medium text-primaria hover:underline">Abrir</button>
                      <button onClick={() => setEditando(p)} className="ml-3 text-xs font-medium text-texto/60 hover:underline">Editar</button>
                      <button onClick={() => excluir(p)} className="ml-3 text-xs font-medium text-secundaria hover:underline">Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rodapé: contagem + paginação */}
      {!carregando && filtrados.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-texto/60">
          <span>
            {inicio + 1}–{Math.min(inicio + porPagina, filtrados.length)} de {filtrados.length}
            {(busca || letra) && ` (${pacientes.length} no total)`}
          </span>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={paginaSegura === 0}
                className="rounded-md bg-black/5 px-3 py-1 text-xs font-semibold text-texto/70 hover:bg-black/10 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs">Página {paginaSegura + 1} de {totalPaginas}</span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaSegura >= totalPaginas - 1}
                className="rounded-md bg-black/5 px-3 py-1 text-xs font-semibold text-texto/70 hover:bg-black/10 disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
