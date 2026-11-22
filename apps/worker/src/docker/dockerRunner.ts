/**
 * FILE: apps/worker/src/docker/dockerRunner.ts
 *
 * PURPOSE:
 * Executes real React + Vite builds inside restricted Docker containers.
 *
 * WHY THIS FILE EXISTS:
 * Repository contents are untrusted. This module isolates clone/build work in
 * containers with resource limits, dropped capabilities and no Docker socket.
 *
 * HOW IT WORKS:
 * Loads project/GitHub/env context, clones with credential helpers, runs npm
 * install and build commands as fixed argument arrays, streams logs through
 * LogShipper, heartbeats the deployment lease, publishes artifacts and asks the
 * API for fenced completion authorization.
 *
 * USED BY:
 * scheduler/workerLoop.ts.
 *
 * SECURITY:
 * No host Docker socket is mounted, containers run as node with CapDrop ALL,
 * no-new-privileges, CPU/memory/PID limits and a build timeout. Secrets are
 * masked from logs.
 */

import Docker from 'dockerode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { ClaimedDeployment } from '../queue/slotAllocator.js';
import type { LogShipper } from '../logs/logShipper.js';
import { publishArtifacts } from '../artifacts/publisher.js';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { decryptSecret } from '@flashlive/shared/crypto';
import { heartbeat, prepareSuccess } from '../api/client.js';

const execFileAsync = promisify(execFile);
const docker = new Docker();

interface ProjectContext {
  id: string;
  userId: string;
  name: string;
  repositoryFullName: string;
  branch: string;
  commitSha: string | null;
  buildCommand: string;
  installCommand: string;
  outputDirectory: string;
  githubAccountId: string | null;
  encryptedAccessToken: string | null;
}

interface BuildResult {
  outcome: 'deployed' | 'failed' | 'cancelled';
  errorMessage?: string;
  buildDurationMs: number;
}

let imageReady: Promise<void> | null = null;

async function ensureDockerImage(): Promise<void> {
  imageReady ??= (async () => {
    try {
      await docker.getImage(env.FLASHLIVE_DOCKER_IMAGE).inspect();
    } catch {
      await new Promise<void>((resolve, reject) => {
        docker.pull(env.FLASHLIVE_DOCKER_IMAGE, (error: Error | null, stream: NodeJS.ReadableStream) => {
          if (error) {
            reject(error);
            return;
          }
          docker.modem.followProgress(stream, (progressError) => {
            if (progressError) reject(progressError);
            else resolve();
          });
        });
      });
    }
  })();
  return imageReady;
}

async function loadContext(deployment: ClaimedDeployment): Promise<{ project: ProjectContext; envVars: Record<string, string>; githubToken: string | null }> {
  const projectResult = await query<ProjectContext>(
    `SELECT p.id, p.user_id AS "userId", p.name, p.repository_full_name AS "repositoryFullName",
       p.branch, p.commit_sha AS "commitSha", p.build_command AS "buildCommand",
       p.install_command AS "installCommand", p.output_directory AS "outputDirectory",
       p.github_account_id AS "githubAccountId", g.encrypted_access_token AS "encryptedAccessToken"
     FROM projects p
     LEFT JOIN github_accounts g ON g.user_id = p.user_id
     WHERE p.id = $1`,
    [deployment.projectId],
  );
  const project = projectResult.rows[0];
  if (!project) throw new Error('Project not found for deployment.');

  const envResult = await query<{ env_key: string; encrypted_value: string }>(
    `SELECT env_key, encrypted_value FROM project_env_vars WHERE project_id = $1 ORDER BY env_key`,
    [project.id],
  );
  const envVars: Record<string, string> = {};
  for (const row of envResult.rows) {
    envVars[row.env_key] = decryptSecret(row.encrypted_value, env.TOKEN_ENCRYPTION_KEY);
  }

  const githubToken = project.encryptedAccessToken
    ? decryptSecret(project.encryptedAccessToken, env.TOKEN_ENCRYPTION_KEY)
    : null;
  return { project, envVars, githubToken };
}

function maskSecrets(values: Array<string | null | undefined>) {
  const secrets = values.filter((value): value is string => Boolean(value && value.length > 3));
  return (message: string) => secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), message);
}

async function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...options.env },
    timeout: options.timeoutMs ?? 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

async function git(args: string[], cwd: string, githubToken: string | null) {
  const env: NodeJS.ProcessEnv = {};
  if (githubToken) env.FLASHLIVE_GITHUB_TOKEN = githubToken;
  const credentialArgs = githubToken
    ? ['-c', 'credential.helper=!f() { echo "username=x-access-token"; echo "password=$FLASHLIVE_GITHUB_TOKEN"; }; f']
    : [];
  return run('git', [...credentialArgs, ...args], { cwd, env });
}

