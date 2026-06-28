// https://heroicons.com/outline
// bookmark
import Svg, { SvgProps, Path } from 'react-native-svg'
import { memo } from 'react'
import { configureIcon } from './utils/iconUtils'
import { iconWithClassName } from './utils/iconWIthClassName'

const SvgComponent = (props: SvgProps) => (
  <Svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
    />
  </Svg>
)

const MemoizedSvgComponent = memo(SvgComponent)
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5,
  isSolid: false,
})
iconWithClassName(ConfiguredIcon)
export { ConfiguredIcon as BookmarkIcon }
