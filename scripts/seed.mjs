// Demo data for the Arubaito Hours system.
//   1. Run supabase/schema.sql in the Supabase SQL editor
//   2. Put NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
//   3. npm run seed
// Re-running deletes and recreates ONLY the @demo.jp accounts (and their data).
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234!';
const must = (r, what) => { if (r.error) { console.error(`✗ ${what}:`, r.error.message); process.exit(1); } return r.data; };

// ---------- dates (Japan time) ----------
const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
const D = (offset) => { const d = new Date(todayStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
const year = +todayStr.slice(0, 4);
const ay = +todayStr.slice(5, 7) >= 4 ? year : year - 1; // Japanese academic year starts in April

// deterministic random
let seed = 20261116;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ---------- 1. remove previous demo accounts ----------
console.log('Cleaning previous demo accounts…');
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error(error.message); process.exit(1); }
  const demo = data.users.filter((u) => u.email?.endsWith('@demo.jp'));
  for (const u of demo) await db.auth.admin.deleteUser(u.id);
  if (data.users.length < 200) break;
}

// ---------- 2. school settings, classes, holidays ----------
must(await db.from('school_settings').update({
  school_name: 'Sakura International Japanese Language School', school_name_ja: 'さくら国際日本語学校',
  address: '1-2-3 Takadanobaba, Shinjuku-ku, Tokyo', phone: '03-0000-0000', email: 'office@sakura-school.example',
}).eq('id', 1), 'settings');

const classDefs = [
  { name: 'A-1', course: '2-year course / 2年コース', level: 'N4', academic_year: ay },
  { name: 'A-2', course: '2-year course / 2年コース', level: 'N3', academic_year: ay },
  { name: 'B-1', course: '1.5-year course / 1.5年コース', level: 'N3', academic_year: ay },
  { name: 'C-1', course: '1-year course / 1年コース', level: 'N2', academic_year: ay },
];
const classes = must(await db.from('classes').upsert(classDefs, { onConflict: 'name' }).select(), 'classes');
const cls = Object.fromEntries(classes.map((c) => [c.name, c.id]));

must(await db.from('school_holidays').delete().like('name', '%(demo)%'), 'clear holidays');
must(await db.from('school_holidays').insert([
  { name: 'Summer vacation (demo)', name_ja: '夏季休暇', kind: 'long_vacation', season: 'summer', start_date: `${ay}-07-25`, end_date: `${ay}-08-31`, approved: true },
  { name: 'Autumn break (demo)', name_ja: '秋季休暇', kind: 'long_vacation', season: 'other', start_date: D(-47), end_date: D(-38), approved: true },
  { name: 'Winter vacation (demo)', name_ja: '冬季休暇', kind: 'long_vacation', season: 'winter', start_date: `${ay}-12-20`, end_date: `${ay + 1}-01-07`, approved: true },
  { name: 'Spring vacation (demo)', name_ja: '春季休暇', kind: 'long_vacation', season: 'spring', start_date: `${ay + 1}-03-14`, end_date: `${ay + 1}-04-05`, approved: true },
  { name: 'School foundation day (demo)', name_ja: '開校記念日', kind: 'school_holiday', season: 'other', start_date: D(-12), end_date: D(-12), approved: true },
]), 'holidays');
const vacation = (d) => d >= D(-47) && d <= D(-38);

// ---------- 3. accounts ----------
async function account(email, full_name, role, meta = {}) {
  const r = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name, ...meta }, app_metadata: role ? { role } : {} });
  return must(r, `create ${email}`).user.id;
}
console.log('Creating accounts…');
const admin = await account('admin@demo.jp', 'Suzuki Hiroshi (鈴木 浩)', 'admin');
const t1 = await account('teacher@demo.jp', 'Tanaka Yuki (田中 由紀)', 'teacher');
const t2 = await account('teacher2@demo.jp', 'Sato Kenji (佐藤 健二)', 'teacher');
must(await db.from('teacher_profiles').update({ staff_no: 'T-001' }).eq('user_id', t1), 'tp1');
must(await db.from('teacher_profiles').update({ staff_no: 'T-002' }).eq('user_id', t2), 'tp2');

