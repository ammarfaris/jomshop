'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import { useAuth } from 'app/contexts/AuthContext'
import { useIsAdmin } from 'app/hooks/useIsAdmin'
import { UserAvatar } from 'app/components/UserAvatar'
import { FeedbackDialog } from 'app/components/FeedbackDialog'
import { Separator } from 'app/components/ui/separator'

export default function Navbar({ maintenanceMode = false }: { maintenanceMode?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [cameFromList, setCameFromList] = useState(false)
  const [, setCurrentLocale] = useState(i18n.locale)
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { isAdmin } = useIsAdmin()
  const menuRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  // Listen for locale changes using Lingui's event system
  // This is needed to ensure our desktop (non-hamburger) nav menu reflect the language change
  useEffect(() => {
    const handleLocaleChange = () => {
      setCurrentLocale(i18n.locale)
    }

    const unsubscribe = i18n.on('change', handleLocaleChange)

    return unsubscribe
  }, [])

  useEffect(() => {
    if (maintenanceMode) return
    // Only show navigation button on detail pages (e.g., /contest/[id], /user/[id])
    const isDetailPage = /^\/(contest|user)\/[^/]+$/.test(pathname)
    setCanGoBack(isDetailPage && window.history.length > 1)

    // Check if we navigated from a list
    if (isDetailPage) {
      const fromList = sessionStorage.getItem('navigated_from_list') === 'true'
      setCameFromList(fromList)
    } else {
      // Clear flags when not on detail page
      setCameFromList(false)
      sessionStorage.removeItem('navigated_from_list')
      sessionStorage.removeItem('list_url')
    }
  }, [pathname, maintenanceMode])

  // Close menu when clicking outside
  useEffect(() => {
    if (maintenanceMode) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current &&
        hamburgerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !hamburgerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen, maintenanceMode])

  if (maintenanceMode) {
    return (
      <nav className="fixed top-0 left-0 w-full z-30 backdrop-blur bg-white/70 dark:bg-black/60 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-center h-16">
          <span className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-800 dark:text-gray-100">
              JomContest
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-main text-main-foreground rounded uppercase tracking-wide">
              BETA
            </span>
          </span>
        </div>
      </nav>
    )
  }

  const primaryLinks = [
    { href: '/', label: i18n._(msg`Home`) },
    { href: '/search', label: i18n._(msg`Search`) },
    { href: '/profile', label: i18n._(msg`Profile`) },
  ]

  const secondaryLinks = [
    { href: '/about', label: i18n._(msg`About`) },
    { href: '/contact', label: i18n._(msg`Contact`) },
    { href: '/privacy', label: i18n._(msg`Privacy`) },
    { href: '/terms', label: i18n._(msg`Terms`) },
  ]

  const adminLink = isAdmin
    ? { href: '/admin', label: i18n._(msg`Admin`) }
    : null

  const handleBack = () => {
    if (canGoBack && cameFromList) {
      // Clear the navigation flag before going back
      sessionStorage.removeItem('navigated_from_list')
      sessionStorage.removeItem('list_url')
      router.back()
    } else {
      // Navigate to home
      router.push('/')
    }
  }

  return (
    <nav className="fixed top-0 left-0 w-full z-30 backdrop-blur bg-white/70 dark:bg-black/60 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      {/* Navigation Button - Fixed position relative to viewport */}
      {canGoBack && cameFromList && (
        <button
          onClick={handleBack}
          className="fixed flex items-center justify-center w-10 h-10 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none z-40"
          style={{ left: '16px', top: '32px', transform: 'translateY(-50%)' }}
          aria-label="Go back to list"
          title="Back to List"
        >
          {/* Heroicon: chevron-left */}
          <svg
            className="w-6 h-6 text-gray-800 dark:text-gray-100"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Feedback Button - Fixed position relative to viewport, only for logged-in users */}
      {user && (
        <div
          className="fixed z-40"
          style={{
            left: canGoBack && cameFromList ? '60px' : '16px',
            top: '32px',
            transform: 'translateY(-50%)',
          }}
        >
          <FeedbackDialog
            currentUrl={
              typeof window !== 'undefined' ? window.location.href : pathname
            }
          >
            {/* Use a React Native Pressable to avoid onPress being forwarded to HTML button */}
            <div
              role="button"
              className="flex items-center justify-center w-10 h-10 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none"
              aria-label="Send Feedback"
              title="Send Feedback"
            >
              {/* Heroicon: chat-bubble-bottom-center-text */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-main"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                />
              </svg>
            </div>
          </FeedbackDialog>
        </div>
      )}

      {/* Desktop Nav Links - Fixed position relative to viewport */}
      <div
        className="hidden lg:flex gap-6 items-center fixed right-4 z-40"
        style={{ top: '32px', transform: 'translateY(-50%)' }}
      >
        {primaryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-gray-800 dark:text-gray-100 font-medium transition-colors hover:!text-[hsl(var(--main))]"
          >
            {link.label}
          </Link>
        ))}
        <span
          className="text-gray-400 dark:text-gray-600 font-medium select-none"
          aria-hidden="true"
        >
          |
        </span>
        {secondaryLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-gray-800 dark:text-gray-100 font-medium transition-colors hover:!text-[hsl(var(--main))]"
          >
            {link.label}
          </Link>
        ))}
        {adminLink && (
          <>
            <span
              className="text-gray-400 dark:text-gray-600 font-medium select-none"
              aria-hidden="true"
            >
              |
            </span>
            <Link
              href={adminLink.href}
              className="text-gray-800 dark:text-gray-100 font-medium transition-colors hover:!text-[hsl(var(--main))]"
            >
              {adminLink.label}
            </Link>
          </>
        )}
        {user && (
          <Link
            href="/profile"
            className="flex items-center justify-center ml-2"
            aria-label="Profile"
            title="Profile"
          >
            <UserAvatar
              userId={user.$id}
              displayName={user.name}
              size="sm"
              className="hover:ring-2 hover-ring-main transition-all"
            />
          </Link>
        )}
      </div>

      {/* Mobile Profile Icon/Avatar - Fixed position relative to viewport */}
      <Link
        href="/profile"
        className="lg:hidden flex items-center justify-center w-10 h-10 rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none fixed right-16 z-40"
        style={{ top: '32px', transform: 'translateY(-50%)' }}
        aria-label="Profile"
        title="Profile"
      >
        {user ? (
          <UserAvatar userId={user.$id} displayName={user.name} size="sm" />
        ) : (
          <svg
            className="w-6 h-6 text-gray-800 dark:text-gray-100"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )}
      </Link>

      {/* Mobile Hamburger - Fixed position relative to viewport */}
      <button
        ref={hamburgerRef}
        className="lg:hidden flex items-center justify-center w-10 h-10 rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none fixed right-4 z-40"
        style={{ top: '32px', transform: 'translateY(-50%)' }}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6 text-gray-800 dark:text-gray-100"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {menuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center h-16 relative">
        {/* Logo - Centered on mobile, left-aligned on desktop with space for back button and feedback button */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 lg:absolute lg:translate-x-0 ${
            canGoBack && cameFromList && user ? 'lg:left-28' : 'lg:left-16'
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-xl font-bold text-gray-800 dark:text-gray-100">
              JomContest
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-main text-main-foreground rounded uppercase tracking-wide">
              BETA
            </span>
          </Link>
        </div>
      </div>
      {/* Mobile Menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="lg:hidden bg-white/90 dark:bg-black/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 pb-4 pt-2"
        >
          <div className="flex flex-col gap-4">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-800 dark:text-gray-100 font-medium transition-colors hover:!text-[hsl(var(--main))]"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Separator />
            {secondaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-800 dark:text-gray-100 font-medium transition-colors hover:!text-[hsl(var(--main))]"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {adminLink && (
              <>
                <Separator />
                <Link
                  href={adminLink.href}
                  className="text-gray-800 dark:text-gray-100 font-medium transition-colors hover:!text-[hsl(var(--main))]"
                  onClick={() => setMenuOpen(false)}
                >
                  {adminLink.label}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
