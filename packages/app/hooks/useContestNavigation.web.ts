import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'app/lib/router-universal'

interface UseContestNavigationProps {
  baseUrl: string // e.g., '/contests' or '/search'
}

export function useContestNavigation({ baseUrl }: UseContestNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  const navigateToContest = (contestSlugOrId: string) => {
    sessionStorage.setItem(`scroll_${baseUrl}`, window.scrollY.toString())
    sessionStorage.setItem('navigated_from_list', 'true')
    sessionStorage.setItem('list_url', baseUrl)

    router.push(`/contest/${contestSlugOrId}`)
  }

  // Restore scroll position when returning to base URL
  useEffect(() => {
    const currentPath = window.location.pathname
    const isOnBaseUrl =
      currentPath === baseUrl || (baseUrl === '/' && currentPath === '/')

    if (!isOnBaseUrl) return

    const savedScroll = sessionStorage.getItem(`scroll_${baseUrl}`)
    if (!savedScroll) return

    const scrollPosition = parseInt(savedScroll, 10)

    const attemptRestore = (attempts = 0) => {
      if (attempts > 10) {
        sessionStorage.removeItem(`scroll_${baseUrl}`)
        return
      }

      requestAnimationFrame(() => {
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight

        if (maxScroll >= scrollPosition || attempts > 5) {
          window.scrollTo(0, scrollPosition)
          sessionStorage.removeItem(`scroll_${baseUrl}`)
        } else {
          setTimeout(() => attemptRestore(attempts + 1), 50)
        }
      })
    }

    attemptRestore()
  }, [pathname, baseUrl])

  return {
    navigateToContest,
  }
}
