/**
 * FILE: apps/web/src/pages/static/StaticPages.tsx
 *
 * PURPOSE:
 * Provides simple public documentation, contact, privacy and terms pages.
 *
 * USED BY:
 * /docs, /contact, /privacy and /terms routes.
 */

import { Link } from 'react-router-dom';
import { Reveal, SectionHeading } from '@/components/animations/Reveal';
import { Card } from '@/components/ui/Card';

export function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-24 lg:px-8">
      <SectionHeading eyebrow="Documentation" title="FLASHLIVE engineering notes" description="Concise product and architecture documentation for developers and reviewers." />
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['Architecture', 'React web app, Express API, PostgreSQL queue, Docker workers and Nginx static hosting.'],
          ['Queue', 'N=3 worker slots are claimed transactionally with FOR UPDATE SKIP LOCKED and lease tokens.'],
          ['Recovery', 'Workers heartbeat deployments; the reaper releases stale leases and requeues eligible builds.'],
          ['Security', 'Firebase ID tokens, GitHub OAuth state, encrypted tokens/env vars and restricted Docker builds.'],
        ].map(([title, text]) => <Reveal key={title}><Card><h2 className="font-condensed text-2xl uppercase">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{text}</p></Card></Reveal>)}
      </div>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center lg:px-8">
      <SectionHeading eyebrow="Contact" title="Talk to the FLASHLIVE team" description="For project feedback, bugs or collaboration." />
      <Card><p className="text-muted">Email: <a className="text-primary hover:underline" href="mailto:hello@flashlive.dev">hello@flashlive.dev</a></p><p className="mt-3 text-sm text-muted">GitHub issues are the fastest way to report deployment bugs.</p><Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">Back to home</Link></Card>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-24 lg:px-8">
      <SectionHeading eyebrow="Legal" title="Privacy policy" />
      <Card className="space-y-4 text-sm leading-6 text-muted"><p>FLASHLIVE stores account profile data, GitHub connection metadata, project configuration, deployment records and encrypted secrets required to provide the service.</p><p>GitHub access tokens and project environment variables are encrypted at rest. Build logs may contain repository output, so do not place secrets in frontend build variables.</p><p>We do not sell personal data. Contact us to request account deletion.</p></Card>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-24 lg:px-8">
      <SectionHeading eyebrow="Legal" title="Terms of service" />
      <Card className="space-y-4 text-sm leading-6 text-muted"><p>You are responsible for the repositories you connect and the content you deploy.</p><p>FLASHLIVE provides best-effort build infrastructure for a semester project and may enforce resource limits, timeouts and fair scheduling.</p><p>Do not deploy unlawful content, abuse the service or attempt to access other users' deployments.</p></Card>
    </div>
  );
}
