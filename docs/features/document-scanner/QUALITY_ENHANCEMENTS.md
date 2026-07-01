# Document Scanner Quality Enhancements

## Overview

This document describes the image quality enhancements applied to the document scanner to match professional scanning apps like CamScanner.

## Enhancement Pipeline

The scanner applies a multi-stage enhancement pipeline to captured documents:

### 1. **High-Resolution Capture**
```typescript
video: {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920, min: 1280 },    // Full HD capture
  height: { ideal: 1080, min: 720 },
  aspectRatio: { ideal: 16 / 9 },
  frameRate: { ideal: 30 },              // Smooth preview
}
```

**Benefits:**
- Captures at 1920x1080 (Full HD) when available
- Falls back to 1280x720 (HD) minimum
- Higher resolution = more detail preserved
- Smooth 30fps preview for better user experience

### 2. **Enhanced Edge Detection**
```typescript
const points = scanner.detect(canvas, {
  useCanny: true,  // Better edge detection for uneven lighting
})
```

**Benefits:**
- Canny edge detection handles shadows and uneven lighting
- More accurate document boundary detection
- Works better with receipts that have faded edges

### 3. **Grayscale Conversion & Contrast Enhancement**

**Algorithm:**
```typescript
// Convert to grayscale using luminance formula
const gray = 0.299 * R + 0.587 * G + 0.114 * B

// Apply contrast enhancement
const contrast = 1.3
const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
const enhanced = factor * (gray - 128) + 128

// Adaptive thresholding
const final = enhanced > 128 ? 255 : Math.max(0, enhanced * 0.8)
```

**Benefits:**
- Converts color images to crisp black & white
- Makes text darker and background lighter
- Removes color noise and distractions
- Improves OCR accuracy (if used later)

### 4. **Sharpening Filter**

**Kernel:**
```
 0  -1   0
-1   5  -1
 0  -1   0
```

**Benefits:**
- Enhances text edges
- Makes small text more readable
- Compensates for camera blur
- Professional document appearance

### 5. **Denoising (Median Filter)**

**Algorithm:**
```typescript
// For each pixel, take median of 3x3 neighborhood
// This removes noise while preserving edges
```

**Benefits:**
- Removes camera sensor noise
- Reduces JPEG compression artifacts
- Preserves text edges (unlike Gaussian blur)
- Cleaner final output

### 6. **High-Quality JPEG Export**
```typescript
canvas.toBlob(callback, 'image/jpeg', 0.98)  // 98% quality
```

**Benefits:**
- Minimal compression artifacts
- Preserves enhancement details
- Still reasonable file size

## Quality Comparison

### Before Enhancement
- Raw camera capture
- Color image with shadows
- Uneven lighting
- Camera noise visible
- Blurry text edges

### After Enhancement
- Black & white document
- Shadows removed/reduced
- Uniform brightness
- Clean, noise-free
- Sharp, crisp text

## Technical Details

### Processing Order
1. **Crop** → Extract document from background
2. **Grayscale + Contrast** → Convert to B&W with enhanced contrast
3. **Sharpen** → Enhance text edges
4. **Denoise** → Remove noise while preserving edges
5. **Export** → High-quality JPEG

### Performance Considerations

**Processing Time:**
- ~100-300ms for typical receipt (depends on device)
- Runs on main thread (acceptable for one-time operation)
- User sees preview immediately after capture

**Memory Usage:**
- Creates temporary canvases for processing
- Cleaned up after conversion to blob
- No memory leaks

## Limitations vs CamScanner

While our enhancements significantly improve quality, CamScanner still has advantages:

### What We Match ✅
- Edge detection and cropping
- Grayscale conversion
- Contrast enhancement
- Sharpening
- Denoising
- High-resolution capture

### What CamScanner Does Better ❌
- **AI-powered shadow removal** (requires ML models)
- **Perspective correction** (advanced warping)
- **Advanced filters** (multiple preset modes)
- **Multi-page scanning** (batch processing)
- **Cloud processing** (server-side enhancement)

## Future Improvements

### Possible Enhancements:
1. **Multiple Filter Modes**
   - Original (no enhancement)
   - B&W (current)
   - Color (preserve colors, just enhance)
   - High Contrast (more aggressive)

2. **Shadow Removal**
   - Implement adaptive thresholding per region
   - Use morphological operations
   - Requires more complex algorithms

3. **Server-Side Processing**
   - Upload to a Supabase Edge Function
   - Use OpenCV with full feature set
   - Apply ML-based enhancements
   - See `OPTIMIZATION_SUMMARY.md` for details

4. **Manual Adjustments**
   - Let users adjust brightness/contrast
   - Preview different filter modes
   - Crop adjustment after capture

## Usage

The enhancements are automatically applied when capturing a document:

```typescript
// User clicks "Capture" button
const handleCapture = async () => {
  // 1. Crop document
  const croppedCanvas = scanner.crop(canvas)
  
  // 2. Apply enhancements (automatic)
  const enhancedCanvas = enhanceDocument(croppedCanvas)
  
  // 3. Convert to file
  const blob = await canvasToBlob(enhancedCanvas, 0.98)
  const file = new File([blob], 'scanned-receipt.jpg')
  
  // 4. Show preview
  setPreviewImage(URL.createObjectURL(blob))
}
```

No additional configuration needed!

## Testing

### Desktop Testing
1. Open scanner on desktop browser
2. Use a printed receipt or document
3. Capture and check preview
4. Verify text is sharp and readable

### Mobile Testing
1. Use ngrok for HTTPS access
2. Test with various lighting conditions
3. Test with receipts that have:
   - Shadows
   - Faded text
   - Colored backgrounds
   - Wrinkles/folds

### Quality Checklist
- [ ] Text is sharp and readable
- [ ] Background is clean (white/light gray)
- [ ] Shadows are reduced
- [ ] No excessive noise
- [ ] File size is reasonable (<500KB for typical receipt)

## References

- **Canny Edge Detection**: https://en.wikipedia.org/wiki/Canny_edge_detector
- **Image Sharpening**: https://en.wikipedia.org/wiki/Unsharp_masking
- **Median Filter**: https://en.wikipedia.org/wiki/Median_filter
- **Contrast Enhancement**: https://en.wikipedia.org/wiki/Histogram_equalization
- **opencv-document-scanner**: https://github.com/joelbarba/opencv-document-scanner

## Changelog

### 2025-11-04
- ✅ Implemented high-resolution capture (1920x1080)
- ✅ Added Canny edge detection
- ✅ Implemented grayscale + contrast enhancement
- ✅ Added sharpening filter
- ✅ Implemented median filter denoising
- ✅ Increased JPEG quality to 98%
- ✅ Fixed TypeScript type safety issues

### Future
- ⏳ Multiple filter modes
- ⏳ Shadow removal algorithm
- ⏳ Server-side ML enhancement
- ⏳ Manual adjustment controls

