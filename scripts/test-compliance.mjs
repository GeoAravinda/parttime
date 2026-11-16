// Runs supabase/schema.sql inside an embedded PostgreSQL (PGlite) and checks
// the compliance engine, the approval workflow and Row Level Security.
//   npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const db = new PGlite({ extensions: { btree_gist } });
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };
const expectError = async (fn, pattern, msg) => {
  try { await fn(); ok(false, `${msg} (no error raised)`); }
  catch (e) { ok(pattern.test(e.message), `${msg} → "${e.message}"`); }
};

// ---- minimal stand-in for Supabase's auth schema & roles ----
await db.exec(`
  create role authenticated; create role anon;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
`);
await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
await db.exec(`
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
`);

const asSystem = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); };
const asUser = async (id) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${id}', false); set role authenticated;`); };
const q = async (sql, params = []) => (await db.query(sql, params)).rows;

async function createUser(name, role) {
  const id = randomUUID();
  // Like Supabase Auth: insert the user first, then write app_metadata.role in a separate UPDATE
  await q(`insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values ($1,$2,$3,$4)`,
    [id, `${name}@test.jp`, JSON.stringify({ provider: 'email' }), JSON.stringify({ full_name: name })]);
  if (role !== 'student-pending')
    await q(`update auth.users set raw_app_meta_data = raw_app_meta_data || $2::jsonb where id = $1`, [id, JSON.stringify({ role })]);
  return id;
}

await asSystem();
const admin = await createUser('admin', 'admin');
const teacher = await createUser('teacher', 'teacher');
const teacher2 = await createUser('teacher2', 'teacher');
const stuA = await createUser('studentA', 'student');
const stuB = await createUser('studentB', 'student');
const pending = await createUser('pendingStudent', 'student-pending');
await q(`insert into teacher_student_assignments (teacher_id, student_id) values ($1,$2)`, [teacher, stuA]);
await q(`insert into school_holidays (name, kind, season, start_date, end_date) values
         ('Summer vacation','long_vacation','summer','2026-08-01','2026-08-31'),
         ('Sports day','school_holiday','other','2026-10-12','2026-10-12')`);

console.log('\nAccounts');
ok((await q(`select status from users where id=$1`, [pending]))[0].status === 'pending', 'self-registration starts as pending');
ok((await q(`select status from users where id=$1`, [stuA]))[0].status === 'active', 'admin-created student is active');
const tRow = (await q(`select u.role, u.status, (select count(*)::int from student_profiles where user_id=u.id) sp, (select count(*)::int from teacher_profiles where user_id=u.id) tp from users u where id=$1`, [teacher]))[0];
ok(tRow.role === 'teacher' && tRow.status === 'active' && tRow.sp === 0 && tRow.tp === 1, 'role set after creation (Supabase Auth order) → active teacher with teacher profile');
ok((await q(`select role from users where id=$1`, [admin]))[0].role === 'admin', 'admin role applied');

// jobs (as student A)
await asUser(stuA);
const [j1] = await q(`insert into jobs (student_id, company_name, workplace_name, job_type, start_date) values ($1,'Lawson','Shinjuku','Convenience store','2026-01-01') returning id`, [stuA]);
const [j2] = await q(`insert into jobs (student_id, company_name, workplace_name, job_type, start_date) values ($1,'Yoshinoya','Ikebukuro','Restaurant','2026-01-01') returning id`, [stuA]);
const [j3] = await q(`insert into jobs (student_id, company_name, workplace_name, job_type, start_date) values ($1,'Yamato','Hub','Warehouse','2026-01-01') returning id`, [stuA]);
console.log('\nJobs');
await expectError(() => q(`insert into jobs (student_id, company_name, workplace_name, job_type, start_date) values ($1,'X','Y','Z','2026-01-01')`, [stuA]),
  /at most 3 active/, '4th active job is refused');

const add = (date, s, e, job = j1.id, brk = 0, status = 'draft') =>
  q(`insert into work_records (student_id, job_id, work_date, start_time, end_time, break_minutes, status) values ($1,$2,$3,$4,$5,$6,$7) returning id, hours`,
    [stuA, job, date, s, e, brk, status]);
const series = async (from, to) => Object.fromEntries((await q(`select * from compliance_series($1,$2,$3)`, [stuA, from, to]))
  .map(r => [r.day.toISOString().slice(0, 10), { h: +r.day_hours, r7: +r.rolling7, level: r.level, hol: r.is_holiday, rem: +r.remaining }]));

