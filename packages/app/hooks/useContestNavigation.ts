import { useRouter } from 'app/lib/router-universal'

interface UseContestNavigationProps {
  baseUrl: string // e.g., '/contests' or '/search'
}

export function useContestNavigation(_props: UseContestNavigationProps) {
  const router = useRouter()

  // Handle navigation to contest detail page
  const navigateToContest = (contestSlugOrId: string) => {
    router.push(`/contest/${contestSlugOrId}`)
  }

  return {
    navigateToContest,
  }
}
