// https://heroicons.com/outline
// funnel
import Svg, { SvgProps, Path } from 'react-native-svg'
import { memo } from 'react'
import { configureIcon } from './utils/iconUtils'
import { iconWithClassName } from './utils/iconWIthClassName'

const SvgComponent = (props: SvgProps) => (
  <Svg
    fill="none"
    stroke="currentColor" // currentColor is needed to make the color flexible
    viewBox="0 0 24 24" // viewBox defines the coordinate system of the SVG and allows it to scale properly
    // className="size-6"  // DON'T HARDCODE SIZING  here or else sizing will be fixed
    // width={24} // DON'T HARDCODE SIZING here or else sizing will be fixed
    // height={24}  // DON'T HARDCODE SIZING  here or else sizing will be fixed
    {...props} // Let parent fully control size/stroke (hence width, height, stroke, and others are adjustable by parent)
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
    />
  </Svg>
)

const MemoizedSvgComponent = memo(SvgComponent)
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5, // this will set the default strokeWidth, not the one above, but for solid icon strokeWidth has no effect
  isSolid: false,
})
iconWithClassName(ConfiguredIcon)
export { ConfiguredIcon as FunnelOutline }
