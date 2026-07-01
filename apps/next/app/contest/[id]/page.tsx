import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ContestDetailClientWrapper from './ClientWrapper'

// ISR caching - revalidate every hour
export const revalidate = 3600

function humanizeSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// Generate metadata for the page.
//
// The contest detail content is rendered client-side (see ClientWrapper) against
// Supabase. Here we (1) confirm the contest actually exists so unknown slugs
// return a real 404 instead of a soft 200, and (2) derive OG/Twitter metadata
// from the real title/summary when available. Dependency-free: a single cached
// PostgREST fetch with the publishable (anon) key.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://jomcontest.com'

  // Validate slug format before building metadata.
  // Slugs are lowercase alphanumeric with hyphens only, e.g.
  // "shopee-iphone-giveaway-from-2024-01-15-until-2024-02-15".
  if (!id || id.length > 150 || !/^[a-z0-9-]+$/.test(id)) {
    notFound()
  }

  let title = humanizeSlug(id)
  let description = 'Discover contests in Malaysia'

  // Verify existence against Supabase (public visibility only). `exists` stays
  // null when we can't reach Supabase, so a transient outage fails open (keeps
  // slug-derived metadata) rather than 404-ing a possibly-valid page. Only a
  // definitive empty result triggers notFound() — and that must run OUTSIDE the
  // try/catch, since notFound() throws a control-flow error we must not swallow.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let exists: boolean | null = null

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/contests?slug=eq.${encodeURIComponent(
          id,
        )}&visibility=in.(users,any)&select=title,summary&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          next: { revalidate: 3600 },
        },
      )
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          title?: string | null
          summary?: string | null
        }>
        if (Array.isArray(rows) && rows.length > 0) {
          exists = true
          if (rows[0]?.title) title = rows[0].title as string
          if (rows[0]?.summary) description = rows[0].summary as string
        } else {
          exists = false
        }
      }
    } catch {
      // Network/parse error: leave exists = null (fail open).
    }
  }

  if (exists === false) {
    notFound()
  }

  return {
    title: `${title} | JomContest`,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/contest/${id}`,
      type: 'website',
      images: [
        {
          url: `${baseUrl}/og-default.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${baseUrl}/og-default.png`],
    },
  }
}

export default function ContestDetailPage() {
  return <ContestDetailClientWrapper />
}
