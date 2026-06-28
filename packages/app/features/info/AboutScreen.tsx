import { View, ScrollView, Platform } from 'react-native'
import { Trans } from '@lingui/react/macro'

import { Text } from 'app/components/ui/text'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useColorScheme } from 'app/hooks/useColorScheme'

export default function AboutScreen() {
  const { bottom } = useSafeArea()
  const { isDarkColorScheme } = useColorScheme()

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
            <Trans>About Us</Trans>
          </Text>

          {/* Mission Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">
              <Trans>Our Mission</Trans>
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              <Trans>
                JomContest is Malaysia's premier contest discovery platform. We
                make it easy for Malaysians to find, track, and participate in
                contests, giveaways, and competitions across the country.
              </Trans>
            </Text>
          </View>

          {/* What We Do Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">
              <Trans>What We Do</Trans>
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300 mb-3">
              <Trans>
                We aggregate contests from various sources across Malaysia,
                bringing them all into one convenient platform. Whether you're
                looking for photo contests, lucky draws, cooking competitions,
                or creative challenges - we've got you covered.
              </Trans>
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              <Trans>
                Our platform helps you discover new opportunities, save your
                favorite contests, and never miss a deadline with our alert
                system.
              </Trans>
            </Text>
          </View>

          {/* Why JomContest Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">
              <Trans>Why JomContest?</Trans>
            </Text>
            <View className="gap-2">
              <Text className="text-base text-gray-700 dark:text-gray-300">
                • <Trans>Curated contests from trusted sources</Trans>
              </Text>
              <Text className="text-base text-gray-700 dark:text-gray-300">
                • <Trans>Easy search and filtering</Trans>
              </Text>
              <Text className="text-base text-gray-700 dark:text-gray-300">
                • <Trans>Save and track your favorite contests</Trans>
              </Text>
              <Text className="text-base text-gray-700 dark:text-gray-300">
                • <Trans>Get alerts before contests end</Trans>
              </Text>
              <Text className="text-base text-gray-700 dark:text-gray-300">
                • <Trans>Available in English and Bahasa Malaysia</Trans>
              </Text>
            </View>
          </View>

          {/* Company Info */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">
              <Trans>About the Company</Trans>
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              <Trans>
                JomContest is developed and maintained by AAF Digital, a
                Malaysian technology company focused on building useful digital
                products for the local community.
              </Trans>
            </Text>
          </View>

          {/* Tagline */}
          <View className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Text className="text-center text-base font-medium text-main">
              <Trans>
                "Contest discovery made easy, Winning made possible!"
              </Trans>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
