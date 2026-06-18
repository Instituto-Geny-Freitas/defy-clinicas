import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { canWith, getPermissions, type PermMatrix } from '@/lib/permissions'

interface Ctx {
  matrix: PermMatrix | null
  reload: () => void
  can: (key: string) => boolean
}

const PermissionsContext = createContext<Ctx>({ matrix: null, reload: () => {}, can: () => true })

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const nivel = profile?.professional?.role
  const [matrix, setMatrix] = useState<PermMatrix | null>(null)

  function reload() {
    getPermissions().then(setMatrix).catch(() => {})
  }
  // Recarrega quando muda o usuário (login) — a leitura de clinics exige autenticação.
  useEffect(reload, [profile?.professional?.id])

  const can = (key: string) => canWith(matrix, nivel, key)

  return <PermissionsContext.Provider value={{ matrix, reload, can }}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): Ctx {
  return useContext(PermissionsContext)
}
