export type IconWithMetadata = React.ComponentType<any> & {
  isSolidIcon?: boolean;
  defaultStrokeWidth?: number;
};

export function markSolidIcon<T extends IconWithMetadata>(Icon: T): T {
  Icon.isSolidIcon = true;
  return Icon;
}

export function setDefaultStrokeWidth<T extends IconWithMetadata>(
  Icon: T,
  strokeWidth: number
): T {
  Icon.defaultStrokeWidth = strokeWidth;
  return Icon;
}

// Utility function to chain both operations
export function configureIcon<T extends IconWithMetadata>(
  Icon: T,
  options: { isSolid?: boolean; strokeWidth?: number }
): T {
  if (options.isSolid) {
    markSolidIcon(Icon);
  }
  if (options.strokeWidth !== undefined) {
    setDefaultStrokeWidth(Icon, options.strokeWidth);
  }
  return Icon;
}
