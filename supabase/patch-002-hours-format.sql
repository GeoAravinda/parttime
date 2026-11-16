-- Patch 002: show hours as "29 h" instead of "29.00 h" in notifications.
-- (Already included in schema.sql — run only on databases created before it.)

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

