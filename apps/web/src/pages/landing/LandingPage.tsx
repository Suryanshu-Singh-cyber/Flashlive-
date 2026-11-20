/**
 * FILE: apps/web/src/pages/landing/LandingPage.tsx
 *
 * PURPOSE:
 * Implements the FLASHLIVE marketing landing page.
 *
 * WHY THIS FILE EXISTS:
 * This is the primary product story and visual showcase for the platform.
 *
 * HOW IT WORKS:
 * Composes animated hero, technology marquee, storytelling steps, feature
 * cards, architecture flow and final CTA using real routes/anchors.
 *
 * USED BY:
 * / route inside PublicLayout.
 */

import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Boxes, Braces, GitBranch, Github, Layers, Radio, Rocket, ShieldCheck, TerminalSquare, Timer, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Reveal, SectionHeading, Stagger, StaggerItem, TextReveal } from '@/components/animations/Reveal';
import { ParticleField } from '@/components/three/ParticleField';

const DeploymentEngine = lazy(() => import('@/components/three/DeploymentEngine').then((module) => ({ default: module.DeploymentEngine })));

const technologies = ['React', 'GitHub', 'PostgreSQL', 'Docker', 'Node.js', 'Nginx'];
const steps = [
  { title: 'The deployment problem', text: 'Pipelines are slow, opaque and easy to misconfigure.', icon: Layers },
  { title: 'Connect repository', text: 'Authorize GitHub and import a React + Vite project.', icon: Github },
  { title: 'Concurrent builds', text: 'PostgreSQL slots coordinate up to three Docker builds.', icon: Boxes },
  { title: 'Monitor execution', text: 'Persistent logs stream to a real terminal interface.', icon: TerminalSquare },
  { title: 'Publish website', text: 'Atomic artifacts are served through Nginx URLs.', icon: Radio },
];
const features = [
  { title: 'One-click deployment', text: 'Import a repo, choose a branch and deploy instantly.', icon: Rocket },
  { title: 'Build queue', text: 'Watch queued and active jobs across worker slots.', icon: Workflow },
  { title: 'Worker monitoring', text: 'Live worker heartbeats and recovery events.', icon: Radio },
  { title: 'Docker isolation', text: 'Untrusted builds run with limits and no socket.', icon: ShieldCheck },
  { title: 'Live terminal', text: 'Stream build output as it happens.', icon: TerminalSquare },
  { title: 'Deployment analytics', text: 'Real success rates, durations and queue metrics.', icon: Timer },
];
const architecture = ['GitHub', 'Express API', 'PostgreSQL Queue', 'Worker Pool', 'Docker', 'Nginx'];


export function LandingPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative grid min-h-[92vh] items-center border-b border-line lg:grid-cols-[1fr_0.9fr]">
        <ParticleField className="absolute inset-0 h-full w-full opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(232,255,0,0.14),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(0,204,255,0.10),transparent_30%)]" />
        <div className="relative mx-auto w-full max-w-7xl px-5 py-24 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-primary">
            <GitBranch className="h-3.5 w-3.5" /> GitHub-native deployment engine
          </motion.div>
          <h1 className="font-display text-[18vw] uppercase leading-[0.82] text-ink sm:text-7xl lg:text-8xl">
            <TextReveal>Push code.</TextReveal><br />
            <TextReveal delay={0.12}><span className="text-primary text-glow">Build fast.</span></TextReveal><br />
            <TextReveal delay={0.24}>Go live.</TextReveal>
          </h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-7 max-w-xl text-lg text-muted">
            Your GitHub repository is one click away from deployment. FLASHLIVE handles builds, scheduling, monitoring and recovery.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-9 flex flex-wrap gap-4">
            <Button onClick={() => { window.location.href = '/register'; }} className="px-7 py-4 text-base">Start deploying <ArrowRight className="h-4 w-4" /></Button>
            <Button variant="secondary" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="px-7 py-4 text-base">Explore platform</Button>
          </motion.div>
        </div>
        <div className="relative hidden h-[620px] lg:block"><Suspense fallback={null}><DeploymentEngine className="h-full w-full" /></Suspense></div>
      </section>

      <section className="border-b border-line bg-surface/40 py-5">
        <div className="flex overflow-hidden">
          <div className="flex min-w-max animate-marquee gap-12 px-6 font-condensed text-xl uppercase tracking-[0.18em] text-muted">
            {[...technologies, ...technologies].map((tech, index) => <span key={`${tech}-${index}`} className="flex items-center gap-3"><Braces className="h-4 w-4 text-primary" />{tech}</span>)}
          </div>
        </div>
      </section>

      <section id="story" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <SectionHeading eyebrow="The system" title="From push to production without pipeline babysitting" description="FLASHLIVE turns repository pushes into scheduled, observable and recoverable static deployments." />
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {steps.map(({ title, text, icon: Icon }, index) => (
            <StaggerItem key={title}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <div className="mb-5 flex items-center justify-between"><span className="font-mono text-xs text-primary">0{index + 1}</span><Icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-condensed text-xl uppercase text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section id="how-it-works" className="border-y border-line bg-surface/30 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading eyebrow="How it works" title="Four steps to a live URL" />
          <div className="grid gap-5 md:grid-cols-4">
            {['Connect GitHub', 'Import repository', 'Deploy project', 'Get live website'].map((step, index) => (
              <Reveal key={step} delay={index * 0.08}>
                <div className="surface-elevated relative h-full p-6">
                  <div className="mb-8 font-display text-6xl text-primary/25">{String(index + 1).padStart(2, '0')}</div>
                  <h3 className="font-condensed text-2xl uppercase">{step}</h3>
                  <p className="mt-2 text-sm text-muted">{['Authorize repository access securely.', 'Choose branch and build settings.', 'Queue a Docker build with real logs.', 'Publish immutable static artifacts.'][index]}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <SectionHeading eyebrow="Product showcase" title="Engineering visible in every view" description="A deployment platform where queue state, worker health and build output are first-class UI." />
        <Stagger className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ title, text, icon: Icon }) => (
            <StaggerItem key={title}>
              <Card className="group h-full transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-card">
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform group-hover:scale-110"><Icon className="h-5 w-5" /></div>
                <h3 className="font-condensed text-2xl uppercase text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section id="architecture" className="border-y border-line bg-black/40 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading eyebrow="Architecture" title="Real services, real concurrency" description="The same flow shown here powers the application: GitHub → API → PostgreSQL queue → workers → Docker → Nginx." />
          <Reveal>
            <div className="surface-elevated grid gap-3 p-6 md:grid-cols-6">
              {architecture.map((node, index) => (
                <div key={node} className="relative">
                  <div className="rounded-xl border border-line bg-surface px-4 py-5 text-center font-condensed text-lg uppercase text-ink">{node}</div>
                  {index < architecture.length - 1 && <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-primary/50 md:block" />}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-28 text-center lg:px-8">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Final transmission</p>
          <h2 className="mt-4 font-display text-6xl uppercase leading-none md:text-8xl">Your code deserves to go live.</h2>
          <div className="mt-9 flex justify-center"><Button onClick={() => { window.location.href = '/register'; }} className="px-8 py-4 text-base">Start deploying <ArrowRight className="h-4 w-4" /></Button></div>
        </Reveal>
      </section>
    </div>
  );
}
