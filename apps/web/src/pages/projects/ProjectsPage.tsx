/**
 * FILE: apps/web/src/pages/projects/ProjectsPage.tsx
 *
 * PURPOSE:
 * Lists FLASHLIVE projects and provides the GitHub repository import wizard.
 *
 * USED BY:
 * /projects route.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Github, GitBranch, Plus, Rocket } from 'lucide-react';
import type { Project } from '@flashlive/shared';
import { apiService, apiError } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

interface Repo { id: number; fullName: string; name: string; private: boolean; defaultBranch: string; htmlUrl: string }
interface Branch { name: string; commitSha: string; protected: boolean }
interface GithubStatus { connected: boolean; account: { login: string; email: string | null } | null }

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [github, setGithub] = useState<GithubStatus>({ connected: false, account: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [repo, setRepo] = useState<Repo | null>(null);
  const [branch, setBranch] = useState('main');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [projectData, githubData] = await Promise.all([apiService.projects(), apiService.githubStatus()]);
      setProjects(projectData);
      setGithub(githubData);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openWizard = async () => {
    setWizard(true);
    setWizardError(null);
    setRepo(null);
    setBranches([]);
    setName('');
    if (!github.connected) return;
    try {
      setRepos(await apiService.githubRepositories());
    } catch (err) {
      setWizardError(apiError(err));
    }
  };

  const selectRepo = async (value: string) => {
    const selected = repos.find((item) => item.fullName === value) ?? null;
    setRepo(selected);
    setBranches([]);
    setBranch(selected?.defaultBranch ?? 'main');
    setName(selected?.name ?? '');
    if (!selected) return;
    try {
      const [owner, repoName] = selected.fullName.split('/');
      setBranches(await apiService.githubBranches(owner!, repoName!));
    } catch (err) {
      setWizardError(apiError(err));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!repo) return setWizardError('Select a repository.');
    setSubmitting(true);
    setWizardError(null);
    try {
      await apiService.createProject({
        name: name || repo.name,
        repositoryFullName: repo.fullName,
        repositoryId: repo.id,
        branch,
        framework: 'react-vite',
        buildCommand: 'npm run build -- --base=./',
        installCommand: 'npm ci',
        outputDirectory: 'dist',
      });
      setWizard(false);
      await load();
    } catch (err) {
      setWizardError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const connect = async () => {
    try {
      window.location.href = await apiService.githubConnect();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const repoOptions = useMemo(() => repos.map((item) => item.fullName), [repos]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Workspace</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">Projects</h1></div>
        <Button onClick={openWizard}><Plus className="h-4 w-4" /> Import project</Button>
      </div>
      {error && <Card className="border-red-400/30 text-red-200">{error}</Card>}
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div> : projects.length === 0 ? (
        <Card className="py-16 text-center"><Github className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-4 font-condensed text-3xl uppercase">No projects yet</h2><p className="mt-2 text-sm text-muted">Connect GitHub and import a React + Vite repository.</p><Button className="mt-6" onClick={openWizard}>Import project</Button></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="h-full transition-all hover:-translate-y-1 hover:border-primary/40">
                <CardHeader><div><h2 className="font-condensed text-2xl uppercase">{project.name}</h2><p className="text-sm text-muted">{project.repositoryFullName}</p></div><Badge status={project.status}>{project.status}</Badge></CardHeader>
                <div className="grid grid-cols-2 gap-3 text-sm text-muted">
                  <span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" />{project.branch}</span>
                  <span className="flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" />{formatDate(project.lastDeploymentAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {wizard && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <Card className="surface-elevated w-full max-w-xl p-6">
            <h2 className="font-condensed text-3xl uppercase">Import repository</h2>
            {!github.connected ? (
              <div className="mt-5 grid gap-4"><p className="text-sm text-muted">Connect GitHub to browse repositories and import projects.</p>{wizardError && <p className="text-sm text-red-300">{wizardError}</p>}<Button onClick={connect}><Github className="h-4 w-4" /> Connect GitHub</Button></div>
            ) : (
              <form onSubmit={submit} className="mt-5 grid gap-4">
                <label className="block text-sm">Repository
                  <select className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3" value={repo?.fullName ?? ''} onChange={(e) => void selectRepo(e.target.value)}>
                    <option value="">Select repository</option>
                    {repoOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                {repo && <p className="text-xs text-muted">{repo.private ? 'Private repository' : 'Public repository'} · default branch {repo.defaultBranch}</p>}
                <Input label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder={repo?.name ?? 'My project'} />
                <label className="block text-sm">Branch
                  <select className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3" value={branch} onChange={(e) => setBranch(e.target.value)}>
                    {branches.length === 0 && <option value={branch}>{branch}</option>}
                    {branches.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                </label>
                {wizardError && <p className="text-sm text-red-300">{wizardError}</p>}
                <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setWizard(false)}>Cancel</Button><Button type="submit" loading={submitting}>Import</Button></div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
