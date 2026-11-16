'use client';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, Cell,
  PieChart, Pie, BarChart, Legend,
} from 'recharts';
import type { ComplianceDay, Level } from '@/lib/types';
import { useI18n } from './i18n-provider';

const COLORS: Record<Level, string> = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' };

/** Daily hours (bars, coloured by compliance level) + rolling 7-day total (line) vs the 28h limit. */
export function HoursChart({ data, weeklyLimit, dailyLimit, height = 260 }: { data: ComplianceDay[]; weeklyLimit: number; dailyLimit: number; height?: number }) {
  const { t } = useI18n();
  const rows = data.map((d) => ({ ...d, label: `${+d.day.slice(5, 7)}/${+d.day.slice(8, 10)}`, roll: d.is_holiday ? null : d.rolling7 }));
  const hasHoliday = data.some((d) => d.is_holiday);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, (max: number) => Math.max(Math.ceil(max) + 2, weeklyLimit + 4)]} />
          <Tooltip
            formatter={(v: number, name: string) => [`${v} h`, name === 'day_hours' ? t('sheet.dayTotal') : t('sheet.rolling')]}
            labelFormatter={(l) => String(l)}
          />
          <ReferenceLine y={weeklyLimit} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `${weeklyLimit}h`, fontSize: 10, fill: '#ef4444', position: 'right' }} />
          {hasHoliday && <ReferenceLine y={dailyLimit} stroke="#f59e0b" strokeDasharray="2 4" />}
          <Bar dataKey="day_hours" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {rows.map((r) => <Cell key={r.day} fill={r.is_holiday ? COLORS[r.level] : r.day_hours > 0 ? '#93c5fd' : '#e2e8f0'} />)}
          </Bar>
          <Line dataKey="roll" type="monotone" stroke="#2563eb" strokeWidth={2} dot={(p: any) => (
            <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload.roll == null ? 0 : 3} fill={COLORS[p.payload.level as Level]} stroke="white" />
          )} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LevelPie({ green, yellow, red }: { green: number; yellow: number; red: number }) {
  const { t } = useI18n();
  const data = [
    { name: t('level.green'), value: green, color: COLORS.green },
    { name: t('level.yellow'), value: yellow, color: COLORS.yellow },
    { name: t('level.red'), value: red, color: COLORS.red },
  ].filter((d) => d.value > 0);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rolling 7-day hours per student vs the limit. */
export function StudentsBar({ rows, limit }: { rows: { name: string; hours: number; level: Level }[]; limit: number }) {
  const { t } = useI18n();
  return (
    <div style={{ height: Math.max(200, rows.length * 26 + 40) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, (max: number) => Math.max(limit + 4, Math.ceil(max))]} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => [`${v} h`, t('stat.rolling7')]} />
          <ReferenceLine x={limit} stroke="#ef4444" strokeDasharray="4 4" />
          <Bar dataKey="hours" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {rows.map((r) => <Cell key={r.name} fill={COLORS[r.level]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stacked daily count of students by level (weekly compliance overview). */
export function WeeklyLevelChart({ rows }: { rows: { label: string; green: number; yellow: number; red: number }[] }) {
  const { t } = useI18n();
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="green" stackId="a" name={t('level.green')} fill={COLORS.green} />
          <Bar dataKey="yellow" stackId="a" name={t('level.yellow')} fill={COLORS.yellow} />
          <Bar dataKey="red" stackId="a" name={t('level.red')} fill={COLORS.red} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
