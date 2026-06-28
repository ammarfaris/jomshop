# SVG Host Image Display Fix

## Problem

Host images (including SVG files) were not displaying correctly on web browsers, while they worked fine on iOS/Android native apps. The issue manifested as:

1. **Contest Cards (Web)**: Host logos showed only blurhash placeholder and never loaded the actual image
2. **Host Manager Modal (Web)**: Host images in the selection list showed only blurhash
3. **Contest Detail Screen (Web)**: Host images failed to render
4. **Preview worked**: Interestingly, when picking a new image in the edit/create flow, the local preview worked fine

## Root Cause

The issue was caused by the Appwrite Storage API's `/view` endpoint not properly serving SVG files with correct Content-Type headers for web browsers. When using `expo-image` on web with the `/view` endpoint:

- **Native (iOS/Android)**: The image loads correctly because native image loaders are more forgiving
- **Web**: Browsers strictly enforce Content-Type headers, and SVGs served via `/view` without proper headers fail to render

Additionally, the preview worked because it was using local blob URLs (`blob:http://...`) which have correct MIME types already set by the browser.

## Solution

Created a centralized `HostImage` component that intelligently handles host images across platforms:

### Key Changes

1. **Created `packages/app/components/HostImage.tsx`**
   - Centralized host image rendering logic
   - Platform-specific URL handling
   - Proper SVG support on web using `/download` endpoint

2. **Platform-Specific Endpoint Selection**
   ```typescript
   if (Platform.OS === 'web') {
     // Use /download endpoint which properly serves SVGs with correct Content-Type
     src.uri = `${baseUri}/download?project=${APPWRITE_PROJECT_ID}${
       imgTokenSecret ? `&token=${imgTokenSecret}` : ''
     }`
   } else if (Platform.OS === 'android' && jwt) {
     // Android: Use JWT header authentication with /view
     src.uri = `${baseUri}/view?project=${APPWRITE_PROJECT_ID}`
     src.headers = { 'X-Appwrite-JWT': jwt }
   } else {
     // iOS/Android without JWT: Use token in URL with /view
     src.uri = `${baseUri}/view?project=${APPWRITE_PROJECT_ID}${
       imgTokenSecret ? `&token=${imgTokenSecret}` : ''
     }`
   }
   ```

3. **Updated All Host Image References**
   - `packages/app/features/admin/HostManagerModal.tsx` - 2 locations (web list + native ScrollView)
   - `packages/app/features/contest/components/ContestCard.tsx` - Host logos in card header
   - `packages/app/features/contest/ContestDetailScreen.tsx` - Host images row
   - `packages/app/features/admin/EditContestTabContent.tsx` - Selected host badges
   - `packages/app/features/admin/CreateContestTabContent.tsx` - Selected host badges

## Technical Details

### Why `/download` vs `/view`?

- **`/view` endpoint**: Designed for embedding in HTML (e.g., `<img>` tags), but doesn't always set correct Content-Type for SVGs
- **`/download` endpoint**: Serves files with proper Content-Type headers and CORS headers, making it more reliable for programmatic image loading

### Component API

```typescript
<HostImage
  imgId={string}                    // Required: Appwrite file ID
  imgTokenSecret={string | null}    // Optional: Token for auth
  imgBlurhash={string}               // Optional: Blurhash placeholder
  width={number}                     // Required: Image width
  height={number}                    // Required: Image height
  borderRadius={number}              // Optional: Border radius (default: 6)
  contentFit={'contain' | 'cover'}   // Optional: Fit mode (default: 'contain')
  style={any}                        // Optional: Additional styles
  jwt={string | null}                // Optional: JWT for Android auth
/>
```

### Benefits

1. **Consistent Behavior**: Same component works across web and native
2. **SVG Support**: SVGs now load correctly on web browsers
3. **Maintainability**: Single source of truth for host image rendering
4. **Performance**: Proper caching policy (`memory-disk`) and smooth transitions
5. **Authentication**: Handles token-based and JWT-based auth correctly per platform

## Testing Checklist

