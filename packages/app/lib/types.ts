/**
 * Neutral, backend-agnostic types shared across the app.
 *
 * The Supabase read transforms return an Appwrite-compatible envelope
 * (`$id` / `$createdAt` / `$updatedAt`) so the screens didn't have to change
 * during the migration. `Document` captures that envelope without depending on
 * the Appwrite SDK's `Models` namespace (which has been removed).
 */
export interface Document {
  $id: string
  $createdAt: string
  $updatedAt: string
  $permissions?: string[]
  $collectionId?: string
  $databaseId?: string
}
