// Remove the demo data created by `npm run seed`.
//   npm run clean-demo            → shows what WOULD be deleted (nothing is changed)
//   npm run clean-demo -- --yes   → deletes it permanently
// Deletes: every account whose email ends in @demo.jp (with all their jobs, work records,
// notifications) and the holidays whose name contains "(demo)".
// Keeps: classes, school settings and every non-demo account.
// Refuses to run unless at least one real (non-demo) active admin exists.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const apply = process.argv.includes('--yes');

const demoUsers = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error(error.message); process.exit(1); }
  demoUsers.push(...data.users.filter((u) => u.email?.toLowerCase().endsWith('@demo.jp')));
  if (data.users.length < 200) break;
}
const ids = demoUsers.map((u) => u.id);
const count = async (table, col) => ids.length
  ? (await db.from(table).select('*', { count: 'exact', head: true }).in(col, ids)).count ?? 0 : 0;
const [records, jobs] = await Promise.all([count('work_records', 'student_id'), count('jobs', 'student_id')]);
const { data: holidays } = await db.from('school_holidays').select('id,name').like('name', '%(demo)%');
const { data: admins } = await db.from('users').select('email').eq('role', 'admin').eq('status', 'active');
const realAdmins = (admins ?? []).filter((a) => !a.email.toLowerCase().endsWith('@demo.jp'));

console.log(`Demo accounts : ${demoUsers.length}`);
demoUsers.forEach((u) => console.log(`   - ${u.email}`));
console.log(`Work records  : ${records}`);
console.log(`Jobs          : ${jobs}`);
console.log(`Holidays      : ${(holidays ?? []).length} ${(holidays ?? []).map((h) => `"${h.name}"`).join(', ')}`);
console.log(`Real admins   : ${realAdmins.length} ${realAdmins.map((a) => a.email).join(', ')}`);

if (!realAdmins.length) {
  console.error('\n✗ No real (non-demo) admin account exists. Create your own admin first');
  console.error('  (log in as admin@demo.jp → Teachers → Create teacher → role: Administrator), then run again.');
  process.exit(1);
}
if (!apply) {
  console.log('\nNothing was deleted. Run `npm run clean-demo -- --yes` to delete the items above permanently.');
  process.exit(0);
}

for (const u of demoUsers) {
  const { error } = await db.auth.admin.deleteUser(u.id);
  if (error) { console.error(`✗ ${u.email}: ${error.message}`); process.exit(1); }
}
if (holidays?.length) {
  const { error } = await db.from('school_holidays').delete().in('id', holidays.map((h) => h.id));
  if (error) { console.error(`✗ holidays: ${error.message}`); process.exit(1); }
}
console.log(`\n✓ Deleted ${demoUsers.length} demo accounts (with ${records} work records and ${jobs} jobs) and ${holidays?.length ?? 0} demo holidays.`);
