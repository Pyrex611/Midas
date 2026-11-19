#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';

const GOLD = '\x1b[33m';
const PURPLE = '\x1b[35m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function detectFramework(cwd: string): Promise<'nextjs-app' | 'nextjs-pages' | 'vite-react' | 'node'> {
  const pkgPath = path.join(cwd, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const raw = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (allDeps.next) {
        if (
          (await fileExists(path.join(cwd, 'src/app'))) ||
          (await fileExists(path.join(cwd, 'app')))
        ) {
          return 'nextjs-app';
        }
        return 'nextjs-pages';
      }
      if (allDeps.react && allDeps.vite) {
        return 'vite-react';
      }
    } catch {}
  }
  return 'node';
}

async function appendEnvKeys(cwd: string, apiKey: string, baseUrl: string) {
  const envFile = (await fileExists(path.join(cwd, '.env.local')))
    ? path.join(cwd, '.env.local')
    : path.join(cwd, '.env');

  let content = '';
  if (await fileExists(envFile)) {
    content = await fs.readFile(envFile, 'utf8');
  }

  const linesToAppend: string[] = [];
  if (!content.includes('MIDAS_API_KEY=')) {
    linesToAppend.push(`MIDAS_API_KEY=${apiKey}`);
  }
  if (!content.includes('MIDAS_BASE_URL=')) {
    linesToAppend.push(`MIDAS_BASE_URL=${baseUrl}`);
  }

  if (linesToAppend.length > 0) {
    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    await fs.writeFile(envFile, `${content}${prefix}${linesToAppend.join('\n')}\n`, 'utf8');
    console.log(`${GREEN}✓ Updated ${path.basename(envFile)} with MIDAS_API_KEY & MIDAS_BASE_URL${RESET}`);
  } else {
    console.log(`${DIM}• ${path.basename(envFile)} already contains MIDAS variables (left untouched)${RESET}`);
  }
}

async function runMcpStdioBridge() {
  const args = process.argv.slice(3);
  let flagKey: string | undefined;
  let flagUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--key' && args[i + 1]) {
      flagKey = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      flagUrl = args[i + 1];
      i++;
    }
  }

  const apiKey = (flagKey || process.env.MIDAS_API_KEY || process.env.TOWN_CRIER_API_KEY || '').trim();
  const baseUrl = (flagUrl || process.env.MIDAS_BASE_URL || 'https://midas-aem.vercel.app').replace(/\/$/, '');

  if (!apiKey) {
    process.stderr.write('MIDAS MCP bridge error: Set MIDAS_API_KEY or pass --key midas_live_...\n');
    process.exit(1);
  }

  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  rl.on('line', async (rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    let parsedId: any = null;
    try {
      const msg = JSON.parse(line);
      parsedId = msg.id ?? null;

      const res = await fetch(`${baseUrl}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: line,
      });

      if (res.status === 202) return;

      const text = await res.text();
      if (!res.ok) {
        output.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: parsedId,
            error: { code: -32000, message: text || `HTTP ${res.status}` },
          })}\n`
        );
        return;
      }

      if (text.trim()) {
        output.write(`${text.trim()}\n`);
      }
    } catch (err: any) {
      if (parsedId !== null) {
        output.write(
          `${JSON.stringify({
            jsonrpc: '2.0',
            id: parsedId,
            error: { code: -32603, message: err?.message || 'MCP bridge request failed' },
          })}\n`
        );
      }
    }
  });
}

