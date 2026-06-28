// https://heroicons.com/outline
// plus
import Svg, { SvgProps, Path } from 'react-native-svg'
import { memo } from 'react'
import { configureIcon } from './utils/iconUtils'
import { iconWithClassName } from './utils/iconWIthClassName'

const SvgComponent = (props: SvgProps) => (
  <Svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </Svg>
)

const MemoizedSvgComponent = memo(SvgComponent)
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5,
  isSolid: false,
})
iconWithClassName(ConfiguredIcon)
export { ConfiguredIcon as PlusOutline }
