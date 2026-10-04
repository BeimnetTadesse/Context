import "server-only";
import { sql } from "@/lib/db";

// Usage numbers for the owner's /stats page. Counts only: never what anyone wrote or asked.
// "Active" = did something that reaches the database (asked, noted, answered a quiz) in the period.
// People who only read are counted by Vercel Web Analytics instead.

const ACTIVITY = sql`
  select user_id, created_at from ai_runs where user_id is not null
  union all select user_id, created_at from notes
  union all select user_id, created_at from assumption_guesses`;

export async function getStats() {
  const [people] = await sql<{ accounts: number; accounts_7d: number; devices: number }[]>`
    select count(*) filter (where email is not null)::int as accounts,
           count(*) filter (where email is not null and created_at > now() - interval '7 days')::int as accounts_7d,
           count(*) filter (where email is null)::int as devices
    from users`;

  const active = await sql<{ days: number; accounts: number; devices: number }[]>`
    select d.days,
           count(distinct a.user_id) filter (where u.email is not null)::int as accounts,
           count(distinct a.user_id) filter (where u.email is null)::int as devices
    from (values (1), (7), (30)) as d(days)
    left join (${ACTIVITY}) a on a.created_at > now() - make_interval(days => d.days)
    left join users u on u.id = a.user_id
    group by d.days order by d.days`;

  const daily = await sql<{ day: string; people: number; questions: number }[]>`
    select to_char(d.day, 'Mon DD') as day,
           (select count(distinct user_id)::int from (${ACTIVITY}) a where a.created_at >= d.day and a.created_at < d.day + interval '1 day') as people,
           (select count(*)::int from ai_runs r where r.kind in ('ask', 'assumption') and r.created_at >= d.day and r.created_at < d.day + interval '1 day') as questions
    from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as d(day)
    order by d.day`;

  const [totals] = await sql<{ questions: number; questions_24h: number; ai_24h: number; notes: number; guesses: number }[]>`
    select (select count(*)::int from ai_runs where kind in ('ask', 'assumption')) as questions,
           (select count(*)::int from ai_runs where kind in ('ask', 'assumption') and created_at > now() - interval '24 hours') as questions_24h,
           (select count(*)::int from ai_runs where created_at > now() - interval '24 hours') as ai_24h,
           (select count(*)::int from notes where kind <> 'text_issue') as notes,
           (select count(*)::int from assumption_guesses) as guesses`;

  const chapters = await sql<{ name: string; chapter: number; slug: string; questions: number }[]>`
    select b.name, r.chapter, b.slug, count(*)::int as questions
    from ai_runs r join books b on b.id = r.book_id
    where r.kind in ('ask', 'assumption') and r.created_at > now() - interval '30 days'
    group by b.name, b.slug, r.chapter order by questions desc, b.name limit 5`;

  return { people, active, daily, totals, chapters };
}
