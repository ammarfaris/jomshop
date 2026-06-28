# Search Localization and State Persistence Fix

## Overview

This document describes the fixes implemented for two critical issues in the search feature:
1. **Localization Issue**: Search results were displaying English text ("By") and category names in English even when the user selected Bahasa Malaysia
2. **State Persistence Issue**: When navigating to a contest detail page and clicking back, the search query and results were reset

## Issues Fixed

### Issue 1: Localization Not Working in Search Results

**Problem**: 
- The "By {host name(s)}" text was always showing "By" in English regardless of language preference
- Category names were always displayed in English even when user selected Bahasa Malaysia

**Root Cause**:
- The Meilisearch index was only storing English category names (`name_en`)
- The search screen wasn't fetching the user's language preference
- The Hit component wasn't using the `Trans` component for localization
- Category names weren't being selected based on language preference

**Solution**:

1. **Updated Meilisearch Admin Function** (`functions/meilisearch-admin/index.js`):
   - Modified `transformContestForMeilisearch()` to index both `category_names_en` and `category_names_ms`
   - Updated searchable attributes to include both language fields
   - Updated filterable attributes to include both language fields

2. **Updated Search Screen** (`packages/app/features/search/screen.tsx`):
   - Added language preference query using `useQuery` to fetch user's language setting from Appwrite preferences
   - Updated Contest type to include both `category_names_en` and `category_names_ms` fields
   - Modified search parameters to highlight both language fields
   - Updated facets to include both category name fields
   - Modified Hit component to:
     - Accept `language` prop
     - Use `Trans` component for "By" text localization
     - Select category names based on language preference
     - Display contest titles in user's preferred language (English/Malay with fallback)
   - Updated Filters component to:
     - Accept `language` prop
     - Display category filters in the user's preferred language

### Issue 2: Search State Not Persisting on Navigation

**Problem**:
- When clicking on a search result to view contest details, then clicking back, the search query and results were lost
- User had to re-enter their search query and wait for results to load again

**Root Cause**:
- Search state was stored only in React component state
- No mechanism to save/restore search state across navigation

**Solution**:

1. **Added State Persistence Functions**:
   - `saveSearchState()`: Saves current search state to storage
   - `getSearchState()`: Retrieves saved search state from storage
   - `clearSearchState()`: Clears saved search state
   - Uses platform-specific storage (localStorage for web, AsyncStorage for mobile)

2. **Implemented State Save on Navigation**:
   - Wrapped `navigateToContest` to save search state before navigating to contest detail
   - Saves: query, hits, filters, facets, offset, and hasMore flag

3. **Implemented State Restoration**:
   - Added useEffect hook to restore search state on component mount
   - Restores all search state including results, filters, and facets
   - Clears saved state after restoration to prevent stale data

## Files Modified

### 1. `/functions/meilisearch-admin/index.js`

**Changes**:
- Line 86-87: Added extraction of both English and Malay category names
- Line 103-104: Updated return object to include both `category_names_en` and `category_names_ms`
- Line 143-144: Added both category name fields to searchable attributes
- Line 151-152: Added both category name fields to filterable attributes

### 2. `/packages/app/features/search/screen.tsx`

**Changes**:
- Line 40: Added `useQuery` import from `@tanstack/react-query`
- Line 141: Updated attributesToHighlight to include both category name fields
- Line 330-331: Updated Contest type to include `category_names_en` and `category_names_ms`
- Line 337: Added `SEARCH_STATE_KEY` constant
- Line 321-360: Added search state persistence functions
- Line 416: Added `language` parameter to Filters component
- Line 566: Updated filter section to use language-specific category field
- Line 682: Added `language` parameter to Hit component
- Line 715-726: Updated host text formatting to use Trans component for localization
- Line 729-731: Added logic to select category names based on language preference
- Line 792: Updated category display to use localized category names
- Line 889-903: Added language preference query
- Line 971-992: Wrapped navigateToContest to save state before navigation
- Line 994-1020: Added effect to restore search state on mount
- Line 979-980: Updated search parameters to include both category name fields
- Line 1206: Passed language prop to Filters component
- Line 1237: Passed language prop to Hit component

## Testing Requirements

