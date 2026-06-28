// Bookmark solid icon with receipt count badge
import Svg, { SvgProps, Path, Circle, Text as SvgText } from 'react-native-svg'
import { memo } from 'react'
import { configureIcon } from './utils/iconUtils'
import { iconWithClassName } from './utils/iconWIthClassName'

interface BookmarkSolidWithBadgeProps extends SvgProps {
  count?: number
}

const SvgComponent = ({ count = 0, ...props }: BookmarkSolidWithBadgeProps) => (
  <Svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    {/* Bookmark solid path */}
    <Path
      fillRule="evenodd"
      d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z"
      clipRule="evenodd"
    />

    {/* Badge circle and count - only show if count > 0 */}
    {count > 0 && (
      <>
        <Circle
          cx="16"
          cy="8"
          r="7"
          fill="#ef4444"
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
  isSolid: true,
})
iconWithClassName(ConfiguredIcon)
export { ConfiguredIcon as BookmarkSolidWithBadge }
