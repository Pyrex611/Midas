import { PLAN_TIERS } from './billing/plans';

function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ComparisonSpec {
  slug: 'instantly' | 'smartlead' | 'beehiiv';
  competitorName: string;
  headline: string;
  answerBlock: string;
  rows: Array<{ capability: string; midas: string; competitor: string }>;
}

const COMPARISONS: Record<ComparisonSpec['slug'], ComparisonSpec> = {
  instantly: {
    slug: 'instantly',
    competitorName: 'Instantly.ai',
    headline: 'MIDAS vs Instantly.ai: Unified Outbound & Newsletter Infrastructure',
    answerBlock:
      'MIDAS combines multi-mailbox cold outbound rotation with permission-based Town Crier newsletter channels, Shadow-DOM embed modals, and a native MCP server in one codebase. Unlike Instantly.ai, MIDAS supports bring-your-own Mailgun, Resend, and custom SMTP domains with bounded 5-send sweep pacing and Knowledge Base grounded AI State-Graph replies starting free on Scout.',
    rows: [
      { capability: 'Cold Mailbox Rotation & Warmup Quotas', midas: 'Sender-level warmup + atomic daily slot claims', competitor: 'Multi-inbox rotation' },
      { capability: 'Permission-Based Newsletters & Lead Magnets', midas: 'Built-in Town Crier Gongs + Shadow-DOM embeds', competitor: 'Cold outreach only' },
      { capability: 'Bring-Your-Own ESP (Mailgun / Resend / SMTP)', midas: 'Native AES-256-GCM encrypted EspRouter', competitor: 'SMTP / IMAP mailbox connections' },
      { capability: 'AI Agent Integration (MCP & SDKs)', midas: 'Remote POST /api/mcp + TS/React & Python SDKs', competitor: 'REST API / Webhooks only' },
      { capability: 'Entry Pricing', midas: 'Scout Free Forever (2,000 emails/mo) · Chief $35/mo', competitor: 'Paid plans starting ~$37/mo' },
    ],
  },
  smartlead: {
    slug: 'smartlead',
    competitorName: 'Smartlead.ai',
    headline: 'MIDAS vs Smartlead: Deliverability Guardrails & Developer Ergonomics',
    answerBlock:
      'MIDAS provides Smartlead-grade multi-sender rotation alongside automated 5%-bounce circuit breakers, Apple Mail Privacy Protection open filtering, and Knowledge Base grounded AI objection handling. Beyond cold sales, MIDAS adds Town Crier Gong channels, tracked smart Artifacts, and an authenticated MCP server so developers can automate outbound and audience workflows programmatically.',
    rows: [
      { capability: 'Anti-Burst Sweep Pacing', midas: 'Bounded <=5 sends/tick + 20s sender cooldown + CronLock', competitor: 'Queue scheduling' },
      { capability: 'Bot & Apple MPP Open Filtering', midas: 'Automatic AS714 (17.0.0.0/8) + <4s scanner filtering', competitor: 'Open tracking toggles' },
      { capability: 'Out-of-Office Sequence Freezing', midas: 'AI State-Graph extracts return date (OOO_FROZEN)', competitor: 'OOO reply detection' },
      { capability: 'Embedded Capture Modals & Autoresponders', midas: '1-line widget.js + progressive profiling schemas', competitor: 'Not included' },
      { capability: 'Developer Ecosystem', midas: '@midas-aem/client, midas-aem (PyPI), OpenAPI 3.1, MCP', competitor: 'REST API + Webhooks' },
    ],
  },
  beehiiv: {
    slug: 'beehiiv',
    competitorName: 'Beehiiv',
    headline: 'MIDAS vs Beehiiv: Headless Newsletter Gongs + B2B Outbound Engine',
    answerBlock:
      'While Beehiiv focuses on hosted web publications, MIDAS Town Crier acts as headless, Shadow-DOM embeddable newsletter infrastructure integrated directly into your Next.js, Vite, or Webflow app. Each Gong channel isolates sending onto a dedicated brand mailbox (such as community@domain.com), triggers sub-60s welcome autoresponders, and connects natively to B2B outbound sequences.',
    rows: [
      { capability: 'Website Integration Model', midas: '1-line Shadow-DOM modal/inline embed + progressive profiling', competitor: 'Hosted portal / iframe embeds' },
      { capability: 'Cold B2B Outbound Sequences', midas: 'Full multi-step Spintax + AI reply State-Graph included', competitor: 'Not designed for cold outbound' },
      { capability: 'Welcome Lead-Magnet Autoresponder', midas: 'Sub-60s dispatch with MIME attachments or smart links', competitor: 'Automation workflows (paid tiers)' },
      { capability: 'Email Envelope Control', midas: 'Card, Editorial, Minimal, and Conversational Plain HTML', competitor: 'Visual newsletter builder' },
      { capability: 'Programmatic AI Control', midas: 'Remote MCP server + @midas-aem/client + Python SDK', competitor: 'REST API' },
    ],
  },
};

