/**
 * FILE: apps/web/src/pages/profile/ProfilePage.tsx
 *
 * PURPOSE:
 * Shows and updates the authenticated user's public profile.
 *
 * USED BY:
 * /profile route.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Save, User } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { apiService, apiError } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.displayName ?? '');
  }, [user?.displayName]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiService.updateMe(name.trim());
      await refreshUser();
      setMessage('Profile updated.');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Account</p><h1 className="mt-2 font-condensed text-5xl font-bold uppercase">Profile</h1></div>
      <Card className="max-w-2xl">
        <CardHeader><div><h2 className="font-condensed text-2xl uppercase">Public profile</h2><p className="text-sm text-muted">Firebase authentication with PostgreSQL profile data</p></div><User className="h-5 w-5 text-primary" /></CardHeader>
        <form onSubmit={save} className="grid gap-4">
          <Input label="Email" value={user?.email ?? ''} disabled />
          <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">Email verified: <span className={user?.emailVerified ? 'text-emerald-300' : 'text-amber-300'}>{user?.emailVerified ? 'yes' : 'no'}</span><br />Member since {formatDate(user?.createdAt)}</div>
          {message && <p className="text-sm text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <Button type="submit" loading={saving} className="w-fit"><Save className="h-4 w-4" /> Save profile</Button>
        </form>
      </Card>
    </div>
  );
}
