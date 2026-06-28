import { View, ScrollView, Platform, Linking } from 'react-native'
import { Trans } from '@lingui/react/macro'

import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useColorScheme } from 'app/hooks/useColorScheme'

export default function ContactScreen() {
  const { bottom } = useSafeArea()
  const { isDarkColorScheme } = useColorScheme()

  const handleEmailPress = () => {
    Linking.openURL('mailto:hello@jomcontest.com')
  }

  return (
    <View
      className={`flex-1 ${isDarkColorScheme ? 'bg-black' : 'bg-white'}`}
      style={{ paddingTop: Platform.OS === 'web' ? 80 : 0 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full web:max-w-2xl web:mx-auto">
          <Text className="text-2xl font-bold text-main mb-6">
            <Trans>Contact Us</Trans>
          </Text>

          {/* Introduction */}
          <View className="mb-6">
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              <Trans>
                We'd love to hear from you! Whether you have questions,
                feedback, or partnership inquiries, feel free to reach out to
                us.
              </Trans>
            </Text>
          </View>

          {/* Email Contact */}
          <View className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Text className="text-lg font-semibold mb-2">
              <Trans>Email</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300 mb-3">
              <Trans>For general inquiries and support:</Trans>
            </Text>
            <Button onPress={handleEmailPress} variant="outline">
              <Text>hello@jomcontest.com</Text>
            </Button>
          </View>

          {/* Business Inquiries */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">
              <Trans>Business Inquiries</Trans>
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              <Trans>
                Interested in listing your contest on JomContest or exploring
                partnership opportunities? We're always open to collaborations
                that benefit our Malaysian community.
              </Trans>
            </Text>
          </View>

          {/* Feedback */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">
              <Trans>Feedback</Trans>
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              <Trans>
                Your feedback helps us improve! If you have suggestions on how
                we can make JomContest better, please don't hesitate to share
                your thoughts with us.
              </Trans>
            </Text>
          </View>

          {/* Response Time */}
          <View className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
              <Trans>
                We typically respond within 1-2 business days. Thank you for
                your patience!
              </Trans>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
