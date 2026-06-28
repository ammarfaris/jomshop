import { useState } from 'react'
import { View, Pressable, Platform } from 'react-native'
import { Trans } from '@lingui/react/macro'

import { Link } from 'app/lib/link-universal'
import { Text } from 'app/components/ui/text'
import { Card, CardContent } from 'app/components/ui/card'
import { XMarkOutline } from 'app/components/icons-svg/XMarkOutline'
import ContestListScreen from 'app/features/contests/list-screen'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useColorTheme } from 'app/contexts/ColorThemeContext'
import { useColorThemeValues } from 'app/hooks/useColorThemeValues'
import { useColorScheme } from 'app/hooks/useColorScheme'
import { useAuth } from 'app/contexts/AuthContext'

export default function HomeScreen() {
  const [showWelcomeCard, setShowWelcomeCard] = useState(true)
  useSafeArea()
  useColorTheme()
  const { isDarkColorScheme } = useColorScheme()
  const { main } = useColorThemeValues(isDarkColorScheme)
  const { user } = useAuth()

  return (
    <View className="flex-1 dark:bg-black bg-white">
      {showWelcomeCard && (
        <View
          className="pb-2"
          style={{
            paddingTop: Platform.OS === 'web' ? 84 : 4,
            paddingLeft: Platform.OS === 'web' ? 4 : 16,
            paddingRight: Platform.OS === 'web' ? 4 : 16,
          }}
        >
          <Card className="w-full web:max-w-4xl web:mx-auto">
            <CardContent className="p-4">
              <View className="flex-row items-start gap-3">
                <View className="flex-1 items-center">
                  <Trans>
                    <Text
                      className={`text-xl font-bold mb-2 text-center ${
                        Platform.OS === 'web' ? 'text-main' : ''
                      }`}
                      style={
                        Platform.OS === 'web' ? undefined : { color: main }
                      }
                    >
                      Welcome to JomContest 👋🏻
                    </Text>
                  </Trans>
                  <Trans>
                    <Text className="text-sm mb-1 text-center">
                      "Contest discovery made easy, Winning made possible!"
                    </Text>
                  </Trans>
                  <Trans>
                    <Text className="text-sm mb-1 text-center">
                      Made with 💙 by{' '}
                      <Link
                        href="https://aaf.digital"
                        target="_blank"
                        className={
                          Platform.OS === 'web'
                            ? 'text-main underline'
                            : 'underline'
                        }
                        style={
                          Platform.OS === 'web' ? undefined : { color: main }
                        }
                      >
                        AAF Digital
                      </Link>
                      .
                    </Text>
                  </Trans>
                  <Trans>
                    <Text className="text-sm font-semibold  mt-2 text-center">
                      Start discovering contests now!
                    </Text>
                  </Trans>
                </View>
                {user && (
                  <Pressable
                    onPress={() => setShowWelcomeCard(false)}
                    className="p-1"
                  >
                    <XMarkOutline
                      width={20}
                      height={20}
                      className="text-gray-500 dark:text-gray-400"
                    />
                  </Pressable>
                )}
              </View>
            </CardContent>
          </Card>
        </View>
      )}
      {/* Show ContestListScreen for both authenticated and anonymous users */}
      {/* Anonymous users will see public contests via the public-contests function */}
      <ContestListScreen hideTopPadding={true} />
    </View>
  )
}
