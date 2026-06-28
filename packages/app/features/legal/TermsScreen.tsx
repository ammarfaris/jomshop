import { View, ScrollView, Platform } from 'react-native'
import { Trans } from '@lingui/react/macro'

import { Text } from 'app/components/ui/text'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useColorScheme } from 'app/hooks/useColorScheme'

export default function TermsScreen() {
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
            <Trans>Terms & Conditions</Trans>
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            <Trans>Last updated: February 2026</Trans>
          </Text>

          {/* Introduction */}
          <Paragraph>
            <Trans>
              Welcome to JomContest. By accessing or using our website and
              mobile application, you agree to be bound by these Terms and
              Conditions. Please read them carefully before using our services.
            </Trans>
          </Paragraph>

          {/* Section 1 */}
          <SectionTitle>
            <Trans>1. About JomContest</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              JomContest is a contest aggregation platform that collects and
              displays information about contests, giveaways, and competitions
              from various sources across Malaysia. We act as an information
              aggregator and do not organize, host, or manage any of the
              contests listed on our platform.
            </Trans>
          </Paragraph>

          {/* Section 2 */}
          <SectionTitle>
            <Trans>2. User Accounts</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              To access certain features, you must create an account. You are
              responsible for maintaining the confidentiality of your account
              credentials and for all activities that occur under your account.
              You must provide accurate and complete information when creating
              your account.
            </Trans>
          </Paragraph>

          {/* Section 3 */}
          <SectionTitle>
            <Trans>3. Platform Role and Disclaimer</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              JomContest is a venue for contest discovery only. We do not:
            </Trans>
          </Paragraph>
          <View className="gap-1 mb-3 ml-4">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Organize or host any contests</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Guarantee the legitimacy of listed contests</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Control contest rules, prizes, or outcomes</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              •{' '}
              <Trans>
                Have any relationship with contest organizers unless stated
              </Trans>
            </Text>
          </View>
          <Paragraph>
            <Trans>
              Users participate in contests at their own risk. We recommend
              verifying contest details directly with the organizer before
              participating.
            </Trans>
          </Paragraph>

          {/* Section 4 */}
          <SectionTitle>
            <Trans>4. Acceptable Use</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>When using JomContest, you agree not to:</Trans>
          </Paragraph>
          <View className="gap-1 mb-3 ml-4">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              •{' '}
              <Trans>
                Use the platform for any illegal or unauthorized purpose
              </Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Attempt to gain unauthorized access to our systems</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              •{' '}
              <Trans>
                Scrape, copy, or reproduce our content without permission
              </Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Submit false or misleading information</Trans>
            </Text>
            <Text className="text-base text-gray-700 dark:text-gray-300">
              • <Trans>Interfere with other users' use of the platform</Trans>
            </Text>
          </View>

          {/* Section 5 */}
          <SectionTitle>
            <Trans>5. Subscription Services</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              JomContest offers free and premium subscription tiers. Premium
              subscriptions provide additional features such as enhanced alerts,
              receipt storage, and ad-free browsing. Subscription fees are
              non-refundable unless required by law. You may cancel your
              subscription at any time, and access will continue until the end
              of the billing period.
            </Trans>
          </Paragraph>

          {/* Section 6 */}
          <SectionTitle>
            <Trans>6. Intellectual Property</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              The JomContest name, logo, and platform design are our
              intellectual property. Contest information displayed on our
              platform belongs to their respective organizers. You may not use
              our branding or content without prior written permission.
            </Trans>
          </Paragraph>

          {/* Section 7 */}
          <SectionTitle>
            <Trans>7. Limitation of Liability</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              To the fullest extent permitted by law, JomContest shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages arising from your use of our platform, including
              but not limited to losses related to contest participation,
              prizes, or reliance on contest information.
            </Trans>
          </Paragraph>

          {/* Section 8 */}
          <SectionTitle>
            <Trans>8. Indemnification</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              You agree to indemnify and hold harmless JomContest, its
              affiliates, and their respective officers, directors, employees,
              and agents from any claims, damages, losses, or expenses arising
              from your use of the platform or violation of these terms.
            </Trans>
          </Paragraph>

          {/* Section 9 */}
          <SectionTitle>
            <Trans>9. Modifications</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              We reserve the right to modify these Terms and Conditions at any
              time. Changes will be effective upon posting to our platform.
              Continued use of JomContest after changes constitutes acceptance
              of the modified terms.
            </Trans>
          </Paragraph>

          {/* Section 10 */}
          <SectionTitle>
            <Trans>10. Termination</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              We may suspend or terminate your account at any time for violation
              of these terms or for any other reason at our discretion. Upon
              termination, your right to use the platform will immediately
              cease.
            </Trans>
          </Paragraph>

          {/* Section 11 */}
          <SectionTitle>
            <Trans>11. Governing Law</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              These Terms and Conditions are governed by and construed in
              accordance with the laws of Malaysia. Any disputes shall be
              subject to the exclusive jurisdiction of the Malaysian courts.
            </Trans>
          </Paragraph>

          {/* Section 12 */}
          <SectionTitle>
            <Trans>12. Contact Us</Trans>
          </SectionTitle>
          <Paragraph>
            <Trans>
              If you have any questions about these Terms and Conditions, please
              contact us at:
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
