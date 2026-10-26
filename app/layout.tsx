import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { EB_Garamond, IBM_Plex_Mono, Instrument_Sans, Noto_Serif_Ethiopic, Noto_Serif_Hebrew } from "next/font/google";
import "./globals.css";

// EB Garamond covers Latin + polytonic Greek, so Scripture and Greek share one voice.
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin", "greek", "greek-ext"],
  style: ["normal", "italic"],
});
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const ethiopic = Noto_Serif_Ethiopic({ variable: "--font-ethiopic", subsets: ["ethiopic"], weight: ["400", "500"] });
// The Hebrew Bible, with its vowel points and accents.
const hebrew = Noto_Serif_Hebrew({ variable: "--font-hebrew-face", subsets: ["hebrew"], weight: ["400", "500"] });

// Google Search Console ownership proof (public by design: it's published in the page head).
// Needed for Google's brand verification of the "Sign in with Google" screen.
const GOOGLE_SITE_VERIFICATION = "";

const DESCRIPTION = "Slow down. Read deeply. Understand the context. Every claim labelled, every source shown.";

// Link previews (Telegram, WhatsApp, LinkedIn, X…): the share image is app/opengraph-image.png and
// app/twitter-image.png. Each page's own <title> is used as the preview title.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.context1.io"),
  title: "Context — a study workspace for Scripture",
  description: DESCRIPTION,
  applicationName: "Context",
  openGraph: { type: "website", siteName: "Context", locale: "en", description: DESCRIPTION },
  twitter: { card: "summary_large_image", description: DESCRIPTION },
  ...(GOOGLE_SITE_VERIFICATION ? { verification: { google: GOOGLE_SITE_VERIFICATION } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${garamond.variable} ${instrument.variable} ${plexMono.variable} ${ethiopic.variable} ${hebrew.variable}`}
    >
      <body className="min-h-dvh">
        {children}
        {/* Vercel Web Analytics: page views and visitor counts, no cookies, no personal data. */}
        <Analytics />
      </body>
    </html>
  );
}
