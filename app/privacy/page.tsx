import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy · Context" };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-12 font-serif text-2xl">{children}</h2>;

export default function Privacy() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-5 sm:px-10">
          <Wordmark />
          <Link href="/study" className="text-ink-2 hover:text-ink">Choose a passage →</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14 leading-relaxed text-ink-2 sm:px-10">
        <p className="eyebrow text-accent">Privacy</p>
        <h1 className="mt-4 font-serif text-[clamp(2.2rem,5vw,3.2rem)] text-ink">What Context stores, and why.</h1>
        <p className="mt-4">
          Context is a free, non-commercial Bible study project. It has no ads, sells nothing, and shares nothing about you
          except what is listed below. Last updated 29 September 2026.
        </p>

        <H>Reading without an account</H>
        <p className="mt-2">
          You can read and study without signing in. To remember your notes and quiz answers on this browser, Context sets a
          random, anonymous identifier in a cookie. It also remembers your chosen Bible versions in a cookie. These cookies
          are not used for tracking or advertising.
        </p>

        <H>Signing in with Google</H>
        <p className="mt-2">
          If you choose to sign in, Google shares your <b className="font-medium text-ink">name, email address and profile picture</b> with
          Context. We use them only to identify your account and show who is signed in. Context never sees your Google password
          and does not access your Gmail, Drive or anything else.
        </p>

        <H>What you write</H>
        <p className="mt-2">
          Notes, reflections and Text-or-Assumption answers are stored in Context’s database so you can see them again. They
          are private to you and are not published or shared.
        </p>

        <H>The research assistant (AI)</H>
        <p className="mt-2">
          When you use <b className="font-medium text-ink">Ask</b> or <b className="font-medium text-ink">Check a statement</b>, the question you
          type is sent, together with public-domain Bible text and commentary from Context, to Google’s Gemini API to generate
          the answer. Context uses Gemini’s free tier, under which Google may use submitted content to improve its services — so
          please don’t type anything personal there. A log of each request is kept to audit the assistant’s accuracy. Licensed
          translations (NIV, NLT, NASB) are never sent to the AI.
        </p>

        <H>Licensed Bible translations</H>
        <p className="mt-2">
          When you read NIV, NLT or NASB, their text is supplied by API.Bible, which requires a usage report (FUMS) listing the
          passages viewed with anonymous device and session identifiers. The New Amharic Standard Version (NASV) is supplied
          by the YouVersion Platform: Context’s server requests the chapter, so YouVersion and Biblica can count which
          chapters are read, but nothing about you is sent with the request. See the{" "}
          <Link href="/copyright" className="text-accent underline underline-offset-4">copyright page</Link>.
        </p>

        <H>Where data lives</H>
        <p className="mt-2">
          The site is hosted on Vercel and the database on Neon (both in the United States). These providers process data
          only to run the service.
        </p>

        <H>Your choices</H>
        <p className="mt-2">
          You can sign out at any time. To have your account and everything you wrote deleted, open a request on the project’s{" "}
          <a href="https://github.com/BeimnetTadesse/Context/issues" className="text-accent underline underline-offset-4" target="_blank" rel="noreferrer">
            GitHub issues page
          </a>{" "}
          (without posting personal details publicly), and it will be removed.
        </p>
      </main>
    </div>
  );
}
