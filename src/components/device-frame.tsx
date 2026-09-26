/**
 * Device frame — native.
 *
 * On iOS/Android the app already fills a real device, so this is a pure
 * passthrough and changes nothing. The web build resolves `device-frame.web.tsx`
 * instead, which presents the app inside a phone-shaped showcase shell on desktop.
 */
export function DeviceFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