### Before Testing - Important Setup Steps

**CRITICAL**: The Meilisearch index must be re-synced after deploying the updated function:

1. **Deploy the Updated Function**:
   ```bash
   cd functions/meilisearch-admin
   tar --exclude='.DS_Store' --exclude='._*' -czf ../all-tar-manual-files/meilisearch-admin.tar.gz .
   ```
   Then upload the tar.gz file via Appwrite Console

2. **Re-sync the Meilisearch Index**:
   - After deploying the function, you MUST trigger a full sync
   - Use the Appwrite Console or API to call the function with:
     ```json
     {
       "action": "sync"
     }
     ```
   - This will re-index all contests with the new `category_names_en` and `category_names_ms` fields
   - Without this step, search results will not show localized category names

### Test Case 1: Localization

1. Sign in to the app
2. Go to Profile and change language to Bahasa Malaysia
3. Navigate to Search
4. Search for any contest
5. **Verify**:
   - "By" text should be translated to Bahasa Malaysia
   - Contest titles should be displayed in Bahasa Malaysia (if available, otherwise English)
   - Category names should be displayed in Bahasa Malaysia
   - Filter categories should be in Bahasa Malaysia

6. Change language back to English
7. **Verify**:
   - "By" text should be in English
   - Contest titles should be displayed in English
   - Category names should be in English
   - Filter categories should be in English

### Test Case 2: State Persistence

1. Navigate to Search
2. Enter a search query (e.g., "contest")
3. Wait for results to load
4. Apply some filters (e.g., select a category)
5. Click on any search result to view contest details
6. Click the back button
7. **Verify**:
   - Search query should still be in the search box
   - Search results should still be displayed
   - Applied filters should still be active
   - Scroll position should be maintained (web only)

### Test Case 3: Cross-Platform

Test on:
- Web browser
- iOS device/simulator
- Android device/emulator

Verify both localization and state persistence work correctly on all platforms.

## Search Fields

When users type in the search input, Meilisearch searches across these **7 fields**:

1. **`title`** - Contest title in English
2. **`title_ms`** - Contest title in Malay
3. **`summary`** - Contest summary in English
4. **`summary_ms`** - Contest summary in Malay
5. **`host_names`** - Names of contest organizers/hosts
6. **`category_names_en`** - Category names in English
7. **`category_names_ms`** - Category names in Malay

## Migration Notes

### For Existing Deployments

1. **Update the Meilisearch Admin Function**:
   - Deploy the updated `meilisearch-admin` function
   - The function is backward compatible and won't break existing searches

2. **Re-sync the Meilisearch Index**:
   - **REQUIRED**: After deploying the function, trigger a full sync using the `sync` action
   - This ensures all contests are re-indexed with both language fields
   - Existing searches will continue to work but won't show localized categories until sync is complete

3. **Update the App**:
   - Deploy the updated search screen
   - No database migrations required
   - No breaking changes to existing functionality

### Rollback Plan

If issues occur:

1. **Revert the Search Screen**:
   - The search screen changes are backward compatible
   - Can be reverted without affecting the Meilisearch index

2. **Revert the Meilisearch Function**:
   - If needed, redeploy the previous version
   - Re-sync the index with the old function
   - Note: This will remove localized category names from search results

## Performance Impact

- **Minimal**: Added one additional query for language preference (cached for 5 minutes)
- **Storage**: Negligible increase in search state storage (typically < 100KB per user)
- **Meilisearch Index**: Slight increase in index size due to storing both language fields
- **Search Performance**: No measurable impact on search speed

## Future Improvements

1. **Host Name Localization**: Currently host names are not localized. Consider adding `name_en` and `name_ms` fields to the hosts collection
2. **Title Localization**: Consider using `title` and `title_ms` fields from contests for search results
3. **State Persistence TTL**: Add expiration time for saved search state (e.g., clear after 1 hour)
4. **Partial State Restoration**: Allow users to choose whether to restore previous search or start fresh

## Related Documentation

- [Meilisearch Setup](../general/MEILISEARCH_SETUP.md)
- [Environment Variables](../general/ENVIRONMENT_VARIABLES.md)
- [Database Schema](../llms/appwrite/DATABASE.md)


