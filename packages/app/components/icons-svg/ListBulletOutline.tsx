// https://heroicons.com/outline
// list-bullet
import Svg, { SvgProps, Path } from "react-native-svg";
import { memo } from "react";
import { configureIcon } from "./utils/iconUtils";
import { iconWithClassName } from "./utils/iconWIthClassName";

const SvgComponent = (props: SvgProps) => (
  <Svg
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
    />
  </Svg>
);

const MemoizedSvgComponent = memo(SvgComponent);
const ConfiguredIcon = configureIcon(MemoizedSvgComponent, {
  strokeWidth: 1.5, // this will set the default strokeWidth, not the one above, but for solid icon strokeWidth has no effect
  isSolid: false,
});
iconWithClassName(ConfiguredIcon);
export { ConfiguredIcon as ListBulletOutline };
