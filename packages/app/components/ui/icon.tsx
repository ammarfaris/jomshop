import IconWrapper from 'app/components/icons-svg/utils/IconWrapper'
import { useColorScheme } from 'app/hooks/useColorScheme'
import * as React from 'react'
import type { ViewStyle } from 'react-native'

type IconComponentType = React.ComponentType<any> & {
  isSolidIcon?: boolean
  defaultStrokeWidth?: number
}

type IconProps = {
  as: IconComponentType
  size?: number
  className?: string
  color?: string
  fillColor?: string
  style?: ViewStyle
  variant?: 'solid' | 'outline'
  colorInverted?: boolean
  strokeWidth?: number
}

/**
 * A wrapper component for custom icons-svg with Tailwind `className` support.
 *
 * This component allows you to render any icon from the icons-svg system while applying
 * Tailwind utility classes. It integrates with IconWrapper for proper theming.
 *
 * @component
 * @example
 * ```tsx
 * import { CheckOutline } from 'app/components/icons-svg/CheckOutline';
 * import { Icon } from 'app/components/ui/icon';
 *
 * <Icon as={CheckOutline} className="text-red-500" size={16} />
 * ```
 *
 * @param {IconComponentType} as - The icon component from icons-svg to render.
 * @param {string} className - Utility classes to style the icon (primarily web; native color is driven by the resolved stroke/fill).
 * @param {number} size - Icon size (defaults to 14).
 * @param {string} color - Custom color for the icon (overrides theme).
 * @param {string} fillColor - Custom fill color for solid icons.
 * @param {ViewStyle} style - Additional inline styles.
 * @param {'solid' | 'outline'} variant - Icon variant (overrides auto-detection).
 * @param {boolean} colorInverted - Whether to invert color based on theme (defaults to true).
 * @param {number} strokeWidth - Custom stroke width for outline icons.
 */
function Icon({
  as: IconComponent,
  className,
  size = 14,
  color,
  fillColor,
  style,
  variant,
  colorInverted = true,
  strokeWidth,
}: IconProps) {
  const { isDarkColorScheme } = useColorScheme()

  // Extract color from className if present (for web compatibility)
  // This allows className="text-foreground" to work properly
  const colorFromClassName = React.useMemo(() => {
    if (!className || color) return color

    // Map common Tailwind text colors to actual colors
    const colorMap: Record<string, { light: string; dark: string }> = {
      'text-foreground': { light: '#000000', dark: '#ffffff' },
      'text-muted-foreground': { light: '#6b7280', dark: '#9ca3af' },
      'text-accent-foreground': { light: '#000000', dark: '#ffffff' },
      'text-primary': { light: '#000000', dark: '#ffffff' },
      'text-secondary': { light: '#6b7280', dark: '#9ca3af' },
      // primary-foreground: inverse of primary bg (for checkbox checkmarks, etc.)
      'text-primary-foreground': { light: '#ffffff', dark: '#000000' },
    }

    for (const [key, value] of Object.entries(colorMap)) {
      if (className.includes(key)) {
        return isDarkColorScheme ? value.dark : value.light
      }
    }

    return color
  }, [className, color, isDarkColorScheme])

  return (
    <IconWrapper
      Icon={IconComponent}
      size={size}
      color={colorFromClassName}
      fillColor={fillColor}
      style={style}
      variant={variant}
      colorInverted={colorInverted}
      strokeWidth={strokeWidth}
      className={className}
    />
  )
}

export { Icon, type IconProps, type IconComponentType }