function npmArgs(command: string, fallback: string[]): string[] {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (parts[0] !== 'npm') throw new Error(`Unsupported build command: ${command}`);
  return parts.length > 1 ? parts : fallback;
}

const SKIP_SEARCH_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);

async function findPackageJsonFiles(root: string, maxDepth = 5): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string, rel: string, depth: number) {
    if (depth > maxDepth) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isFile() && entry.name === 'package.json') found.push(rel ? `${rel}/package.json` : 'package.json');
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_SEARCH_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name, depth + 1);
    }
  }
  await walk(root, '', 0);
  return found;
}

async function detectAppRoot(workspace: string): Promise<string> {
  const candidates = (await findPackageJsonFiles(workspace)).sort(
    (a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b),
  );
  let sawPackageJson = false;
  for (const rel of candidates) {
    const raw = await readFile(path.join(workspace, ...rel.split('/')), 'utf8').catch(() => null);
    if (!raw) continue;
    sawPackageJson = true;
    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      pkg = JSON.parse(raw) as typeof pkg;
    } catch {
      continue;
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!deps.react || !deps.vite) continue;
    const dir = path.posix.dirname(rel);
    return dir === '.' ? '' : dir;
  }
  if (sawPackageJson) throw new Error('FLASHLIVE currently supports React + Vite projects only.');
  throw new Error('package.json was not found in the repository.');
}

