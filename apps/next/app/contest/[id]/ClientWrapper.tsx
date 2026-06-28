/***
 *  Architecture:
 *  page.tsx = Server Component (no 'use client')
 *  ClientWrapper.tsx = Client Component ('use client')
 *  Why this pattern?:
 *  Server component generates metadata (OG tags), has revalidate export (ISR)
 *  Client component handles interactivity (React hooks, state)
 *  Best of both worlds!
 ***/

'use client'

import { useEffect, useState } from 'react'
import UserDetailScreen from 'app/features/contest/detail-screen'

export default function ContestDetailClientWrapper() {
  // to tackle nextjs hydration issue
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Only scroll to top if NOT coming from the contest list
    // This preserves scroll position when navigating back
    const navigatedFromList = sessionStorage.getItem('navigated_from_list')
    if (navigatedFromList === 'true') {
      // Clear the flag so subsequent visits scroll to top
      sessionStorage.removeItem('navigated_from_list')
      // Scroll to top for detail page
      window.scrollTo(0, 0)
    }
  }, [])

  if (!isClient) return null

  return <UserDetailScreen />
}
