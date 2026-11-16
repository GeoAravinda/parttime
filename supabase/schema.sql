-- =====================================================================
--  Arubaito (Part-Time Work) Hour Management System — database schema
--  Target: Supabase (PostgreSQL 15+)
--  Run this whole file once in the Supabase SQL editor.
--
--  The compliance engine (28h rolling 7-day rule / 8h per day during
--  official long vacations) lives in this file as SQL functions, so the
--  numbers are always computed on the server from the stored records.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role      as enum ('student','teacher','admin');
  create type public.account_status as enum ('pending','active','inactive');
  create type public.record_status  as enum ('draft','submitted','approved','rejected');
  create type public.job_status     as enum ('active','inactive');
  create type public.holiday_kind   as enum ('long_vacation','school_holiday');
  create type public.vacation_season as enum ('summer','winter','spring','other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.school_settings (
  id                   int primary key default 1 check (id = 1),
  school_name          text not null default 'Sakura Japanese Language School',
  school_name_ja       text not null default 'さくら日本語学校',
  address              text,
  phone                text,
  email                text,
  weekly_limit         numeric(5,2) not null default 28 check (weekly_limit > 0),
  weekly_warn          numeric(5,2) not null default 24 check (weekly_warn > 0),
  holiday_daily_limit  numeric(5,2) not null default 8 check (holiday_daily_limit > 0),
  holiday_daily_warn   numeric(5,2) not null default 6 check (holiday_daily_warn > 0),
  allow_student_delete boolean not null default true,   -- students may delete draft/rejected records
  allow_future_days    int not null default 0,          -- how many days ahead a record may be dated
  missing_record_days  int not null default 7,          -- "missing records" after N days without entries
  updated_at           timestamptz not null default now()
);
insert into public.school_settings (id) values (1) on conflict do nothing;

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        public.user_role not null default 'student',
  status      public.account_status not null default 'pending',
  locale      text not null default 'en' check (locale in ('en','ja')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists users_role_idx on public.users(role);

create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  course        text not null,              -- e.g. "2-year course", "1.5-year course"
  level         text,                       -- e.g. N3
  academic_year int,
  created_at    timestamptz not null default now()
);

create table if not exists public.student_profiles (
  user_id          uuid primary key references public.users(id) on delete cascade,
  student_no       text unique,
  nationality      text,
  date_of_birth    date,
  class_id         uuid references public.classes(id) on delete set null,
  visa_type        text default 'Student (留学)',
  visa_expiry      date,
  work_permit      boolean not null default true,     -- 資格外活動許可
  work_permit_no   text,
  phone            text,
  enrollment_date  date,
  updated_at       timestamptz not null default now()
);

create table if not exists public.teacher_profiles (
  user_id                uuid primary key references public.users(id) on delete cascade,
  staff_no               text unique,
  phone                  text,
  can_view_all_students  boolean not null default false,  -- extra permission granted by admin
  updated_at             timestamptz not null default now()
);

create table if not exists public.teacher_student_assignments (
  teacher_id  uuid not null references public.users(id) on delete cascade,
  student_id  uuid not null references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);
create index if not exists tsa_student_idx on public.teacher_student_assignments(student_id);

create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.users(id) on delete cascade,
  company_name    text not null,
  workplace_name  text not null,
  job_type        text not null,
  start_date      date not null,
  end_date        date,
  status          public.job_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists jobs_student_idx on public.jobs(student_id);

create table if not exists public.work_records (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.users(id) on delete cascade,
  job_id          uuid not null references public.jobs(id),
  work_date       date not null,
  start_time      time not null,
  end_time        time not null,              -- end <= start means the shift ends next day
  break_minutes   int  not null default 0 check (break_minutes >= 0 and break_minutes < 1440),
  hours           numeric(5,2) generated always as (
                    round(((case when end_time > start_time
                                  then extract(epoch from (end_time - start_time))
                                  else extract(epoch from (end_time - start_time)) + 86400 end) / 3600.0
                           - break_minutes / 60.0)::numeric, 2)
                  ) stored,
  shift_range     tsrange generated always as (
                    tsrange(work_date + start_time,
                            case when end_time > start_time then work_date + end_time
                                 else (work_date + 1) + end_time end,
                            '[)')
                  ) stored,
  status          public.record_status not null default 'draft',
  note            text,
  teacher_comment text,
  submitted_at    timestamptz,
  reviewed_by     uuid references public.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint work_records_time_check  check (end_time <> start_time),
  constraint work_records_hours_check check (hours > 0 and hours <= 24),
  -- the same student can never have two shifts that overlap in time (across all jobs)
  constraint work_records_no_overlap exclude using gist (student_id with =, shift_range with &&)
);
create index if not exists wr_student_date_idx on public.work_records(student_id, work_date);
create index if not exists wr_status_idx on public.work_records(status);

