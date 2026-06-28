# Meilisearch Search Implementation (Secure with Appwrite Functions)

This guide explains how to set up and use the secure Meilisearch-powered search functionality in your contest app using Appwrite Functions to protect your credentials.

## 🚀 Quick Setup

### 1. Install Meilisearch Server

**Option A: Using Docker (Recommended)**

```bash
docker run -it --rm \
  -p 7700:7700 \
  -e MEILI_ENV='development' \
  -v $(pwd)/meili_data:/meili_data \
  getmeili/meilisearch:v1.7
```

**Option B: Download Binary**
Visit [Meilisearch releases](https://github.com/meilisearch/meilisearch/releases) and download for your platform.

### 2. Deploy Appwrite Functions

Deploy the two Meilisearch functions to your Appwrite project:

1. **Upload `functions/meilisearch-search.tar.gz`** - For search operations
2. **Upload `functions/meilisearch-admin.tar.gz`** - For admin operations

### 3. Configure Environment Variables

In your Appwrite Console, set these environment variables for both functions:

**For meilisearch-search function:**

- `MEILISEARCH_HOST` = `http://localhost:7700` (or your Meilisearch URL)
- `MEILISEARCH_SEARCH_API_KEY` = `your-search-only-key`

**For meilisearch-admin function:**

- `MEILISEARCH_HOST` = `http://localhost:7700` (or your Meilisearch URL)
- `MEILISEARCH_ADMIN_API_KEY` = `your-master-key`
- `APPWRITE_ENDPOINT` = (auto-set)
- `APPWRITE_PROJECT_ID` = (auto-set)
- `INTERNAL_API_KEY` = (auto-set)
- `ADMIN_TEAM_ID` = `your-admin-team-id`
- `DATABASE_ID` = `your-database-id`
- `CONTESTS_COLLECTION_ID` = `your-contests-collection-id`

### 4. Update Function IDs

Update the function IDs in `packages/app/lib/meilisearch/api.ts`:

```typescript
const MEILISEARCH_SEARCH_FUNCTION_ID = 'your-search-function-id'
const MEILISEARCH_ADMIN_FUNCTION_ID = 'your-admin-function-id'
```

### 5. Initial Setup & Data Sync

Create a setup script or add to your admin panel:

```typescript
import {
  setupMeilisearchIndex,
  syncContestsToMeilisearch,
} from 'app/lib/meilisearch/api'

// Run this once to configure your index
async function initializeSearch() {
  try {
    // 1. Setup the index with proper configuration (via secure function)
    await setupMeilisearchIndex()

    // 2. Sync existing contests from Appwrite (via secure function)
    await syncContestsToMeilisearch()

    console.log('🎉 Search setup complete!')
  } catch (error) {
    console.error('Setup failed:', error)
  }
}

// Call this function
initializeSearch()
```

## 🔧 Configuration Details

### Security Features

✅ **Credentials Protected**: Meilisearch credentials are stored securely in Appwrite Functions
✅ **Admin-Only Operations**: Index management requires admin team membership
✅ **Read-Only Search**: Public search uses read-only API key
✅ **Server-Side Validation**: All operations validated on the server

### Search Features Enabled

1. **Searchable Fields**: title, summary
2. **Filterable Fields**: status, start_date, end_date
3. **Sortable Fields**: start_date, end_date, title

### Search UI Components

The search screen includes:

- 📝 **Search Box**: Real-time search with debouncing
- 🎯 **Filters**: Modal with status filtering
- 📱 **Infinite Scroll**: Loads more results automatically
- 📄 **Contest Cards**: Displays contest info with navigation to details

## 📱 Usage

### For Users

1. Navigate to the Search tab
2. Type in the search box to find contests
3. Tap "Filters" to filter by status
4. Tap any contest card to view details

### For Developers

#### Keep Search Index Updated

**When creating a contest:**

```typescript
import { addContestToMeilisearch } from 'app/lib/meilisearch/api'

// After creating contest in Appwrite
const contest = await databases.createDocument(...)
await addContestToMeilisearch(contest) // Secure function call
```

**When updating a contest:**

```typescript
// After updating contest in Appwrite
const updatedContest = await databases.updateDocument(...)
await addContestToMeilisearch(updatedContest) // Secure function call
```

**When deleting a contest:**

```typescript
import { deleteContestFromMeilisearch } from 'app/lib/meilisearch/api'

// After deleting from Appwrite
await databases.deleteDocument(...)
await deleteContestFromMeilisearch(contestId) // Secure function call
```

#### Manual Re-sync

```typescript
import { syncContestsToMeilisearch } from 'app/lib/meilisearch/api'

// Re-sync all contests (useful after bulk changes)
await syncContestsToMeilisearch()
```

## 🔒 Security Notes

1. **Secure by Design**:

   - ✅ No credentials exposed in client code
   - ✅ All sensitive operations go through Appwrite Functions
   - ✅ Admin operations require team membership verification
   - ✅ Search operations use read-only keys

2. **API Keys Management**:

   - **Master Key**: Stored securely in Appwrite Function environment (admin operations)
   - **Search Key**: Stored securely in Appwrite Function environment (read-only search)
   - **Client**: No direct access to Meilisearch credentials

3. **Production Setup**:
   - Environment variables are managed in Appwrite Console
   - Functions run in isolated, secure environment
   - Consider using a managed Meilisearch service for production

## 🎨 Customization

### Adding More Search Fields

To make additional fields searchable, update the Appwrite Function:

1. **Admin Function** (`functions/meilisearch-admin/index.js`):

```javascript
// In the 'setup' case
await index.updateSearchableAttributes([
  'title',
  'summary',
  'new_field', // Add here
])
```

2. **Data transformation** (same file, in 'sync' and 'add' cases):

```javascript
const transformedContest = {
  // ... existing fields
  new_field: contestData.new_field, // Add here
}
```

### Styling

The search UI uses your existing design system:

- UI components from `app/components/ui/`
- TailwindCSS classes
- Follows your app's theme
- Custom search implementation (no longer uses InstantSearch UI)

## 🐛 Troubleshooting

### Common Issues

**"Function execution failed"**

- Check Appwrite Function logs in the console
- Verify environment variables are set correctly
- Ensure Meilisearch server is accessible from Appwrite

**"Forbidden" errors**

- Verify user is member of admin team for admin operations
- Check ADMIN_TEAM_ID environment variable

**"No results found"**

- Check if data was synced: `await syncContestsToMeilisearch()`
- Verify searchable attributes are configured via admin function
- Check Meilisearch server logs

**Function deployment issues**

- Ensure tar.gz files are created correctly
- Check function dependencies in package.json
- Verify function IDs are updated in api.ts

### Debug Mode

Add to your search screen for debugging:

```typescript
// Add this to see what's being searched
console.log('Search query:', searchQuery)
console.log('Search results:', searchState.hits)
console.log('Function response:', result)
```

Check Appwrite Function execution logs in the console for server-side debugging.

## 📚 Further Reading

- [Meilisearch Documentation](https://docs.meilisearch.com/)
- [React InstantSearch Documentation](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react/)
- [Meilisearch + InstantSearch Guide](https://github.com/meilisearch/meilisearch-js)