// profile: cap = max rolling 7-day hours the generator aims for; spike = [dayOffset, hours] that breaks the rule
const students = [
  { email: 'student@demo.jp', name: 'NGUYEN VAN AN', nat: 'Vietnam', cls: 'A-1', cap: 26, spike: [-17, 9.5], vacSpike: [-44, 8], jobs: 3, teacher: t1, current: true },
  { email: 'student2@demo.jp', name: 'SHRESTHA BIKASH', nat: 'Nepal', cls: 'A-1', cap: 22, jobs: 2, teacher: t1 },
  { email: 'student3@demo.jp', name: 'WANG LI (王 莉)', nat: 'China', cls: 'A-1', cap: 27, jobs: 2, teacher: t1, current: true },
  { email: 'student4@demo.jp', name: 'PERERA KASUN', nat: 'Sri Lanka', cls: 'A-2', cap: 25, spike: [-3, 9], jobs: 2, teacher: t1, current: true },
  { email: 'student5@demo.jp', name: 'AUNG KYAW MIN', nat: 'Myanmar', cls: 'A-2', cap: 20, jobs: 1, teacher: t1 },
  { email: 'student6@demo.jp', name: 'SARI DEWI', nat: 'Indonesia', cls: 'A-2', cap: 24, vacSpike: [-41, 9.5], jobs: 2, teacher: t1 },
  { email: 'student7@demo.jp', name: 'TRAN THI HOA', nat: 'Vietnam', cls: 'A-2', cap: 21, jobs: 1, teacher: t1, stopAt: -12 },
  { email: 'student8@demo.jp', name: 'SANTOS MARIA', nat: 'Philippines', cls: 'B-1', cap: 18, jobs: 1, teacher: t2 },
  { email: 'student9@demo.jp', name: 'RAHMAN MD ARIF', nat: 'Bangladesh', cls: 'B-1', cap: 27, spike: [-6, 7], jobs: 3, teacher: t2, current: true },
  { email: 'student10@demo.jp', name: 'KARIMOV JASUR', nat: 'Uzbekistan', cls: 'B-1', cap: 23, jobs: 2, teacher: t2, night: true },
  { email: 'student11@demo.jp', name: 'BATBAYAR ENKHJIN', nat: 'Mongolia', cls: 'C-1', cap: 0, jobs: 0, teacher: t2, noPermit: true },
  { email: 'student12@demo.jp', name: 'KIM MINJUN (김민준)', nat: 'Korea', cls: 'C-1', cap: 15, jobs: 1, teacher: t2, stopAt: -15 },
];
const companies = [
  ['Sakura Mart', 'Takadanobaba Station', 'Convenience store'],
  ['Tokyo Bento Factory', 'Itabashi Plant', 'Food factory'],
  ['Kaze Logistics', 'Koto Warehouse', 'Warehouse sorting'],
  ['Midori Hotel', 'Shinjuku West', 'Hotel cleaning'],
  ['Yamabiko Izakaya', 'Ikebukuro East', 'Restaurant'],
  ['Hikari Ramen', 'Nakano Broadway', 'Restaurant'],
];

let n = 0;
for (const s of students) {
  n++;
  const id = await account(s.email, s.name, 'student', { student_no: `S${ay}-${String(n).padStart(3, '0')}` });
  s.id = id;
  must(await db.from('student_profiles').update({
    nationality: s.nat, class_id: cls[s.cls], date_of_birth: `${2000 + (n % 6)}-0${1 + (n % 9)}-1${n % 9}`,
    visa_type: 'Student (留学)', visa_expiry: n === 4 ? D(60) : `${ay + 2}-0${1 + (n % 9)}-15`,
    work_permit: !s.noPermit, work_permit_no: s.noPermit ? null : `P-${100000 + n * 137}`,
    phone: `080-0000-${String(1000 + n).slice(-4)}`, enrollment_date: `${ay}-04-0${1 + (n % 5)}`,
  }).eq('user_id', id), 'profile');
  must(await db.from('teacher_student_assignments').insert({ teacher_id: s.teacher, student_id: id }), 'assign');

  s.jobIds = [];
  for (let j = 0; j < s.jobs; j++) {
    const [company_name, workplace_name, job_type] = companies[(n + j * 2) % companies.length];
    const job = must(await db.from('jobs').insert({ student_id: id, company_name, workplace_name, job_type, start_date: D(-120 - j * 30), status: 'active' }).select().single(), 'job');
    s.jobIds.push(job.id);
  }
}
// a registration waiting for approval (no app_metadata role → pending)
await account('pending@demo.jp', 'GURUNG PRAKASH', null, { student_no: '', nationality: 'Nepal' });
const pendingId = (await db.from('users').select('id').eq('email', 'pending@demo.jp').single()).data?.id;
if (pendingId) await db.from('student_profiles').update({ nationality: 'Nepal', visa_type: 'Student (留学)' }).eq('user_id', pendingId);

