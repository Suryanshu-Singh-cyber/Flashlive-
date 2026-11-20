/**
 * FILE: apps/web/src/pages/projects/ProjectDetailPage.tsx
 *
 * PURPOSE:
 * Shows project configuration, deploy action and deployment history.
 *
 * USED BY:
 * /projects/:projectId route.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GitBranch, Rocket, Save, Trash2 } from 'lucide-react';
import type { Deployment, Project } from '@flashlive/shared';
import { apiService, apiError } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [projectData, deploymentData] = await Promise.all([apiService.project(projectId), apiService.deployments({ projectId })]);
      setProject(projectData);
      setName(projectData.name);
      setBranch(projectData.branch);
      setDeployments(deploymentData);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [projectId]);

  const deploy = async () => {
    setDeploying(true);
    setError(null);
    try {
      await apiService.deployProject(projectId);
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setDeploying(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiService.updateProject(projectId, { name, branch });
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Archive this project? Deployment history is preserved.')) return;
    try {
      await apiService.deleteProject(projectId);
      navigate('/projects');
    } catch (err) {
      setError(apiError(err));
    }
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!project) return <Card className="border-red-400/30 text-red-200">{error ?? 'Project not found.'}</Card>;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Project</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">{project.name}</h1><p className="mt-2 text-muted">{project.repositoryFullName}</p></div>
        <div className="flex gap-3"><Button variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /> Archive</Button><Button onClick={deploy} loading={deploying}><Rocket className="h-4 w-4" /> Deploy</Button></div>
      </div>
      {error && <Card className="border-red-400/30 text-red-200">{error}</Card>}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader><h2 className="font-condensed text-2xl uppercase">Configuration</h2></CardHeader>
          <div className="grid gap-4">
            <Input label="Project name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} icon={<GitBranch className="h-4 w-4" />} />
            <div className="grid grid-cols-2 gap-3 text-sm text-muted">
              <div className="rounded-xl border border-line bg-surface p-3">Framework<br /><span className="text-ink">{project.framework}</span></div>
              <div className="rounded-xl border border-line bg-surface p-3">Output<br /><span className="text-ink">{project.outputDirectory}</span></div>
              <div className="rounded-xl border border-line bg-surface p-3">Build<br /><span className="text-ink">{project.buildCommand}</span></div>
              <div className="rounded-xl border border-line bg-surface p-3">Install<br /><span className="text-ink">{project.installCommand}</span></div>
            </div>
            <Button variant="secondary" onClick={save} loading={saving}><Save className="h-4 w-4" /> Save changes</Button>
          </div>
        </Card>
        <Card>
          <CardHeader><h2 className="font-condensed text-2xl uppercase">Deployments</h2></CardHeader>
          <div className="grid gap-3">
            {deployments.length === 0 && <p className="text-sm text-muted">No deployments yet.</p>}
            {deployments.map((deployment) => (
              <Link key={deployment.id} to={`/deployments/${deployment.id}`} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 hover:border-primary/40">
                <div><div className="text-sm font-medium">{deployment.commitSha?.slice(0, 8) ?? deployment.id.slice(0, 8)}</div><div className="text-xs text-muted">{formatDate(deployment.createdAt)}</div></div>
                <Badge status={deployment.status}>{deployment.status}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
