import { createContext, useContext, useEffect, useState } from 'react'
import { Models } from 'app/lib/appwrite-universal'

import { account, teams } from 'app/provider/appwrite/api'
import { ADMIN_TEAM_ID } from 'app/provider/appwrite/constants'
import { BACKEND } from 'app/lib/backend'
import { getSupabase, isSupabaseConfigured } from 'app/lib/supabase/client'
import {
  getSupabaseUser,
  isSupabaseAdmin,
  mapSupabaseUser,
} from 'app/lib/supabase/auth'

interface AuthContextType {
  user: Models.User<Models.Preferences> | null
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
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true)

  const refreshUser = async () => {
    try {
      setIsLoading(true)

      if (BACKEND === 'supabase') {
        if (!isSupabaseConfigured) {
          setUser(null)
          return
        }
        try {
          const currentUser = await getSupabaseUser()
          setUser(
            currentUser as unknown as Models.User<Models.Preferences> | null,
          )
        } catch (error) {
          setUser(null)
        }
        return
      }

      // First check if there's an active session by trying to get the user
      try {
        const currentUser = await account.get()
        // console.log('[Auth] Active user:', currentUser.name)
        setUser(currentUser)
      } catch (error) {
        setUser(null)
      }
    } catch (error) {
      // No session or error - user is not logged in
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Check admin status when user changes
  useEffect(() => {
    if (isLoading || !user) {
      setIsAdmin(false)
      setIsLoadingAdmin(false)
      return
    }

    setIsLoadingAdmin(true)

    if (BACKEND === 'supabase') {
      isSupabaseAdmin(user.$id)
        .then(setIsAdmin)
        .catch(() => setIsAdmin(false))
        .finally(() => setIsLoadingAdmin(false))
      return
    }

    teams
      .listMemberships({ teamId: ADMIN_TEAM_ID })
      .then((res) => {
        const found = res.memberships.some((m) => m.userId === user.$id)
        setIsAdmin(found)
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setIsLoadingAdmin(false))
  }, [user?.$id, isLoading])

  // Supabase: react to sign-in / sign-out (incl. OAuth redirect completion).
  useEffect(() => {
    if (BACKEND !== 'supabase' || !isSupabaseConfigured) return
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setUser(
        mapSupabaseUser(session?.user ?? null) as unknown as
          | Models.User<Models.Preferences>
          | null,
      )
      setIsLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Supabase resolves the initial session via the onAuthStateChange listener
    // above (it emits INITIAL_SESSION on subscribe), so skip the delayed refresh
    // here to avoid a loading-state flicker. If Supabase isn't configured nothing
    // will ever fire, so clear loading to avoid a permanent spinner.
    if (BACKEND === 'supabase') {
      if (!isSupabaseConfigured) {
        setUser(null)
        setIsLoading(false)
      }
      return
    }

    // On Android, add a small delay to ensure AsyncStorage has loaded
    // before checking for session
    const initAuth = async () => {
      // Small delay to ensure AsyncStorage is ready
      await new Promise((resolve) => setTimeout(resolve, 100))
      refreshUser()
    }

    initAuth()
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