create table if not exists public.school_holidays (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ja     text,
  kind        public.holiday_kind not null default 'long_vacation',
  season      public.vacation_season not null default 'other',
  start_date  date not null,
  end_date    date not null,
  approved    boolean not null default true,     -- only approved long vacations change the rule
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists holidays_range_idx on public.school_holidays(start_date, end_date);

create table if not exists public.approval_records (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.work_records(id) on delete cascade,
  student_id  uuid not null references public.users(id) on delete cascade,
  action      text not null check (action in ('submitted','resubmitted','approved','rejected','admin_edit')),
  actor_id    uuid references public.users(id) on delete set null,
  comment     text,
  snapshot    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists approval_record_idx on public.approval_records(record_id);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  student_id  uuid references public.users(id) on delete cascade,
  level       text not null default 'info' check (level in ('info','yellow','red','success')),
  title       text not null,
  title_ja    text,
  body        text,
  body_ja     text,
  link        text,
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.audit_logs (
  id          bigserial primary key,
  actor_id    uuid references public.users(id) on delete set null,
  actor_role  text,
  action      text not null,
  table_name  text,
  row_id      text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can be used inside RLS)
-- ---------------------------------------------------------------------
create or replace function public.jst_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Tokyo')::date $$;

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.teacher_can_see(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'teacher' and (
    exists (select 1 from public.teacher_student_assignments a
             where a.teacher_id = auth.uid() and a.student_id = p_student)
    or exists (select 1 from public.teacher_profiles t
                where t.user_id = auth.uid() and t.can_view_all_students)
  )
$$;

create or replace function public.can_view_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_student = auth.uid() and public.my_role() = 'student')
      or public.is_admin()
      or coalesce(public.teacher_can_see(p_student), false)
$$;

-- ---------------------------------------------------------------------
-- Compliance engine
-- ---------------------------------------------------------------------

-- Is the date inside an officially configured & approved LONG vacation?
-- (Weekends, national holidays and one-day school closures do NOT count.)
create or replace function public.is_long_holiday(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.school_holidays h
                  where h.kind = 'long_vacation' and h.approved
                    and p_day between h.start_date and h.end_date)
$$;

-- Hours per student per calendar day, all jobs combined.
-- Overnight shifts are split at midnight; breaks are deducted proportionally.
-- Runs as the caller, so Row Level Security decides which students are visible.
create or replace function public.daily_hours(p_from date, p_to date, p_student uuid default null)
returns table(student_id uuid, day date, hours numeric)
language sql stable set search_path = public as $$
  with r as (
    select wr.student_id as sid, wr.work_date as wd,
           lower(wr.shift_range) as ls, upper(wr.shift_range) as us,
           wr.hours as net,
           extract(epoch from (upper(wr.shift_range) - lower(wr.shift_range))) / 3600.0 as gross
      from public.work_records wr
     where wr.work_date between p_from - 1 and p_to
       and (p_student is null or wr.student_id = p_student)
  ), seg as (
    select sid, wd as d,
           extract(epoch from (least(us, (wd + 1)::timestamp) - ls)) / 3600.0 * net / gross as h
      from r
    union all
    select sid, wd + 1,
           extract(epoch from (us - (wd + 1)::timestamp)) / 3600.0 * net / gross
      from r where us > (wd + 1)::timestamp
  )
  select sid, d, round(sum(h)::numeric, 2)
    from seg where d between p_from and p_to
   group by sid, d
$$;

-- One row per date: the day's total, whether it is a long-vacation day,
-- the rolling 7-day total ending that day and the compliance level.
--   * Normal period : rolling sum of the 7 consecutive days ending that day
--                     (hours on long-vacation days are not part of the 28h rule)
--                     green < warn(24) <= yellow <= limit(28) < red
--   * Long vacation : the day's own total, all jobs combined
--                     green < warn(6) <= yellow <= limit(8) < red
--   * No work permit: any hours at all are red.
create or replace function public.compliance_series(p_student uuid, p_from date, p_to date)
returns table(day date, day_hours numeric, is_holiday boolean, rolling7 numeric,
              rule text, level text, remaining numeric)
language sql stable set search_path = public as $$
  with s as (select * from public.school_settings where id = 1),
  p as (select coalesce((select work_permit from public.student_profiles where user_id = p_student), true) as permit),
  days as (select g::date as d from generate_series(p_from - 6, p_to, interval '1 day') g),
  dh as (select x.day as d, x.hours as h from public.daily_hours(p_from - 6, p_to, p_student) x),
  base as (
    select days.d, coalesce(dh.h, 0) as h, public.is_long_holiday(days.d) as hol
      from days left join dh on dh.d = days.d
  ),
  roll as (
    select d, h, hol,
           sum(case when hol then 0 else h end) over (order by d rows between 6 preceding and current row) as r7
      from base
  )
  select roll.d, roll.h, roll.hol, roll.r7,
         case when not p.permit then 'no_permit' when roll.hol then 'holiday_daily' else 'rolling_7day' end,
         case
           when not p.permit then case when roll.h > 0 then 'red' else 'green' end
           when roll.hol then case when roll.h > s.holiday_daily_limit then 'red'
                                   when roll.h >= s.holiday_daily_warn then 'yellow' else 'green' end
           else case when roll.r7 > s.weekly_limit then 'red'
                     when roll.r7 >= s.weekly_warn then 'yellow' else 'green' end
         end,
         case
           when not p.permit then 0
           when roll.hol then greatest(s.holiday_daily_limit - roll.h, 0)
           else greatest(s.weekly_limit - roll.r7, 0)
         end
    from roll, s, p
   where roll.d between p_from and p_to
   order by roll.d
$$;

-- Overview of every student visible to the caller (RLS applies).
-- level = worst level over the 7 evaluation dates ending p_date.
create or replace function public.students_overview(p_date date default public.jst_today())
returns table(student_id uuid, full_name text, email text, student_no text, status public.account_status,
              class_id uuid, class_name text, course text, nationality text, visa_expiry date,
              work_permit boolean, today_hours numeric, rolling7 numeric, is_holiday boolean,
              remaining numeric, level text, max_rolling7 numeric, max_day_hours numeric,
              last_record_date date, active_jobs int, pending_count int, missing_records boolean)
language sql stable set search_path = public as $$
  with s as (select * from public.school_settings where id = 1),
  st as (
    select u.id, u.full_name, u.email, u.status, sp.student_no, sp.class_id, c.name as class_name,
           c.course, sp.nationality, sp.visa_expiry, coalesce(sp.work_permit, true) as permit
      from public.users u
      left join public.student_profiles sp on sp.user_id = u.id
      left join public.classes c on c.id = sp.class_id
     where u.role = 'student'
  ),
  days as (select g::date as d from generate_series(p_date - 12, p_date, interval '1 day') g),
  hol as (select d, public.is_long_holiday(d) as hol from days),
  dh as (select x.student_id as sid, x.day as d, x.hours as h from public.daily_hours(p_date - 12, p_date) x),
  grid as (
    select st.id as sid, st.permit, hol.d, hol.hol, coalesce(dh.h, 0) as h
      from st cross join hol
      left join dh on dh.sid = st.id and dh.d = hol.d
  ),
  roll as (
    select sid, permit, d, hol, h,
           sum(case when hol then 0 else h end) over (partition by sid order by d rows between 6 preceding and current row) as r7
      from grid
  ),
  lv as (
    select roll.*,
           case
             when not permit then case when h > 0 then 3 else 1 end
             when hol then case when h > s.holiday_daily_limit then 3 when h >= s.holiday_daily_warn then 2 else 1 end
             else case when r7 > s.weekly_limit then 3 when r7 >= s.weekly_warn then 2 else 1 end
           end as lvl
      from roll, s
     where d > p_date - 7
  ),
  agg as (
    select sid,
           max(lvl) as lvl,
           max(case when not hol then r7 end) as max_r7,
           max(case when hol then h end) as max_h,
           max(case when d = p_date then h end) as today_h,
           max(case when d = p_date then r7 end) as today_r7,
           bool_or(case when d = p_date then hol end) as today_hol
      from lv group by sid
  )
  select st.id, st.full_name, st.email, st.student_no, st.status, st.class_id, st.class_name, st.course,
         st.nationality, st.visa_expiry, st.permit,
         coalesce(agg.today_h, 0), coalesce(agg.today_r7, 0), coalesce(agg.today_hol, false),
         case when not st.permit then 0
              when agg.today_hol then greatest(s.holiday_daily_limit - agg.today_h, 0)
              else greatest(s.weekly_limit - coalesce(agg.today_r7, 0), 0) end,
         case coalesce(agg.lvl, 1) when 3 then 'red' when 2 then 'yellow' else 'green' end,
         coalesce(agg.max_r7, 0), coalesce(agg.max_h, 0),
         (select max(w.work_date) from public.work_records w where w.student_id = st.id),
         (select count(*)::int from public.jobs j where j.student_id = st.id and j.status = 'active'),
         (select count(*)::int from public.work_records w where w.student_id = st.id and w.status = 'submitted'),
         exists (select 1 from public.jobs j where j.student_id = st.id and j.status = 'active')
           and coalesce((select max(w.work_date) from public.work_records w where w.student_id = st.id), date '1900-01-01')
               < p_date - s.missing_record_days
    from st cross join s
    left join agg on agg.sid = st.id
   order by st.full_name
$$;

-- Per-student summary for a period (school-wide reports). RLS applies.
create or replace function public.period_report(p_from date, p_to date)
returns table(student_id uuid, full_name text, student_no text, class_name text, status public.account_status,
              total_hours numeric, days_worked int, max_rolling7 numeric, max_holiday_day numeric,
              yellow_days int, red_days int)
language sql stable set search_path = public as $$
  with s as (select * from public.school_settings where id = 1),
  st as (
    select u.id, u.full_name, u.status, sp.student_no, c.name as class_name, coalesce(sp.work_permit, true) as permit
      from public.users u
      left join public.student_profiles sp on sp.user_id = u.id
      left join public.classes c on c.id = sp.class_id
     where u.role = 'student'
  ),
  days as (select g::date as d, public.is_long_holiday(g::date) as hol
             from generate_series(p_from - 6, p_to, interval '1 day') g),
  dh as (select x.student_id as sid, x.day as d, x.hours as h from public.daily_hours(p_from - 6, p_to) x),
  grid as (
    select st.id as sid, st.permit, days.d, days.hol, coalesce(dh.h, 0) as h
      from st cross join days left join dh on dh.sid = st.id and dh.d = days.d
  ),
  roll as (
    select grid.*, sum(case when hol then 0 else h end)
             over (partition by sid order by d rows between 6 preceding and current row) as r7
      from grid
  ),
  lv as (
    select roll.*,
           case
             when not permit then case when h > 0 then 3 else 1 end
             when hol then case when h > s.holiday_daily_limit then 3 when h >= s.holiday_daily_warn then 2 else 1 end
             else case when r7 > s.weekly_limit then 3 when r7 >= s.weekly_warn then 2 else 1 end
           end as lvl
      from roll, s
     where d between p_from and p_to
  )
  select st.id, st.full_name, st.student_no, st.class_name, st.status,
         coalesce(sum(lv.h), 0), (count(*) filter (where lv.h > 0))::int,
         coalesce(max(lv.r7) filter (where not lv.hol), 0), coalesce(max(lv.h) filter (where lv.hol), 0),
         (count(*) filter (where lv.lvl = 2))::int, (count(*) filter (where lv.lvl = 3))::int
    from st left join lv on lv.sid = st.id
   group by st.id, st.full_name, st.student_no, st.class_name, st.status
   order by st.full_name
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- New auth user -> public.users (+ profile). Self-registration is always a
-- *pending student*. Only the service role (admin API) can set app_metadata.role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role   public.user_role := coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'student');
  v_status public.account_status := case when new.raw_app_meta_data ? 'role' then 'active' else 'pending' end;
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_no     text := nullif(trim(v_meta->>'student_no'), '');
begin
  insert into public.users (id, email, full_name, role, status)
  values (new.id, new.email, coalesce(nullif(trim(v_meta->>'full_name'), ''), new.email), v_role, v_status);

  if v_role = 'student' then
    if v_no is not null and exists (select 1 from public.student_profiles where student_no = v_no) then
      v_no := null;
    end if;
    insert into public.student_profiles (user_id, student_no, nationality, date_of_birth, visa_type, visa_expiry, phone)
    values (new.id, v_no, nullif(v_meta->>'nationality',''),
            nullif(v_meta->>'date_of_birth','')::date,
            coalesce(nullif(v_meta->>'visa_type',''), 'Student (留学)'),
            nullif(v_meta->>'visa_expiry','')::date,
            nullif(v_meta->>'phone',''));
  elsif v_role = 'teacher' then
    insert into public.teacher_profiles (user_id) values (new.id);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Supabase Auth writes app_metadata.role in an UPDATE right after the insert,
-- so staff roles set by the admin API are applied here.
create or replace function public.handle_user_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role public.user_role;
begin
  if not (coalesce(new.raw_app_meta_data, '{}'::jsonb) ? 'role') then return new; end if;
  if tg_op = 'UPDATE' and (old.raw_app_meta_data->>'role') is not distinct from (new.raw_app_meta_data->>'role') then
    return new;
  end if;
  v_role := (new.raw_app_meta_data->>'role')::public.user_role;
  update public.users set role = v_role, status = 'active' where id = new.id;
  if v_role = 'student' then
    insert into public.student_profiles (user_id) values (new.id) on conflict do nothing;
    delete from public.teacher_profiles where user_id = new.id;
  else
    delete from public.student_profiles where user_id = new.id;
    if v_role = 'teacher' then
      insert into public.teacher_profiles (user_id) values (new.id) on conflict do nothing;
    else
      delete from public.teacher_profiles where user_id = new.id;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.handle_user_role_change() from public, anon, authenticated;

drop trigger if exists on_auth_user_role_change on auth.users;
create trigger on_auth_user_role_change after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_role_change();

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- Non-admins may not change their own role/status/email
create or replace function public.guard_users() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role; new.status := old.status; new.email := old.email; new.id := old.id;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Students may update only personal fields of their profile
create or replace function public.guard_student_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id := old.user_id; new.student_no := old.student_no; new.class_id := old.class_id;
    new.work_permit := old.work_permit; new.enrollment_date := old.enrollment_date;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Max 3 active jobs per student
create or replace function public.guard_jobs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (
       select count(*) from public.jobs j
        where j.student_id = new.student_id and j.status = 'active' and j.id <> new.id) >= 3 then
    raise exception 'A student can have at most 3 active part-time jobs' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    new.student_id := old.student_id;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Work record integrity + approval workflow enforcement
create or replace function public.guard_work_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := public.my_role();
  v_job  public.jobs;
  v_s    public.school_settings;
begin
  select * into v_s from public.school_settings where id = 1;

  if tg_op = 'DELETE' then
    if auth.uid() is not null and v_role is distinct from 'admin' then
      if v_role is distinct from 'student' or old.student_id <> auth.uid()
         or old.status not in ('draft','rejected') or not v_s.allow_student_delete then
        raise exception 'This record can no longer be deleted' using errcode = 'P0001';
      end if;
    end if;
    return old;
  end if;

  -- job must belong to the student and cover the date
  select * into v_job from public.jobs where id = new.job_id;
  if v_job.id is null or v_job.student_id <> new.student_id then
    raise exception 'The selected job does not belong to this student' using errcode = 'P0001';
  end if;
  if new.work_date < v_job.start_date or (v_job.end_date is not null and new.work_date > v_job.end_date) then
    raise exception 'The work date is outside the employment period of this job' using errcode = 'P0001';
  end if;
  if new.work_date > public.jst_today() + v_s.allow_future_days then
    raise exception 'Work records cannot be dated in the future' using errcode = 'P0001';
  end if;

  if auth.uid() is null or v_role = 'admin' then
    -- system / admin: everything allowed (still audited)
    if tg_op = 'UPDATE' and new.status in ('approved','rejected') and new.status is distinct from old.status then
      new.reviewed_at := now();
      new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
    end if;
    if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
      new.submitted_at := now();
    end if;
    new.updated_at := now();
    return new;
  end if;

  if v_role = 'student' then
    if new.student_id <> auth.uid() then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      if new.status not in ('draft','submitted') then new.status := 'draft'; end if;
      new.teacher_comment := null; new.reviewed_by := null; new.reviewed_at := null;
    else
      if old.status in ('submitted','approved') then
        raise exception 'Submitted or approved records cannot be changed by students' using errcode = 'P0001';
      end if;
      if new.status not in ('draft','submitted') then
        raise exception 'Invalid status change' using errcode = 'P0001';
      end if;
      new.student_id := old.student_id;
      new.teacher_comment := old.teacher_comment;
      new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    end if;
    if new.status = 'submitted' then new.submitted_at := now(); end if;
    new.updated_at := now();
    return new;
  end if;

  if v_role = 'teacher' then
    if tg_op = 'INSERT' then
      raise exception 'Teachers cannot create work records' using errcode = '42501';
    end if;
    if old.status <> 'submitted' or new.status not in ('approved','rejected') then
      raise exception 'Teachers can only approve or reject submitted records' using errcode = 'P0001';
    end if;
    if new.status = 'rejected' and coalesce(trim(new.teacher_comment), '') = '' then
      raise exception 'A reason is required when rejecting a record' using errcode = 'P0001';
    end if;
    -- teachers cannot change the data itself
    new.student_id := old.student_id; new.job_id := old.job_id; new.work_date := old.work_date;
    new.start_time := old.start_time; new.end_time := old.end_time; new.break_minutes := old.break_minutes;
    new.note := old.note; new.submitted_at := old.submitted_at;
    new.reviewed_by := auth.uid(); new.reviewed_at := now(); new.updated_at := now();
    return new;
  end if;

  raise exception 'Not allowed' using errcode = '42501';
end $$;

-- Re-evaluate compliance after a change and notify student + assigned teachers.
create or replace function public.refresh_compliance_alerts(p_student uuid, p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row  record;
  v_name text;
begin
  select full_name into v_name from public.users where id = p_student;
  -- a record on day D influences the rolling windows ending D .. D+7 (+1 for overnight)
  select * into v_row from public.compliance_series(p_student, p_day, p_day + 7)
   where level in ('yellow','red')
   order by case level when 'red' then 0 else 1 end, day
   limit 1;
  if v_row.day is null then return; end if;

  insert into public.notifications (user_id, student_id, level, title, title_ja, body, body_ja, link, dedupe_key)
  select x.uid, p_student, v_row.level,
         case v_row.level when 'red' then 'Work-hour limit exceeded' else 'Approaching work-hour limit' end,
         case v_row.level when 'red' then '就労時間の上限を超えています' else '就労時間の上限に近づいています' end,
         case when v_row.is_holiday
              then format('%s: %s h worked on %s (long vacation limit: 8 h/day).', v_name, trim_scale(v_row.day_hours), v_row.day)
              else format('%s: %s h in the 7 days ending %s (limit: 28 h).', v_name, trim_scale(v_row.rolling7), v_row.day) end,
         case when v_row.is_holiday
              then format('%s：%s の就労時間は %s 時間です（長期休暇中の上限：1日8時間）。', v_name, v_row.day, trim_scale(v_row.day_hours))
              else format('%s：%s までの7日間の就労時間は %s 時間です（上限：28時間）。', v_name, v_row.day, trim_scale(v_row.rolling7)) end,
         x.link,
         format('compliance:%s:%s:%s', p_student, v_row.level, v_row.day)
    from (
      select p_student as uid, '/student' as link
      union all
      select a.teacher_id, '/teacher/students/' || p_student
        from public.teacher_student_assignments a where a.student_id = p_student
    ) x
  on conflict (user_id, dedupe_key) do nothing;
end $$;

-- After-change: approval history, notifications
create or replace function public.after_work_record_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_action text;
begin
  if tg_op = 'DELETE' then return old; end if;

  if tg_op = 'INSERT' and new.status = 'submitted' then
    v_action := 'submitted';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_action := case new.status
                  when 'submitted' then case when old.status = 'rejected' then 'resubmitted' else 'submitted' end
                  when 'approved'  then 'approved'
                  when 'rejected'  then 'rejected'
                  else null end;
  end if;
  if tg_op = 'UPDATE' and public.is_admin() and v_action is null then
    v_action := 'admin_edit';
  end if;

  if v_action is not null then
    insert into public.approval_records (record_id, student_id, action, actor_id, comment, snapshot)
    values (new.id, new.student_id, v_action, auth.uid(),
            case when v_action in ('approved','rejected') then new.teacher_comment end,
            jsonb_build_object('work_date', new.work_date, 'start_time', new.start_time, 'end_time', new.end_time,
                               'break_minutes', new.break_minutes, 'hours', new.hours, 'job_id', new.job_id));
  end if;

  if v_action in ('approved','rejected') then
    insert into public.notifications (user_id, student_id, level, title, title_ja, body, body_ja, link)
    values (new.student_id, new.student_id,
            case when v_action = 'approved' then 'success' else 'red' end,
            case when v_action = 'approved' then 'Work record approved' else 'Work record rejected' end,
            case when v_action = 'approved' then '勤務記録が承認されました' else '勤務記録が差し戻されました' end,
            format('%s (%s h)%s', new.work_date, trim_scale(new.hours), coalesce(' — ' || new.teacher_comment, '')),
            format('%s（%s 時間）%s', new.work_date, trim_scale(new.hours), coalesce(' — ' || new.teacher_comment, '')),
            '/student/records');
  end if;

  if tg_op = 'INSERT' or new.work_date <> old.work_date or new.start_time <> old.start_time
     or new.end_time <> old.end_time or new.break_minutes <> old.break_minutes then
    perform public.refresh_compliance_alerts(new.student_id, new.work_date);
  end if;
  return new;
end $$;

-- Generic audit trail
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  v_id := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'id',
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'user_id',
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'student_id');
  insert into public.audit_logs (actor_id, actor_role, action, table_name, row_id, old_data, new_data)
  values (
    (select id from public.users where id = auth.uid()),
    coalesce(public.my_role()::text, case when auth.uid() is null then 'system' else 'unknown' end),
    lower(tg_op), tg_table_name, v_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- App-level events (login, export, ...) written by the application
create or replace function public.log_event(p_action text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, actor_role, action, table_name, new_data)
  select auth.uid(), public.my_role()::text, p_action, 'app', p_detail
   where auth.uid() is not null and exists (select 1 from public.users where id = auth.uid());
$$;

-- wire triggers
drop trigger if exists users_guard on public.users;
create trigger users_guard before update on public.users for each row execute function public.guard_users();
drop trigger if exists student_profiles_guard on public.student_profiles;
create trigger student_profiles_guard before update on public.student_profiles for each row execute function public.guard_student_profile();
drop trigger if exists jobs_guard on public.jobs;
create trigger jobs_guard before insert or update on public.jobs for each row execute function public.guard_jobs();
drop trigger if exists work_records_guard on public.work_records;
create trigger work_records_guard before insert or update or delete on public.work_records for each row execute function public.guard_work_records();
drop trigger if exists work_records_after on public.work_records;
create trigger work_records_after after insert or update on public.work_records for each row execute function public.after_work_record_change();
drop trigger if exists teacher_profiles_touch on public.teacher_profiles;
create trigger teacher_profiles_touch before update on public.teacher_profiles for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.school_settings;
create trigger settings_touch before update on public.school_settings for each row execute function public.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['users','student_profiles','teacher_profiles','teacher_student_assignments','classes',
                           'jobs','work_records','school_holidays','school_settings']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.users                       enable row level security;
alter table public.student_profiles            enable row level security;
alter table public.teacher_profiles            enable row level security;
alter table public.classes                     enable row level security;
alter table public.teacher_student_assignments enable row level security;
alter table public.jobs                        enable row level security;
alter table public.work_records                enable row level security;
alter table public.school_holidays             enable row level security;
alter table public.approval_records            enable row level security;
alter table public.notifications               enable row level security;
alter table public.audit_logs                  enable row level security;
alter table public.school_settings             enable row level security;

-- drop old policies so the file can be re-run
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- users
create policy users_select on public.users for select to authenticated using (
  id = auth.uid() or public.is_admin()
  or (role = 'student' and public.teacher_can_see(id))
  or (role = 'teacher' and exists (select 1 from public.teacher_student_assignments a
                                    where a.teacher_id = users.id and a.student_id = auth.uid()))
  or (role = 'teacher' and public.my_role() = 'teacher')
);
create policy users_update_self on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin_all on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- student_profiles
create policy sp_select on public.student_profiles for select to authenticated using (public.can_view_student(user_id));
create policy sp_update_self on public.student_profiles for update to authenticated
  using (user_id = auth.uid() and public.my_role() = 'student') with check (user_id = auth.uid());
create policy sp_admin_all on public.student_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- teacher_profiles
create policy tp_select on public.teacher_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy tp_admin_all on public.teacher_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- classes / holidays / settings: readable by every active user, writable by admins
create policy classes_select on public.classes for select to authenticated using (public.my_role() is not null);
create policy classes_admin on public.classes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy holidays_select on public.school_holidays for select to authenticated using (public.my_role() is not null);
create policy holidays_admin on public.school_holidays for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_select on public.school_settings for select to authenticated using (true);
create policy settings_admin on public.school_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- assignments
create policy tsa_select on public.teacher_student_assignments for select to authenticated
  using (teacher_id = auth.uid() or student_id = auth.uid() or public.is_admin());
create policy tsa_admin on public.teacher_student_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- jobs
create policy jobs_select on public.jobs for select to authenticated using (public.can_view_student(student_id));
create policy jobs_student_insert on public.jobs for insert to authenticated
  with check (student_id = auth.uid() and public.my_role() = 'student');
create policy jobs_student_update on public.jobs for update to authenticated
  using (student_id = auth.uid() and public.my_role() = 'student') with check (student_id = auth.uid());
create policy jobs_student_delete on public.jobs for delete to authenticated
  using (student_id = auth.uid() and public.my_role() = 'student'
         and not exists (select 1 from public.work_records w where w.job_id = jobs.id));
create policy jobs_admin on public.jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- work_records
create policy wr_select on public.work_records for select to authenticated using (public.can_view_student(student_id));
create policy wr_student_insert on public.work_records for insert to authenticated
  with check (student_id = auth.uid() and public.my_role() = 'student');
create policy wr_student_update on public.work_records for update to authenticated
  using (student_id = auth.uid() and public.my_role() = 'student' and status in ('draft','rejected'))
  with check (student_id = auth.uid());
create policy wr_student_delete on public.work_records for delete to authenticated
  using (student_id = auth.uid() and public.my_role() = 'student' and status in ('draft','rejected'));
create policy wr_teacher_review on public.work_records for update to authenticated
  using (public.teacher_can_see(student_id) and status = 'submitted')
  with check (public.teacher_can_see(student_id));
create policy wr_admin on public.work_records for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- approval history (written only by triggers)
create policy ar_select on public.approval_records for select to authenticated using (public.can_view_student(student_id));

-- notifications (written only by triggers)
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- audit logs: admins only, append-only
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());

-- function privileges
revoke execute on function public.refresh_compliance_alerts(uuid, date) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.compliance_series(uuid, date, date) to authenticated;
grant execute on function public.students_overview(date) to authenticated;
grant execute on function public.daily_hours(date, date, uuid) to authenticated;
grant execute on function public.period_report(date, date) to authenticated;
grant execute on function public.log_event(text, jsonb) to authenticated;
