/**
 * FILE: apps/web/src/components/terminal/LogTerminal.tsx
 *
 * PURPOSE:
 * Renders persistent deployment logs with auto-scroll, pause and copy actions.
 *
 * WHY THIS FILE EXISTS:
 * Users need a reliable real-time terminal for build monitoring.
 *
 * HOW IT WORKS:
 * Accepts DeploymentLog[] plus optional live socket logs, colors levels,
 * preserves scroll position and supports copy/download.
 *
 * USED BY:
 * Deployment detail page and project deployment views.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Pause, Play } from 'lucide-react';
import type { DeploymentLog } from '@flashlive/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface LogTerminalProps {
  logs: DeploymentLog[];
  className?: string;
  live?: boolean;
}

function levelClass(level: DeploymentLog['level']) {
  if (level === 'ERROR') return 'text-red-300';
  if (level === 'WARNING') return 'text-amber-300';
  if (level === 'SUCCESS') return 'text-emerald-300';
  return 'text-zinc-300';
}

export function LogTerminal({ logs, className, live = false }: LogTerminalProps) {
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const text = useMemo(() => logs.map((log) => `[${log.createdAt}] ${log.level}: ${log.message}`).join('\n'), [logs]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'flashlive-deployment.log';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('terminal overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className={cn('h-2 w-2 rounded-full', live ? 'animate-pulseGlow bg-primary' : 'bg-zinc-500')} />
          {live ? 'LIVE LOG STREAM' : 'PERSISTED LOGS'} · {logs.length} lines
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => setPaused((value) => !value)}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </Button>
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={download}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="h-[420px] overflow-auto p-4">
        {logs.length === 0 ? (
          <p className="font-mono text-sm text-muted">Waiting for build output…</p>
        ) : (
          logs.map((log) => (
            <div key={`${log.deploymentId}-${log.sequence}`} className="mb-1 font-mono text-xs leading-5">
              <span className="text-zinc-600">{new Date(log.createdAt).toLocaleTimeString()}</span>{' '}
              <span className={levelClass(log.level)}>[{log.level}]</span>{' '}
              <span className="text-zinc-200">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
