import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Client, Databases, Query } from 'node-appwrite' // this page is using SSR (node-appwrite is a server-only package)
import ContestDetailClientWrapper from './ClientWrapper'
import {
  DATABASE_ID,
  CONTESTS_COLLECTION_ID,
  CONTESTS_BUCKET_ID,
  APPWRITE_PROJECT_ID,
  APPWRITE_ENDPOINT,
} from 'app/provider/appwrite/constants'

// ISR caching - revalidate every hour
export const revalidate = 3600

// Types for contest data
type Contest = {
  $id: string
  slug: string
  title: string
  title_ms?: string
  summary?: string
  summary_ms?: string
  main_img_id?: string
  main_img_token_secret?: string
  language?: string
}

// Helper function to sanitize metadata text
function sanitizeForMetadata(text: string | undefined | null): string {
  if (!text) return ''
  return text
    .replace(/[<>]/g, '') // Remove HTML brackets
    .substring(0, 200) // Limit length
    .trim()
}

// Helper function to create Appwrite server client
function createServerClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)

  // Use API key if available (for server-side operations)
  const apiKey = process.env.APPWRITE_API_KEY
  if (apiKey) {
    client.setKey(apiKey)
  }

  return client
}

// Fetch contest data for metadata
async function fetchContestData(contestSlug: string): Promise<Contest | null> {
  try {
    const client = createServerClient()
    const databases = new Databases(client)

    const response = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: CONTESTS_COLLECTION_ID,
      queries: [Query.equal('slug', contestSlug), Query.limit(1)],
    })

    if (response.documents.length === 0) {
      return null
    }

    return response.documents[0] as unknown as Contest
  } catch (error) {
    console.error('Failed to fetch contest for metadata:', error)
    return null
  }
}

// Generate metadata for the page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://jomcontest.com'

  // Validate slug format before hitting database
  // Slugs are generated as lowercase alphanumeric with hyphens only
  // Example: "shopee-iphone-giveaway-from-2024-01-15-until-2024-02-15"
  if (!id || id.length > 150 || !/^[a-z0-9-]+$/.test(id)) {
    notFound()
  }

  try {
    // Fetch contest data
    const contest = await fetchContestData(id)

    if (!contest) {
      // Contest not found in database
      notFound()
    }

    // Determine image URL with fallbacks
    let imageUrl = `${baseUrl}/og-default.png` // Static fallback

    // Use contest main image as OG image (no custom OG generation)
    // Contests bucket is public, no token needed
    // Use preview endpoint with JPEG output for better iOS/WhatsApp compatibility
    if (contest.main_img_id) {
      imageUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${CONTESTS_BUCKET_ID}/files/${contest.main_img_id}/preview?project=${APPWRITE_PROJECT_ID}&width=1200&height=630&output=jpg`
    }

    // Prepare metadata
    const title = contest.title
    const description = sanitizeForMetadata(contest.summary)
    const locale = contest.language || 'en'

    return {
      title: `${title} | JomContest`,
      description: description || 'Discover contests in Malaysia',
      openGraph: {
        title,
        description: description || 'Discover contests in Malaysia',
        url: `${baseUrl}/contest/${id}`,
        type: 'website',
        locale,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: description || 'Discover contests in Malaysia',
        images: [imageUrl],
      },
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    // Return 404 on database errors
    notFound()
  }
}

export default function ContestDetailPage() {
  return <ContestDetailClientWrapper />
}
