import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const maintenanceEnabled = process.env.MAINTENANCE_MODE === 'true'
  if (!maintenanceEnabled) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  const isMaintenancePage = pathname === '/maintenance'
  const isApiRoute = pathname.startsWith('/api')
  const isNextAsset = pathname.startsWith('/_next')
  const isStaticFile = /\.[^/]+$/.test(pathname)

  if (isMaintenancePage || isApiRoute || isNextAsset || isStaticFile) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/maintenance'
  return NextResponse.rewrite(url)
}