async function scaffoldInit() {
  const cwd = process.cwd();
  const rl = readline.createInterface({ input, output });

  console.log(`\n${PURPLE}${BOLD}MIDAS${RESET} ${GOLD}Golden Email Infrastructure — Project Scaffolder${RESET}\n`);

  try {
    const detected = await detectFramework(cwd);
    console.log(`${DIM}Detected environment:${RESET} ${BOLD}${detected}${RESET}\n`);

    const apiKeyInput = await ask(rl, `${BOLD}1. Enter your Midas API Key${RESET} ${DIM}(leave blank for placeholder)${RESET}: `);
    const gongSlugInput = await ask(rl, `${BOLD}2. Target Gong Slug${RESET} ${DIM}(default: weekly-alpha)${RESET}: `);
    const baseUrlInput = await ask(rl, `${BOLD}3. Midas Host URL${RESET} ${DIM}(default: https://midas-aem.vercel.app)${RESET}: `);

    const apiKey = apiKeyInput.trim() || 'midas_live_replace_me';
    const gongSlug = gongSlugInput.trim() || 'weekly-alpha';
    const baseUrl = (baseUrlInput.trim() || 'https://midas-aem.vercel.app').replace(/\/$/, '');

    await appendEnvKeys(cwd, apiKey, baseUrl);

    if (detected === 'nextjs-app') {
      const appBase = (await fileExists(path.join(cwd, 'src/app'))) ? 'src/app' : 'app';
      const routeDir = path.join(cwd, appBase, 'api', 'midas', 'subscribe');
      await fs.mkdir(routeDir, { recursive: true });
      const routePath = path.join(routeDir, 'route.ts');

      if (!(await fileExists(routePath))) {
        await fs.writeFile(
          routePath,
          `import { NextResponse } from 'next/server';
import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient({
  apiKey: process.env.MIDAS_API_KEY!,
  baseUrl: process.env.MIDAS_BASE_URL,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await midas.subscribe({
      email: body.email,
      name: body.name,
      gongId: body.gongId || '${gongSlug}',
      cadence: body.cadence || 'weekly',
      metadata: body.metadata,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Subscription failed' }, { status: 400 });
  }
}
`,
          'utf8'
        );
        console.log(`${GREEN}✓ Created Next.js App Router endpoint: ${appBase}/api/midas/subscribe/route.ts${RESET}`);
      }

      const compDir = (await fileExists(path.join(cwd, 'src')))
        ? path.join(cwd, 'src', 'components')
        : path.join(cwd, 'components');
      await fs.mkdir(compDir, { recursive: true });
      const compPath = path.join(compDir, 'MidasNewsletterButton.tsx');

      if (!(await fileExists(compPath))) {
        await fs.writeFile(
          compPath,
          `'use client';
import React from 'react';
import { MidasModal } from '@midas-aem/client/react';

export function MidasNewsletterButton() {
  return (
    <MidasModal
      apiKey={process.env.NEXT_PUBLIC_MIDAS_KEY}
      baseUrl="${baseUrl}"
      gongId="${gongSlug}"
      headline="Join Our Weekly Dispatch"
      accent="#4A2559"
      developerToggle
      className="px-4 py-2 rounded-xl bg-[#4A2559] text-white font-bold hover:opacity-90 transition"
    >
      Subscribe to Newsletter
    </MidasModal>
  );
}
`,
          'utf8'
        );
        console.log(`${GREEN}✓ Created React component: ${path.relative(cwd, compPath)}${RESET}`);
      }
    } else if (detected === 'vite-react') {
      const compDir = path.join(cwd, 'src', 'components');
      await fs.mkdir(compDir, { recursive: true });
      const compPath = path.join(compDir, 'MidasNewsletterButton.tsx');
      if (!(await fileExists(compPath))) {
        await fs.writeFile(
          compPath,
          `import React from 'react';
import { MidasModal } from '@midas-aem/client/react';

export function MidasNewsletterButton() {
  return (
    <MidasModal
      apiKey={import.meta.env.VITE_MIDAS_API_KEY}
      baseUrl="${baseUrl}"
      gongId="${gongSlug}"
      headline="Join Our Newsletter"
      accent="#4A2559"
      developerToggle
      className="px-4 py-2 rounded-xl bg-[#4A2559] text-white font-bold"
    >
      Subscribe
    </MidasModal>
  );
}
`,
          'utf8'
        );
        console.log(`${GREEN}✓ Created Vite React component: src/components/MidasNewsletterButton.tsx${RESET}`);
      }
    } else {
      const demoPath = path.join(cwd, 'midas-quickstart.mjs');
      if (!(await fileExists(demoPath))) {
        await fs.writeFile(
          demoPath,
          `import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient({
  apiKey: process.env.MIDAS_API_KEY || '${apiKey}',
  baseUrl: process.env.MIDAS_BASE_URL || '${baseUrl}',
});

const stats = await midas.getStats();
console.log('Connected to MIDAS:', stats);
`,
          'utf8'
        );
        console.log(`${GREEN}✓ Created Node quickstart script: midas-quickstart.mjs${RESET}`);
      }
    }

    console.log(`\n${GOLD}${BOLD}Next steps:${RESET}`);
    console.log(`  1. Replace any placeholder API key in your .env file with a key from ${baseUrl}/profile?tab=apiKeys`);
    console.log(`  2. Read full docs at ${baseUrl}/docs\n`);
  } finally {
    rl.close();
  }
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'init') {
    await scaffoldInit();
    return;
  }
  if (cmd === 'mcp') {
    await runMcpStdioBridge();
    return;
  }

  console.log(`
${PURPLE}${BOLD}@midas-aem/client CLI${RESET}

Usage:
  npx @midas-aem/client init     Scaffold Midas SDK, env variables & modal component
  npx @midas-aem/client mcp      Start stdio-to-HTTP MCP bridge for Claude Code / Cursor
`);
}

main().catch((err) => {
  console.error('\x1b[31mError:\x1b[0m', err?.message || err);
  process.exit(1);
});