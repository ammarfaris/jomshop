import { View } from 'react-native'
import { Trans } from '@lingui/react/macro'

import { Text } from 'app/components/ui/text'
import { BellAlertOutline } from 'app/components/icons-svg/BellAlertOutline'

function AlertsTabContent() {
  return (
    <View className="flex-1 items-center justify-center p-8 gap-4">
      <BellAlertOutline
        className="w-16 h-16 text-gray-400 dark:text-gray-600"
        accessibilityLabel="No alerts"
      />
      <Text className="text-xl font-bold text-gray-800 dark:text-gray-200 text-center">
        <Trans>No Alerts Yet</Trans>
      </Text>
      <Text className="text-gray-600 dark:text-gray-400 text-center">
        <Trans>
          Important and relevant alerts will be shown here. Stay tuned!
        </Trans>
      </Text>
    </View>
  )
}

export default AlertsTabContent
