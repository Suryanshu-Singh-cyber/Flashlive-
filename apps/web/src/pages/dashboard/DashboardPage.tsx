/**
 * FILE: apps/web/src/pages/dashboard/DashboardPage.tsx
 *
 * PURPOSE:
 * Authenticated overview with real deployment, queue and worker metrics.
 *
 * USED BY:
 * /dashboard route.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle2, Clock3, FolderGit2, GitBranch, Rocket, XCircle } from 'lucide-react';
import type { Deployment, DeploymentAnalytics, Project, QueueSnapshot } from '@flashlive/shared';
import { apiService } from '@/services/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import { formatDate, formatDuration } from '@/lib/utils';

export function DashboardPage() {
  const [analytics, setAnalytics] = useState<DeploymentAnalytics | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiService.analytics(30), apiService.deployments(), apiService.projects(), apiService.queue()])
      .then(([analyticsData, deploymentsData, projectsData, queueData]) => {
        setAnalytics(analyticsData);
        setDeployments(deploymentsData.slice(0, 6));
        setProjects(projectsData.slice(0, 4));
        setQueue(queueData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (error) return <Card className="border-red-400/30 text-red-200">{error}</Card>;

  const overview = analytics?.overview;
  const stats = [
    { label: 'Projects', value: projects.length, icon: FolderGit2 },
    { label: 'Deployments', value: overview?.totalDeployments ?? 0, icon: Rocket },
    { label: 'Successful', value: overview?.successfulDeployments ?? 0, icon: CheckCircle2 },
    { label: 'Failed', value: overview?.failedDeployments ?? 0, icon: XCircle },
    { label: 'Active builds', value: overview?.activeDeployments ?? 0, icon: Activity },
    { label: 'Queued', value: overview?.queuedDeployments ?? 0, icon: Clock3 },
    { label: 'Avg build', value: formatDuration(overview?.averageBuildDurationMs), icon: GitBranch },
    { label: 'Success rate', value: `${Math.round((overview?.successRate ?? 0) * 100)}%`, icon: Activity },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Mission control</p>
        <h1 className="mt-2 font-condensed text-5xl font-bold uppercase">Overview</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}><div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><Icon className="h-4 w-4 text-primary" /></div><div className="mt-4 font-display text-4xl">{value}</div></Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><div><h2 className="font-condensed text-2xl uppercase">Recent deployments</h2><p className="text-sm text-muted">Latest build activity</p></div><Link to="/deployments" className="text-sm text-primary hover:underline">View all</Link></CardHeader>
          <div className="grid gap-3">
            {deployments.length === 0 && <p className="text-sm text-muted">No deployments yet. Import a project and deploy.</p>}
            {deployments.map((deployment) => (
              <Link key={deployment.id} to={`/deployments/${deployment.id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-primary/40">
                <div><div className="font-medium">{deployment.projectName}</div><div className="text-xs text-muted">{deployment.repositoryFullName} · {formatDate(deployment.createdAt)}</div></div>
                <Badge status={deployment.status}>{deployment.status}</Badge>
              </Link>
            ))}
          </div>
        </Card>
        <div className="grid gap-6">
          <Card>
            <CardHeader><h2 className="font-condensed text-2xl uppercase">Build slots</h2></CardHeader>
            <div className="grid gap-3">
              {queue?.slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
                  <div><div className="text-sm font-medium">Slot {slot.slotIndex + 1}</div><div className="text-xs text-muted">{slot.worker?.name ?? 'Unassigned'}</div></div>
                  <Badge status={slot.status === 'claimed' ? 'building' : 'deployed'}>{slot.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader><h2 className="font-condensed text-2xl uppercase">Recent projects</h2></CardHeader>
            <div className="grid gap-3">
              {projects.map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-primary/40">{project.name}<span className="block text-xs text-muted">{project.repositoryFullName}</span></Link>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
