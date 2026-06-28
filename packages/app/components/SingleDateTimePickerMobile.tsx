import { useState, useEffect } from 'react'
import { View, Pressable, Text } from 'react-native'
import dayjs from 'dayjs'
import DateTimePickerModal from 'react-native-modal-datetime-picker'

export default function SingleDateTimePickerMobile({
  value,
  onChange,
  ...props
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}) {
  const [datetime, setDatetime] = useState<Date | undefined>(() => {
    if (value) {
      try {
        return new Date(value)
      } catch {
        return undefined
      }
    }
    return undefined
  })

  const [isDatePickerVisible, setDatePickerVisibility] = useState(false)

  // Sync local state with prop changes
  useEffect(() => {
    if (value) {
      try {
        const newDate = new Date(value)
        setDatetime(newDate)
      } catch {
        setDatetime(undefined)
      }
    } else {
      setDatetime(undefined)
    }
  }, [value])

  const showDatePicker = () => {
    setDatePickerVisibility(true)
  }

  const hideDatePicker = () => {
    setDatePickerVisibility(false)
  }

  const handleConfirm = (date: Date) => {
    setDatetime(date)
    onChange(date.toISOString())
    hideDatePicker()
  }

  const handleCancel = () => {
    hideDatePicker()
  }

  return (
    <View>
      <Pressable
        onPress={showDatePicker}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            height: 48, // native:h-12
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#d1d5db', // border-input equivalent
            backgroundColor: 'white',
            paddingHorizontal: 12,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, color: '#000' }}>
            {datetime
              ? dayjs(datetime).format('DD MMMM YYYY, HH:mm')
              : props.placeholder ?? 'Select date and time'}
          </Text>
        </View>
      </Pressable>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        date={datetime || new Date()}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  )
}
