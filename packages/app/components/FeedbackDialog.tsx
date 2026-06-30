'use client'
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from 'app/components/ui/dialog'
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import { functions } from 'app/provider/appwrite/api'
import { PROCESS_FEEDBACK_FUNCTION_ID } from 'app/provider/appwrite/constants'
import { BACKEND } from 'app/lib/backend'
import { submitFeedbackSupabase } from 'app/lib/supabase'
import { useAuth } from 'app/contexts/AuthContext'
import { useTextScale } from 'app/contexts/TextScaleContext'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import {
  TextInput,
  Linking,
  View,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { toast } from 'app/lib/sonner-universal'
import { cn } from 'app/lib/utils'
import { WhatsAppSolid } from 'app/components/icons-svg'
import {
  WHATSAPP_PHONE_NUMBER,
  FEEDBACK_MESSAGE_LIMIT,
} from 'app/utils/constants/ConstFeedbackDialog'
import { TURNSTILE_SITE_KEY } from 'app/utils/constants/ConstTurnstile'
import IconWrapper from 'app/components/icons-svg/utils/IconWrapper'
import { TurnstileWidget } from 'app/components/TurnstileWidget'
import { useColorScheme } from 'app/hooks/useColorScheme'

interface FeedbackDialogProps {
  children: React.ReactNode
  currentUrl?: string
}

export function FeedbackDialog({ children, currentUrl }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [isCaptchaReady, setIsCaptchaReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingWhatsApp, setIsSubmittingWhatsApp] = useState(false)
  const { user } = useAuth()
  const { colorScheme, isDarkColorScheme } = useColorScheme()
  const { fontSize } = useTextScale()
  const { main } = useColorThemeValues(isDarkColorScheme)

  // Reset captcha ready state when dialog opens
  useEffect(() => {
    if (open) {
      setIsCaptchaReady(false)
    }
  }, [open])

  // Reset captcha state when theme changes (widget will re-mount)
  useEffect(() => {
    if (open) {
      setIsCaptchaReady(false)
      setCaptchaToken('')
    }
  }, [colorScheme, open])

  // iOS Safari: while dialog is open, disable page zoom to prevent smart-zoom on textarea tap
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (!isIOS) return

    const viewport = document.querySelector('meta[name=viewport]')
    if (!viewport) return

    const original = viewport.getAttribute('content') || ''

    const preventDblClick = (e: Event) => {
      e.preventDefault()
    }
    const preventGesture = (e: Event) => {
      e.preventDefault()
    }

    if (open) {
      // Lock zoom while dialog is open to avoid iOS Safari smart-zoom
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
      )
      // Best-effort prevention of double-tap and pinch zoom while open
      document.addEventListener('dblclick', preventDblClick, { passive: false })
      document.addEventListener('gesturestart', preventGesture as any, {
        passive: false,
      })
    }

    return () => {
      // Restore zoom settings and listeners when dialog closes/unmounts
      document.removeEventListener('dblclick', preventDblClick as any)
      document.removeEventListener('gesturestart', preventGesture as any)
      viewport.setAttribute(
        'content',
        original ||
          'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes'
      )
    }
  }, [open])

  const handleCancel = () => {
    setFeedback('')
    setCaptchaToken('')
    setIsCaptchaReady(false)
    setOpen(false)
  }

  // Clear token when dialog closes to require fresh verification
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Dialog is closing - clear token for fresh verification next time
      setCaptchaToken('')
      setIsCaptchaReady(false)
    }
  }

  const handleSubmit = async () => {
    if (!feedback.trim() || !user || !captchaToken) return

    // ⚡ OPTIMISTIC UI: Show success immediately
    const feedbackCopy = feedback
    const captchaTokenCopy = captchaToken

    // Reset form and close dialog immediately
    setFeedback('')
    setCaptchaToken('')
    setIsCaptchaReady(false)
    setOpen(false)
    toast.success(i18n._(msg`Thank you for your feedback!`))

    // Run validation in background
    setIsSubmitting(true)
    try {
      // Format page_url for native vs web
      const pageUrl =
        Platform.OS === 'web'
          ? currentUrl || ''
          : currentUrl
          ? `app://jomcontest${currentUrl}`
          : 'app://jomcontest'

      if (BACKEND === 'supabase') {
        await submitFeedbackSupabase(feedbackCopy, pageUrl)
      } else {
        const execution = await functions.createExecution(
          PROCESS_FEEDBACK_FUNCTION_ID,
          JSON.stringify({
            user_id: user.$id,
            message: feedbackCopy,
            page_url: pageUrl,
            captcha_token: captchaTokenCopy,
          })
        )

        const result = JSON.parse(execution.responseBody || '{}')

        if (!result.success) {
          throw new Error(result.error || 'Failed to submit feedback')
        }
      }

      // Success - already showed toast
    } catch (error: any) {
      // Show error notification if background validation fails
      const errorMessage =
        error.message ||
        i18n._(msg`Failed to submit feedback. Please try again.`)
      toast.error(errorMessage, {
        duration: 6000,
      })

      // Restore feedback for retry
      setFeedback(feedbackCopy)
      setCaptchaToken(captchaTokenCopy)
      // Don't set isCaptchaReady here - let the widget signal when it's ready again
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWhatsAppSubmit = async () => {
    if (!feedback.trim() || !user || !captchaToken) return

    // ⚡ OPTIMISTIC UI: Show success immediately
    const feedbackCopy = feedback
    const captchaTokenCopy = captchaToken

    // Reset form and close dialog immediately
    setFeedback('')
    setCaptchaToken('')
    setIsCaptchaReady(false)
    setOpen(false)
    toast.success(i18n._(msg`You will be directed to Whatsapp. Thank you 🙏🏻`), {
      duration: 1000,
    })

    // Run validation and WhatsApp opening in background
    setIsSubmittingWhatsApp(true)
    try {
      // Format page_url for native vs web
      const pageUrl =
        Platform.OS === 'web'
          ? currentUrl || ''
          : currentUrl
          ? `app://jomcontest${currentUrl}`
          : 'app://jomcontest'

      // First, save to database (Supabase insert or the Appwrite secure function)
      if (BACKEND === 'supabase') {
        await submitFeedbackSupabase(feedbackCopy, pageUrl)
      } else {
        const execution = await functions.createExecution(
          PROCESS_FEEDBACK_FUNCTION_ID,
          JSON.stringify({
            user_id: user.$id,
            message: feedbackCopy,
            page_url: pageUrl,
            captcha_token: captchaTokenCopy,
          })
        )

        const result = JSON.parse(execution.responseBody || '{}')

        if (!result.success) {
          throw new Error(result.error || 'Failed to submit feedback')
        }
      }

      // Then, open WhatsApp with the feedback message
      const whatsappMessage = encodeURIComponent(
        `Feedback from ${user.name || 'User'}:\n\n${feedbackCopy}\n\nPage: ${
          currentUrl || 'N/A'
        }`
      )

      // Use phone number specific WhatsApp URL format
      const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${whatsappMessage}`

      // For web platforms, use different methods based on device
      if (typeof window !== 'undefined') {
        try {
          // Detect mobile devices (iOS and Android)
          const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent)

          if (isMobile) {
            // For mobile browsers, use window.location.href which works more reliably
            // This navigates the current page to WhatsApp, avoiding popup blockers
            window.location.href = whatsappUrl
          } else {
            // For desktop, use window.open to open in new tab without navigating away
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
          }
        } catch (error) {
          // console.warn('Failed to open WhatsApp:', error)
          throw new Error('Cannot open WhatsApp')
        }
      } else {
        // For React Native, try Linking
        const canOpen = await Linking.canOpenURL(whatsappUrl)
        if (canOpen) {
          await Linking.openURL(whatsappUrl)
        } else {
          throw new Error('Cannot open WhatsApp')
        }
      }

      // Success - already showed toast
    } catch (error: any) {
      // console.error('Error submitting feedback via WhatsApp:', error)
      const errorMessage = error.message?.includes(
        'feedback is already in our system'
      )
        ? error.message
        : error.message?.includes('Cannot open WhatsApp')
        ? i18n._(msg`Failed to open WhatsApp. Please try again.`)
        : i18n._(msg`Failed to submit feedback. Please try again.`)
      toast.error(errorMessage, {
        duration: 6000,
      })

      // Restore feedback for retry
      setFeedback(feedbackCopy)
      setCaptchaToken(captchaTokenCopy)
      // Don't set isCaptchaReady here - let the widget signal when it's ready again
    } finally {
      setIsSubmittingWhatsApp(false)
    }
  }

  const remainingChars = FEEDBACK_MESSAGE_LIMIT - feedback.length
  const isOverLimit = feedback.length > FEEDBACK_MESSAGE_LIMIT
  const isSubmittingAny = isSubmitting || isSubmittingWhatsApp
  const canSubmit =
    feedback.trim() &&
    captchaToken &&
    isCaptchaReady &&
    !isOverLimit &&
    !isSubmittingAny

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent
        className={cn(
          'sm:max-w-xl no-zoom-on-focus',
          Platform.OS !== 'web' && 'pt-6 pb-2'
        )}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={Platform.OS !== 'web' ? { width: '100%' } : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              Platform.OS !== 'web' ? { paddingBottom: 20 } : undefined
            }
          >
            <DialogTitle className="mb-3">
              {i18n._(msg`Send Feedback`)}
            </DialogTitle>
            <DialogDescription className="mb-3">
              {i18n._(
                msg`JomContest evolves with your input. Share your thoughts and help us improve....`
              )}
            </DialogDescription>

            <View className="w-full px-1">
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder={i18n._(
                  msg`Share your suggestions or report bugs or issues...`
                )}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={Platform.OS === 'android' ? undefined : 8}
                editable={!isSubmittingAny}
                maxLength={FEEDBACK_MESSAGE_LIMIT}
                scrollEnabled={Platform.OS === 'android'}
                style={Platform.select({
                  web: {
                    width: '100%',
                    minHeight: 180,
                    padding: 12,
                    borderWidth: 1,
                    borderRadius: 8,
                    textAlignVertical: 'top',
                    fontSize: fontSize.base, // Use text scale
                  },
                  default: {
                    width: '100%',
                    height: 180, // Fixed height on native to prevent expansion
                    padding: 12,
                    borderWidth: 1,
                    borderRadius: 8,
                    textAlignVertical: 'top',
                    fontSize: fontSize.base, // Use text scale
                  },
                })}
                className="border-input bg-background text-foreground"
              />

              {/* Clear button and character counter */}
              <View className="flex flex-row justify-between items-center mt-1 w-full">
                <Pressable
                  onPress={() => setFeedback('')}
                  disabled={!feedback || isSubmittingAny}
                  className="mt-2 disabled:opacity-50"
                >
                  <Text
                    className={`text-sm ${
                      !feedback || isSubmittingAny
                        ? 'text-muted-foreground'
                        : ''
                    }`}
                    style={
                      !feedback || isSubmittingAny
                        ? undefined
                        : Platform.OS === 'web'
                        ? undefined
                        : { color: main }
                    }
                  >
                    {i18n._(msg`Clear`)}
                  </Text>
                </Pressable>
                <Text
                  className={`text-xs mt-2 ${
                    isOverLimit
                      ? 'text-red-500 dark:text-red-400'
                      : remainingChars < 20
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {feedback.length}/{FEEDBACK_MESSAGE_LIMIT}
                </Text>
              </View>
            </View>

            {/* CAPTCHA Widget */}
            {TURNSTILE_SITE_KEY && (
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                onReady={() => setIsCaptchaReady(true)}
                onSuccess={setCaptchaToken}
                onError={() => {
                  setCaptchaToken('')
                  setIsCaptchaReady(false)
                  toast.error(
                    i18n._(msg`CAPTCHA verification failed. Please try again.`)
                  )
                }}
                onExpire={() => {
                  setCaptchaToken('')
                  setIsCaptchaReady(false)
                  toast.warning(
                    i18n._(msg`CAPTCHA expired. Please verify again.`)
                  )
                }}
              />
            )}

            <View className="flex flex-row justify-center gap-4 mt-2">
              <Button
                variant="outline"
                onPress={handleCancel}
                disabled={isSubmittingAny}
                className="min-w-[80px]"
              >
                <Text>{i18n._(msg`Cancel`)}</Text>
              </Button>
              <Button
                onPress={handleSubmit}
                disabled={!canSubmit}
                className="min-w-[85px]"
              >
                {isSubmitting ? (
                  <ActivityIndicator
                    size="small"
                    color={isDarkColorScheme ? '#000' : 'white'}
                  />
                ) : (
                  <Text>{i18n._(msg`Send`)}</Text>
                )}
              </Button>
              <Button
                onPress={handleWhatsAppSubmit}
                disabled={!canSubmit}
                // WhatsApp green via className so it overrides the Button's
                // default `bg-primary` (inline style is dropped by this Button).
                // Disabled state is handled by the Button's own opacity-50, so the
                // white label + logo keep their contrast in both light and dark.
                className="min-w-[95px] bg-[#25D366] web:hover:opacity-90"
                style={{ backgroundColor: '#25D366' }}
              >
                {isSubmittingWhatsApp ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Text className="text-white">{i18n._(msg`Send`)}</Text>
                    <IconWrapper Icon={WhatsAppSolid} size={16} color="white" />
                  </View>
                )}
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  )
}
