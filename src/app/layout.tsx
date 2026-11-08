import type { Metadata, Viewport } from "next";
import { parseSiteUrl } from "@/lib/site";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import { SkipLink } from "@/components/layout/SkipLink";
import { MotionProvider } from "@/components/motion/MotionProvider";
import "./globals.css";

// Fonts are bundled with the build through next/font, so the page makes no third-party font request.
// Fraunces (variable weight and optical size) is the display face; Geist and Geist Mono set text and metadata.
const fraunces = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-display-face",
  display: "swap",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
});

// Only a valid https address becomes the base for absolute URLs; without one, none are emitted.
const siteUrl = parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Without JavaScript, Motion never runs, so its hidden initial states are cleared here.
const NO_SCRIPT_CSS =
  ".reveal[style*=opacity],.reveal [style*=opacity]{opacity:1!important;transform:none!important;filter:none!important}.case-open{display:none!important}.case-thumb{place-items:start center}.hero-loop-live{display:none}.hero-loop-static{position:static!important;width:auto!important;height:auto!important;clip-path:none!important}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable}`}>
      <head>
        <noscript>
          <style>{NO_SCRIPT_CSS}</style>
        </noscript>
      </head>
      <body>
        <SkipLink />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