console.log('\nNormal period — spec example (Mon 8, Tue 4, Wed 5, Thu 3, Fri 4, Sat 2, Sun 2)');
await add('2026-10-05', '09:00', '17:00');             // Mon 8
await add('2026-10-06', '10:00', '14:00', j2.id);      // Tue 4 (other job)
await add('2026-10-07', '13:00', '19:00', j1.id, 60);  // Wed 6h - 60min break = 5
await add('2026-10-08', '18:00', '21:00', j3.id);      // Thu 3
await add('2026-10-09', '09:00', '11:00');             // Fri 2 + 2 (two jobs same day)
await add('2026-10-09', '17:00', '19:00', j2.id);
await add('2026-10-10', '10:00', '12:00');             // Sat 2
await add('2026-10-11', '10:00', '12:00', j3.id);      // Sun 2
let s = await series('2026-10-05', '2026-10-11');
ok(s['2026-10-07'].h === 5, 'break minutes are deducted (Wed = 5h)');
ok(s['2026-10-09'].h === 4, 'two jobs on the same day are combined (Fri = 4h)');
ok(s['2026-10-11'].r7 === 28, `rolling 7-day total on Sunday = 28 (got ${s['2026-10-11'].r7})`);
ok(s['2026-10-11'].level === 'yellow', 'exactly 28h is at the limit → yellow, not red');
ok(s['2026-10-08'].r7 === 20 && s['2026-10-08'].level === 'green', 'Thu running total 20h → green');
ok(s['2026-10-10'].r7 === 26 && s['2026-10-10'].level === 'yellow', 'Sat running total 26h → yellow (24–28)');
ok(s['2026-10-11'].rem === 0, 'remaining hours = 0 at 28h');

console.log('\nRolling window does not reset on Monday');
await add('2026-10-12', '09:00', '18:00');             // Mon 9h (sports day is NOT a long vacation)
s = await series('2026-10-12', '2026-10-18');
ok(s['2026-10-12'].r7 === 29, `Mon window Tue–Mon = 28 - 8 + 9 = 29 (got ${s['2026-10-12'].r7})`);
ok(s['2026-10-12'].level === 'red', '29h in 7 consecutive days → red');
ok(s['2026-10-12'].hol === false, 'a one-day school holiday does not switch to the 8h/day rule');
ok(s['2026-10-13'].r7 === 25, `Tue window Wed–Tue = 25 (got ${s['2026-10-13'].r7})`);
ok(s['2026-10-18'].r7 === 9, `Sun 18th window = only Monday 12th = 9 (got ${s['2026-10-18'].r7})`);

console.log('\nOvernight shift is split at midnight');
await add('2026-10-20', '22:00', '06:00', j2.id);      // 8h: 2h on 20th, 6h on 21st
s = await series('2026-10-20', '2026-10-21');
ok(s['2026-10-20'].h === 2 && s['2026-10-21'].h === 6, `20th = 2h, 21st = 6h (got ${s['2026-10-20'].h}/${s['2026-10-21'].h})`);
await expectError(() => add('2026-10-21', '05:00', '08:00', j1.id), /no_overlap|exclusion|conflicting/i, 'overlapping shift (even on another job) is refused');

console.log('\nOfficial long vacation (8h/day)');
await add('2026-08-03', '09:00', '17:00');                  // Mon 8
await add('2026-08-04', '09:00', '13:00');                  // Tue 4 + 3 = 7
await add('2026-08-04', '15:00', '18:00', j2.id);
await add('2026-08-05', '09:00', '17:00', j3.id);           // Wed 8
await add('2026-08-06', '08:00', '17:00', j1.id);           // Thu 9 → red
await add('2026-08-07', '10:00', '15:00');                  // Fri 5 → green
s = await series('2026-08-03', '2026-08-07');
ok(s['2026-08-03'].hol && s['2026-08-03'].level === 'yellow', 'holiday 8h → yellow (at limit)');
ok(s['2026-08-04'].h === 7 && s['2026-08-04'].level === 'yellow', 'holiday 7h across two jobs → yellow');
ok(s['2026-08-06'].level === 'red', 'holiday 9h → red');
ok(s['2026-08-07'].level === 'green', 'holiday 5h → green');
ok(s['2026-08-07'].r7 === 0, '28h weekly rule is not applied to long-vacation days');
await add('2026-09-01', '09:00', '15:00');                  // first normal day after vacation
s = await series('2026-09-01', '2026-09-01');
ok(s['2026-09-01'].hol === false && s['2026-09-01'].r7 === 6, 'after the vacation the 28h rule resumes (vacation hours excluded)');

