import { View, ScrollView, Platform } from 'react-native'
import { Trans } from '@lingui/react/macro'

import { Text } from 'app/components/ui/text'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useColorScheme } from 'app/hooks/useColorScheme'

export default function PrivacyScreen() {
  const { bottom } = useSafeArea()
  const { isDarkColorScheme } = useColorScheme()

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <Text className="text-lg font-semibold mb-2 mt-4">{children}</Text>
  )

  const Paragraph = ({ children }: { children: React.ReactNode }) => (
    <Text className="text-base leading-6 text-gray-700 dark:text-gray-300 mb-3">
      {children}
    </Text>
  )

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
          <Text className="text-2xl font-bold text-main mb-2">
            <Trans>Privacy Policy</Trans>
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            <Trans>Last updated: February 2026</Trans>
          </Text>

          {/* Introduction */}
          <Paragraph>
            <Trans>
              JomContest ("we", "us", or "our") is committed to protecting your
              personal data in accordance with the Personal Data Protection Act
              2010 (Act 709) of Malaysia ("PDPA"). This Privacy Policy explains
              how we collect, use, disclose, and protect your personal data when
              you use our website and mobile application.
            </Trans>
          </Paragraph>

          {/* Section 1 */}
          <SectionTitle>
            <Trans>1. Personal Data We Collect</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>We may collect the following types of personal data:</Trans>
          </Paragraph>
          <View className="gap-1 mb-3 ml-4">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Name and display name</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Email address</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Profile picture (if provided)</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Language and app preferences</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Device information and usage data</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Contest participation and saved contests</Trans>
            </Text>
          </View>

          {/* Section 2 */}
          <SectionTitle>
            <Trans>2. Purpose of Data Collection</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              Your personal data is collected and processed for the following
              purposes:
            </Trans>
          </Paragraph>
          <View className="gap-1 mb-3 ml-4">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>To create and manage your account</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>To provide personalized contest recommendations</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>To send contest alerts and notifications</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>To process subscription payments</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>To improve our services and user experience</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>To communicate with you about our services</Trans>
            </Text>
          </View>

          {/* Section 3 */}
          <SectionTitle>
            <Trans>3. Consent</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              By using JomContest, you consent to the collection, processing,
              and use of your personal data as described in this Privacy Policy.
              You may withdraw your consent at any time by contacting us or
              deleting your account.
            </Trans>
          </Paragraph>

          {/* Section 4 */}
          <SectionTitle>
            <Trans>4. Disclosure of Personal Data</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              We do not sell your personal data. We may share your data with:
            </Trans>
          </Paragraph>
          <View className="gap-1 mb-3 ml-4">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              •{' '}
              <Trans>
                Service providers who assist in operating our platform
              </Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Payment processors for subscription services</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              •{' '}
              <Trans>
                Law enforcement agencies when required by law
              </Trans>
            </Text>
          </View>

          {/* Section 5 */}
          <SectionTitle>
            <Trans>5. Data Security</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              We implement appropriate technical and organizational security
              measures to protect your personal data against unauthorized
              access, alteration, disclosure, or destruction. This includes
              encryption, secure servers, and access controls.
            </Trans>
          </Paragraph>

          {/* Section 6 */}
          <SectionTitle>
            <Trans>6. Data Retention</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              We retain your personal data only for as long as necessary to
              fulfill the purposes for which it was collected, or as required by
              law. When you delete your account, we will delete or anonymize
              your personal data within a reasonable timeframe.
            </Trans>
          </Paragraph>

          {/* Section 7 */}
          <SectionTitle>
            <Trans>7. Your Rights</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>Under the PDPA, you have the right to:</Trans>
          </Paragraph>
          <View className="gap-1 mb-3 ml-4">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Access your personal data held by us</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Correct any inaccurate personal data</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Withdraw consent for data processing</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              •{' '}
              <Trans>
                Request deletion of your personal data (subject to legal
                requirements)
              </Trans>
            </Text>
          </View>

          {/* Section 8 */}
          <SectionTitle>
            <Trans>8. Cookies and Tracking</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              Our website uses cookies and similar technologies to enhance your
              browsing experience and analyze usage patterns. You can manage
              cookie preferences through your browser settings.
            </Trans>
          </Paragraph>

          {/* Section 9 */}
          <SectionTitle>
            <Trans>9. Changes to This Policy</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the new policy on
              our platform with an updated effective date.
            </Trans>
          </Paragraph>

          {/* Section 10 */}
          <SectionTitle>
            <Trans>10. Contact Us</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              If you have any questions about this Privacy Policy or wish to
              exercise your rights under the PDPA, please contact us at:
            </Trans>
          </Paragraph>
          <View className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg mt-2">
            <Text className="text-base font-medium">JomContest</Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              Email: hello@jomcontest.com
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
