import { useEffect } from 'react'
import { Platform } from 'react-native'
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
    if (Platform.OS === 'web' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // Handle navigation to contest detail page
  const navigateToContest = (contestSlugOrId: string) => {
    // Save scroll position before navigating (web only)
    if (Platform.OS === 'web') {
      // Store scroll position in sessionStorage
      sessionStorage.setItem(`scroll_${baseUrl}`, window.scrollY.toString())
      // Set flag that we're navigating from list (will be cleared on back navigation)
      sessionStorage.setItem('navigated_from_list', 'true')
      sessionStorage.setItem('list_url', baseUrl) // Store the base URL to return to
    }

    // Use router for both web and native
    router.push(`/contest/${contestSlugOrId}`)
  }

  // Restore scroll position when returning to base URL
  useEffect(() => {
    if (Platform.OS !== 'web') return

    // Check if we're on the base URL (ignoring query parameters)
    const currentPath = window.location.pathname
    const isOnBaseUrl =
      currentPath === baseUrl || (baseUrl === '/' && currentPath === '/')

    if (isOnBaseUrl) {
      const savedScroll = sessionStorage.getItem(`scroll_${baseUrl}`)
      if (savedScroll) {
        // Restore scroll position after content has rendered
        // Use multiple attempts to ensure content is loaded
        const scrollPosition = parseInt(savedScroll, 10)

        const attemptRestore = (attempts = 0) => {
          if (attempts > 10) {
            // Give up after 10 attempts (500ms total)
            sessionStorage.removeItem(`scroll_${baseUrl}`)
            return
          }

          requestAnimationFrame(() => {
            // Check if page has enough content to scroll to the saved position
            const maxScroll =
              document.documentElement.scrollHeight - window.innerHeight

            if (maxScroll >= scrollPosition || attempts > 5) {
              // Content is ready or we've waited long enough
              window.scrollTo(0, scrollPosition)
              sessionStorage.removeItem(`scroll_${baseUrl}`)
            } else {
              // Content not ready yet, try again
              setTimeout(() => attemptRestore(attempts + 1), 50)
            }
          })
        }

        attemptRestore()
      }
    }
  }, [pathname, baseUrl])

  return {
    navigateToContest,
  }
}
