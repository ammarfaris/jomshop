'use client'

import { useEffect, useState } from 'react'

import TermsScreen from 'app/features/legal/TermsScreen'

export default function TermsPage() {
  // to tackle nextjs hydration issue
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Render a placeholder with same height to prevent layout shift
  if (!isClient) {
    return <div style={{ minHeight: '100vh' }} />
  }

  return <TermsScreen />
}
