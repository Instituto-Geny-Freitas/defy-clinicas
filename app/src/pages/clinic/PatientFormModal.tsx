import { useState, type FormEvent } from 'react'
import { createPatient, type PatientInput } from '@/lib/patients'

interface Props {
  clinicId: string
  onClose: () => void
  onCreated: (id: string) => void
}

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function PatientFormModal({ clinicId, onClose, onCreated }: Props) {
  const [form, setForm] = useState<PatientInput>({ nome: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function set<K extends keyof PatientInput>(k: K, v: PatientInput[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) {
      setErro('Informe o nome.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const p = await createPatient(clinicId, form)
      onCreated(p.id)
    } catch {
      setErro('Não foi possível cadastrar. Verifique os dados (CPF duplicado?).')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Novo paciente</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-texto/70">Nome completo *</label>
            <input className={field} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">CPF</label>
            <input className={field} value={form.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Data de nascimento</label>
            <input type="date" className={field} value={form.nascimento ?? ''} onChange={(e) => set('nascimento', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">E-mail</label>
            <input className={field} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">WhatsApp</label>
            <input className={field} value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-texto/70">Alergias</label>
            <input className={field} value={form.alergias ?? ''} onChange={(e) => set('alergias', e.target.value)} />
          </div>

          {erro && <p className="text-sm text-secundaria sm:col-span-2">{erro}</p>}

          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
