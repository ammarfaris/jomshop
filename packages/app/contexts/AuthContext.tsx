import { createContext, useContext, useEffect, useState } from 'react'
import { Models } from 'app/lib/appwrite-universal'

import { account, teams } from 'app/provider/appwrite/api'
import { ADMIN_TEAM_ID } from 'app/provider/appwrite/constants'

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

      // console.log('[Auth] Checking for active user session...')

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
    teams
      .listMemberships({ teamId: ADMIN_TEAM_ID })
      .then((res) => {
        const found = res.memberships.some((m) => m.userId === user.$id)
        setIsAdmin(found)
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setIsLoadingAdmin(false))
  }, [user?.$id, isLoading])

  useEffect(() => {
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
