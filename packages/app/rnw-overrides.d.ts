// override react-native types with react-native-web types
import 'react-native'

declare module 'react-native' {
  interface PressableStateCallbackType {
    /** Not used but keep */
    hovered?: boolean
    focused?: boolean
  }
  interface PressableProps {
    /** Optional Tailwind / CSS class string for RN Web */
    className?: string
  }
  interface ViewStyle {
    transitionProperty?: string
    transitionDuration?: string
  }
  interface TextProps {
    /** Optional Tailwind / CSS class string for RN Web */
    className?: string
    accessibilityComponentType?: never
    accessibilityTraits?: never
    href?: string
    hrefAttrs?: {
      rel: 'noreferrer'
      target?: '_blank'
    }
  }
  interface ViewProps {
    /** Optional Tailwind / CSS class string for RN Web */
    className?: string
    accessibilityRole?: string
    href?: string
    hrefAttrs?: {
      rel: 'noreferrer'
      target?: '_blank'
    }
    onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
  }
}
