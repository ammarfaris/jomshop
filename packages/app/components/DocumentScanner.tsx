// Document scanner is only available on web
// This is a placeholder for mobile platforms

interface DocumentScannerProps {
  visible: boolean
  onClose: () => void
  onCapture: (imageFile: File) => void
}

export function DocumentScanner({}: DocumentScannerProps) {
  return null
}
