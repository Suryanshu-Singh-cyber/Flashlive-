/**
 * FILE: apps/web/src/pages/analytics/AnalyticsPage.tsx
 *
 * PURPOSE:
 * Displays real deployment analytics with date-range filters and charts.
 *
 * USED BY:
 * /analytics route.
 */

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import type { DeploymentAnalytics } from '@flashlive/shared';
import { apiService, apiError } from '@/services/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Spinner';
import { formatDuration } from '@/lib/utils';

const ranges = [7, 30, 90];

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState<DeploymentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiService.analytics(days)
      .then(setAnalytics)
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (!analytics) return <Card className="border-red-400/30 text-red-200">{error ?? 'Analytics unavailable.'}</Card>;

  const overview = analytics.overview;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Telemetry</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">Analytics</h1></div>
        <div className="flex gap-2">{ranges.map((range) => <button key={range} onClick={() => setDays(range)} className={`rounded-full border px-4 py-2 text-xs font-semibold ${days === range ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted'}`}>Last {range} days</button>)}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Success rate', `${Math.round(overview.successRate * 100)}%`],
          ['Avg build', formatDuration(overview.averageBuildDurationMs)],
          ['Avg queue wait', formatDuration(overview.averageQueueDurationMs)],
          ['Recovery events', overview.recoveryEvents],
        ].map(([label, value]) => <Card key={label}><div className="text-sm text-muted">{label}</div><div className="mt-2 font-display text-4xl">{value}</div></Card>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-condensed text-2xl uppercase">Deployments per day</h2></CardHeader>
          <div className="h-72"><ResponsiveContainer><LineChart data={analytics.daily}><CartesianGrid stroke="rgba(255,255,255,0.08)" /><XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} /><YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} allowDecimals={false} /><Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} /><Line type="monotone" dataKey="total" stroke="#E8FF00" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        </Card>
        <Card>
          <CardHeader><h2 className="font-condensed text-2xl uppercase">Success vs failure</h2></CardHeader>
          <div className="h-72"><ResponsiveContainer><BarChart data={analytics.daily}><CartesianGrid stroke="rgba(255,255,255,0.08)" /><XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} /><YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} allowDecimals={false} /><Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} /><Bar dataKey="successful" stackId="a" fill="#E8FF00" /><Bar dataKey="failed" stackId="a" fill="#f87171" /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>
      <Card>
        <CardHeader><h2 className="font-condensed text-2xl uppercase">Worker utilization</h2></CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          {analytics.workers.map((worker) => <div key={worker.id} className="rounded-xl border border-line bg-surface p-4"><div className="font-medium">{worker.name}</div><div className="mt-1 text-xs text-muted">{worker.status} · {worker.activeBuilds} active · {worker.completedBuilds} completed</div></div>)}
          {analytics.workers.length === 0 && <p className="text-sm text-muted">No workers registered.</p>}
        </div>
      </Card>
    </div>
  );
}
