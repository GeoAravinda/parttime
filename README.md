# Arubaito Hours — アルバイト管理システム

Web app for Japanese language schools that need to track international students' part-time work hours and keep them within the Immigration rules.

- **Normal period:** at most **28 hours in any 7 consecutive days**, with all jobs added together. Every day is checked as the end of a 7-day window, so the total does **not** reset on Monday.
- **Official long vacations:** at most **8 hours per calendar day**, with all jobs added together. This only applies to vacation dates that an admin has configured *and approved*. Weekends, national holidays and one-day school holidays stay on the normal 28-hour rule.
- **Warning colours:** green / yellow / red. Normal period: under 24h is green, 24–28h is yellow, over 28h is red. Vacation: under 6h is green, 6–8h is yellow, over 8h is red.

Stack: Next.js 15 (App Router), React 19, Tailwind CSS (shadcn-style components), Supabase (PostgreSQL, Auth, Row Level Security), Recharts, jsPDF, write-excel-file.

## How the rules are enforced (server side)

All the compliance logic is in PostgreSQL, in `supabase/schema.sql`:

| Function | What it does |
|---|---|
| `daily_hours()` | Adds up hours per student per calendar day across all jobs. Overnight shifts are split at midnight and breaks are deducted. |
| `compliance_series()` | For each date, gives the day total, the rolling 7-day total, which rule applies, the level and the hours remaining. |
| `students_overview()` | Current status of every student the caller is allowed to see (used by the teacher and admin dashboards). |
| `period_report()` | Monthly or period summary for school-wide reports. |

The database also enforces these rules itself, so the browser cannot get around them:

- An exclusion constraint stops a student from having two shifts that overlap, even if they are for different jobs.
- A student can have at most 3 active jobs. A work record must belong to one of that student's jobs and fall inside the job's employment dates.
- Approval workflow: students can only edit or delete records that are `draft` or `rejected`. Teachers can only change a `submitted` record to `approved` or `rejected`, and a rejection needs a reason. **Approved records cannot be changed by students.**
- Every change is written to `audit_logs`. Each submit, approve and reject is also kept in `approval_records`.
- When a student reaches yellow or red, the student and their assigned teachers are both notified automatically.
- RLS rules: a student sees only their own data. A teacher sees only the students assigned to them, unless an admin grants "may view all students". Admins see everything.

To run the tests (they load the real schema into an embedded Postgres, so no Supabase project is needed):

```bash
npm run test:db
```

## Setup

1. **Create a Supabase project** at <https://supabase.com> (the free plan works). Choose the Tokyo region.
2. In Supabase, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**.
3. In **Authentication → Sign In / Providers → Email**, either turn off *Confirm email* or set up SMTP. Students who register still need admin approval before they can log in.
4. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # server only, never commit it
   NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true  # shows the demo login hint; remove for production
   ```
5. Install, add the demo data, and run:
   ```bash
   npm install
   npm run seed
   npm run dev
   ```
   Then open http://localhost:3000.

### Demo accounts (password `Demo1234!`)

| Role | Email |
|---|---|
| Admin | admin@demo.jp |
| Teacher | teacher@demo.jp, teacher2@demo.jp |
| Student | student@demo.jp … student12@demo.jp |
| Pending registration | pending@demo.jp (approve it from Admin → Students) |

## Hosting on Vercel

1. Push this folder to a **private** GitHub repository.
2. On <https://vercel.com>, choose **Add New → Project**, import the repository, and keep the default (Next.js) settings.
3. Add the environment variables from step 4 above.
4. Click **Deploy**. The site works on phones and laptops.
5. In Supabase, go to **Authentication → URL Configuration** and set *Site URL* to your Vercel URL.

Before real students use it:

- Delete the demo accounts.
- Create your real admin account with `npm run seed` or the Supabase dashboard (set `app_metadata.role = "admin"`).
- Remove `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS`.

## Notes

- PDF exports use English headers because the built-in PDF fonts have no Japanese characters. Excel exports keep all Japanese text.
- Hours from every record (draft, submitted, approved or rejected) count toward the limits. This is the safer choice for compliance, because a record waiting for approval still means the student worked those hours.
- Dates are calculated in Japan time (Asia/Tokyo).
