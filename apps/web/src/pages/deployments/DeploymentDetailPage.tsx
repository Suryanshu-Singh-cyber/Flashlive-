/**
 * FILE: apps/web/src/pages/deployments/DeploymentDetailPage.tsx
 *
 * PURPOSE:
 * Monitors a single deployment with metadata, actions and live logs.
 *
 * USED BY:
 * /deployments/:deploymentId route.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import type { Deployment, DeploymentLog } from '@flashlive/shared';
import { apiService, apiError } from '@/services/api';
import { getFlashliveSocket, watchDeployment } from '@/services/socket';
import { auth } from '@/lib/firebase';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Spinner';
import { LogTerminal } from '@/components/terminal/LogTerminal';
import { formatDate, formatDuration } from '@/lib/utils';

export function DeploymentDetailPage() {
  const { deploymentId = '' } = useParams();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [deploymentData, logData] = await Promise.all([apiService.deployment(deploymentId), apiService.deploymentLogs(deploymentId)]);
      setDeployment(deploymentData);
      setLogs(logData);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [deploymentId]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (deployment?.status === 'queued' || deployment?.status === 'building') void load();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [deployment?.status, load]);

  useEffect(() => {
    if (!auth?.currentUser || !deploymentId) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const socket = await getFlashliveSocket();
      if (cancelled) return;
      cleanup = watchDeployment(socket, deploymentId, () => void load());
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [deploymentId, load]);

  const act = async (action: 'cancel' | 'redeploy') => {
    try {
      if (action === 'cancel') await apiService.cancelDeployment(deploymentId);
      else await apiService.redeploy(deploymentId);
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!deployment) return <Card className="border-red-400/30 text-red-200">{error ?? 'Deployment not found.'}</Card>;

  const rows = [
    ['Project', deployment.projectName],
    ['Repository', deployment.repositoryFullName],
    ['Branch', deployment.branch],
    ['Commit', deployment.commitSha?.slice(0, 12) ?? 'Pending'],
    ['Worker', deployment.workerId?.slice(0, 8) ?? '—'],
    ['Queue time', formatDuration(deployment.queueDurationMs)],
    ['Build duration', formatDuration(deployment.buildDurationMs)],
    ['Started', formatDate(deployment.startedAt)],
    ['Finished', formatDate(deployment.finishedAt)],
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Deployment</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">{deployment.projectName}</h1><p className="mt-2 font-mono text-xs text-muted">{deployment.id}</p></div>
        <div className="flex flex-wrap gap-2">
          {deployment.liveUrl && <a href={deployment.liveUrl} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" /> Open site</Button></a>}
          {deployment.status !== 'deployed' && deployment.status !== 'cancelled' && <Button variant="secondary" onClick={() => void act('redeploy')}><RotateCcw className="h-4 w-4" /> Redeploy</Button>}
          {(deployment.status === 'queued' || deployment.status === 'building') && <Button variant="danger" onClick={() => void act('cancel')}><XCircle className="h-4 w-4" /> Cancel</Button>}
          <Button variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>
      </div>
      {error && <Card className="border-red-400/30 text-red-200">{error}</Card>}
      {deployment.errorMessage && <Card className="border-red-400/30 text-red-200"><span className="font-semibold">Error:</span> {deployment.errorMessage}</Card>}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><div><h2 className="font-condensed text-2xl uppercase">Status</h2><p className="text-sm text-muted">Live deployment state</p></div><Badge status={deployment.status}>{deployment.status}</Badge></CardHeader>
          <div className="grid gap-3">
            {rows.map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm"><span className="text-muted">{label}</span><span className="font-medium">{value}</span></div>)}
          </div>
          <Link to={`/projects/${deployment.projectId}`} className="mt-4 inline-block text-sm text-primary hover:underline">View project →</Link>
        </Card>
        <LogTerminal logs={logs} live={deployment.status === 'building' || deployment.status === 'queued'} />
      </div>
    </div>
  );
}
