// https://heroicons.com/outline
// home
import Svg, { SvgProps, Path } from "react-native-svg";
import { memo } from "react";
import { configureIcon } from "./utils/iconUtils";
import { iconWithClassName } from "./utils/iconWIthClassName";

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
      d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  </Svg>
);

const MemoizedSvgComponent = memo(SvgComponent);
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5, // this will set the default strokeWidth, not the one above, but for solid icon strokeWidth has no effect
  isSolid: false,
});
iconWithClassName(ConfiguredIcon);
export { ConfiguredIcon as HomeOutline };
