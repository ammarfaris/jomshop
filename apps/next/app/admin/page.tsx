'use client'

import { useEffect, useState } from 'react'

import AdminScreen from 'app/features/admin/screen'

export default function AdminPage() {
  // tackle nextjs hydration issue
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) return null

  return <AdminScreen />
}
