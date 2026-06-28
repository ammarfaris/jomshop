# Document Scanner Preview Feature

## Overview
Added a preview step before uploading scanned documents, allowing users to review and retake if needed.

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Camera View                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │         [Live Camera Feed]                           │   │
│  │                                                       │   │
│  │         Green highlights show                        │   │
│  │         detected document edges                      │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [Cancel]                              [Capture]            │
│  Green highlight indicates detected document edges          │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    User clicks "Capture"
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Preview Screen (NEW!)                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │         [Scanned Document Preview]                   │   │
│  │                                                       │   │
│  │         Perspective-corrected                        │   │
│  │         Clean, flat image                            │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Preview Scanned Document                                   │
│  [Retake]                              [Use This]           │
│  Review the scanned document before uploading               │
└─────────────────────────────────────────────────────────────┘
                          ↓
            User clicks "Use This"
                          ↓
        Document uploaded with CAPTCHA verification
```

## Features

### 1. **Preview Screen**
After capturing, users see:
- The extracted and perspective-corrected document
- Full-screen preview for detailed inspection
- Clear image quality check

### 2. **Retake Option**
If the scan isn't perfect:
- Click "Retake" to go back to camera view
- Camera resumes immediately
- No need to close and reopen the scanner

### 3. **Confirm Upload**
When satisfied:
- Click "Use This" to proceed
- Document goes through normal upload flow
- CAPTCHA verification still applies

## Implementation Details

### State Management
```typescript
// Preview state
const [showPreview, setShowPreview] = useState(false)
const [previewImage, setPreviewImage] = useState<string | null>(null)
const [previewFile, setPreviewFile] = useState<File | null>(null)
```

### Flow Control
1. **Capture**: 
   - Extracts document
   - Creates preview URL
   - Stops camera
   - Shows preview screen

2. **Retake**:
   - Cleans up preview
   - Restarts camera
   - Returns to camera view

3. **Confirm**:
   - Uploads the file
   - Closes scanner
   - Cleans up resources

### Memory Management
- Preview URLs are created with `URL.createObjectURL()`
- Properly cleaned up with `URL.revokeObjectURL()` on:
  - Retake
  - Close
  - Confirm upload
- Prevents memory leaks

## Benefits

### For Users
- ✅ **Confidence**: See exactly what will be uploaded
- ✅ **Quality Control**: Catch blurry or incorrect scans
- ✅ **No Wasted Uploads**: Only upload good scans
- ✅ **Better UX**: Clear feedback on scan quality

### For Developers
- ✅ **Reduced Bad Uploads**: Users self-filter poor quality scans
- ✅ **Better Data Quality**: Only good scans reach the server
- ✅ **Fewer Support Issues**: Users understand what was captured

## User Experience

### Before (No Preview)
1. Position document
2. Click capture
3. ❌ Document uploaded immediately
4. ❌ Can't review quality
5. ❌ Must delete and rescan if bad

### After (With Preview)
1. Position document
2. Click capture
3. ✅ **Review scanned result**
4. ✅ **Retake if needed**
5. ✅ **Only upload when satisfied**

## Testing Checklist

- [ ] Capture shows preview screen
- [ ] Preview displays the corrected document
- [ ] "Retake" returns to camera view
- [ ] Camera resumes after retake
- [ ] "Use This" uploads the document
- [ ] Preview cleans up on close
- [ ] No memory leaks (check DevTools)
- [ ] Works on mobile (via HTTPS/ngrok)

## Future Enhancements

Potential improvements:
- **Zoom/Pan**: Allow zooming into preview for detail inspection
- **Rotation**: Rotate preview if document orientation is wrong
- **Filters**: Apply brightness/contrast adjustments
- **Multiple Pages**: Scan multiple pages in one session
- **Comparison**: Show before/after (original vs corrected)

## Code Location

- **Component**: `packages/app/components/DocumentScanner.web.tsx`
- **Preview UI**: Lines 473-551
- **Handlers**: Lines 312-378

