'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import SignInRegisterScreen from 'app/features/auth/sign-in-register-screen'

function SignInRegisterContent() {
  const searchParams = useSearchParams()
  const baseRedirect = searchParams.get('redirect') || '/'
  const refCode = searchParams.get('ref')

  // Append ref code to redirect URL if present
  const redirect = refCode
    ? `${baseRedirect}${baseRedirect.includes('?') ? '&' : '?'}ref=${refCode}`
    : baseRedirect

  // to tackle nextjs hydration issue
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) return null
  return <SignInRegisterScreen redirectPath={redirect} />
}

export default function SignInRegisterPage() {
  return (
    <Suspense fallback={null}>
      <SignInRegisterContent />
    </Suspense>
  )
}
