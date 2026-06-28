// https://heroicons.com/outline
// magnifying-glass
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
      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
    />
  </Svg>
)

const MemoizedSvgComponent = memo(SvgComponent)
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5, // this will set the default strokeWidth, not the one above, but for solid icon strokeWidth has no effect
  isSolid: false,
})
iconWithClassName(ConfiguredIcon)
export { ConfiguredIcon as SearchOutline }
