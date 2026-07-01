import { useState, useMemo } from 'react'
import {
  ScrollView,
  View,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { Permission, Role } from 'app/lib/appwrite-universal'
import { Image as ExpoImage } from 'expo-image'

import { Button } from 'app/components/ui/button'
import { Input } from 'app/components/ui/input'
import { Textarea } from 'app/components/ui/textarea'
import { Text } from 'app/components/ui/text'
import { Label } from 'app/components/ui/label'
import { Badge } from 'app/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'app/components/ui/select'

import { tablesDB, storage, functions } from 'app/provider/appwrite/api'
import * as ImagePicker from 'expo-image-picker'
import {
  DATABASE_ID,
  CONTESTS_COLLECTION_ID,
  CONTESTS_BUCKET_ID,
  GENERATE_IMG_BLURHASH_IMG_TOKEN_FN_ID,
  ADMIN_TEAM_ID,
  CONTEST_TRANSLATIONS_COLLECTION_ID,
} from 'app/provider/appwrite/constants'
import { BACKEND } from 'app/lib/backend'
import { createSupabaseContest } from 'app/lib/supabase/admin'
import SingleDateTimePicker from 'app/components/SingleDateTimePicker'
import SingleDateTimePickerMobile from 'app/components/SingleDateTimePickerMobile'
import { addContestToMeilisearch } from 'app/lib/meilisearch/api'
import HostManagerModal, { HostDoc as HostModalDoc } from './HostManagerModal'
import CategoryManagerModal, {
  CategoryDoc as CategoryModalDoc,
} from './CategoryManagerModal'
import { toast } from 'app/lib/sonner-universal'
import {
  createContestSchema,
  CreateContestFormData,
} from './createContestSchema'
import { DraggableHostBadge } from 'app/components/admin/DraggableHostBadge'
import { DraggableCategoryBadge } from 'app/components/admin/DraggableCategoryBadge'
import { detectSuspiciousLineBreaks } from 'app/utils/lineBreakDetection'
import { pickMarkdownFile, readFileAsText } from 'app/utils/filePicker'
import {
  parseContestMarkdown,
  buildContestMarkdownTemplate,
  CONTEST_MD_SECTION_KEYS,
} from './contestMarkdownIO'
import { copyToClipboard } from 'app/lib/clipboard'

interface CreateContestTabContentProps {
  user: any
  isDarkColorScheme: boolean
  containerMaxWidth: number
  isDesktopLayout: boolean
}

const ENGLISH_INPUT_CLASSNAME_WEB =
  'border border-main focus:border-main focus:ring-1 focus:ring-main'
const ENGLISH_INPUT_CLASSNAME_NATIVE = 'border focus:ring-1'

export default function CreateContestTabContent({
  user,
  isDarkColorScheme,
  containerMaxWidth,
  isDesktopLayout,
}: CreateContestTabContentProps) {
  const { main, mainForeground } = useColorThemeValues(isDarkColorScheme)

  // Helper functions
  const getDefaultStartDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}T00:00:00`
  }

  const getDefaultEndDate = () => {
    const today = new Date()
    const threeMonthsFromToday = new Date(
      today.getFullYear(),
      today.getMonth() + 3,
      today.getDate()
    )
    const year = threeMonthsFromToday.getFullYear()
    const month = String(threeMonthsFromToday.getMonth() + 1).padStart(2, '0')
    const day = String(threeMonthsFromToday.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}T23:59:00`
  }

  const slugify = (value: string): string => {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
    trigger,
  } = useForm<CreateContestFormData>({
    resolver: valibotResolver(createContestSchema),
    defaultValues: {
      title: '',
      title_ms: '',
      summary: 'Summary powered by AI ✨',
      summary_ms: 'Rumusan dikuasakan oleh AI ✨',
      start_date: getDefaultStartDate(),
      end_date: getDefaultEndDate(),
      slug: '',
      total_prizes_value_rm: '',
      link_aff_shopee: '',
      link_aff_lazada: '',
      link_aff_tiktok_shop: '',
      link_media_instagram: '',
      link_media_facebook: '',
      link_media_tiktok: '',
      link_media_x: '',
      visibility: 'users',
      link_media_youtube: '',
      link_media_linkedin: '',
      link_media_website: '',
      prizes_en: '',
      prizes_ms: '',
      link_tnc_en: '',
      link_tnc_ms: '',
      link_faq_en: '',
      link_faq_ms: '',
      eligible_products_en: '',
      eligible_products_ms: '',
      eligible_participants_en: '',
      eligible_participants_ms: '',
      eligible_participants_exclusion_en: '',
      eligible_participants_exclusion_ms: '',
      eligible_stores_en: '',
      eligible_stores_ms: '',
      winners_selection_method_en: '',
      winners_selection_method_ms: '',
      winners_comm_and_timeline_en: '',
      winners_comm_and_timeline_ms: '',
      entry_method_en: '',
      entry_method_ms: '',
      winners_list_and_announcement_en: '',
      winners_list_and_announcement_ms: '',
    },
  })

  // Watch form values for slug generation
  const watchTitle = watch('title')
  const watchStartDate = watch('start_date')
  const watchEndDate = watch('end_date')

  // UI state
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isExpandedMode, setIsExpandedMode] = useState(true)

  // Image state
  const [galleryAssets, setGalleryAssets] = useState<any[]>([])
  const [galleryUris, setGalleryUris] = useState<string[]>([])
  const [mainUri, setMainUri] = useState<string | null>(null)

  // Host and category state
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([])
  const [hostModalOpen, setHostModalOpen] = useState(false)
  const [selectedHostDocs, setSelectedHostDocs] = useState<HostModalDoc[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [selectedCategoryDocs, setSelectedCategoryDocs] = useState<
    CategoryModalDoc[]
  >([])

  const selectedHosts = selectedHostDocs
  const selectedCategories = selectedCategoryDocs

  // Drag and drop instance IDs (for web only)
  const hostInstanceId = useMemo(() => Symbol('hosts'), [])
  const categoryInstanceId = useMemo(() => Symbol('categories'), [])

  // Reorder functions for drag and drop
  const handleHostReorder = (startIndex: number, endIndex: number) => {
    const newHosts = [...selectedHostDocs]
    const [movedHost] = newHosts.splice(startIndex, 1)

    if (movedHost) {
      newHosts.splice(endIndex, 0, movedHost)

      setSelectedHostDocs(newHosts)
      setSelectedHostIds(newHosts.map((h) => h.$id))
    }
  }

  const handleCategoryReorder = (startIndex: number, endIndex: number) => {
    const newCategories = [...selectedCategoryDocs]
    const [movedCategory] = newCategories.splice(startIndex, 1)

    if (movedCategory) {
      newCategories.splice(endIndex, 0, movedCategory)

      setSelectedCategoryDocs(newCategories)
      setSelectedCategoryIds(newCategories.map((c) => c.$id))
    }
  }

  const populateFormWithDummyData = () => {
    setValue('title', 'Sample Contest Title')
    setValue('title_ms', 'Tajuk Peraduan Contoh')
    setValue(
      'summary',
      'This is a placeholder summary for the contest highlighting the key activities and prizes.'
    )
    setValue(
      'summary_ms',
      'Ini ialah ringkasan tempat letak untuk peraduan yang menonjolkan aktiviti dan hadiah utama.'
    )
    setValue('total_prizes_value_rm', '10000.50')
    setValue('link_aff_shopee', 'https://shopee.com.my/sample-contest')
    setValue('link_aff_lazada', 'https://www.lazada.com.my/sample-contest')
    setValue('link_aff_tiktok_shop', 'https://www.tiktok.com/@sample/contest')
    setValue(
      'prizes_en',
      'Win amazing prizes including gadgets, shopping vouchers, and exclusive merchandise.'
    )
    setValue(
      'prizes_ms',
      'Menangi hadiah hebat termasuk gajet, baucar beli-belah, dan barangan eksklusif.'
    )
    setValue('link_tnc_en', 'https://example.com/en/contest-tnc')
    setValue('link_tnc_ms', 'https://example.com/ms/contest-tnc')
    setValue('link_faq_en', 'https://example.com/en/contest-faq')
    setValue('link_faq_ms', 'https://example.com/ms/contest-faq')
    setValue(
      'eligible_products_en',
      'Purchase any participating product worth RM50 and above to qualify.'
    )
    setValue(
      'eligible_products_ms',
      'Beli mana-mana produk yang mengambil bahagian bernilai RM50 ke atas untuk layak.'
    )
    setValue(
      'eligible_participants_en',
      'Open to all residents of Malaysia aged 18 and above with valid identification.'
    )
    setValue(
      'eligible_participants_ms',
      'Terbuka kepada semua penduduk Malaysia berumur 18 tahun ke atas dengan pengenalan diri yang sah.'
    )
    setValue(
      'eligible_participants_exclusion_en',
      'Employees of the organizer and their immediate family members are not eligible.'
    )
    setValue(
      'eligible_participants_exclusion_ms',
      'Pekerja penganjur dan ahli keluarga terdekat mereka tidak layak.'
    )
    setValue(
      'eligible_stores_en',
      'Available nationwide at selected retail outlets and participating online stores.'
    )
    setValue(
      'eligible_stores_ms',
      'Tersedia di seluruh negara di kedai runcit terpilih dan kedai dalam talian yang mengambil bahagian.'
    )
    setValue(
      'winners_selection_method_en',
      'Winners will be selected through a random draw conducted after the campaign ends.'
    )
    setValue(
      'winners_selection_method_ms',
      'Pemenang akan dipilih melalui cabutan rawak yang dijalankan selepas kempen berakhir.'
    )
    setValue(
      'winners_comm_and_timeline_en',
      'Winners will be notified via email within 7 working days after selection. Winners list will be announced on our website and social media.'
    )
    setValue(
      'winners_comm_and_timeline_ms',
      'Pemenang akan dimaklumkan melalui e-mel dalam masa 7 hari bekerja selepas pemilihan. Senarai pemenang akan diumumkan di laman web dan media sosial kami.'
    )
    setValue(
      'entry_method_en',
      'Submit your proof of purchase via the contest form within 7 days of purchase.'
    )
    setValue(
      'entry_method_ms',
      'Hantar bukti pembelian anda melalui borang peraduan dalam masa 7 hari selepas pembelian.'
    )
    setValue(
      'winners_list_and_announcement_en',
      'Winners will be notified via email and announced on our website within 7 working days.'
    )
    setValue(
      'winners_list_and_announcement_ms',
      'Pemenang akan dimaklumkan melalui e-mel dan diumumkan di laman web kami dalam masa 7 hari bekerja.'
    )
  }

  // ---- Import T&C from .md ------------------------------------------------
  const FORM_KEYS_TO_CHECK_DIRTY = [
    'title',
    'title_ms',
    'summary',
    'summary_ms',
    'total_prizes_value_rm',
    ...CONTEST_MD_SECTION_KEYS,
  ] as const

  const handleImportMarkdown = async () => {
    const picked = await pickMarkdownFile()
    if (!picked.success || !picked.file) {
      if (picked.error && picked.error !== 'File selection canceled') {
        toast.error(picked.error)
      }
      return
    }

    let raw: string
    try {
      raw = await readFileAsText(picked.file.uri)
    } catch (err: any) {
      toast.error(`Could not read file: ${err?.message || 'unknown error'}`)
      return
    }

    const report = parseContestMarkdown(raw)

    if (report.errors.length > 0) {
      report.errors.forEach((e) => toast.error(e))
      return
    }

    // Confirm if the form already has content in the fields we're about to write.
    const willOverwrite = FORM_KEYS_TO_CHECK_DIRTY.some((k) => {
      const cur = (watch(k as any) as string) || ''
      const next = (report.values as any)[k]
      return (
        cur.trim().length > 0 &&
        cur !== 'Summary powered by AI ✨' &&
        cur !== 'Rumusan dikuasakan oleh AI ✨' &&
        next !== undefined &&
        next !== cur
      )
    })

    if (willOverwrite && Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm(
          'Some form fields already contain content. Overwrite them with the imported values?'
        )
      if (!ok) return
    }

    Object.entries(report.values).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      setValue(k as any, v as any, {
        shouldDirty: true,
        shouldValidate: true,
      })
    })

    toast.success(
      `Imported ${report.filled.length} field${
        report.filled.length === 1 ? '' : 's'
      } from ${picked.file.name}`
    )
    if (report.overLimit.length) {
      report.overLimit.forEach((o) =>
        toast.warning(
          `${o.field}: ${o.chars} chars exceeds limit of ${o.limit} — please trim before submitting.`
        )
      )
    }
    if (report.unknownSections.length) {
      toast.warning(
        `Ignored unknown sections: ${report.unknownSections.join(', ')}`
      )
    }
    if (report.warnings.length) {
      report.warnings.forEach((w) => toast.warning(w))
    }
    if (report.missing.length) {
      const sample = report.missing.slice(0, 4).join(', ')
      const more =
        report.missing.length > 4 ? ` (+${report.missing.length - 4} more)` : ''
      toast(`Not provided in file: ${sample}${more}`)
    }
  }

  // Canonical static URL served from apps/next/public/. The runtime helper
  // buildContestMarkdownTemplate() is only used as a last-resort fallback
  // (offline / fetch failure / native).
  const TEMPLATE_PUBLIC_URL = '/contest-md-import/contest-template.md'

  const handleDownloadTemplate = async () => {
    if (Platform.OS === 'web') {
      try {
        const res = await fetch(TEMPLATE_PUBLIC_URL, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const md = await res.text()
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'contest-template.md'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 0)
        toast.success('Template downloaded as contest-template.md')
        return
      } catch (err: any) {
        toast.warning(
          `Couldn't fetch the canonical template (${
            err?.message || 'unknown'
          }) — using built-in fallback.`
        )
        try {
          const md = buildContestMarkdownTemplate()
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'contest-template.md'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 0)
          toast.success('Template (fallback) downloaded')
          return
        } catch {
          // fall through to clipboard fallback
        }
      }
    }

    const md = buildContestMarkdownTemplate()
    const ok = await copyToClipboard(md)
    if (ok) {
      toast.success('Template copied to clipboard')
    } else {
      toast.error('Could not download or copy the template')
    }
  }

  const generateSlug = () => {
    const getLocalDate = (dateStr: string) => {
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const start = getLocalDate(watchStartDate)
    const end = getLocalDate(watchEndDate)
    const hostPart = selectedHosts
      .map((h) => h.slug || slugify(h.name))
      .filter(Boolean)
      .join('-')
    const titlePart = slugify(watchTitle)
    const mainPart = [hostPart, titlePart]
      .filter((p) => !!p && p.trim())
      .join('-')
    const generated = `${mainPart}-from-${start}-until-${end}`
    setValue('slug', generated)
  }

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data)
  })

  const handleSubmitWithValidation = async () => {
    // Trigger form validation
    const isValid = await trigger()

    if (!isValid) {
      // Show each validation error as a separate sonner notification
      Object.entries(errors).forEach(([field, error]) => {
        const fieldLabels: Record<string, string> = {
          title: 'Title (English)',
          title_ms: 'Title (Malay)',
          summary: 'Summary (English)',
          summary_ms: 'Summary (Malay)',
          start_date: 'Start Date & Time',
          end_date: 'End Date & Time',
          slug: 'Slug',
          prizes_en: 'Prizes & Prizes Limit (English)',
          eligible_products_en: 'Eligible Products & Purchases (English)',
          eligible_participants_en: 'Eligible Participants (English)',
          eligible_stores_en: 'Eligible Stores (English)',
          winners_selection_method_en: 'Winners Selection Method (English)',
          winners_comm_and_timeline_en:
            'Winners Communication Channel & Timeline (English)',
          entry_method_en: 'Entry Method & Submission (English)',
          winners_list_and_announcement_en:
            'Winners List & Announcement (English)',
          visibility: 'Visibility',
        }
        const label =
          fieldLabels[field] ||
          field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

        toast.error(`${label}: ${error?.message || 'Invalid value'}`)
      })
      return
    }

    // If valid, proceed with form submission
    await handleFormSubmit()
  }

  const onSubmit = async (data: CreateContestFormData) => {
    if (!user) {
      toast.error('User not found, cannot create contest!')
      return
    }

    if (galleryAssets.length === 0) {
      toast.error('At least one image is required')
      return
    }

    if (selectedHostIds.length === 0) {
      toast.error('At least one host is required')
      return
    }

    if (selectedCategoryIds.length === 0) {
      toast.error('At least one category is required')
      return
    }

    // Show loading toast with spinner
    const loadingToastId = toast.loading('Creating contest...')

    try {
      if (BACKEND === 'supabase') {
        setUploadingImages(true)
        await createSupabaseContest(data, {
          hostIds: selectedHostIds,
          categoryIds: selectedCategoryIds,
          galleryAssets,
          mainUri,
        })
      } else {
      // Create the contest document first (without images)
      const contestDoc = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: CONTESTS_COLLECTION_ID,
        rowId: 'unique()',
        data: {
          title: data.title,
          title_ms: data.title_ms || null,
          summary: data.summary,
          summary_ms: data.summary_ms || null,
          start_date: new Date(data.start_date).toISOString(),
          end_date: new Date(data.end_date).toISOString(),
          host_ids: selectedHostIds,
          category_ids: selectedCategoryIds,
          slug: data.slug,
          total_prizes_value_rm: data.total_prizes_value_rm
            ? parseFloat(data.total_prizes_value_rm)
            : null,
          link_aff_shopee: data.link_aff_shopee || null,
          link_aff_lazada: data.link_aff_lazada || null,
          link_aff_tiktok_shop: data.link_aff_tiktok_shop || null,
          link_media_instagram: data.link_media_instagram || null,
          link_media_facebook: data.link_media_facebook || null,
          link_media_tiktok: data.link_media_tiktok || null,
          link_media_x: data.link_media_x || null,
          link_media_youtube: data.link_media_youtube || null,
          link_media_linkedin: data.link_media_linkedin || null,
          link_media_website: data.link_media_website || null,
          visibility: data.visibility ?? 'users',
        },
        permissions: [Permission.write(Role.team(ADMIN_TEAM_ID))],
      })
      const contestId = contestDoc.$id

      // Upload each selected image & invoke backend function
      setUploadingImages(true)

      // Ensure the asset marked as main goes first in the sequence order (0)
      const orderedAssets = [...galleryAssets].sort((a, b) => {
        if (a.uri === mainUri) return -1
        if (b.uri === mainUri) return 1
        return 0
      })

      for (let i = 0; i < orderedAssets.length; i++) {
        const asset = orderedAssets[i]
        const isMain = asset.uri === mainUri
        const label = isMain ? 'main-gallery' : 'gallery'

        const getFileExtension = (fileName: string | undefined): string => {
          if (!fileName) return 'jpg'
          const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
          return match && typeof match[1] === 'string'
            ? match[1].toLowerCase()
            : 'jpg'
        }
        const getImageFileName = (
          fileName: string | undefined,
          title: string
        ): string => {
          const slug = (title || 'contest')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
          const safeDate = new Date().toISOString().split('T')[0]
          const ext = getFileExtension(fileName)
          return `${slug}-${safeDate}-${i + 1}.${ext}`
        }

        let fileToUpload: any
        if (Platform.OS === 'web') {
          if (asset instanceof File) {
            fileToUpload = asset
          } else {
            const fileName = getImageFileName(asset.fileName, data.title)
            const response = await fetch(asset.uri)
            const blob = await response.blob()
            fileToUpload = new File([blob], fileName, {
              type: asset.type || 'image/jpeg',
            })
          }
        } else {
          const fileName = getImageFileName(asset.fileName, data.title)
          fileToUpload = {
            uri: asset.uri,
            name: fileName,
            type: asset.mimeType || asset.type || 'image/jpeg',
            size: (asset as any).fileSize ?? undefined,
          } as any
        }

        const uploaded = await storage.createFile(
          CONTESTS_BUCKET_ID,
          'unique()',
          fileToUpload,
          [Permission.write(Role.team(ADMIN_TEAM_ID))]
        )

        const exec = await functions.createExecution(
          GENERATE_IMG_BLURHASH_IMG_TOKEN_FN_ID,
          JSON.stringify({
            fileId: uploaded.$id,
            contestId,
            file_label: label,
            file_order: i + 1,
            skipToken: true, // Contest images are public, no token needed
          })
        )

        let tokenSecret: string | undefined
        let blurhash: string | undefined
        try {
          const raw =
            (exec as any).responseBody ??
            (exec as any).response ??
            (exec as any).stdout
          if (typeof raw === 'string' && raw.trim()) {
            const parsed = JSON.parse(raw)
            tokenSecret = parsed.tokenSecret
            blurhash = parsed.blurhash
          }
        } catch {
          /* ignore JSON parse errors */
        }

        if (isMain) {
          await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: CONTESTS_COLLECTION_ID,
            rowId: contestId,
            data: {
              main_img_id: uploaded.$id,
              main_img_token_secret: tokenSecret ?? null,
              main_img_blurhash: blurhash ?? null,
            },
          })
        }
      }

      // Create translations documents
      try {
        const translationsPayloads: Array<{
          locale: 'en' | 'ms'
          data: any
        }> = []

        const enData: any = {
          contest_id: contestId,
          locale: 'en',
          // Required fields
          prizes: data.prizes_en.trim(),
          eligible_products_and_purchases: data.eligible_products_en.trim(),
          eligible_participants: data.eligible_participants_en.trim(),
          eligible_stores: data.eligible_stores_en.trim(),
          winners_selection_method: data.winners_selection_method_en.trim(),
          winners_comm_and_timeline: data.winners_comm_and_timeline_en.trim(),
          entry_method_and_submission: data.entry_method_en.trim(),
          winners_list_and_announcement:
            data.winners_list_and_announcement_en.trim(),
        }
        // Optional fields
        if (data.link_tnc_en?.trim()) enData.link_tnc = data.link_tnc_en.trim()
        if (data.link_faq_en?.trim()) enData.link_faq = data.link_faq_en.trim()
        if (data.eligible_participants_exclusion_en?.trim())
          enData.eligible_participants_exclusion =
            data.eligible_participants_exclusion_en.trim()

        translationsPayloads.push({ locale: 'en', data: enData })

        const msData: any = { contest_id: contestId, locale: 'ms' }
        if (data.prizes_ms?.trim()) msData.prizes = data.prizes_ms.trim()
        if (data.link_tnc_ms?.trim()) msData.link_tnc = data.link_tnc_ms.trim()
        if (data.link_faq_ms?.trim()) msData.link_faq = data.link_faq_ms.trim()
        if (data.eligible_products_ms?.trim())
          msData.eligible_products_and_purchases =
            data.eligible_products_ms.trim()
        if (data.eligible_participants_ms?.trim())
          msData.eligible_participants = data.eligible_participants_ms.trim()
        if (data.eligible_participants_exclusion_ms?.trim())
          msData.eligible_participants_exclusion =
            data.eligible_participants_exclusion_ms.trim()
        if (data.eligible_stores_ms?.trim())
          msData.eligible_stores = data.eligible_stores_ms.trim()
        if (data.winners_selection_method_ms?.trim())
          msData.winners_selection_method =
            data.winners_selection_method_ms.trim()
        if (data.winners_comm_and_timeline_ms?.trim())
          msData.winners_comm_and_timeline =
            data.winners_comm_and_timeline_ms.trim()
        if (data.entry_method_ms?.trim())
          msData.entry_method_and_submission = data.entry_method_ms.trim()
        if (data.winners_list_and_announcement_ms?.trim())
          msData.winners_list_and_announcement =
            data.winners_list_and_announcement_ms.trim()
        if (Object.keys(msData).length > 2)
          translationsPayloads.push({ locale: 'ms', data: msData })

        for (const t of translationsPayloads) {
          await tablesDB.createRow({
            databaseId: DATABASE_ID,
            tableId: CONTEST_TRANSLATIONS_COLLECTION_ID,
            rowId: 'unique()',
            data: t.data,
            permissions: [Permission.write(Role.team(ADMIN_TEAM_ID))],
          })
        }
      } catch (translationErr) {
        console.warn('Failed to create translation docs:', translationErr)
      }

      // Update Meilisearch index
      try {
        const completeContest = await tablesDB.getRow({
          databaseId: DATABASE_ID,
          tableId: CONTESTS_COLLECTION_ID,
          rowId: contestId,
        })
        await addContestToMeilisearch(completeContest)
        console.log('✅ Contest added to Meilisearch index')
      } catch (meilisearchError) {
        console.error(
          '⚠️ Failed to update Meilisearch index:',
          meilisearchError
        )
      }
      }

      // Note: Using main image as OG image (no custom OG generation needed)

      toast.dismiss(loadingToastId)
      toast.success('Contest created successfully!')
      // Reset form
      reset()
      setGalleryAssets([])
      setGalleryUris([])
      setMainUri(null)
      setSelectedHostIds([])
      setSelectedHostDocs([])
      setSelectedCategoryIds([])
      setSelectedCategoryDocs([])
    } catch (error: any) {
      toast.dismiss(loadingToastId)
      toast.error(error?.message || 'Failed to create contest')
    } finally {
      setUploadingImages(false)
    }
  }

  // Render controlled field helper
  const renderControlledField = (
    name: keyof CreateContestFormData,
    label: string,
    placeholder: string,
    component: 'input' | 'textarea' = 'input',
    isMalay: boolean = false,
    isRequired: boolean = false,
    supportsMarkdown: boolean = false,
    maxLength?: number,
    detectLineBreaks: boolean = false
  ) => {
    const Component = component === 'textarea' ? Textarea : Input
    const error = errors[name]
    const fieldValue = watch(name) as string
    const charCount = fieldValue?.length || 0
    const showCharCount = maxLength !== undefined
    const isOverLimit = maxLength !== undefined && charCount > maxLength
    const hasSuspiciousBreaks =
      detectLineBreaks &&
      component === 'textarea' &&
      detectSuspiciousLineBreaks(fieldValue)

    return (
      <View className="flex-1">
        <Label className="mb-2">
          <View className="flex-row items-center gap-2">
            <Text
              className=""
              style={
                !isMalay && Platform.OS !== 'web' ? { color: main } : undefined
              }
            >
              {label}
              {isRequired && <Text className="text-red-500"> *</Text>}
            </Text>
            {supportsMarkdown && (
              <Badge
                variant="outline"
                style={
                  Platform.OS === 'web'
                    ? undefined
                    : {
                        backgroundColor: isDarkColorScheme
                          ? 'rgba(128, 90, 213, 0.2)'
                          : 'rgba(128, 90, 213, 0.1)',
                        borderColor: isDarkColorScheme
                          ? 'rgba(128, 90, 213, 0.4)'
                          : 'rgba(128, 90, 213, 0.3)',
                      }
                }
                className="bg-main/10 border-main/30 dark:bg-main/20 dark:border-main/40"
              >
                <Text
                  className="text-xs font-medium text-main dark:text-main"
                  style={Platform.OS === 'web' ? undefined : { color: main }}
                >
                  Markdown
                </Text>
              </Badge>
            )}
            {hasSuspiciousBreaks && (
              <Badge
                variant="outline"
                style={
                  Platform.OS === 'web'
                    ? undefined
                    : {
                        backgroundColor: isDarkColorScheme
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(245, 158, 11, 0.1)',
                        borderColor: isDarkColorScheme
                          ? 'rgba(245, 158, 11, 0.4)'
                          : 'rgba(245, 158, 11, 0.3)',
                      }
                }
                className="bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/20 dark:border-amber-500/40"
              >
                <Text
                  className="text-xs font-medium text-amber-600 dark:text-amber-400"
                  style={
                    Platform.OS === 'web'
                      ? undefined
                      : { color: isDarkColorScheme ? '#fbbf24' : '#d97706' }
                  }
                >
                  ⚠️ Line Breaks
                </Text>
              </Badge>
            )}
          </View>
        </Label>
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, value } }) => (
            <Component
              placeholder={placeholder}
              value={value as string}
              onChangeText={onChange}
              multiline={component === 'textarea'}
              scrollEnabled={!isExpandedMode}
              style={{
                ...(component === 'textarea'
                  ? isExpandedMode
                    ? { minHeight: 300, maxHeight: 600 }
                    : { height: 80 }
                  : {}),
                ...(!isMalay && Platform.OS !== 'web'
                  ? ({ borderColor: main, '--tw-ring-color': main } as any)
                  : {}),
              }}
              className={
                !isMalay
                  ? Platform.OS === 'web'
                    ? ENGLISH_INPUT_CLASSNAME_WEB
                    : ENGLISH_INPUT_CLASSNAME_NATIVE
                  : undefined
              }
              autoCapitalize="none"
              {...(maxLength !== undefined ? { maxLength } : {})}
            />
          )}
        />
        {showCharCount && (
          <Text
            className={`text-xs mt-1 text-right ${
              isOverLimit
                ? 'text-red-500 dark:text-red-400'
                : charCount > maxLength * 0.9
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-muted-foreground'
            }`}
          >
            {charCount}/{maxLength}
          </Text>
        )}
        {error && (
          <Text className="text-red-500 text-sm mt-1">
            {error.message as string}
          </Text>
        )}
      </View>
    )
  }

  const renderLocaleFieldPair = (
    keyEn: keyof CreateContestFormData,
    keyMs: keyof CreateContestFormData,
    label: string,
    placeholderEn: string,
    placeholderMs: string,
    component: 'input' | 'textarea' = 'input',
    isRequired: boolean = false,
    supportsMarkdown: boolean = false,
    maxLength?: number,
    detectLineBreaks: boolean = false
  ) => {
    return (
      <View className="mt-4 w-full">
        {isDesktopLayout ? (
          <View className="flex-row gap-4">
            <View className="flex-1" style={{ minWidth: 0 }}>
              {renderControlledField(
                keyEn,
                `${label} (English)`,
                placeholderEn,
                component,
                false,
                isRequired,
                supportsMarkdown,
                maxLength,
                detectLineBreaks
              )}
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>
              {renderControlledField(
                keyMs,
                `${label} (Malay)`,
                placeholderMs,
                component,
                true,
                false,
                supportsMarkdown,
                maxLength,
                detectLineBreaks
              )}
            </View>
          </View>
        ) : (
          <View className="gap-3">
            {renderControlledField(
              keyEn,
              `${label} (English)`,
              placeholderEn,
              component,
              false,
              isRequired,
              supportsMarkdown,
              maxLength,
              detectLineBreaks
            )}
            {renderControlledField(
              keyMs,
              `${label} (Malay)`,
              placeholderMs,
              component,
              true,
              false,
              supportsMarkdown,
              maxLength,
              detectLineBreaks
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingBottom: 48,
        }}
        className="p-4"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <View className="flex-col mb-4 gap-2 items-center">
          <Text
            className="text-2xl font-bold text-center"
            style={Platform.OS === 'web' ? undefined : { color: main }}
          >
            Create Contest
          </Text>
          <View className="flex-row items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="px-3 py-1"
              onPress={populateFormWithDummyData}
            >
              <Text className="text-xs font-semibold">Use Dummy Data</Text>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="px-3 py-1"
              onPress={handleImportMarkdown}
            >
              <Text className="text-xs font-semibold">Import T&C (.md)</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="px-3 py-1"
              onPress={handleDownloadTemplate}
            >
              <Text className="text-xs font-semibold">
                {Platform.OS === 'web'
                  ? 'Download .md Template'
                  : 'Copy .md Template'}
              </Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="px-3 py-1"
              onPress={() => setIsExpandedMode(!isExpandedMode)}
            >
              <Text className="text-xs font-semibold">
                {isExpandedMode ? '📋 Collapse Fields' : '📖 Expand All Fields'}
              </Text>
            </Button>
          </View>
        </View>

        <View
          className="w-full gap-4"
          style={{
            width: '100%',
            maxWidth: containerMaxWidth,
            alignSelf: 'center',
          }}
        >
          <Label>
            Host(s)<Text className="text-red-500"> *</Text>
            {Platform.OS === 'web' && selectedHosts.length > 1 && (
              <Text className="text-xs text-gray-500 ml-2">
                (Drag to reorder)
              </Text>
            )}
          </Label>
          {selectedHosts.length ? (
            <View className="flex-row flex-wrap mb-2">
              {selectedHosts.map((h, index) => (
                <DraggableHostBadge
                  key={h.$id}
                  host={h}
                  index={index}
                  instanceId={hostInstanceId}
                  onRemove={() => {
                    setSelectedHostIds((prev) =>
                      prev.filter((id) => id !== h.$id)
                    )
                    setSelectedHostDocs((prev) =>
                      prev.filter((doc) => doc.$id !== h.$id)
                    )
                  }}
                  onReorder={handleHostReorder}
                />
              ))}
            </View>
          ) : (
            <Text className="mb-2">No hosts selected</Text>
          )}
          <Button variant="secondary" onPress={() => setHostModalOpen(true)}>
            <Text>Select / Manage Hosts</Text>
          </Button>

          <Label>
            Category(s)<Text className="text-red-500"> *</Text>
            {Platform.OS === 'web' && selectedCategories.length > 1 && (
              <Text className="text-xs text-gray-500 ml-2">
                (Drag to reorder)
              </Text>
            )}
          </Label>
          {selectedCategories.length ? (
            <View className="flex-row flex-wrap mb-2">
              {selectedCategories.map((c, index) => (
                <DraggableCategoryBadge
                  key={c.$id}
                  category={c}
                  index={index}
                  instanceId={categoryInstanceId}
                  onRemove={() => {
                    setSelectedCategoryIds((prev) =>
                      prev.filter((id) => id !== c.$id)
                    )
                    setSelectedCategoryDocs((prev) =>
                      prev.filter((doc) => doc.$id !== c.$id)
                    )
                  }}
                  onReorder={handleCategoryReorder}
                />
              ))}
            </View>
          ) : (
            <Text className="mb-2">No categories selected</Text>
          )}
          <Button
            variant="secondary"
            onPress={() => setCategoryModalOpen(true)}
          >
            <Text>Select / Manage Categories</Text>
          </Button>

          <View className="mt-4">
            <Label className="mb-2">Visibility</Label>
            <Controller
              control={control}
              name="visibility"
              render={({ field: { onChange, value } }) => (
                <Select
                  value={{
                    value: value || 'users',
                    label:
                      value === 'any'
                        ? 'Any (Public)'
                        : value === 'admin'
                        ? 'Admin Only'
                        : 'Users (Logged-in)',
                  }}
                  onValueChange={(option) => {
                    onChange(option?.value || 'users')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="users" label="Users (Logged-in)">
                      Users (Logged-in)
                    </SelectItem>
                    <SelectItem value="any" label="Any (Public)">
                      Any (Public)
                    </SelectItem>
                    <SelectItem value="admin" label="Admin Only">
                      Admin Only
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <Text className="text-xs text-muted-foreground mt-1">
              Users = logged-in users only | Any = everyone including
              non-logged-in | Admin = admins only
            </Text>
          </View>

          <Label>
            Contest Images<Text className="text-red-500"> *</Text>
          </Label>
          {galleryUris.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                marginBottom: 8,
                height: 300,
                flexGrow: 0,
                flexShrink: 0,
              }}
              contentContainerStyle={{ alignItems: 'flex-start' }}
            >
              {galleryUris.map((uri, idx) => (
                <View
                  key={`${uri}-${idx}`}
                  style={{ marginRight: 8, alignItems: 'center' }}
                >
                  <ExpoImage
                    source={{ uri }}
                    style={{
                      width: 200,
                      height: 200,
                      borderRadius: 8,
                      borderWidth: mainUri === uri ? 3 : 0,
                      borderColor: mainUri === uri ? '#00AEEF' : 'transparent',
                    }}
                    contentFit="cover"
                  />
                  {mainUri === uri ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled
                    >
                      <Text>Current Main</Text>
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onPress={() => setMainUri(uri)}
                    >
                      <Text>Set as Main</Text>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="mt-2"
                    onPress={() => {
                      setGalleryUris((u) => u.filter((x) => x !== uri))
                      setGalleryAssets((a) => a.filter((x) => x.uri !== uri))
                      if (mainUri === uri) {
                        setMainUri(() => {
                          const remaining = galleryUris.filter((x) => x !== uri)
                          return remaining[0] ?? null
                        })
                      }
                    }}
                  >
                    <Text>Remove</Text>
                  </Button>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <Button
            variant="secondary"
            disabled={uploadingImages}
            onPress={async () => {
              const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync()
              if (status !== 'granted') {
                toast.error(
                  'Sorry, we need media library permissions to pick an image!'
                )
                return
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
                allowsMultipleSelection: true,
                selectionLimit: 10,
              })

              if (result.canceled || !result.assets?.length) return

              const newAssets = result.assets
              setGalleryAssets((prev) => {
                const merged = [...prev, ...newAssets].filter(
                  (v, i, arr) => arr.findIndex((x) => x.uri === v.uri) === i
                )
                return merged
              })
              setGalleryUris((prev) => {
                const merged = [...prev, ...newAssets.map((a) => a.uri)].filter(
                  (v, i, arr) => arr.indexOf(v) === i
                )
                if (merged.length && !mainUri) setMainUri(merged[0] ?? null)
                return merged
              })
            }}
          >
            <Text>
              {uploadingImages
                ? 'Uploading...'
                : galleryUris.length
                ? 'Add More Images'
                : 'Pick Image(s)'}
            </Text>
          </Button>

          {renderLocaleFieldPair(
            'title',
            'title_ms',
            'Title',
            'Title',
            'Tajuk (BM)',
            'input',
            true,
            false,
            100
          )}
          {renderLocaleFieldPair(
            'summary',
            'summary_ms',
            'Summary',
            'Summary',
            'Ringkasan (BM)',
            'textarea',
            true,
            false,
            200
          )}

          {Platform.OS === 'web' ? (
            <>
              <Label>
                Start Date & Time<Text className="text-red-500"> *</Text>
              </Label>
              <Controller
                control={control}
                name="start_date"
                render={({ field: { onChange, value } }) => (
                  <SingleDateTimePicker
                    placeholder="Pick a date"
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
              {errors.start_date && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.start_date.message as string}
                </Text>
              )}
              <Label>
                End Date & Time<Text className="text-red-500"> *</Text>
              </Label>
              <Controller
                control={control}
                name="end_date"
                render={({ field: { onChange, value } }) => (
                  <SingleDateTimePicker
                    placeholder="Pick a date"
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
              {errors.end_date && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.end_date.message as string}
                </Text>
              )}
            </>
          ) : (
            <>
              <Label>
                Start Date & Time<Text className="text-red-500"> *</Text>
              </Label>
              <Controller
                control={control}
                name="start_date"
                render={({ field: { onChange, value } }) => (
                  <SingleDateTimePickerMobile
                    placeholder="Pick a date"
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
              {errors.start_date && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.start_date.message as string}
                </Text>
              )}
              <Label>
                End Date & Time<Text className="text-red-500"> *</Text>
              </Label>
              <Controller
                control={control}
                name="end_date"
                render={({ field: { onChange, value } }) => (
                  <SingleDateTimePickerMobile
                    placeholder="Pick a date"
                    value={value}
                    onChange={onChange}
                  />
                )}
              />
              {errors.end_date && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.end_date.message as string}
                </Text>
              )}
            </>
          )}

          <View className="flex-row items-center gap-2">
            <Label>
              Slug<Text className="text-red-500"> *</Text>
            </Label>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onPress={generateSlug}
            >
              <Text>Generate</Text>
            </Button>
          </View>
          <Controller
            control={control}
            name="slug"
            render={({ field: { onChange, value } }) => {
              const charCount = value?.length || 0
              const maxLength = 200
              const isOverLimit = charCount > maxLength
              return (
                <View>
                  <Input
                    placeholder="contest-slug"
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline={true}
                    numberOfLines={2}
                    className="h-16 py-2"
                    {...(maxLength !== undefined ? { maxLength } : {})}
                  />
                  <Text
                    className={`text-xs mt-1 text-right ${
                      isOverLimit
                        ? 'text-red-500 dark:text-red-400'
                        : charCount > maxLength * 0.9
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {charCount}/{maxLength}
                  </Text>
                </View>
              )
            }}
          />
          {errors.slug && (
            <Text className="text-red-500 text-sm mt-1">
              {errors.slug.message as string}
            </Text>
          )}

          <Text className="text-lg font-semibold mt-4 mb-2 text-black dark:text-white">
            Contest Details
          </Text>

          {renderControlledField(
            'total_prizes_value_rm',
            'Total Prize Value (RM)',
            'e.g. 5000.50'
          )}
          {renderControlledField(
            'link_aff_shopee',
            'Shopee Affiliate Link',
            'https://shopee.com.my/...',
            'input',
            false,
            false,
            false,
            1000
          )}
          {renderControlledField(
            'link_aff_lazada',
            'Lazada Affiliate Link',
            'https://www.lazada.com.my/...',
            'input',
            false,
            false,
            false,
            1000
          )}
          {renderControlledField(
            'link_aff_tiktok_shop',
            'TikTok Shop Affiliate Link',
            'https://www.tiktok.com/...',
            'input',
            false,
            false,
            false,
            1000
          )}

          <Text className="text-lg font-semibold mt-6 mb-2 text-black dark:text-white">
            Social Media Links
          </Text>

          {renderControlledField(
            'link_media_instagram',
            'Instagram Post Link',
            'https://www.instagram.com/p/...',
            'input',
            false,
            false,
            false,
            400
          )}
          {renderControlledField(
            'link_media_facebook',
            'Facebook Post Link',
            'https://www.facebook.com/...',
            'input',
            false,
            false,
            false,
            400
          )}
          {renderControlledField(
            'link_media_tiktok',
            'TikTok Post Link',
            'https://www.tiktok.com/@.../video/...',
            'input',
            false,
            false,
            false,
            200
          )}
          {renderControlledField(
            'link_media_x',
            'X (Twitter) Post Link',
            'https://x.com/.../status/...',
            'input',
            false,
            false,
            false,
            200
          )}
          {renderControlledField(
            'link_media_youtube',
            'YouTube Video Link',
            'https://www.youtube.com/watch?v=...',
            'input',
            false,
            false,
            false,
            200
          )}
          {renderControlledField(
            'link_media_linkedin',
            'LinkedIn Post Link',
            'https://www.linkedin.com/posts/...',
            'input',
            false,
            false,
            false,
            400
          )}
          {renderControlledField(
            'link_media_website',
            'Website Link',
            'https://example.com/contest',
            'input',
            false,
            false,
            false,
            400
          )}

          <Text className="text-lg font-semibold mt-6 mb-2 text-black dark:text-white">
            Localized Contest Information
          </Text>

          <View
            className="mt-2 mb-4 px-3 py-2 bg-main/5 dark:bg-main/10 rounded-md border border-main/20 dark:border-main/30"
            style={
              Platform.OS === 'web'
                ? undefined
                : {
                    backgroundColor: isDarkColorScheme
                      ? 'rgba(128, 90, 213, 0.1)'
                      : 'rgba(128, 90, 213, 0.05)',
                    borderColor: isDarkColorScheme
                      ? 'rgba(128, 90, 213, 0.3)'
                      : 'rgba(128, 90, 213, 0.2)',
                  }
            }
          >
            <Text
              className="text-xs text-main dark:text-main"
              style={Platform.OS === 'web' ? undefined : { color: main }}
            >
              💡 Tip: Fields marked with "Markdown" badge support markdown
              formatting:
              {'\n'}→ **bold text**
              {'\n'}→ *italic text* or _italic text_
              {'\n'}→ [Link Text](https://example.com)
              {'\n'}→ [Internal Link](/page)
              {'\n'}→ - bullet list or * bullet list
              {'\n'}→ 1. numbered list
              {'\n'}→ | Col1 | Col2 | for tables
              {'\n'}→ # ## ### #### for headings
              {'\n'}→ --- for horizontal rule
            </Text>
          </View>

          {renderLocaleFieldPair(
            'eligible_participants_en',
            'eligible_participants_ms',
            'Eligible Participants',
            'Who can participate',
            'Siapa yang boleh menyertai',
            'textarea',
            true,
            true,
            1500,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'eligible_participants_exclusion_en',
            'eligible_participants_exclusion_ms',
            'Eligible Participants Exclusion',
            'Who cannot participate',
            'Siapa yang tidak boleh menyertai',
            'textarea',
            false,
            true,
            1000,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'eligible_products_en',
            'eligible_products_ms',
            'Eligible Products & Purchases',
            'Eligible products and purchase requirements',
            'Produk layak dan keperluan pembelian',
            'textarea',
            true,
            true,
            2400,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'eligible_stores_en',
            'eligible_stores_ms',
            'Eligible Stores',
            'Eligible stores or locations',
            'Kedai atau lokasi yang layak',
            'textarea',
            true,
            true,
            2000,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'prizes_en',
            'prizes_ms',
            'Prizes & Prizes Limit',
            'Prize details and prizes limit in English',
            'Maklumat hadiah dan had hadiah dalam Bahasa Melayu',
            'textarea',
            true,
            true,
            2000,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'entry_method_en',
            'entry_method_ms',
            'Entry Method & Submission',
            'How to enter and submit',
            'Cara untuk menyertai dan menghantar',
            'textarea',
            true,
            true,
            2000,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'winners_selection_method_en',
            'winners_selection_method_ms',
            'Winners Selection Method',
            'How winners will be selected',
            'Bagaimana pemenang akan dipilih',
            'textarea',
            true,
            true,
            2000,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'winners_comm_and_timeline_en',
            'winners_comm_and_timeline_ms',
            'Winners Communication Channel & Timeline',
            'How and when winners will be contacted and announced',
            'Bagaimana dan bila pemenang akan dihubungi dan diumumkan',
            'textarea',
            true,
            true,
            1500,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'winners_list_and_announcement_en',
            'winners_list_and_announcement_ms',
            'Winners List and Announcement',
            'Additional winner information and announcement details',
            'Maklumat tambahan pemenang dan pengumuman',
            'textarea',
            true,
            true,
            1000,
            true // Enable line break detection
          )}
          {renderLocaleFieldPair(
            'link_tnc_en',
            'link_tnc_ms',
            'Terms & Conditions Link',
            'https://example.com/tnc',
            'https://example.com/terma-syarat',
            'input',
            false,
            false,
            300
          )}
          {renderLocaleFieldPair(
            'link_faq_en',
            'link_faq_ms',
            'FAQ Link',
            'https://example.com/faq',
            'https://example.com/soalan-lazim',
            'input',
            false,
            false,
            300
          )}

          <Button
            className="bg-main mt-2 mb-8"
            onPress={handleSubmitWithValidation}
            disabled={isSubmitting || uploadingImages}
          >
            {isSubmitting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={mainForeground} />
                <Text>Creating Contest...</Text>
              </View>
            ) : (
              <Text>Create Contest</Text>
            )}
          </Button>
        </View>
      </ScrollView>

      <HostManagerModal
        visible={hostModalOpen}
        selectedHostIds={selectedHostIds}
        onChangeSelection={(ids, hosts) => {
          setSelectedHostIds(ids)
          setSelectedHostDocs(hosts)
        }}
        onRequestClose={() => setHostModalOpen(false)}
      />
      <CategoryManagerModal
        visible={categoryModalOpen}
        selectedCategoryIds={selectedCategoryIds}
        onChangeSelection={(ids, categories) => {
          setSelectedCategoryIds(ids)
          setSelectedCategoryDocs(categories)
        }}
        onRequestClose={() => setCategoryModalOpen(false)}
      />
    </KeyboardAvoidingView>
  )
}
