#!/usr/bin/env node

/**
 * MIDAS Autonomous Outbound & Newsletter CLI
 * Usage:
 *   midas login --key <midas_live_...> [--url <https://...>]
 *   midas stats
 *   midas gongs list
 *   midas gongs create --name "Newsletter Name" [--slug <slug>]
 *   midas broadcast --gong <gongId> --subject "Subject" --body "Content"
 *   midas subscribers list
 *   midas subscribers add --email "lead@domain.com" [--name "Name"]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.midas');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const cfg = readConfig();
  const apiKey = process.env.MIDAS_API_KEY || cfg.apiKey;
  const baseUrl = (process.env.MIDAS_BASE_URL || cfg.baseUrl || 'https://midas-aem.vercel.app').replace(/\/$/, '');

  if (!apiKey) {
    console.error('\x1b[31mError: No API key configured. Run `midas login --key <midas_live_...>` first.\x1b[0m');
    process.exit(1);
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`\x1b[31mAPI Error (${res.status}): ${data.error || 'Request failed'}\x1b[0m`);
    process.exit(1);
  }
  return data;
}

function parseArgs(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

async function main() {
  const [,, cmd, subCmd, ...rest] = process.argv;
  const flags = parseArgs(process.argv.slice(2));

  if (!cmd || cmd === 'help' || flags.help) {
    console.log(`
\x1b[1m\x1b[33mMIDAS Autonomous Email & Newsletter CLI (v2.2.0)\x1b[0m
Commands:
  \x1b[36mmidas login\x1b[0m --key <apiKey> [--url <baseUrl>]
  \x1b[36mmidas stats\x1b[0m                                 Fetch real-time platform telemetry
  \x1b[36mmidas gongs list\x1b[0m                            List all publication channels
  \x1b[36mmidas gongs create\x1b[0m --name <name> [--slug <slug>] Create a new Gong publication
  \x1b[36mmidas broadcast\x1b[0m --gong <id> --subject <str> --body <str>
  \x1b[36mmidas subscribers list\x1b[0m                      List subscribers (paginated)
  \x1b[36mmidas subscribers add\x1b[0m --email <email> [--name <name>]
    `);
    process.exit(0);
  }

  switch (cmd) {
    case 'login': {
      if (!flags.key) {
        console.error('\x1b[31mError: --key is required. Example: midas login --key midas_live_...\x1b[0m');
        process.exit(1);
      }
      saveConfig({
        apiKey: flags.key.trim(),
        baseUrl: flags.url ? flags.url.trim() : 'https://midas-aem.vercel.app',
      });
      console.log('\x1b[32m✓ Successfully authenticated and saved credentials to ~/.midas/config.json\x1b[0m');
      break;
    }

    case 'stats': {
      const data = await apiCall('/api/public/town-crier/stats');
      console.log('\n\x1b[1m\x1b[34m--- MIDAS TELEMETRY DASHBOARD ---\x1b[0m');
      console.log(`Active Subscribers : \x1b[32m${data.totalSubscribers}\x1b[0m`);
      console.log(`Active Gongs       : \x1b[36m${data.activeGongs}\x1b[0m`);
      console.log(`Total Delivered    : \x1b[33m${data.totalSent}\x1b[0m`);
      console.log(`Broadcast Issues   : \x1b[35m${data.broadcastsCount}\x1b[0m`);
      console.log(`Probe Timestamp    : ${data.timestamp}\n`);
      break;
    }

    case 'gongs': {
      if (subCmd === 'list') {
        const data = await apiCall('/api/public/town-crier/gongs');
        console.log(`\n\x1b[1mFound ${data.gongs?.length || 0} Gong Channel(s):\x1b[0m`);
        (data.gongs || []).forEach(g => {
          console.log(`• \x1b[36m${g.name}\x1b[0m [id: ${g.id}] (slug: ${g.slug})`);
          console.log(`  Subscribers: ${g._count?.recipients || 0} | Issues: ${g._count?.broadcasts || 0} | Welcome Autoresponder: ${g.welcomeEmailEnabled ? 'ON' : 'OFF'}`);
        });
        console.log('');
      } else if (subCmd === 'create') {
        if (!flags.name) {
          console.error('\x1b[31mError: --name is required for Gong creation.\x1b[0m');
          process.exit(1);
        }
        const data = await apiCall('/api/public/town-crier/gongs', 'POST', {
          name: flags.name,
          slug: flags.slug,
          welcomeEmailEnabled: Boolean(flags.welcome),
          welcomeSubject: flags['welcome-subject'],
          welcomeBody: flags['welcome-body'],
        });
        console.log(`\x1b[32m✓ Gong created successfully: ${data.gong.name} [id: ${data.gong.id}]\x1b[0m`);
      }
      break;
    }

    case 'broadcast': {
      if (!flags.gong || !flags.subject || !flags.body) {
        console.error('\x1b[31mError: --gong, --subject, and --body are all required to publish a broadcast.\x1b[0m');
        process.exit(1);
      }
      const data = await apiCall(`/api/public/town-crier/gongs/${flags.gong}/broadcast`, 'POST', {
        subject: flags.subject,
        body: flags.body,
      });
      console.log(`\x1b[32m✓ ${data.message}\x1b[0m`);
      break;
    }

    case 'subscribers': {
      if (subCmd === 'list') {
        const data = await apiCall('/api/public/town-crier/recipients?pageSize=20');
        console.log(`\n\x1b[1mShowing ${(data.data || []).length} of ${data.pagination?.total || 0} Subscribers:\x1b[0m`);
        (data.data || []).forEach(s => {
          console.log(`• \x1b[36m${s.email}\x1b[0m (${s.name || 'Anonymous'}) [${s.status}]`);
        });
        console.log('');
      } else if (subCmd === 'add') {
        if (!flags.email) {
          console.error('\x1b[31mError: --email is required.\x1b[0m');
          process.exit(1);
        }
        const data = await apiCall('/api/public/town-crier/subscribe', 'POST', {
          email: flags.email,
          name: flags.name,
          gongId: flags.gong,
        });
        console.log(`\x1b[32m✓ Subscribed ${data.subscriber.email} successfully.\x1b[0m`);
      }
      break;
    }

    default:
      console.log(`Unknown command: ${cmd}. Run \`midas help\` for instructions.`);
  }
}

main().catch(err => {
  console.error('\x1b[31mFatal CLI error:\x1b[0m', err.message);
  process.exit(1);
});