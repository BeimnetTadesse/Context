import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmAction } from "@/components/account/ConfirmAction";
import { DeleteAccount } from "@/components/account/DeleteAccount";
import { signOutAction } from "@/app/actions";
import { deleteHighlightsAction, deleteNotesAction, resetQuizAction } from "./actions";
import { getAccount } from "@/lib/data/account";
import { currentViewer } from "@/lib/user";

export const metadata: Metadata = { title: "Profile · Context", robots: { index: false } };

const month = (d: Date) => d.toLocaleDateString("en", { month: "long", year: "numeric" });

export default async function Profile() {
  const viewer = await currentViewer();
  const account = viewer.id ? await getAccount(viewer.id) : null;
  const n = account ?? { notes: 0, reflections: 0, highlights: 0, guesses: 0, correct: 0, questions: 0 };
  const hasData = n.notes + n.reflections + n.highlights + n.guesses > 0;
  const initial = (viewer.name ?? "?").trim().charAt(0).toUpperCase();

  const stats = [
    { label: "Notes", value: n.notes, href: "/notebook?tab=notes" },
    { label: "Reflections", value: n.reflections, href: "/notebook?tab=reflections" },
    { label: "Highlights", value: n.highlights, href: "/notebook?tab=highlights" },
    { label: "Quiz answers", value: n.guesses, href: "/notebook?tab=quiz", note: n.guesses ? `${Math.round((n.correct / n.guesses) * 100)}% matched Context` : null },
    { label: "Questions asked", value: n.questions, href: null, note: "to the research assistant" },
  ];

  return (
    <div className="min-h-dvh">
      <PageHeader viewer={viewer} />
      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-10">
        <p className="eyebrow text-accent">Profile</p>

        {/* Who you are */}
        <section className="mt-6 flex flex-wrap items-center gap-6 rounded-3xl border border-rule bg-card p-6 sm:p-8">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-rule bg-paper">
            {viewer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <span className="font-serif text-3xl">{viewer.signedIn ? initial : "◦"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {viewer.signedIn ? (
              <>
                <h1 className="font-serif text-4xl leading-tight">{viewer.name}</h1>
                <p className="mt-1 text-ink-2">{viewer.email}</p>
                <p className="mt-2 text-sm text-muted">
                  Signed in with Google{account ? ` · member since ${month(account.created_at)}` : ""}. Your name and picture come
                  from your Google account.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-serif text-4xl leading-tight">Reading without an account</h1>
                <p className="mt-2 text-ink-2">
                  {hasData ? "What you save is kept in this browser only." : "Anything you save will be kept in this browser only."} Sign in
                  to keep it safe and use it on every device. It comes with you when you sign in.
                </p>
              </>
            )}
          </div>
          {viewer.signedIn ? (
            <form action={signOutAction}>
              <input type="hidden" name="next" value="/study" />
              <button className="rounded-xl border border-rule px-4 py-2 text-sm text-ink-2 hover:border-ink hover:text-ink">Sign out</button>
            </form>
          ) : (
            <Link href="/signin?next=/account" className="rounded-xl bg-ink px-5 py-2.5 text-paper">Sign in</Link>
          )}
        </section>

        {/* What you've saved */}
        <h2 className="mt-14 font-serif text-3xl">Your study</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => {
            const body = (
              <>
                <p className="font-serif text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-ink-2">{s.label}</p>
                {s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}
              </>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className="rounded-2xl border border-rule bg-card p-4 transition hover:border-ink">{body}</Link>
            ) : (
              <div key={s.label} className="rounded-2xl border border-rule bg-card p-4">{body}</div>
            );
          })}
        </div>
        <Link href="/notebook" className="mt-4 inline-block text-accent underline-offset-4 hover:underline">Open your notebook →</Link>

        {/* Your data */}
        <h2 className="mt-14 font-serif text-3xl">Your data</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Everything you save is private to you. Download a copy, or delete parts of it. Deleting can’t be undone.
        </p>
        <div className="mt-5 divide-y divide-rule rounded-2xl border border-rule bg-card">
          <Row title="Download my data" text="Notes, reflections, highlights and quiz answers as a file (JSON).">
            {hasData ? (
              <a href="/api/account/export" className="rounded-xl border border-rule bg-paper px-4 py-2 text-sm text-ink-2 hover:border-ink hover:text-ink">Download</a>
            ) : (
              <span className="text-sm text-muted">Nothing saved yet</span>
            )}
          </Row>
          <Row title="Notes and reflections" text={`${n.notes + n.reflections} saved`}>
            <ConfirmAction action={deleteNotesAction} label="Delete all" question={`Delete all ${n.notes + n.reflections}?`} disabled={n.notes + n.reflections === 0} />
          </Row>
          <Row title="Highlights" text={`${n.highlights} saved`}>
            <ConfirmAction action={deleteHighlightsAction} label="Delete all" question={`Delete all ${n.highlights}?`} disabled={n.highlights === 0} />
          </Row>
          <Row title="Quiz answers" text={`${n.guesses} answered`}>
            <ConfirmAction action={resetQuizAction} label="Reset" question="Reset your quiz answers?" disabled={n.guesses === 0} />
          </Row>
        </div>

        {/* Danger zone */}
        {(viewer.signedIn || hasData) && (
          <section className="mt-14 rounded-2xl border border-[var(--l-tradition)] p-6">
            <h2 className="font-serif text-2xl text-accent">{viewer.signedIn ? "Delete my account" : "Delete this device’s data"}</h2>
            <p className="mt-2 max-w-2xl text-ink-2">
              {viewer.signedIn ? "Your account and" : "Everything saved in this browser,"} including all notes, reflections, highlights and quiz
              answers, will be permanently deleted. Questions you asked the research assistant stay in Context’s accuracy log,
              no longer linked to you.
            </p>
            <DeleteAccount signedIn={viewer.signedIn} />
          </section>
        )}

        <p className="mt-10 text-sm text-muted">
          How Context handles your data: <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy</Link>
        </p>
      </main>
    </div>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}
