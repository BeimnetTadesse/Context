import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Mono, Instrument_Sans, Noto_Serif_Ethiopic } from "next/font/google";
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

// Google Search Console ownership proof (public by design: it's published in the page head).
// Needed for Google's brand verification of the "Sign in with Google" screen.
const GOOGLE_SITE_VERIFICATION = "";

export const metadata: Metadata = {
  title: "Context — a study workspace for Scripture",
  description:
    "Slow down. Read deeply. Understand the context. Every claim labelled, every source shown.",
  ...(GOOGLE_SITE_VERIFICATION ? { verification: { google: GOOGLE_SITE_VERIFICATION } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${garamond.variable} ${instrument.variable} ${plexMono.variable} ${ethiopic.variable}`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