async function cloneRepository(project: ProjectContext, deployment: ClaimedDeployment, workspace: string, githubToken: string | null, log: (level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string) => void): Promise<string> {
  await mkdir(path.dirname(workspace), { recursive: true });
  await rm(workspace, { recursive: true, force: true });
  const url = `https://github.com/${project.repositoryFullName}.git`;
  const branch = deployment.branch || project.branch || 'main';
  const targetCommit = deployment.commitSha ?? project.commitSha;

  log('INFO', `Cloning ${project.repositoryFullName}@${branch}`);
  await git(['clone', '--depth', '1', '--branch', branch, url, workspace], path.dirname(workspace), githubToken);

  const head = (await git(['-C', workspace, 'rev-parse', 'HEAD'], path.dirname(workspace), null)).stdout.trim();
  if (targetCommit && head !== targetCommit) {
    log('INFO', `Fetching requested commit ${targetCommit}`);
    try {
      await git(['-C', workspace, 'fetch', '--depth', '1', 'origin', targetCommit], path.dirname(workspace), githubToken);
      await git(['-C', workspace, 'checkout', 'FETCH_HEAD'], path.dirname(workspace), null);
    } catch (error) {
      throw new Error(`Could not checkout commit ${targetCommit}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const appRelativeDir = await detectAppRoot(workspace);

  await query('UPDATE deployments SET commit_sha = $2 WHERE id = $1', [deployment.id, head]);
  log('SUCCESS', `Repository ready at ${head.slice(0, 12)}${appRelativeDir ? ` (app root: ${appRelativeDir})` : ''}`);
  return appRelativeDir;
}

function lineHandler(ship: (line: string) => void) {
  let buffer = '';
  return (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) ship(line);
  };
}

async function runContainer(options: {
  cmd: string[];
  workspace: string;
  workdir?: string;
  env: string[];
  shipper: LogShipper;
  mask: (message: string) => string;
  timeoutMs: number;
  label: string;
  isCancelled: () => boolean;
  setActiveContainer: (container: Docker.Container | null) => void;
}): Promise<void> {
  await ensureDockerImage();
  const container = await docker.createContainer({
    Image: env.FLASHLIVE_DOCKER_IMAGE,
    Cmd: options.cmd,
    WorkingDir: options.workdir ?? '/workspace',
    User: 'node',
    Env: options.env,
    HostConfig: {
      Binds: [`${options.workspace}:/workspace`],
      Memory: 1024 * 1024 * 1024,
      NanoCpus: 1_000_000_000,
      PidsLimit: 128,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
      NetworkMode: 'bridge',
      AutoRemove: false,
    },
  });

  options.setActiveContainer(container);
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const recent: string[] = [];
  const remember = (line: string) => {
    recent.push(line);
    if (recent.length > 40) recent.shift();
  };
  stdout.setEncoding('utf8');
  stderr.setEncoding('utf8');
  stdout.on('data', lineHandler((line) => {
    const clean = options.mask(line);
    remember(clean);
    options.shipper.log('INFO', clean);
  }));
  stderr.on('data', lineHandler((line) => {
    const clean = options.mask(line);
    remember(clean);
    options.shipper.log('WARNING', clean);
  }));

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void container.kill().catch(() => undefined);
  }, options.timeoutMs);

  try {
    await container.start();
    const logStream = await container.logs({ follow: true, stdout: true, stderr: true });
    docker.modem.demuxStream(logStream as NodeJS.ReadableStream, stdout, stderr);
    const waitResult = await container.wait();
    const exitCode = waitResult.StatusCode ?? 1;
    if (options.isCancelled()) throw new Error('Build cancelled by user.');
    if (timedOut) throw new Error(`Build timed out after ${Math.round(options.timeoutMs / 1000)} seconds.`);
    if (exitCode !== 0) {
      throw new Error(`${options.label} failed with exit code ${exitCode}. ${recent.slice(-5).join(' | ')}`);
    }
  } finally {
    clearTimeout(timeout);
    options.setActiveContainer(null);
    stdout.destroy();
    stderr.destroy();
    await container.remove({ force: true }).catch(() => undefined);
  }
}

export async function executeDeployment(deployment: ClaimedDeployment, workerId: string, shipper: LogShipper): Promise<BuildResult> {
  const started = Date.now();
  const { project, envVars, githubToken } = await loadContext(deployment);
  const workspace = path.resolve(env.FLASHLIVE_WORKSPACE_DIR, `${deployment.id}-attempt-${deployment.attemptCount}`);
  const secrets = [githubToken, ...Object.values(envVars)];
  const mask = maskSecrets(secrets);
  const log = (level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string) => shipper.log(level, mask(message));

  let cancelled = false;
  let activeContainer: Docker.Container | null = null;
  const heartbeatTimer = setInterval(() => {
    void heartbeat(deployment.id, deployment.leaseToken, workerId)
      .then((result) => {
        if (result.cancelRequested || !result.ok) {
          cancelled = true;
          void activeContainer?.kill().catch(() => undefined);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes('lease')) {
          cancelled = true;
          void activeContainer?.kill().catch(() => undefined);
        }
      });
  }, env.FLASHLIVE_HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  try {
    await ensureDockerImage();
    const appRelativeDir = await cloneRepository(project, deployment, workspace, githubToken, log);
    const appDir = appRelativeDir ? path.join(workspace, ...appRelativeDir.split('/')) : workspace;
    const containerWorkdir = appRelativeDir ? `/workspace/${appRelativeDir}` : '/workspace';
    await chmod(workspace, 0o777);
    if (appDir !== workspace) await chmod(appDir, 0o777);

    const hasLockfile = await stat(path.join(appDir, 'package-lock.json')).then(() => true).catch(() => false);
    const installCommand = project.installCommand === 'npm ci' && !hasLockfile ? 'npm install --no-audit --no-fund' : project.installCommand;
    const installArgs = npmArgs(installCommand, ['npm', 'ci', '--no-audit', '--no-fund']);
    const buildArgs = npmArgs(project.buildCommand, ['npm', 'run', 'build']);
    const installEnv = ['CI=true', 'npm_config_cache=/tmp/npm-cache'];
    const safeEnv = ['CI=true', 'NODE_ENV=production', 'npm_config_cache=/tmp/npm-cache'];
    const buildEnv = [...safeEnv, ...Object.entries(envVars).map(([key, value]) => `${key}=${value}`)];

    log('INFO', `Installing dependencies with ${installCommand}`);
    await runContainer({
      cmd: installArgs,
      workspace,
      workdir: containerWorkdir,
      env: installEnv,
      shipper,
      mask,
      timeoutMs: env.FLASHLIVE_BUILD_TIMEOUT_MS,
      label: 'Dependency installation',
      isCancelled: () => cancelled,
      setActiveContainer: (container) => { activeContainer = container; },
    });

    log('INFO', `Running build command: ${project.buildCommand}`);
    await runContainer({
      cmd: buildArgs,
      workspace,
      workdir: containerWorkdir,
      env: buildEnv,
      shipper,
      mask,
      timeoutMs: env.FLASHLIVE_BUILD_TIMEOUT_MS,
      label: 'Build',
      isCancelled: () => cancelled,
      setActiveContainer: (container) => { activeContainer = container; },
    });

    const prepare = await prepareSuccess(deployment.id, deployment.leaseToken);
    if (!prepare.ok) {
      log('WARNING', 'Deployment was cancelled before artifact publishing.');
      return { outcome: 'cancelled', buildDurationMs: Date.now() - started };
    }

    log('INFO', `Publishing ${project.outputDirectory}`);
    await publishArtifacts(appDir, project.outputDirectory, deployment.id);
    log('SUCCESS', `Deployment ${deployment.id} is ready.`);
    return { outcome: 'deployed', buildDurationMs: Date.now() - started };
  } catch (error) {
    const message = mask(error instanceof Error ? error.message : String(error));
    if (cancelled || message.toLowerCase().includes('cancelled')) {
      log('WARNING', 'Deployment cancelled.');
      return { outcome: 'cancelled', errorMessage: message, buildDurationMs: Date.now() - started };
    }
    log('ERROR', message);
    return { outcome: 'failed', errorMessage: message.slice(0, 3900), buildDurationMs: Date.now() - started };
  } finally {
    clearInterval(heartbeatTimer);
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
    await shipper.close();
  }
}
