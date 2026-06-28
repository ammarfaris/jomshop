// Bookmark icon with receipt count badge
import Svg, { SvgProps, Path, Circle, Text as SvgText } from 'react-native-svg'
import { memo } from 'react'
import { configureIcon } from './utils/iconUtils'
import { iconWithClassName } from './utils/iconWIthClassName'

interface BookmarkWithBadgeProps extends SvgProps {
  count?: number
}

const SvgComponent = ({ count = 0, ...props }: BookmarkWithBadgeProps) => (
  <Svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    {/* Bookmark outline path */}
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
    />

    {/* Badge circle and count - only show if count > 0 */}
    {count > 0 && (
      <>
        <Circle
          cx="16"
          cy="8"
          r="7"
          fill="#3b82f6"
          stroke="white"
          strokeWidth="1.5"
        />
        <SvgText
          x="16"
          y="11.5"
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="white"
        >
          {count}
        </SvgText>
      </>
    )}
  </Svg>
)

const MemoizedSvgComponent = memo(SvgComponent)
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5,
  isSolid: false,
})
iconWithClassName(ConfiguredIcon)
export { ConfiguredIcon as BookmarkWithBadge }
