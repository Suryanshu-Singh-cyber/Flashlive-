/**
 * FILE: apps/web/src/pages/settings/SettingsPage.tsx
 *
 * PURPOSE:
 * Provides account integration settings, currently GitHub connection controls.
 *
 * USED BY:
 * /settings route.
 */

import { useEffect, useState } from 'react';
import { Github } from 'lucide-react';
import { apiService, apiError } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface GithubStatus { connected: boolean; account: { login: string; email: string | null; scopes: string } | null }

export function SettingsPage() {
  const [status, setStatus] = useState<GithubStatus>({ connected: false, account: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setStatus(await apiService.githubStatus());
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const connect = async () => {
    try {
      window.location.href = await apiService.githubConnect();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect GitHub? Projects will remain but new imports will require reconnecting.')) return;
    try {
      await apiService.githubDisconnect();
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="grid gap-6">
      <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Workspace</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">Settings</h1></div>
      {error && <Card className="border-red-400/30 text-red-200">{error}</Card>}
      <Card>
        <CardHeader><div><h2 className="font-condensed text-2xl uppercase">GitHub integration</h2><p className="text-sm text-muted">Repository access for imports and builds</p></div><Badge status={status.connected ? 'deployed' : 'queued'}>{status.connected ? 'connected' : 'disconnected'}</Badge></CardHeader>
        {loading ? <p className="text-sm text-muted">Loading…</p> : status.connected ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-line bg-surface p-4"><div className="font-medium">{status.account?.login}</div><div className="text-sm text-muted">{status.account?.email ?? 'No public email'}</div><div className="mt-2 font-mono text-xs text-muted">scopes: {status.account?.scopes || 'repo read:user'}</div></div>
            <div className="flex gap-3"><Button variant="secondary" onClick={connect}>Reconnect</Button><Button variant="danger" onClick={disconnect}>Disconnect</Button></div>
          </div>
        ) : (
          <div className="grid gap-4"><p className="text-sm text-muted">Connect GitHub to import repositories, browse branches and authorize private projects.</p><Button className="w-fit" onClick={connect}><Github className="h-4 w-4" /> Connect GitHub</Button></div>
        )}
      </Card>
      <Card>
        <CardHeader><h2 className="font-condensed text-2xl uppercase">Build policy</h2></CardHeader>
        <p className="text-sm leading-6 text-muted">FLASHLIVE supports React + Vite projects with constrained build commands. Build variables are encrypted at rest but may be embedded into public frontend output; never put backend secrets in project environment variables.</p>
      </Card>
    </div>
  );
}
