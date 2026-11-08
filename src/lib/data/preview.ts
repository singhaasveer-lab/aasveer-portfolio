/**
 * Development preview switch. Opt-in through `pnpm dev:preview` (PORTFOLIO_PREVIEW=1),
 * and honoured only by the development server. A production build ignores it here and
 * next.config.ts refuses to build while it is set.
 */
export function isPreviewEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.PORTFOLIO_PREVIEW === "1";
}