// ---------- 4. work records ----------
console.log('Generating work records…');
const toTime = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
let total = 0;
for (const s of students) {
  if (!s.jobIds.length) continue;
  const daily = new Map(); // date -> hours (to keep the rolling total under the student's cap)
  const rows = [];
  const add = (date, d) => daily.set(date, (daily.get(date) ?? 0) + d);
  const roll = (date) => { let sum = 0; for (let i = 0; i < 7; i++) { const d = D(Math.round((Date.parse(date) - Date.parse(todayStr)) / 864e5) - i); if (!vacation(d)) sum += daily.get(d) ?? 0; } return sum; };
  let skipNext = false;

  for (let off = -63; off <= (s.current ? 0 : -1); off++) {
    const date = D(off);
    if (s.stopAt !== undefined && off > s.stopAt) break;
    if (skipNext) { skipNext = false; continue; }
    const hol = vacation(date);
    const forced = (s.spike && off === s.spike[0]) || (s.vacSpike && off === s.vacSpike[0]);
    if (!forced && rnd() > (hol ? 0.8 : 0.62)) continue;

    let hours;
    if (s.spike && off === s.spike[0]) hours = s.spike[1];
    else if (s.vacSpike && off === s.vacSpike[0]) hours = s.vacSpike[1];
    else if (hol) hours = pick([5, 6, 6.5, 7, 7.5, 8]);
    else {
      const room = s.cap - roll(date);
      hours = Math.min(pick([3, 4, 4, 4.5, 5, 5, 6, 8]), Math.floor(room * 2) / 2);
      if (hours < 2.5) continue;
    }

    // night shift (crosses midnight) for one student
    if (s.night && !hol && hours >= 5 && rnd() < 0.3) {
      rows.push({ job_id: s.jobIds[0], work_date: date, start_time: '22:00', end_time: toTime(22 * 60 + hours * 60), break_minutes: 0 });
      add(date, 2); add(D(off + 1), hours - 2); skipNext = true;
      continue;
    }
    // long days may be split across two jobs (morning + evening)
    if (hours >= 6 && s.jobIds.length > 1 && rnd() < 0.6) {
      const a = Math.floor(hours) / 2;
      const b = hours - a;
      rows.push({ job_id: s.jobIds[0], work_date: date, start_time: '09:00', end_time: toTime(540 + a * 60), break_minutes: 0 });
      rows.push({ job_id: s.jobIds[1 + Math.floor(rnd() * (s.jobIds.length - 1))], work_date: date, start_time: '17:00', end_time: toTime(1020 + b * 60), break_minutes: 0 });
    } else {
      const brk = hours > 6 ? 60 : 0;
      const start = pick([9 * 60, 10 * 60, 13 * 60]);
      rows.push({ job_id: pick(s.jobIds), work_date: date, start_time: toTime(start), end_time: toTime(start + hours * 60 + brk), break_minutes: brk });
    }
    add(date, hours);
  }

  // workflow status: older → approved (one rejected), last 2 weeks → submitted, current week → draft
  const monday = (() => { const d = new Date(todayStr + 'T00:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; return D(-wd); })();
  let rejectedOne = false;
  for (const r of rows) {
    r.student_id = s.id;
    if (r.work_date >= monday) r.status = 'draft';
    else if (r.work_date >= D(-14)) r.status = 'submitted';
    else if (!rejectedOne && r.work_date >= D(-28) && rnd() < 0.25) {
      r.status = 'rejected'; r.teacher_comment = 'Please check the end time against your shift sheet. / シフト表と終了時刻を確認してください。'; r.reviewed_by = s.teacher; rejectedOne = true;
    } else { r.status = 'approved'; r.reviewed_by = s.teacher; }
    if (r.status !== 'draft') r.submitted_at = new Date().toISOString();
  }
  if (rows.length) {
    const res = await db.from('work_records').insert(rows);
    if (res.error) { console.error(`✗ records for ${s.email}:`, res.error.message); process.exit(1); }
  }
  total += rows.length;
  console.log(`  ${s.name.padEnd(22)} ${String(rows.length).padStart(3)} records`);
}

console.log(`\n✓ Done: ${students.length} students, ${total} work records.`);
console.log(`\nDemo logins (password: ${PASSWORD})`);
console.log('  Admin   : admin@demo.jp      → /login/admin');
console.log('  Teacher : teacher@demo.jp    → /login/teacher   (also teacher2@demo.jp)');
console.log('  Student : student@demo.jp    → /login/student   (student2…student12@demo.jp)');
console.log('  Pending registration to approve: pending@demo.jp');