- [x] Host images display in Contest Cards (web)
- [x] Host images display in Host Manager Modal (web)
- [x] Host images display in Contest Detail Screen (web)
- [x] Host images display in Admin Create/Edit forms (web)
- [ ] Verify host images still work on iOS
- [ ] Verify host images still work on Android
- [ ] Test with both PNG and SVG host logos
- [ ] Test with and without authentication tokens

## Files Modified

1. **New File**: `packages/app/components/HostImage.tsx`
2. `packages/app/features/admin/HostManagerModal.tsx`
3. `packages/app/features/contest/components/ContestCard.tsx`
4. `packages/app/features/contest/ContestDetailScreen.tsx`
5. `packages/app/features/admin/EditContestTabContent.tsx`
6. `packages/app/features/admin/CreateContestTabContent.tsx`

## Migration Notes

If you need to render host images elsewhere in the app, use the new `HostImage` component instead of directly using `ExpoImage` with Appwrite URLs.

**Before:**
```typescript
<ExpoImage
  source={{
    uri: `${APPWRITE_ENDPOINT}/storage/buckets/${CONTEST_HOSTS_BUCKET_ID}/files/${host.img_id}/view?project=${APPWRITE_PROJECT_ID}&token=${host.img_token_secret}`
  }}
  style={{ width: 50, height: 50 }}
  contentFit="contain"
  placeholder={{ blurhash: host.img_blurhash }}
/>
```

**After:**
```typescript
<HostImage
  imgId={host.img_id}
  imgTokenSecret={host.img_token_secret}
  imgBlurhash={host.img_blurhash}
  width={50}
  height={50}
  contentFit="contain"
/>
```

## Related Issues

- Host images showing only blurhash on web
- SVG files not rendering in browsers
- Inconsistent image loading across platforms

## Mobile Browser SVG Sharpness Fix (Final Solution)

### Discovery
After testing multiple CSS approaches that didn't work, we discovered:
- ✅ **Android mobile browsers**: Sharp SVGs at 50x50px
- ❌ **iOS Safari mobile**: Blurry SVGs at 50x50px
- ✅ **Desktop browsers**: Already sharp, no issue
- 🔍 **renderScale testing**: Only affects mobile browsers, no impact on desktop

### Root Cause
Mobile browsers (especially iOS Safari) have aggressive SVG rendering optimization that causes blur at small sizes. Desktop browsers don't have this issue.

### Final Solution: Mobile-Only 2x Rendering

**Strategy**: Render SVGs at 2x resolution on mobile browsers only, then scale down with CSS transform.

```javascript
// Detect mobile browser
const isMobileBrowser = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const renderScale = isMobileBrowser ? 2 : 1

// Mobile: Render at 100x100px, scale to 50x50px (2x detail)
// Desktop: Render normally at 50x50px (already sharp)
```

**Why This Works:**
1. **Mobile browsers** get 2x SVG rendering → sharper display
2. **Desktop browsers** skip the overhead → better performance
3. **Display size**: Still 50x50px (no space sacrifice)
4. **Internal rendering**: 100x100px on mobile only

### Implementation Details

**Mobile Path:**
```
Container (50x50px) → SVG renders at 100x100px → transform: scale(0.5) → Sharp!
```

**Desktop Path:**
```
Direct render at 50x50px (already sharp, no transform needed)
```

### Result

- ✅ **iOS Safari mobile**: Sharp SVG logos (2x rendering)
- ✅ **Android mobile**: Sharp SVGs (2x rendering, was already decent)
- ✅ **Desktop Chrome/Safari**: Sharp (normal rendering, no overhead)
- ✅ **50x50px maintained**: No space sacrifice
- ✅ **Performance**: Desktop avoids unnecessary transforms

### Files Modified

1. `packages/app/components/HostImage.tsx` - Mobile-specific 2x rendering

## Future Improvements

1. Consider adding error fallback UI when image fails to load
2. Add support for custom placeholder components
3. Add loading state indicator for slow network connections
4. Consider lazy loading for lists with many host images
5. Monitor if tablet detection is needed (currently treated as mobile)

