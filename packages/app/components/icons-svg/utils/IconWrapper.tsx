import { useColorScheme } from 'app/hooks/useColorScheme'
import { ViewStyle } from 'react-native'

export default function IconWrapper({
  Icon,
  size = 24,
  color,
  fillColor,
  style,
  variant, // "solid" or "outline"
  colorInverted = true, // default color follow theme mode, if dark (color is black) and vice versa
  strokeWidth,
  className = '', // Web: forwarded to the DOM SVG (Tailwind via react-native-web). Native: color comes from the resolved stroke/fill props below.
}: {
  Icon: React.ComponentType<any> & {
    isSolidIcon?: boolean
    defaultStrokeWidth?: number
  }
  size?: number
  color?: string // this can actually be used for both solid and outline
  fillColor?: string
  style?: ViewStyle
  variant?: 'solid' | 'outline'
  colorInverted?: boolean
  strokeWidth?: number
  className?: string
}) {
  const { isDarkColorScheme } = useColorScheme()

  // Resolve icon type: from prop
  const inferredSolid = Icon.isSolidIcon === true

  const isSolidIcon = variant === 'solid' || (variant == null && inferredSolid)

  // Custom color logic for stroke & fill
  const computedColor =
    color ??
    (colorInverted
      ? isDarkColorScheme
        ? 'white'
        : 'black'
      : isDarkColorScheme
      ? 'black'
      : 'white')

  const resolvedStrokeColor = isSolidIcon ? 'none' : computedColor
  const resolvedFillColor = fillColor ?? (isSolidIcon ? computedColor : 'none')
  const resolvedStrokeWidth =
    strokeWidth ?? (Icon as any).defaultStrokeWidth ?? 1.5 //(Icon as any).defaultStrokeWidth not implemented yet

  return (
    <Icon
      width={size}
      height={size}
      stroke={resolvedStrokeColor}
      fill={resolvedFillColor}
      style={style}
      strokeWidth={resolvedStrokeWidth}
      className={className}
    />
  )
}
