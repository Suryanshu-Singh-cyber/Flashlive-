/**
 * FILE: apps/web/src/pages/queue/QueuePage.tsx
 *
 * PURPOSE:
 * Visualizes PostgreSQL worker slots, active builds and queued deployments.
 *
 * USED BY:
 * /queue route.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import type { QueueSnapshot } from '@flashlive/shared';
import { apiService, apiError } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Spinner';
import { formatDate, formatDuration } from '@/lib/utils';

export function QueuePage() {
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setQueue(await apiService.queue());
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading) return <Skeleton className="h-96" />;
  if (!queue) return <Card className="border-red-400/30 text-red-200">{error ?? 'Queue unavailable.'}</Card>;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Scheduler</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">Build queue</h1></div>
        <Button variant="secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      {error && <Card className="border-red-400/30 text-red-200">{error}</Card>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Slots', queue.stats.slotCount],
          ['Active', queue.stats.activeBuilds],
          ['Queued', queue.stats.queuedBuilds],
          ['Workers online', queue.stats.onlineWorkers],
        ].map(([label, value]) => <Card key={label}><div className="text-sm text-muted">{label}</div><div className="mt-2 font-display text-4xl">{value}</div></Card>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-condensed text-2xl uppercase">Worker slots</h2></CardHeader>
          <div className="grid gap-3">
            {queue.slots.map((slot) => (
              <div key={slot.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between"><div><div className="font-medium">Worker slot {slot.slotIndex + 1}</div><div className="text-xs text-muted">{slot.worker?.name ?? 'Unassigned'}</div></div><Badge status={slot.status === 'claimed' ? 'building' : slot.status === 'available' ? 'deployed' : 'failed'}>{slot.status}</Badge></div>
                {slot.deployment && <Link to={`/deployments/${slot.deployment.id}`} className="mt-3 block text-sm text-primary hover:underline">{slot.deployment.id.slice(0, 8)} · {slot.deployment.status}</Link>}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader><h2 className="font-condensed text-2xl uppercase">Queued deployments</h2></CardHeader>
          <div className="grid gap-3">
            {queue.queued.length === 0 && <p className="text-sm text-muted">Queue is empty.</p>}
            {queue.queued.map((deployment, index) => (
              <Link key={deployment.id} to={`/deployments/${deployment.id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 hover:border-primary/40">
                <div><div className="text-sm font-medium">#{index + 1} · {deployment.projectName}</div><div className="text-xs text-muted">{deployment.repositoryFullName} · {formatDate(deployment.createdAt)}</div></div>
                <div className="text-right"><Badge status="queued">queued</Badge><div className="mt-1 text-xs text-muted">{formatDuration(deployment.queueDurationMs)}</div></div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
