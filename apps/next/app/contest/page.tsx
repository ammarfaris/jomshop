'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ContestRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to home page
    router.replace('/')
  }, [router])

  return null
}
