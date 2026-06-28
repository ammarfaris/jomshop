# Document Scanner Feature

## Overview
Added a real-time document scanner feature for web platforms using [opencv-document-scanner](https://github.com/tony-xlh/opencvjs-document-scanner). This allows users to scan physical receipts using their device camera with automatic paper detection and perspective correction.

## Features
- **Real-time paper detection**: Highlights document edges in green as the camera detects them
- **Automatic perspective correction**: Transforms the captured document to a flat, rectangular image
- **Professional quality enhancements**: CamScanner-style image processing (grayscale, contrast, sharpening, denoising)
- **High-resolution capture**: 1920x1080 (Full HD) camera capture for maximum detail
- **Preview before upload**: Review the scanned document and retake if needed before uploading
- **Web-only**: Only available on web browsers (disabled on mobile native apps)
- **Integrated with receipt upload flow**: Scanned documents follow the same upload process with CAPTCHA verification

## Implementation

### Files Created
1. **`packages/app/components/DocumentScanner.web.tsx`**: Main scanner component for web
   - Uses jscanify for document detection and extraction
   - Loads OpenCV.js dynamically (required by jscanify)
   - Real-time camera preview with paper highlighting
   - Handles camera permissions and errors

2. **`packages/app/components/DocumentScanner.tsx`**: Placeholder for mobile (returns null)

### Files Modified
1. **`packages/app/features/profile/components/ReceiptManagerModal.tsx`**:
   - Added "Scan Document" button next to "Add Image Receipt" (web only)
   - Buttons appear side-by-side in a flex-row layout on web
   - Added scanner modal state and handlers
   - Integrated scanned documents with existing upload flow

2. **`packages/app/package.json`**:
   - Added `jscanify@1.4.0` dependency

## Usage

### For Users (Web Only)
1. Open the Receipt Manager modal
2. Expand "Add New Receipt" section
3. Click "Scan Document" button (appears next to "Add Image Receipt")
4. Allow camera access when prompted
5. Position the document within the camera frame
6. Green highlights will appear when the document is detected
7. Click "Capture" to scan the document
8. **Preview the scanned document** - review the result
9. Click "Retake" if you want to scan again, or "Use This" to proceed
10. The scanned image will be uploaded with CAPTCHA verification

### Technical Details

#### opencv-document-scanner Integration
- **OpenCV.js**: Loaded dynamically from CDN (https://docs.opencv.org/4.8.0/opencv.js)
- **Paper Detection**: Uses `scanner.detect()` to find document boundaries
- **Document Extraction**: Uses `scanner.crop()` to extract and correct perspective
- **Output Format**: JPEG at 95% quality
- **Visual Feedback**: Green polygon overlay shows detected document edges with corner markers

#### Scanner Component Props
```typescript
interface DocumentScannerProps {
  visible: boolean
  onClose: () => void
  onCapture: (imageFile: File) => void
}
```

#### Camera Configuration
- Facing mode: `environment` (back camera preferred)
- Ideal resolution: 1280x720
- Real-time processing at ~10fps (requestAnimationFrame)

## Platform Support
- ✅ **Web**: Full support with camera access
- ❌ **iOS**: Not available (button hidden)
- ❌ **Android**: Not available (button hidden)

## Dependencies
- `opencv-document-scanner@1.2.2`: Document scanning library
- OpenCV.js 4.8.0: Computer vision (loaded via CDN)

## Security
- Requires CAPTCHA verification before upload (same as other receipt uploads)
- Camera access requires user permission
- All uploads subject to file size and type validation

## Future Enhancements
- Mobile native support using react-native-camera or expo-camera
- Multiple document capture in one session
- Manual corner adjustment for difficult documents
- Image enhancement filters (brightness, contrast, etc.)
- Offline OpenCV loading for faster initialization

## Testing
To test the feature:
1. Run the web app: `yarn dev` (in apps/next)
2. Navigate to a contest and open "Manage Receipts"
3. Click "Add New Receipt"
4. Click "Scan Document" button
5. Allow camera access
6. Test with a physical document/receipt
7. Verify the captured image is correctly processed and uploaded

## Known Issues
- OpenCV.js takes 2-5 seconds to load on first use
- Requires good lighting for accurate detection
- May struggle with documents on busy backgrounds
- Camera access may be blocked by browser privacy settings

## Additional Documentation
- **[QUALITY_ENHANCEMENTS.md](./QUALITY_ENHANCEMENTS.md)**: Detailed explanation of image enhancement pipeline
- **[PREVIEW_FEATURE.md](./PREVIEW_FEATURE.md)**: Preview step implementation details
- **[MOBILE_TESTING.md](./MOBILE_TESTING.md)**: Guide for testing on mobile browsers
- **[LIBRARY_SWAP.md](./LIBRARY_SWAP.md)**: Why we switched from jscanify to opencv-document-scanner

## References
- [opencv-document-scanner GitHub](https://github.com/tony-xlh/opencvjs-document-scanner)
- [opencv-document-scanner npm](https://www.npmjs.com/package/opencv-document-scanner)
- [OpenCV.js Documentation](https://docs.opencv.org/4.8.0/d5/d10/tutorial_js_root.html)
- [Blog: Web Document Scanner with OpenCV.js](https://www.dynamsoft.com/codepool/web-document-scanner-opencv-js.html)
- [CamScanner](https://www.camscanner.com/) - Industry standard for comparison

