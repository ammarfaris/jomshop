import { useState, useRef, useEffect } from 'react'
import {
  View,
  Modal as RNModal,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from 'app/lib/utils'
import { XMarkOutline } from 'app/components/icons-svg/XMarkOutline'
import { useColorScheme } from 'app/hooks/useColorScheme'
import Colors from 'app/utils/constants/ConstColors'

interface DocumentScannerProps {
  visible: boolean
  onClose: () => void
  onCapture: (imageFile: File) => void
}

export function DocumentScanner({
  visible,
  onClose,
  onCapture,
}: DocumentScannerProps) {
  const { t } = useLingui()
  const { isDarkColorScheme } = useColorScheme()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const frameCountRef = useRef<number>(0) // Track frames for memory cleanup
  const scanStartTimeRef = useRef<number>(0) // Track scan duration
  const detectionFrameSkipRef = useRef<number>(0) // Skip detection to reduce CPU load
  const lastDetectedPointsRef = useRef<any>(null) // Keep last detected points to prevent blinking

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [scanner, setScanner] = useState<any>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opencvLoaded, setOpencvLoaded] = useState(false)
  const animationFrameRef = useRef<number | null>(null)

  // Preview state
  const [showPreview, setShowPreview] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)

  // Load OpenCV and initialize scanner
  useEffect(() => {
    if (!visible) return

    // Load eruda for mobile debugging (development only)
    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      const loadEruda = async () => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/eruda'
        script.onload = () => {
          ;(window as any).eruda?.init()
        }
        document.head.appendChild(script)
      }
      if (!(window as any).eruda) {
        loadEruda()
      }
    }

    const loadOpenCV = () => {
      return new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') {
          reject(new Error('Window not available'))
          return
        }

        // Check if OpenCV is already loaded
        if ((window as any).cv && (window as any).cv.Mat) {
          resolve()
          return
        }

        // Check if script already exists
        const existingScript = document.querySelector(
          'script[src*="opencv.js"]'
        )
        if (existingScript) {
          // Wait for it to load
          const checkOpenCV = setInterval(() => {
            if ((window as any).cv && (window as any).cv.Mat) {
              clearInterval(checkOpenCV)
              resolve()
            }
          }, 100)
          return
        }

        // Setup Module config before loading OpenCV
        ;(window as any).Module = {
          onRuntimeInitialized: () => {
            resolve()
          },
        }

        // Load OpenCV script
        const script = document.createElement('script')
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
        script.async = true
        script.onload = () => {
          // OpenCV needs a moment to initialize
          const checkOpenCV = setInterval(() => {
            if ((window as any).cv && (window as any).cv.Mat) {
              clearInterval(checkOpenCV)
              resolve()
            }
          }, 100)
          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkOpenCV)
            reject(new Error('OpenCV initialization timeout'))
          }, 10000)
        }
        script.onerror = () => reject(new Error('Failed to load OpenCV'))
        document.head.appendChild(script)
      })
    }

    const initScanner = async () => {
      try {
        setError(null)
        await loadOpenCV()

        // Dynamically import opencv-document-scanner
        const { DocumentScanner } = await import('opencv-document-scanner')
        const scannerInstance = new DocumentScanner()
        setScanner(scannerInstance)
        setOpencvLoaded(true)
      } catch (err) {
        console.error('Failed to initialize scanner:', err)
        setError(t`Failed to initialize scanner. Please try again.`)
      }
    }

    initScanner()
  }, [visible, t])

  // Start camera
  useEffect(() => {
    if (!visible || !opencvLoaded) return

    const startCamera = async () => {
      try {
        setError(null)

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const isLocalhost =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1'
          const isHTTPS = window.location.protocol === 'https:'

          if (!isHTTPS && !isLocalhost) {
            setError(
              t`Camera access requires HTTPS. Please use a secure connection (https://).`
            )
          } else if (!isHTTPS && isLocalhost) {
            setError(
              t`Camera access requires HTTPS on mobile browsers. Please use ngrok or deploy to a secure server for mobile testing.`
            )
          } else {
            setError(t`Camera access is not supported on this browser.`)
          }
          return
        }

        // Try with back camera - balanced resolution for quality and performance
        let mediaStream: MediaStream | null = null
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' }, // Prefer back camera
              width: { ideal: 960 }, // Reduced resolution for better stability on iOS
              height: { ideal: 540 },
              aspectRatio: { ideal: 16 / 9 },
              frameRate: { ideal: 24 }, // Lower frame rate to reduce processing
            },
          })
        } catch (err) {
          // Fallback: Try with any available camera
          console.log('Back camera not available, trying any camera:', err)
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 960 },
                height: { ideal: 540 },
                aspectRatio: { ideal: 16 / 9 },
              },
            })
          } catch (fallbackErr) {
            // Fallback: Try with basic constraints
            console.log('Trying basic camera constraints:', fallbackErr)
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: true,
            })
          }
        }

        if (!mediaStream) {
          throw new Error('Failed to get media stream')
        }

        setStream(mediaStream)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play()
          scanStartTimeRef.current = Date.now() // Track scan start time
          lastDetectedPointsRef.current = null // Clear last detected points on scan start
          setIsScanning(true)
        }
      } catch (err: any) {
        console.error('Camera access error:', err)

        // Provide specific error messages
        let errorMessage = t`Camera access denied. Please allow camera access to scan documents.`

        if (
          err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError'
        ) {
          errorMessage = t`Camera permission denied. Please allow camera access in your browser settings and reload the page.`
        } else if (
          err.name === 'NotFoundError' ||
          err.name === 'DevicesNotFoundError'
        ) {
          errorMessage = t`No camera found on this device.`
        } else if (
          err.name === 'NotReadableError' ||
          err.name === 'TrackStartError'
        ) {
          errorMessage = t`Camera is already in use by another application.`
        } else if (
          err.name === 'OverconstrainedError' ||
          err.name === 'ConstraintNotSatisfiedError'
        ) {
          errorMessage = t`Camera does not support the required settings.`
        } else if (err.name === 'NotSupportedError') {
          errorMessage = t`Camera access is not supported on this browser.`
        } else if (err.name === 'SecurityError') {
          errorMessage = t`Camera access blocked for security reasons. Please use HTTPS.`
        }

        setError(errorMessage)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [visible, opencvLoaded, t])

  // Expand detected points outward to include more of the document edges
  const expandPoints = (
    points: Array<{ x: number; y: number }>,
    width: number,
    height: number,
    bufferPercent: number = 5 // 5% buffer to capture edge details
  ): Array<{ x: number; y: number }> => {
    if (!points || points.length !== 4) return points

    // Calculate center point
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / 4
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / 4

    // Expand each point away from center with different factors for X and Y
    return points.map((point) => {
      const dx = point.x - centerX
      const dy = point.y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance === 0) return point

      // Use 5% for horizontal, 3% for vertical (less vertical expansion)
      const expandFactorX = 1 + bufferPercent / 100 // 5% horizontal
      const expandFactorY = 1 + (bufferPercent - 2) / 100 // 3% vertical

      const newX = centerX + dx * expandFactorX
      const newY = centerY + dy * expandFactorY

      // Clamp to canvas bounds
      return {
        x: Math.max(0, Math.min(width, newX)),
        y: Math.max(0, Math.min(height, newY)),
      }
    })
  }

  // Scanning loop
  useEffect(() => {
    if (
      !isScanning ||
      !scanner ||
      !videoRef.current ||
      !canvasRef.current ||
      !overlayCanvasRef.current
    ) {
      // Cancel any existing animation frame when stopping
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    const ctx = canvas.getContext('2d')
    const overlayCtx = overlayCanvas.getContext('2d')

    if (!ctx || !overlayCtx) return

    // Cancel any existing animation frame before starting new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const scan = () => {
      if (
        !isScanning ||
        !video.readyState ||
        video.readyState !== video.HAVE_ENOUGH_DATA
      ) {
        animationFrameRef.current = requestAnimationFrame(scan)
        return
      }

      // Safety check: Stop scanning after 60 seconds to prevent iOS Safari crashes
      const scanDuration = Date.now() - scanStartTimeRef.current
      if (scanDuration > 60000) {
        // 60 seconds (1 minute)
        console.warn(
          'Scan duration exceeded 60 seconds, stopping to prevent crash'
        )
        setIsScanning(false)
        setError(
          t`Scanner stopped after 60 seconds for stability. Please capture your receipt or close and restart.`
        )
        return
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      overlayCanvas.width = video.videoWidth
      overlayCanvas.height = video.videoHeight

      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Aggressive memory cleanup to prevent crashes (every 150 frames ~6 seconds at 24fps)
      frameCountRef.current++
      if (frameCountRef.current % 150 === 0) {
        try {
          // Force garbage collection by clearing canvases
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

          // Redraw current frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Reset frame counter to prevent overflow
          if (frameCountRef.current > 10000) {
            frameCountRef.current = 0
          }
        } catch (err) {
          console.warn('Memory cleanup warning:', err)
        }
      }

      // Skip detection every 3rd frame to reduce CPU/memory load
      detectionFrameSkipRef.current++
      const shouldDetect = detectionFrameSkipRef.current % 3 === 0

      try {
        let detectedPoints: any = null

        // Only run detection every 3rd frame, but use last detected points for other frames
        if (shouldDetect) {
          // Detect document boundaries (use default settings for better stability)
          detectedPoints = scanner.detect(canvas)
          // Store for next frames
          if (detectedPoints && detectedPoints.length === 4) {
            lastDetectedPointsRef.current = detectedPoints
          }
        } else {
          // Use last detected points to prevent blinking
          detectedPoints = lastDetectedPointsRef.current
        }

        // Clear overlay
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

        // Draw the video frame
        overlayCtx.drawImage(canvas, 0, 0)

        // Draw detected polygon if found
        if (detectedPoints && detectedPoints.length === 4) {
          // Expand points to show actual crop area (with buffer)
          const expandedPoints = expandPoints(
            detectedPoints,
            canvas.width,
            canvas.height,
            5 // 5% buffer to capture edge details
          )

          // Draw expanded polygon (what will actually be captured)
          if (expandedPoints && expandedPoints.length === 4) {
            overlayCtx.strokeStyle = '#00FF00' // Green
            overlayCtx.lineWidth = 4
            overlayCtx.beginPath()
            overlayCtx.moveTo(expandedPoints[0]!.x, expandedPoints[0]!.y)
            for (let i = 1; i < expandedPoints.length; i++) {
              overlayCtx.lineTo(expandedPoints[i]!.x, expandedPoints[i]!.y)
            }
            overlayCtx.closePath()
            overlayCtx.stroke()

            // Draw corner circles on expanded points
            overlayCtx.fillStyle = '#00FF00'
            expandedPoints.forEach((point) => {
              overlayCtx.beginPath()
              overlayCtx.arc(point.x, point.y, 8, 0, 2 * Math.PI)
              overlayCtx.fill()
            })
          }
        } else {
          // No document detected, just show the video
          overlayCtx.drawImage(canvas, 0, 0)
        }
      } catch (err) {
        // Detection failed, just show the video
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
        overlayCtx.drawImage(canvas, 0, 0)
      }

      animationFrameRef.current = requestAnimationFrame(scan)
    }

    scan()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isScanning, scanner])

  // Advanced image enhancement functions
  const enhanceDocument = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    // Create a new canvas for enhanced output
    const enhancedCanvas = document.createElement('canvas')
    enhancedCanvas.width = canvas.width
    enhancedCanvas.height = canvas.height
    const enhancedCtx = enhancedCanvas.getContext('2d')
    if (!enhancedCtx) return canvas

    // Get image data
    enhancedCtx.drawImage(canvas, 0, 0)
    const imageData = enhancedCtx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    )
    const data = imageData.data

    // Gentle enhancement: slight grayscale with moderate contrast
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0

      // Grayscale conversion
      const gray = 0.299 * r + 0.587 * g + 0.114 * b

      // Moderate contrast boost (less aggressive)
      const contrast = 1.15 // Reduced from 1.3
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      const enhanced = factor * (gray - 128) + 128

      // Clamp values (no harsh thresholding)
      const final = Math.min(255, Math.max(0, enhanced))

      data[i] = final
      data[i + 1] = final
      data[i + 2] = final
      // Alpha stays the same
    }

    // Apply gentle sharpening only (no denoising to avoid artifacts)
    const sharpenKernel = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0] // Gentler
    const sharpened = applyConvolution(
      imageData,
      sharpenKernel,
      canvas.width,
      canvas.height
    )

    enhancedCtx.putImageData(sharpened, 0, 0)

    return enhancedCanvas
  }

  const applyConvolution = (
    imageData: ImageData,
    kernel: number[],
    width: number,
    height: number
  ): ImageData => {
    const data = imageData.data
    const output = new ImageData(width, height)
    const outputData = output.data

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0,
          g = 0,
          b = 0

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            const weight = kernel[kernelIdx] ?? 0

            r += (data[idx] ?? 0) * weight
            g += (data[idx + 1] ?? 0) * weight
            b += (data[idx + 2] ?? 0) * weight
          }
        }

        const outIdx = (y * width + x) * 4
        outputData[outIdx] = Math.min(255, Math.max(0, r))
        outputData[outIdx + 1] = Math.min(255, Math.max(0, g))
        outputData[outIdx + 2] = Math.min(255, Math.max(0, b))
        outputData[outIdx + 3] = 255
      }
    }

    return output
  }

  const handleCapture = async () => {
    if (!scanner || !canvasRef.current || isCapturing) return

    setIsCapturing(true)
    try {
      const canvas = canvasRef.current

      // Detect points first
      const detectedPoints = scanner.detect(canvas)

      // Expand points to include more edge details
      let croppedCanvas: HTMLCanvasElement | null = null
      if (detectedPoints && detectedPoints.length === 4) {
        const expandedPoints = expandPoints(
          detectedPoints,
          canvas.width,
          canvas.height,
          5 // 5% buffer to capture edge details
        )
        // Crop with expanded points
        croppedCanvas = scanner.crop(canvas, expandedPoints)
      } else {
        // Fallback to normal crop
        croppedCanvas = scanner.crop(canvas)
      }

      if (!croppedCanvas) {
        throw new Error('Failed to crop document')
      }

      // Apply advanced enhancements (CamScanner-style)
      const enhancedCanvas = enhanceDocument(croppedCanvas)

      // Convert to blob then file with high quality
      const blob: Blob = await new Promise((resolve, reject) => {
        enhancedCanvas.toBlob(
          (b: Blob | null) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create blob'))
          },
          'image/jpeg',
          0.98 // Increased quality
        )
      })

      const file = new File([blob], `scanned-receipt-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      // Create preview URL
      const previewUrl = URL.createObjectURL(blob)

      // Stop scanning (but keep camera stream running)
      setIsScanning(false)
      setPreviewImage(previewUrl)
      setPreviewFile(file)
      setShowPreview(true)

      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // Aggressive cleanup after capture to free memory
      if (canvasRef.current && overlayCanvasRef.current) {
        const canvas = canvasRef.current
        const overlayCanvas = overlayCanvasRef.current
        const ctx = canvas.getContext('2d')
        const overlayCtx = overlayCanvas.getContext('2d')

        if (ctx && overlayCtx) {
          // Clear canvases
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

          // Force memory release by resetting dimensions
          canvas.width = 0
          canvas.height = 0
          overlayCanvas.width = 0
          overlayCanvas.height = 0
        }
      }
    } catch (err) {
      console.error('Capture error:', err)
      setError(
        t`Failed to capture document. Make sure the entire document is visible in the frame.`
      )
    } finally {
      setIsCapturing(false)
    }
  }

  const handleConfirmUpload = () => {
    if (previewFile) {
      onCapture(previewFile)
      handleClose()
    }
  }

  const handleRetake = async () => {
    console.log('=== RETAKE CLICKED ===')
    console.log('Video ref:', videoRef.current)
    console.log('Stream:', stream)
    console.log('Stream active:', stream?.active)

    // Clean up preview
    if (previewImage) {
      URL.revokeObjectURL(previewImage)
    }
    setPreviewImage(null)
    setPreviewFile(null)
    setShowPreview(false)

    // Ensure video is playing
    if (videoRef.current && stream) {
      try {
        console.log('Video srcObject before:', videoRef.current.srcObject)

        // Make sure video element has the stream
        if (!videoRef.current.srcObject) {
          console.log('Re-assigning srcObject')
          videoRef.current.srcObject = stream
        }

        console.log('Video paused:', videoRef.current.paused)
        console.log('Video readyState:', videoRef.current.readyState)

        // Play the video
        await videoRef.current.play()
        console.log('Video play() called successfully')

        // Resume scanning
        console.log('Setting isScanning to true')
        setIsScanning(true)
      } catch (err) {
        console.error('Failed to resume video:', err)
        setError(t`Failed to resume camera. Please try again.`)
      }
    } else {
      console.log('No video ref or stream, just setting isScanning')
      // Camera stream lost, need to restart
      setIsScanning(true)
    }
  }

  const handleClose = () => {
    setIsScanning(false)
    setShowPreview(false)

    // Clean up preview
    if (previewImage) {
      URL.revokeObjectURL(previewImage)
    }
    setPreviewImage(null)
    setPreviewFile(null)

    // Clean up camera stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Clean up canvases to free memory
    try {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
        canvasRef.current.width = 0
        canvasRef.current.height = 0
      }
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            overlayCanvasRef.current.width,
            overlayCanvasRef.current.height
          )
        }
        overlayCanvasRef.current.width = 0
        overlayCanvasRef.current.height = 0
      }
    } catch (err) {
      console.error('Error cleaning up canvases:', err)
    }

    onClose()
  }

  if (!visible) return null

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
    >
      <View
        className="flex-1 bg-black"
        // @ts-ignore - touchAction is web-only
        style={{ touchAction: 'pan-y' }}
      >
        {/* Header - Compact for maximum camera view */}
        <View className="bg-black/30 px-4 py-2 absolute top-0 left-0 right-0 z-10">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-white">
              <Trans>Scan Document</Trans>
            </Text>
            <Pressable onPress={handleClose} className="p-2 -mr-2">
              <XMarkOutline className="w-6 h-6 text-white" />
            </Pressable>
          </View>
        </View>

        {/* Hidden video element - always mounted */}
        <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

        {/* Hidden canvas for processing - always mounted */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Camera View */}
        {!showPreview && (
          <View className="flex-1 items-center justify-center relative">
            {!opencvLoaded && (
              <View className="absolute inset-0 items-center justify-center bg-black">
                <ActivityIndicator
                  size="large"
                  color={
                    isDarkColorScheme ? Colors.dark.tint : Colors.light.tint
                  }
                />
                <Text className="text-white mt-4">
                  <Trans>Initializing scanner...</Trans>
                </Text>
              </View>
            )}

            {error && (
              <View className="absolute inset-0 items-center justify-center bg-black px-8">
                <Text className="text-red-400 text-center text-lg">
                  {error}
                </Text>
                <Button
                  onPress={handleClose}
                  variant="outline"
                  className="mt-6"
                >
                  <Text>
                    <Trans>Close</Trans>
                  </Text>
                </Button>
              </View>
            )}

            {/* Overlay canvas display with detected boundaries */}
            <canvas
              ref={overlayCanvasRef}
              className="max-w-full max-h-full"
              style={{
                objectFit: 'contain',
                width: '100%',
                height: '100%',
              }}
            />
          </View>
        )}

        {/* Preview View */}
        {showPreview && previewImage && (
          <View
            className="flex-1 items-center justify-center bg-black"
            // @ts-ignore - touchAction is web-only
            style={{ touchAction: 'none' }}
          >
            <img
              src={previewImage}
              alt="Scanned document preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                touchAction: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          </View>
        )}

        {/* Camera Controls - Compact */}
        {!showPreview && opencvLoaded && !error && (
          <View className="bg-black/30 px-6 py-4 absolute bottom-0 left-0 right-0">
            <View className="flex-row items-center justify-center gap-4">
              <Button
                onPress={handleClose}
                variant="outline"
                className="flex-1 max-w-xs"
                disabled={isCapturing}
              >
                <Text>
                  <Trans>Cancel</Trans>
                </Text>
              </Button>
              <Button
                onPress={handleCapture}
                className={cn('flex-1 max-w-xs', isCapturing && 'opacity-70')}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text>
                    <Trans>Capture</Trans>
                  </Text>
                )}
              </Button>
            </View>
            <Text className="text-gray-300 text-xs text-center mt-2">
              <Trans>
                💡 Hold camera directly above receipt, keep steady & get closer.
                If you are not satisfied, use normal camera via "Add Image
                Receipt" button or app like CamScanner.
              </Trans>
            </Text>
          </View>
        )}

        {/* Preview Controls - Compact */}
        {showPreview && (
          <View className="bg-black/30 px-6 py-4 absolute bottom-0 left-0 right-0">
            <View className="flex-row items-center justify-center gap-4">
              <Button
                onPress={handleRetake}
                variant="outline"
                className="flex-1 max-w-xs"
              >
                <Text>
                  <Trans>Retake</Trans>
                </Text>
              </Button>
              <Button onPress={handleConfirmUpload} className="flex-1 max-w-xs">
                <Text>
                  <Trans>Use This</Trans>
                </Text>
              </Button>
            </View>
            <Text className="text-gray-400 text-xs text-center mt-2">
              <Trans>Review before uploading</Trans>
            </Text>
          </View>
        )}
      </View>
    </RNModal>
  )
}
