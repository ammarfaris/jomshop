import { Platform, Text, View } from 'react-native'

export default function AdminPage() {
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Admin tools are available on web only.</Text>
      </View>
    )
  }

  const AdminScreen = require('app/features/admin/screen').default

  return <AdminScreen />
}
