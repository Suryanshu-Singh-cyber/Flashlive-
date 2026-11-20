/**
 * FILE: apps/web/src/pages/deployments/DeploymentsPage.tsx
 *
 * PURPOSE:
 * Lists deployments with status filtering and quick actions.
 *
 * USED BY:
 * /deployments route.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, XCircle } from 'lucide-react';
import type { Deployment, DeploymentStatus } from '@flashlive/shared';
import { apiService, apiError } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

const filters: Array<{ label: string; value?: DeploymentStatus }> = [
  { label: 'All' },
  { label: 'Queued', value: 'queued' },
  { label: 'Building', value: 'building' },
  { label: 'Deployed', value: 'deployed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [status, setStatus] = useState<DeploymentStatus | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setDeployments(await apiService.deployments(status ? { status } : {}));
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status]);

  const cancel = async (id: string) => {
    try {
      await apiService.cancelDeployment(id);
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Build history</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">Deployments</h1></div>
        <Button variant="secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => <button key={filter.label} onClick={() => setStatus(filter.value)} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${status === filter.value ? 'border-primary bg-primary/10 text-primary' : 'border-line text-muted hover:text-ink'}`}>{filter.label}</button>)}
      </div>
      {error && <Card className="border-red-400/30 text-red-200">{error}</Card>}
      {loading ? <div className="grid gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div> : deployments.length === 0 ? (
        <Card className="py-14 text-center text-sm text-muted">No deployments found.</Card>
      ) : (
        <div className="grid gap-3">
          {deployments.map((deployment) => (
            <Card key={deployment.id} className="flex flex-wrap items-center justify-between gap-4">
              <Link to={`/deployments/${deployment.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3"><span className="font-medium">{deployment.projectName}</span><Badge status={deployment.status}>{deployment.status}</Badge></div>
                <div className="mt-1 truncate text-xs text-muted">{deployment.repositoryFullName} · {deployment.branch} · {deployment.commitSha?.slice(0, 8) ?? 'pending'} · {formatDate(deployment.createdAt)}</div>
              </Link>
              <div className="flex gap-2">
                {deployment.liveUrl && <a href={deployment.liveUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Open site</a>}
                {(deployment.status === 'queued' || deployment.status === 'building') && <Button variant="danger" className="px-3 py-2 text-xs" onClick={() => void cancel(deployment.id)}><XCircle className="h-4 w-4" /> Cancel</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
