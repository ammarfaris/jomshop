'use client'

import { useEffect, useState } from 'react'

import ContactScreen from 'app/features/info/ContactScreen'

export default function ContactPage() {
  // to tackle nextjs hydration issue
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Render a placeholder with same height to prevent layout shift
  if (!isClient) {
    return <div style={{ minHeight: '100vh' }} />
  }

  return <ContactScreen />
}