console.log('\nApproval workflow & permissions');
const [rec] = await add('2026-10-01', '09:00', '12:00', j1.id, 0, 'submitted');
await expectError(() => q(`update work_records set end_time='13:00' where id=$1`, [rec.id]).then(async () => {
  const [r] = await q(`select end_time from work_records where id=$1`, [rec.id]);
  if (r.end_time !== '12:00:00') return; throw new Error('blocked by RLS');
}), /blocked|cannot be changed/, 'student cannot modify a submitted record');

await asUser(stuB);
ok((await q(`select * from work_records where student_id=$1`, [stuA])).length === 0, 'another student cannot see the records');
ok((await q(`select * from compliance_series($1,'2026-10-01','2026-10-12')`, [stuA])).every(r => +r.day_hours === 0), 'another student gets zero hours from the calculator (RLS)');

await asUser(teacher2);
ok((await q(`select * from work_records where student_id=$1`, [stuA])).length === 0, 'unassigned teacher cannot see the student');

await asUser(teacher);
ok((await q(`select * from work_records where student_id=$1`, [stuA])).length > 0, 'assigned teacher can see the records');
await expectError(() => q(`update work_records set status='rejected' where id=$1`, [rec.id]), /reason is required/, 'reject without a reason is refused');
await expectError(() => q(`insert into work_records (student_id, job_id, work_date, start_time, end_time) values ($1,$2,'2026-10-02','09:00','10:00')`, [stuA, j1.id]),
  /row-level security|cannot create/, 'teacher cannot create records');
await q(`update work_records set status='rejected', teacher_comment='End time does not match the shift sheet' where id=$1`, [rec.id]);
const ov = await q(`select * from students_overview('2026-10-13')`);
ok(ov.length === 1 && ov[0].level === 'red', `teacher overview shows only assigned student, level red (got ${ov.map(o => o.level)})`);

await asUser(stuA);
await q(`update work_records set end_time='12:30', status='submitted' where id=$1`, [rec.id]);
const hist = await q(`select action from approval_records where record_id=$1 order by created_at`, [rec.id]);
ok(hist.map(h => h.action).join(',') === 'submitted,rejected,resubmitted', `approval history kept (${hist.map(h => h.action)})`);
await asUser(teacher);
await q(`update work_records set status='approved', teacher_comment=null where id=$1`, [rec.id]);
await asUser(stuA);
await expectError(async () => {
  await q(`update work_records set end_time='18:00' where id=$1`, [rec.id]);
  await q(`delete from work_records where id=$1`, [rec.id]);
  const [r] = await q(`select end_time from work_records where id=$1`, [rec.id]);
  if (r && r.end_time === '12:30:00') throw new Error('blocked by RLS');
}, /blocked/, 'student cannot modify or delete an approved record');
const notes = await q(`select level, title from notifications where user_id=$1`, [stuA]);
ok(notes.some(n => n.level === 'red'), 'student received a red compliance warning');
ok(notes.some(n => n.title.includes('approved')), 'student was notified of approval');
await asUser(teacher);
ok((await q(`select * from notifications where user_id=$1 and level='red'`, [teacher])).length > 0, 'assigned teacher received the warning');
await expectError(() => q(`select * from audit_logs`).then(r => { if (r.length === 0) throw new Error('hidden'); }), /hidden/, 'teacher cannot read audit logs');
await asUser(admin);
ok((await q(`select count(*)::int c from audit_logs`))[0].c > 0, 'admin can read the audit log');
const rep = await q(`select * from period_report('2026-10-05','2026-10-18') where student_id=$1`, [stuA]);
ok(rep.length === 1 && +rep[0].max_rolling7 === 29 && rep[0].red_days > 0, `period report: peak 7-day = 29h, red days = ${rep[0]?.red_days}`);
await asUser(pending);
ok((await q(`select * from classes`)).length === 0 && (await q(`select * from school_holidays`)).length === 0, 'pending account cannot read school data');

await asSystem();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
