import { View, ActivityIndicator, ViewStyle } from 'react-native'

import IconWrapper from 'app/components/icons-svg/utils/IconWrapper'
import { Text } from 'app/components/ui/text'
import { Button } from 'app/components/ui/button'
import { useColorScheme } from 'app/hooks/useColorScheme'

export function ButtonIconAndText({
  onPress,
  buttonClassName,
  buttonStyle,
  buttonText = '',
  Icon,
  iconSize = 16,
  iconColor = undefined,
  iconColorInverted = true, // default color follow theme mode, if dark (color is black) and vice versa
  iconSide = 'left',
  disabled = false,
  isLoading = false,
}: {
  onPress: () => void
  buttonClassName?: string
  buttonStyle?: ViewStyle
  buttonText?: string
  Icon: any
  iconSize?: number
  iconColor?: string
  iconColorInverted?: boolean
  iconSide?: 'left' | 'right'
  disabled?: boolean
  isLoading?: boolean
}) {
  const { isDarkColorScheme } = useColorScheme()

  return (
    <Button
      onPress={onPress}
      className={buttonClassName}
      style={buttonStyle}
      disabled={disabled || isLoading}
    >
      <View
        style={{ justifyContent: 'center', alignItems: 'center' }}
        className="relative"
      >
        {/* Icon + Text row, always rendered, hidden when loading but takes up space */}
        <View
          className="flex-row items-center justify-center gap-2"
          style={{ opacity: isLoading ? 0 : 1 }}
        >
          {iconSide === 'left' && (
            <IconWrapper
              Icon={Icon}
              color={iconColor}
              size={iconSize}
              colorInverted={iconColorInverted}
            />
          )}

          {buttonText.length > 0 && (
            <View>
              <Text>{buttonText}</Text>
              <View className="android:h-[1.5px]" />
            </View>
          )}

          {iconSide === 'right' && (
            <IconWrapper
              Icon={Icon}
              color={iconColor}
              size={iconSize}
              colorInverted={iconColorInverted}
            />
          )}
        </View>
        {/* ActivityIndicator overlays in center when loading */}
        {isLoading && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            pointerEvents="none"
          >
            <ActivityIndicator color={isDarkColorScheme ? '#000' : '#fff'} />
          </View>
        )}
      </View>
    </Button>
  )
}
