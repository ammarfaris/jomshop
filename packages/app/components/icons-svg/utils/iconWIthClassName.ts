// need this, or else className (nativewind) won't work in native (ios and android) for our icons-svg
import { cssInterop } from "nativewind";

export function iconWithClassName(icon: any) {
  cssInterop(icon, {
    className: {
      target: "style",
      nativeStyleToProp: {
        color: true,
        opacity: true,
      },
    },
  });
}
