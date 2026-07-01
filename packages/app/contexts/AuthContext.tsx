import { createContext, useContext, useEffect, useState } from 'react'

import { getSupabase, isSupabaseConfigured } from 'app/lib/supabase/client'
import {
  getSupabaseUser,
  isSupabaseAdmin,
  mapSupabaseUser,
  type AppUser,
} from 'app/lib/supabase/auth'

interface AuthContextType {
  user: AppUser | null
  isLoading: boolean
  isAdmin: boolean
  isLoadingAdmin: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isLoadingAdmin: true,
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true)

  const refreshUser = async () => {
    try {
      setIsLoading(true)
      if (!isSupabaseConfigured) {
        setUser(null)
        return
      }
      try {
        setUser(await getSupabaseUser())
      } catch {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Admin = a row in user_roles (replaces the Appwrite admin team membership).
  useEffect(() => {
    if (isLoading || !user) {
      setIsAdmin(false)
      setIsLoadingAdmin(false)
      return
    }

    setIsLoadingAdmin(true)
    isSupabaseAdmin(user.$id)
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false))
      .finally(() => setIsLoadingAdmin(false))
  }, [user?.$id, isLoading])

  // React to sign-in / sign-out (incl. OAuth redirect completion). Supabase
  // emits INITIAL_SESSION on subscribe, which also resolves the initial load.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null)
      setIsLoading(false)
      return
    }
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUser(session?.user ?? null))
      setIsLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAdmin, isLoadingAdmin, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
