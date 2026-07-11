/**
 * Since the migration to Uniwind, the custom SVG icons are colored
 * via the explicit `stroke` / `fill` props computed in IconWrapper (driven by
 * `useColorScheme` and the `color` prop), so no per-icon className interop is
 * required. This is intentionally a no-op so the ~41 icon modules that call it
 * don't need to change.
 *
 * - Web: `className` still passes through react-native-web / react-native-svg to
 *   the DOM, and `icon.tsx` maps common Tailwind text colors to a concrete
 *   `color`.
 * - Native: to drive icon color from `className` itself, wrap the icon with
 *   `withUniwind` (see the bendary-rnr reference's `components/ui/icon.tsx`).
 *   Deferred here to avoid any behavior change during the migration.
 */
export function iconWithClassName(_icon: unknown): void {}
