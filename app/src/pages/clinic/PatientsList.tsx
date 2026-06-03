import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPatients } from '@/lib/patients'
import { useAuth } from '@/auth/AuthProvider'
import type { Patient } from '@/lib/types'
import PatientFormModal from './PatientFormModal'

export default function PatientsList() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)

  const clinicId = profile?.professional?.clinic_id

  function recarregar() {
    listPatients()
      .then(setPacientes)
      .catch(() => {})
      .finally(() => setCarregando(false))
  }

  useEffect(recarregar, [])

  const filtrados = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()),
  )

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
          onCreated={(id) => {
            setModalAberto(false)
            navigate(`/clinica/pacientes/${id}`)
          }}
        />
      )}

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome…"
        className="mt-4 w-full max-w-sm rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
      />

      <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
        {carregando ? (
          <p className="p-6 text-sm text-texto/50">Carregando…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-6 text-sm text-texto/50">Nenhum paciente cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">CPF</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/clinica/pacientes/${p.id}`)}
                  className="cursor-pointer border-t border-black/5 hover:bg-black/[0.02]"
                >
                  <td className="px-4 py-2 text-texto">{p.nome}</td>
                  <td className="px-4 py-2 text-texto/70">{p.cpf ?? '—'}</td>
                  <td className="px-4 py-2 text-texto/70">{p.whatsapp ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
