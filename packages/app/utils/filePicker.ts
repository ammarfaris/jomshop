import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { Platform } from 'react-native'

/**
 * Standardized file object for receipts
 */
export interface ReceiptFile {
  uri: string
  name: string
  type: string // MIME type
  size?: number
}

/**
 * Result of file picker operations
 */
export interface FilePickerResult {
  success: boolean
  file?: ReceiptFile
  error?: string
}

/**
 * Pick images using expo-image-picker
 * Returns a standardized file object
 */
export async function pickImages(): Promise<FilePickerResult> {
  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== 'granted') {
      return {
        success: false,
        error: 'Permission to access media library is required',
      }
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8, // Compress to reduce file size
      allowsMultipleSelection: false, // Single file for now
    })

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return {
        success: false,
        error: 'Image selection canceled',
      }
    }

    const asset = result.assets[0]

    if (!asset) {
      return {
        success: false,
        error: 'No image selected',
      }
    }

    // Determine MIME type
    let mimeType = asset.mimeType || 'image/jpeg'
    if (!mimeType && asset.uri) {
      const extension = asset.uri.split('.').pop()?.toLowerCase()
      if (extension === 'png') mimeType = 'image/png'
      else if (extension === 'jpg' || extension === 'jpeg')
        mimeType = 'image/jpeg'
      else if (extension === 'webp') mimeType = 'image/webp'
      else if (extension === 'heic') mimeType = 'image/heic'
    }

    // Generate filename if not available
    const fileName =
      asset.fileName ||
      `receipt_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`

    return {
      success: true,
      file: {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
        size: asset.fileSize,
      },
    }
  } catch (error) {
    console.error('Image picker error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pick image',
    }
  }
}

/**
 * Pick documents (PDFs) using expo-document-picker
 * Returns a standardized file object
 */
export async function pickDocument(): Promise<FilePickerResult> {
  try {
    // Launch document picker (no permission request needed)
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    })

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return {
        success: false,
        error: 'Document selection canceled',
      }
    }

    const asset = result.assets[0]

    if (!asset) {
      return {
        success: false,
        error: 'No document selected',
      }
    }

    return {
      success: true,
      file: {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/pdf',
        size: asset.size,
      },
    }
  } catch (error) {
    console.error('Document picker error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pick document',
    }
  }
}

/**
 * Combined file picker that allows user to choose between image or PDF
 * On mobile, shows action sheet to choose
 * On web, can use native file input
 */
export async function pickReceiptFile(): Promise<FilePickerResult> {
  if (Platform.OS === 'web') {
    // On web, use document picker which can handle both images and PDFs
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: false,
        multiple: false,
      })

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return {
          success: false,
          error: 'File selection canceled',
        }
      }

      const asset = result.assets[0]

      if (!asset) {
        return {
          success: false,
          error: 'No file selected',
        }
      }

      return {
        success: true,
        file: {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        },
      }
    } catch (error) {
      console.error('File picker error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pick file',
      }
    }
  }

  // On native, default to image picker
  // User can separately choose PDF option if needed
  return pickImages()
}

/**
 * Validate file size (max 10MB)
 */
export function validateFileSize(file: ReceiptFile): {
  valid: boolean
  error?: string
} {
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

  if (file.size && file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size must be less than 10MB',
    }
  }

  return { valid: true }
}

/**
 * Validate file type
 */
export function validateFileType(file: ReceiptFile): {
  valid: boolean
  error?: string
} {
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
  ]

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'File type must be JPEG, PNG, WebP, HEIC, or PDF',
    }
  }

  return { valid: true }
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'application/pdf': 'pdf',
  }

  return map[mimeType] || 'file'
}

/**
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * Check if file is a PDF
 */
export function isPDFFile(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

/**
 * Pick a Markdown (.md / text) file using expo-document-picker.
 * Used by the contest admin "Import T&C from .md" feature.
 */
export async function pickMarkdownFile(): Promise<FilePickerResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      // Some browsers don't honor a non-standard "text/markdown" mime; we
      // include the .md extension and text/plain as fallbacks.
      type: ['text/markdown', 'text/plain', 'application/octet-stream', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    })

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: 'File selection canceled' }
    }
    const asset = result.assets[0]
    if (!asset) return { success: false, error: 'No file selected' }

    const name = asset.name || `imported-${Date.now()}.md`
    if (!/\.(md|markdown|txt)$/i.test(name)) {
      return {
        success: false,
        error: `Unsupported file type: ${name}. Please pick a .md, .markdown, or .txt file.`,
      }
    }

    return {
      success: true,
      file: {
        uri: asset.uri,
        name,
        type: asset.mimeType || 'text/markdown',
        size: asset.size,
      },
    }
  } catch (error) {
    console.error('Markdown picker error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to pick markdown file',
    }
  }
}

/**
 * Read a previously picked file's contents as UTF-8 text.
 * Works on both web (blob/data/file URLs) and native (file:// URIs)
 * by leaning on the universally-available `fetch` API.
 */
export async function readFileAsText(uri: string): Promise<string> {
  const r = await fetch(uri)
  return r.text()
}
