import { useAuth } from 'app/contexts/AuthContext'

export function useIsAdmin() {
  const { isAdmin, isLoadingAdmin } = useAuth()

  return {
    isAdmin,
    isLoading: isLoadingAdmin,
  }
}