export class SeoRendererService {
  private wrapPage(options: {
    baseUrl: string;
    path: string;
    title: string;
    description: string;
    schemas: object[];
    bodyHtml: string;
  }): string {
    const canonical = `${options.baseUrl}${options.path}`;
    const ldJsonScripts = options.schemas
      .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
      .join('\n  ');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(options.title)}</title>
  <meta name="description" content="${esc(options.description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <link rel="alternate" type="text/markdown" title="MIDAS LLM Index" href="${esc(options.baseUrl)}/llms.txt" />
  <link rel="alternate" type="text/markdown" title="MIDAS Markdown Docs" href="${esc(options.baseUrl)}/docs.md" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="MIDAS" />
  <meta property="og:title" content="${esc(options.title)}" />
  <meta property="og:description" content="${esc(options.description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(options.title)}" />
  <meta name="twitter:description" content="${esc(options.description)}" />
  ${ldJsonScripts}
  <style>
    :root { --bg: #F3EBF6; --card: #FFFFFF; --royal: #4A2559; --royal-dark: #1F1124; --gold: #D4AF37; --muted: #7A4E7A; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--royal-dark); line-height: 1.65; }
    header { background: #fff; border-bottom: 1px solid rgba(212,175,55,0.4); padding: 16px 24px; }
    .nav-wrap { max-width: 1080px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .brand { font-weight: 900; font-size: 20px; color: var(--royal); text-decoration: none; letter-spacing: 0.06em; }
    nav a { margin-left: 18px; font-size: 13px; font-weight: 700; color: var(--royal); text-decoration: none; }
    nav a.cta { background: var(--royal); color: #fff; padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(212,175,55,0.5); }
    main { max-width: 1080px; margin: 0 auto; padding: 40px 24px; }
    .card { background: var(--card); border: 1px solid rgba(212,175,55,0.4); border-radius: 20px; padding: 28px; margin-bottom: 24px; }
    h1 { font-size: 34px; line-height: 1.15; margin: 0 0 12px; color: var(--royal-dark); }
    h2 { font-size: 21px; margin: 0 0 10px; color: var(--royal); }
    h3 { font-size: 16px; margin: 0 0 6px; }
    .answer { background: #FCFAFD; border-left: 4px solid var(--gold); padding: 14px 18px; border-radius: 0 12px 12px 0; font-size: 15px; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid rgba(212,175,55,0.3); }
    th { background: #F7F1F7; color: var(--royal); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    pre { background: #1F1124; color: #F7F1F7; padding: 16px; border-radius: 12px; overflow-x: auto; font-size: 13px; }
    footer { max-width: 1080px; margin: 0 auto; padding: 24px; border-top: 1px solid rgba(212,175,55,0.35); font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  </style>
</head>
<body>
  <header>
    <div class="nav-wrap">
      <a class="brand" href="${esc(options.baseUrl)}/overview">MIDAS</a>
      <nav>
        <a href="${esc(options.baseUrl)}/overview">Overview</a>
        <a href="${esc(options.baseUrl)}/pricing">Pricing</a>
        <a href="${esc(options.baseUrl)}/deliverability-benchmarks">Deliverability Benchmarks</a>
        <a href="${esc(options.baseUrl)}/docs">Docs</a>
        <a href="${esc(options.baseUrl)}/llms.txt">llms.txt</a>
        <a class="cta" href="${esc(options.baseUrl)}/signup">Start Free</a>
      </nav>
    </div>
  </header>
  <main>${options.bodyHtml}</main>
  <footer>
    <span>&copy; 2026 MIDAS Golden Email Infrastructure, By Pyrexx.</span>
    <span>
      <a href="${esc(options.baseUrl)}/vs/instantly">MIDAS vs Instantly</a> &middot;
      <a href="${esc(options.baseUrl)}/vs/smartlead">MIDAS vs Smartlead</a> &middot;
      <a href="${esc(options.baseUrl)}/vs/beehiiv">MIDAS vs Beehiiv</a> &middot;
      <a href="${esc(options.baseUrl)}/openapi.json">OpenAPI 3.1</a>
    </span>
  </footer>
</body>
</html>`;
  }

  private organizationSchema(baseUrl: string) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'MIDAS (Pyrexx)',
      url: baseUrl,
      sameAs: [
        'https://github.com/Pyrex611/Midas',
        'https://www.npmjs.com/package/@midas-aem/client',
      ],
      knowsAbout: [
        'Email Deliverability',
        'Cold Email Infrastructure',
        'SPF DKIM DMARC BIMI',
        'Newsletter Publishing',
        'Model Context Protocol (MCP)',
      ],
    };
  }

  private softwareSchema(baseUrl: string) {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'MIDAS Autonomous Email & Town Crier Infrastructure',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Node.js, Python',
      url: baseUrl,
      offers: Object.values(PLAN_TIERS).map((tier) => ({
        '@type': 'Offer',
        name: tier.displayName,
        price: String(tier.priceUsdMonthly),
        priceCurrency: 'USD',
      })),
    };
  }

  private breadcrumbSchema(baseUrl: string, items: Array<{ name: string; path: string }>) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: `${baseUrl}${item.path}`,
      })),
    };
  }

  public renderOverviewHtml(baseUrl: string): string {
    return this.wrapPage({
      baseUrl,
      path: '/overview',
      title: 'MIDAS — Deliverability-First Outbound & Newsletter Infrastructure',
      description:
        'MIDAS separates multi-mailbox cold outbound sequences from isolated Town Crier newsletter channels with bounded 5-send sweeps, Knowledge Base AI, and remote MCP.',
      schemas: [this.organizationSchema(baseUrl), this.softwareSchema(baseUrl)],
      bodyHtml: `
        <section class="card">
          <h1>Deliverability-First Outbound &amp; Newsletter Infrastructure</h1>
          <p>MIDAS unifies cold B2B sales sequencing and permission-based Town Crier newsletters under strict sender-level isolation, automated circuit breakers, and developer-native SDKs.</p>
        </section>

        <section class="card">
          <h2>What is MIDAS Autonomous Email Infrastructure?</h2>
          <div class="answer">
            MIDAS is a dual-engine email platform that protects domain reputation by separating cold outbound burner mailboxes from dedicated newsletter senders. Every dispatch executes in bounded sweeps of at most 5 emails per tick with 20-second per-sender cooldowns, recursive Spintax entropy, and automated Knowledge Base grounded reply classification.
          </div>
          <div class="grid">
            <div><h3>Cold Sequence Engine</h3><p>Multi-sender round-robin rotation, atomic daily quota claims, Out-of-Office sequence freezing, and tracked smart Artifacts.</p></div>
            <div><h3>Town Crier &amp; Gongs</h3><p>Slug-addressed publication channels, 1-line Shadow-DOM modals, progressive profiling, and sub-60s welcome autoresponders.</p></div>
            <div><h3>Developer &amp; AI Native</h3><p>Authenticated remote MCP server (POST /api/mcp), @midas-aem/client TypeScript/React SDK, and midas-aem Python SDK.</p></div>
          </div>
        </section>

        <section class="card">
          <h2>How does MIDAS protect sender reputation at scale?</h2>
          <div class="answer">
            MIDAS isolates root DNS credentials (Domain) from per-inbox quotas (Sender), enforces warmup curves, and trips an automated circuit breaker whenever bounce rate reaches 5% or complaint rate reaches 0.3%. Open tracking filters Apple Mail Privacy Protection proxies and sub-4-second gateway scanners so engagement telemetry stays accurate.
          </div>
        </section>
      `,
    });
  }

  public renderPricingHtml(baseUrl: string): string {
    const tiers = Object.values(PLAN_TIERS);
    return this.wrapPage({
      baseUrl,
      path: '/pricing',
      title: 'MIDAS Pricing — Scout Free Forever, Chief $35/mo, Syndicate $99/mo',
      description:
        'Transparent SaaS infrastructure tiers for cold outbound and Town Crier newsletters. Start free on Scout with 2,000 emails/month and Zero-Setup Sandbox.',
      schemas: [
        this.softwareSchema(baseUrl),
        this.breadcrumbSchema(baseUrl, [
          { name: 'Home', path: '/overview' },
          { name: 'Pricing', path: '/pricing' },
        ]),
      ],
      bodyHtml: `
        <section class="card">
          <h1>MIDAS Infrastructure Pricing</h1>
          <div class="answer">
            MIDAS offers three infrastructure tiers: Scout ($0 forever for 2,000 emails/month, 1 domain, 2 mailboxes, and 2 Gongs), Chief ($35/month founding rate for 15,000 emails/month, 10 domains, autonomous AI auto-replies, and custom tracking CNAMEs), and Syndicate ($99/month for 100,000 emails/month across 100 domains).
          </div>
          <table>
            <thead>
              <tr>
                <th>Plan Tier</th>
                <th>Monthly Price</th>
                <th>Monthly Emails</th>
                <th>Leads / Subscribers</th>
                <th>Domains / Senders / Gongs</th>
                <th>AI Credits / mo</th>
              </tr>
            </thead>
            <tbody>
              ${tiers
                .map(
                  (t) => `<tr>
                    <td><strong>${esc(t.displayName)}</strong></td>
                    <td>$${t.priceUsdMonthly}/mo${t.priceUsdAnnual ? ` ($${t.priceUsdAnnual}/yr)` : ''}</td>
                    <td>${t.monthlyEmails.toLocaleString()}</td>
                    <td>${t.maxLeads.toLocaleString()} / ${t.maxSubscribers.toLocaleString()}</td>
                    <td>${t.maxDomains} / ${t.maxSenders} / ${t.maxGongs}</td>
                    <td>${t.monthlyAiCredits.toLocaleString()} (+ BYO key)</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </section>
      `,
    });
  }

  public renderBenchmarksHtml(baseUrl: string): string {
    const publishedDate = '2026-11-19';
    return this.wrapPage({
      baseUrl,
      path: '/deliverability-benchmarks',
      title: 'MIDAS Deliverability Architecture & Pacing Benchmarks (2026)',
      description:
        'Engineering benchmarks covering MIDAS bounded 5-send sweep pacing, 20-second sender cooldowns, Apple MPP proxy filtering, and 5%/0.3% automated circuit breakers.',
      schemas: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'MIDAS Deliverability Architecture & Pacing Benchmarks',
          datePublished: publishedDate,
          dateModified: publishedDate,
          author: { '@type': 'Organization', name: 'MIDAS Engineering' },
        },
        this.breadcrumbSchema(baseUrl, [
          { name: 'Home', path: '/overview' },
          { name: 'Deliverability Benchmarks', path: '/deliverability-benchmarks' },
        ]),
      ],
      bodyHtml: `
        <article class="card">
          <p style="font-size:12px;color:#7A4E7A;font-weight:700;">ENGINEERING REPORT · UPDATED ${publishedDate}</p>
          <h1>Deliverability Architecture &amp; Pacing Benchmarks</h1>
          <div class="answer">
            MIDAS enforces strict transport invariants instead of bulk send loops: each cron sweep claims at most 5 emails via PostgreSQL SKIP LOCKED, enforces a 20-second minimum per-sender cooldown, and halts domains automatically at a 5.0% bounce rate or 0.3% spam complaint threshold.
          </div>
          <h2>Measured Architectural Invariants</h2>
          <table>
            <thead><tr><th>Safeguard</th><th>Enforced Threshold</th><th>Operational Effect</th></tr></thead>
            <tbody>
              <tr><td>Bounded Sweep Size</td><td>5 emails / tick (max 10)</td><td>Eliminates burst spikes across Gmail &amp; Microsoft 365 MX relays</td></tr>
              <tr><td>Per-Sender Cooldown</td><td>20 seconds minimum</td><td>Prevents rapid-fire connection bursts from a single mailbox</td></tr>
              <tr><td>Atomic Daily Quota Claim</td><td>UPDATE ... WHERE sent &lt; limit</td><td>Prevents multi-cron overshoot across QStash &amp; GitHub Actions</td></tr>
              <tr><td>Domain Circuit Breaker</td><td>&ge; 5.0% bounce or &ge; 0.3% complaint</td><td>Transitions domain to paused_health_risk &amp; fires urgent webhook</td></tr>
              <tr><td>Bot &amp; Apple MPP Filter</td><td>17.0.0.0/8 + &lt;4s + proxy UAs</td><td>Excludes automated scanners from humanOpenCount snapshots</td></tr>
            </tbody>
          </table>
        </article>
      `,
    });
  }

  public renderComparisonHtml(baseUrl: string, slug: string): string | null {
    const spec = COMPARISONS[slug as ComparisonSpec['slug']];
    if (!spec) return null;

    return this.wrapPage({
      baseUrl,
      path: `/vs/${spec.slug}`,
      title: `${spec.headline} | MIDAS`,
      description: spec.answerBlock,
      schemas: [
        this.softwareSchema(baseUrl),
        this.breadcrumbSchema(baseUrl, [
          { name: 'Home', path: '/overview' },
          { name: `MIDAS vs ${spec.competitorName}`, path: `/vs/${spec.slug}` },
        ]),
      ],
      bodyHtml: `
        <section class="card">
          <h1>${esc(spec.headline)}</h1>
          <div class="answer">${esc(spec.answerBlock)}</div>
          <table>
            <thead>
              <tr><th>Capability</th><th>MIDAS</th><th>${esc(spec.competitorName)}</th></tr>
            </thead>
            <tbody>
              ${spec.rows
                .map(
                  (r) =>
                    `<tr><td><strong>${esc(r.capability)}</strong></td><td>${esc(r.midas)}</td><td>${esc(r.competitor)}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </section>
      `,
    });
  }

  public renderDocsHtml(baseUrl: string): string {
    return this.wrapPage({
      baseUrl,
      path: '/docs',
      title: 'MIDAS Developer Documentation — SDKs, MCP Server & REST API',
      description:
        'Complete reference for @midas-aem/client, midas-aem Python SDK, Town Crier Shadow-DOM embeds, REST endpoints, and the remote MCP server.',
      schemas: [
        this.softwareSchema(baseUrl),
        this.breadcrumbSchema(baseUrl, [
          { name: 'Home', path: '/overview' },
          { name: 'Developer Docs', path: '/docs' },
        ]),
      ],
      bodyHtml: `
        <section class="card">
          <h1>MIDAS Developer Documentation</h1>
          <div class="answer">
            Integrate MIDAS via the @midas-aem/client TypeScript/React SDK, the midas-aem Python SDK, a 1-line Shadow-DOM widget script, REST API endpoints authenticated with Bearer midas_live_ keys, or the stateless Streamable HTTP MCP server at ${esc(baseUrl)}/api/mcp.
          </div>
          <h2>Quickstart (TypeScript &amp; MCP)</h2>
          <pre>npm install @midas-aem/client
npx @midas-aem/client init

# Or run the MCP stdio bridge for Claude Code / Cursor:
MIDAS_API_KEY=midas_live_... npx @midas-aem/client mcp</pre>
          <p>Machine-readable specs: <a href="${esc(baseUrl)}/docs.md">Markdown Docs (/docs.md)</a> &middot; <a href="${esc(baseUrl)}/llms.txt">llms.txt</a> &middot; <a href="${esc(baseUrl)}/openapi.json">OpenAPI 3.1</a></p>
        </section>
      `,
    });
  }

  public buildRobotsTxt(baseUrl: string): string {
    return [
      'User-agent: *',
      'Allow: /',
      'Allow: /overview',
      'Allow: /pricing',
      'Allow: /deliverability-benchmarks',
      'Allow: /docs',
      'Allow: /vs/',
      'Allow: /llms.txt',
      'Allow: /llms-full.txt',
      'Allow: /docs.md',
      'Allow: /openapi.json',
      'Disallow: /api/admin',
      'Disallow: /api/cron',
      'Disallow: /api/webhooks',
      'Disallow: /api/user',
      'Disallow: /admin',
      'Disallow: /inbox',
      'Disallow: /leads',
      'Disallow: /campaigns',
      'Disallow: /domains',
      'Disallow: /profile',
      '',
      'User-agent: GPTBot',
      'Allow: /',
      'User-agent: OAI-SearchBot',
      'Allow: /',
      'User-agent: ChatGPT-User',
      'Allow: /',
      'User-agent: ClaudeBot',
      'Allow: /',
      'User-agent: Claude-Web',
      'Allow: /',
      'User-agent: anthropic-ai',
      'Allow: /',
      'User-agent: PerplexityBot',
      'Allow: /',
      'User-agent: Google-Extended',
      'Allow: /',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n');
  }

  public buildSitemapXml(baseUrl: string): string {
    const today = new Date().toISOString().split('T')[0];
    const urls = [
      { path: '/', priority: '1.0', freq: 'weekly' },
      { path: '/overview', priority: '0.9', freq: 'weekly' },
      { path: '/pricing', priority: '0.9', freq: 'weekly' },
      { path: '/deliverability-benchmarks', priority: '0.8', freq: 'monthly' },
      { path: '/docs', priority: '0.9', freq: 'weekly' },
      { path: '/vs/instantly', priority: '0.8', freq: 'monthly' },
      { path: '/vs/smartlead', priority: '0.8', freq: 'monthly' },
      { path: '/vs/beehiiv', priority: '0.8', freq: 'monthly' },
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(baseUrl + u.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
  }

  public buildLlmsTxt(baseUrl: string): string {
    return `# MIDAS — Golden Email & Audience Infrastructure

> Dual-engine email infrastructure combining deliverability-protected cold B2B outreach sequences (multi-sender rotation, bounded <=5-send sweeps, Knowledge Base AI State-Graph) with Town Crier permission-based Gong newsletter channels, 1-line Shadow-DOM modals, and a stateless remote MCP server.

## Core Documentation & Machine Specs
- [Full Markdown Documentation](${baseUrl}/docs.md): Complete SDK, Town Crier widget, campaign, webhook, and MCP usage guide.
- [OpenAPI 3.1 Specification](${baseUrl}/openapi.json): Machine-readable REST API schema for Bearer midas_live_ integrations.
- [Full Combined LLM Context](${baseUrl}/llms-full.txt): Single-file complete technical manual for coding agents.

## Public Overview & Benchmarks
- [Platform Overview](${baseUrl}/overview): Architecture summary, cold outbound vs. Town Crier separation, and Q&A.
- [Pricing & Quotas](${baseUrl}/pricing): Scout ($0 Free), Chief ($35/mo), and Syndicate ($99/mo) limits.
- [Deliverability Benchmarks](${baseUrl}/deliverability-benchmarks): Bounded pacing, 20s sender cooldowns, Apple MPP filtering, and circuit breakers.

## Comparisons
- [MIDAS vs Instantly.ai](${baseUrl}/vs/instantly): Unified cold outbound + newsletter infrastructure comparison.
- [MIDAS vs Smartlead](${baseUrl}/vs/smartlead): Circuit breakers, OOO sequence freezing, and developer SDK comparison.
- [MIDAS vs Beehiiv](${baseUrl}/vs/beehiiv): Headless Shadow-DOM embeds and dedicated mailbox isolation comparison.

## Remote MCP Server & SDKs
- Remote MCP Endpoint: \`POST ${baseUrl}/api/mcp\` (Streamable HTTP JSON-RPC 2.0, \`Authorization: Bearer midas_live_...\`)
- Stdio MCP Bridge: \`MIDAS_API_KEY=midas_live_... npx @midas-aem/client mcp\`
- Node/React SDK: \`npm install @midas-aem/client\`
- Python SDK: \`pip install midas-aem\`
`;
  }

  public buildDocsMarkdown(baseUrl: string): string {
    return `# MIDAS Developer Manual (v3.3)

Base URL: \`${baseUrl}\`
Authentication: \`Authorization: Bearer midas_live_YOUR_API_KEY\`

---

## 1. Quickstart SDKs

### Node.js / TypeScript / Next.js
\`\`\`bash
npm install @midas-aem/client
npx @midas-aem/client init
\`\`\`

\`\`\`typescript
import { MidasClient } from '@midas-aem/client';

const midas = new MidasClient(); // Reads MIDAS_API_KEY & MIDAS_BASE_URL

await midas.sendSandboxTest({ subject: 'Hello from MIDAS' });

await midas.subscribe({
  email: 'alex@acme.com',
  name: 'Alex Mercer',
  gongId: 'weekly-alpha',
  cadence: 'weekly',
  metadata: { isDeveloper: true },
});
\`\`\`

### Python (Sync & Async)
\`\`\`bash
pip install midas-aem
\`\`\`

---

## 2. Universal Shadow-DOM Widget
\`\`\`html
<script src="${baseUrl}/api/public/town-crier/widget.js" async></script>
<button
  data-town-crier-modal
  data-key="midas_live_YOUR_KEY"
  data-gong="weekly-alpha"
  data-fields="name,email,cadence"
  data-headline="Join 15,000+ Founders"
  data-accent="#4A2559">
  Subscribe
</button>
\`\`\`

---

## 3. Core REST Endpoints
- \`POST /api/public/town-crier/subscribe\` (\`town_crier:write\`): Subscribe single or bulk contacts to a Gong channel.
- \`GET /api/public/town-crier/gongs\` (\`town_crier:read\`): List publication channels.
- \`POST /api/public/town-crier/gongs\` (\`town_crier:write\`): Create a Gong channel with optional welcome autoresponder.
- \`POST /api/public/town-crier/gongs/:id/broadcast\` (\`town_crier:send\`): Queue a newsletter broadcast into bounded sweeps.
- \`GET /api/campaigns\` & \`POST /api/campaigns\` (\`campaigns:read|write\`): Manage cold outreach sequences.
- \`POST /api/campaigns/:id/dispatch-now\` (\`campaigns:write\`): Trigger a bounded 5-send sweep.
- \`POST /api/sandbox/test-send\` (\`campaigns:write\`): Send a guarded test email to your own account email.
- \`POST /api/artifacts/link\` (\`campaigns:write\`): Register a tracked \`{{artifact:slug}}\` smart link.

---

## 4. Stateless Remote MCP Server
Endpoint: \`POST ${baseUrl}/api/mcp\` (Streamable HTTP JSON-RPC 2.0)

Local stdio bridge for Claude Code / Cursor / Codex:
\`\`\`json
{
  "mcpServers": {
    "midas": {
      "command": "npx",
      "args": ["-y", "@midas-aem/client", "mcp"],
      "env": {
        "MIDAS_API_KEY": "midas_live_YOUR_KEY",
        "MIDAS_BASE_URL": "${baseUrl}"
      }
    }
  }
}
\`\`\`

### Exposed MCP Tools
1. \`midas_create_gong_channel\` (\`town_crier:write\`)
2. \`midas_get_embed_snippet\` (\`town_crier:read\`)
3. \`midas_subscribe_contact\` (\`town_crier:write\`)
4. \`midas_send_sandbox_test\` (\`campaigns:write\`)
5. \`midas_get_campaign_health\` (\`campaigns:read\`)
6. \`midas_create_artifact\` (\`campaigns:write\`)
`;
  }

  public buildLlmsFullTxt(baseUrl: string): string {
    return `${this.buildLlmsTxt(baseUrl)}

---

${this.buildDocsMarkdown(baseUrl)}

---

## Architecture & Deliverability Invariants
- Bounded Queue Drainer: \`SEND_SWEEP_BATCH_SIZE=5\`, \`SENDER_COOLDOWN_SECONDS=20\`, \`CronLock\` DB mutex, \`FOR UPDATE SKIP LOCKED\`.
- Multi-ESP Routing: Mailgun (cold + newsletters), Resend (newsletters only; cold outreach blocked by policy guard), Custom SMTP.
- Automated Circuit Breakers: Domains auto-pause at \`>= 5.0%\` bounce rate or \`>= 0.3%\` complaint rate.
- State-Graph Inbound Agent: Freezes sequences on \`OUT_OF_OFFICE\` (\`OOO_FROZEN\` + \`frozenUntil\`) and generates Knowledge Base grounded objection replies.
`;
  }

  public buildOpenApiSpec(baseUrl: string): object {
    return {
      openapi: '3.1.0',
      info: {
        title: 'MIDAS Autonomous Email & Town Crier API',
        version: '3.3.1',
        description:
          'Deliverability-first outbound sequence orchestration, Town Crier Gong newsletters, Artifacts, Sandbox, and Remote MCP.',
      },
      servers: [{ url: baseUrl }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'Workspace API key (midas_live_...) or session JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      paths: {
        '/api/public/town-crier/subscribe': {
          post: {
            summary: 'Subscribe a contact (or bulk array) to Town Crier / Gong channel',
            responses: { '201': { description: 'Subscribed successfully' } },
          },
        },
        '/api/public/town-crier/gongs': {
          get: { summary: 'List Gong newsletter channels', responses: { '200': { description: 'Array of Gongs' } } },
          post: { summary: 'Create a Gong newsletter channel', responses: { '201': { description: 'Gong created' } } },
        },
        '/api/public/town-crier/gongs/{id}/broadcast': {
          post: { summary: 'Queue a broadcast edition for a Gong channel', responses: { '201': { description: 'Queued' } } },
        },
        '/api/campaigns': {
          get: { summary: 'List campaigns', responses: { '200': { description: 'Campaign list' } } },
          post: { summary: 'Create a cold outreach campaign', responses: { '201': { description: 'Campaign created' } } },
        },
        '/api/campaigns/{id}/health': {
          get: { summary: 'Inspect campaign health alerts and queue state', responses: { '200': { description: 'Health report' } } },
        },
        '/api/campaigns/{id}/dispatch-now': {
          post: { summary: 'Run a bounded send sweep (<= 5 emails)', responses: { '200': { description: 'Sweep summary' } } },
        },
        '/api/sandbox/test-send': {
          post: { summary: 'Send a guarded Zero-Setup Sandbox test email to your account inbox', responses: { '200': { description: 'Sent' } } },
        },
        '/api/artifacts/link': {
          post: { summary: 'Create a tracked {{artifact:slug}} smart link', responses: { '201': { description: 'Created' } } },
        },
        '/api/mcp': {
          post: { summary: 'Stateless Streamable HTTP MCP JSON-RPC 2.0 endpoint', responses: { '200': { description: 'JSON-RPC response' } } },
        },
      },
    };
  }
}

export const seoRendererService = new SeoRendererService();