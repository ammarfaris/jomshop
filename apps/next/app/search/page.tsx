'use client'

import { useEffect, useState } from 'react'

import SearchScreen from 'app/features/search/screen'

export default function SearchPage() {
  // to tackle nextjs hydration issue
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Render a placeholder with same height to prevent layout shift
  if (!isClient) {
    return <div style={{ minHeight: '100vh' }} />
  }

  return <SearchScreen />
}
