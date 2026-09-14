# Midas: AI-Powered Cold Email Outreach & Follow-up System

> A semi-automated cold email outreach and follow-up agent with intelligent leads management, powered by multiple AI providers and deployed on Vercel.

**Branch:** `vercel` | **Status:** Production-ready MVP with Phase 3.5+ features

---

## 🎯 Overview

Midas is a full-stack TypeScript/Python application that automates the entire cold email outreach workflow:

1. **Lead Management** – Upload and manage CSV/XLSX files with prospect data
2. **Campaign Orchestration** – Create campaigns with customizable follow-up sequences
3. **Intelligent Email Drafting** – AI-powered email generation based on tone, use case, and campaign context
4. **Automated Sending** – Scheduled delivery via Mailgun with domain deliverability management
5. **Reply Intelligence** – Automatic sentiment analysis and reply-to-reply generation
6. **Inbox Management** – Centralized inbox for monitoring opens, clicks, bounces, and replies
7. **Domain Warmup** – Built-in sender reputation management with daily send limits and bounce tracking

**Key Stats:**
- **84.5% TypeScript** | 12.9% Python | 3.6% Other
- **Tech Stack:** Vite + React, Express.js, Prisma, PostgreSQL (Neon), Clerk Auth, Mailgun, Multiple AI Providers
- **Deployment:** Vercel (serverless) with scheduled cron jobs

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** database (Neon recommended for serverless)
- **Environment variables** (see Configuration section)

### Installation

```bash
# Clone the repository
git clone https://github.com/Pyrex611/Midas.git
cd Midas
git checkout vercel

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Setup database
npx prisma db push

# Start development server
npm run dev
```

**Frontend:** Accessible at `http://localhost:5173`  
**Backend API:** Accessible at `http://localhost:3000/api`

### Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start

# Vercel deployment
npm run vercel-build
```

---

## 📋 Configuration

Create a `.env.local` file in the project root with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname
DATABASE_URL_POOLED=postgresql://user:password@host/dbname?sslmode=require

# Frontend
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Backend Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# CORS & Deployment
CORS_ORIGIN=http://localhost:5173,https://midas-aem.vercel.app
NODE_ENV=development
PORT=3000

# Email Service (Mailgun)
EMAIL_SERVICE=mailgun
EMAIL_FROM=hello@yourdomain.com
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_WEBHOOK_KEY=your_mailgun_webhook_key

# File Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
MAX_FILE_SIZE_MB=10

# Cron Job Security
CRON_SECRET=your_32_char_minimum_secret

# AI Provider (choose one or multiple)
AI_PROVIDER=openrouter
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash-lite
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_MODEL=deepseek-chat
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=deepseek/deepseek-r1:free

# Optional: Local LLM (Ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_FAST_MODEL=llama3.2:1b
OLLAMA_POWERFUL_MODEL=llama3.1:8b

# Optional: Email Verification
BOUNCEBAN_API_KEY=your_bounceban_key

# Encryption (generate a 64-char hex key or use default for dev)
ENCRYPTION_KEY=your_64_char_hex_encryption_key
```

---

## 🏗️ Architecture

### Project Structure

```
Midas/
├── src/                          # React Frontend (84.5% TypeScript)
│   ├── main.tsx                 # Entry point with Clerk provider
│   ├── App.tsx                  # Router & route definitions
│   ├── pages/                   # Route components (Home, Leads, Campaigns, etc.)
│   ├── components/              # Reusable UI components
│   ├── context/                 # React context (AuthContext)
│   └── index.css                # Tailwind CSS styles
│
├── server/                       # Express.js Backend
│   ├── app.ts                   # Express app setup with CORS & routes
│   ├── index.ts                 # Server entry point (port 3000)
│   ├── config/                  # Configuration modules
│   │   ├── env.ts              # Environment validation (Zod)
│   │   └── logger.ts           # Winston logging
│   ├── middleware/              # Auth & request handlers
│   │   └── auth.middleware.ts  # Clerk JWT verification + user sync
│   └── routes/                  # API route handlers
│       ├── lead.routes.ts      # Lead CRUD & upload
│       ├── campaign.routes.ts  # Campaign management
│       ├── domain.routes.ts    # Domain verification & warmup
│       ├── inbox.routes.ts     # Email tracking & replies
│       ├── ai.routes.ts        # Draft generation & sentiment analysis
│       ├── webhooks.routes.ts  # Mailgun & Clerk webhooks
│       ├── cron.routes.ts      # Scheduled email sending
│       ├── user.routes.ts      # User profile
│       └── diagnostic.routes.ts # Health checks
│
├── api/                         # Vercel Serverless Functions
│   └── index.ts                # Serverless HTTP wrapper (serverless-http)
│
├── prisma/                      # Database Schema
│   └── schema.prisma           # 14+ models (User, Campaign, Lead, etc.)
│
├── vite.config.ts              # Vite build configuration
├── tsconfig.json               # TypeScript config (frontend)
├── tsconfig.server.json        # TypeScript config (backend)
├── vercel.json                 # Vercel deployment & cron config
├── package.json                # Dependencies & build scripts
└── .dockerfile                 # Docker image for Cloud Run deployment
```

### Database Schema (Prisma)

**Core Models:**
- **User** – Clerk-integrated user accounts with UUID primary key
- **Campaign** – Email campaigns with follow-up steps, timezones, and status tracking
- **Lead** – Prospects with email verification status and outreach tracking
- **Domain** – Sender domains with DKIM/SPF/MX/tracking verification, warmup day, daily limits
- **Draft** – Email templates (subject + body) with version control and reusability
- **OutboundEmail** – Sent emails with delivery tracking (open, click, reply, bounce)
- **PendingEmail** – Scheduled emails awaiting dispatch
- **FollowUpStep** – Configured delays between campaign steps
- **CampaignMember** – Multi-user collaboration (OWNER/EDITOR/VIEWER roles)
- **CampaignInvite** – Email invitations with expiration tokens
- **Blocklist** – Regex patterns to filter leads
- **UploadJob** – Async lead upload progress tracking
- **UserSettings** – User preferences and configuration

[View full schema](https://github.com/Pyrex611/Midas/blob/vercel/prisma/schema.prisma)

---

## 🔐 Authentication & Security

### Clerk Integration
- **Frontend:** React SDK with `@clerk/clerk-react`
- **Backend:** Node SDK with JWT verification via `@clerk/clerk-sdk-node`
- **Middleware:** `requireAuth` middleware validates RS256 signatures and auto-syncs users to PostgreSQL
- **User Cache:** In-memory cache maps Clerk IDs to local UUIDs for 0ms resolution

### CORS Policy
Allowed origins include:
- Configured `CORS_ORIGIN` list
- All `*.vercel.app` deployments
- `localhost:*` and `127.0.0.1:*` (development)
- All origins in development mode

### Protected Routes
- `/api/leads`, `/api/campaigns`, `/api/domains`, `/api/inbox`, `/api/ai`, `/api/user`, `/api/diagnostics` – Protected by Clerk auth
- `/api/webhooks` – Public (Mailgun & Clerk webhooks)
- `/api/cron` – Protected by `CRON_SECRET` bearer token
- `/api/health` – Public health check

---

## 📧 Email Infrastructure

### Mailgun Integration
- **API Key:** Validated during domain setup
- **Webhook Key:** Verifies webhook signatures
- **Events Tracked:** Delivered, opened, clicked, bounced, complained
- **Sender Format:** `{senderLocalPart}@{domainName}` (default: `hello@domain.com`)

### Domain Verification
- **DKIM, SPF, MX Verification** – Status flags for each domain
- **Tracking Enabled** – Optional tracking domain for open/click events
- **Warmup Protocol:**
  - Day 1 warmup start
  - Configurable daily send limit (default: 20)
  - Bounce/complaint rate tracking
  - Automatic rate limiting based on reputation

### Email Delivery Flow
1. **Draft Generation** – AI creates email from campaign context
2. **Pending Queue** – Email scheduled with optional domain preference
3. **Cron Dispatch** – 09:00 UTC daily (`/api/cron/queue`)
4. **Mailgun Send** – Domain selected via round-robin or preference
5. **Webhook Events** – Real-time delivery status updates
6. **Reply Capture** – Incoming replies parsed and stored
7. **Sentiment Analysis** – AI analyzes reply tone
8. **Auto-Reply Draft** – AI generates contextual response (user approval required)

---

## 🤖 AI & Automation

### Supported Providers
- **OpenAI** – `gpt-4-turbo-preview` (default for powerful tasks)
- **Google Gemini** – `gemini-2.5-flash-lite`
- **DeepSeek** – `deepseek-chat`
- **OpenRouter** – `deepseek/deepseek-r1:free` (free tier default)
- **Ollama** – Local models for privacy (`llama3.2:1b`, `llama3.1:8b`)
- **Mock** – Development mode (returns static responses)

### AI Capabilities
- **Email Draft Generation** – Contextual cold emails from tone, use case, and campaign objective
- **Sentiment Analysis** – Reply classification (positive, negative, neutral, interested, not-interested)
- **Intent Recognition** – Detect action items in replies
- **Auto-Reply Drafting** – Generate follow-ups based on sentiment and thread context
- **Request Delay** – Configurable delay between AI requests (default: 500ms) to respect rate limits

### Configuration
```env
AI_PROVIDER=openrouter                          # Primary provider
PRIMARY_FALLBACK_PROVIDER=gemini               # Fallback if primary fails
OPENROUTER_API_KEY=sk-...
OPENROUTER_MODEL=deepseek/deepseek-r1:free
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
AI_REQUEST_DELAY_MS=500                        # Delay between API calls
```

---

## 🔄 Automation & Cron Jobs

### Scheduled Tasks (Vercel Cron)

**Queue Processing:** `0 9 * * *` (09:00 UTC daily)
- Dispatches pending emails respecting domain daily limits
- Checks warmup status and adjusts send rates
- Handles retries for failed sends

**Lead Processing:** `0 10 * * *` (10:00 UTC daily)
- Processes incoming replies
- Runs sentiment analysis
- Generates auto-reply drafts

### Configuration
```json
{
  "crons": [
    { "path": "/api/cron/queue", "schedule": "0 9 * * *" },
    { "path": "/api/cron/leads", "schedule": "0 10 * * *" }
  ]
}
```

Secure cron requests with `CRON_SECRET` header:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://midas-aem.vercel.app/api/cron/queue
```

---

## 🎨 Frontend Features

### Pages
- **Home** – Dashboard overview
- **Leads** – Lead list with CSV/XLSX upload, status filters, verification tracking
- **Campaigns** – Campaign creation, editing, follow-up step configuration
- **Campaign Detail** – Per-campaign email tracking and member collaboration
- **Domains** – Domain verification, DNS record display, warmup status
- **Inbox** – Unified inbox for sent emails, replies, opens, clicks
- **Profile** – User settings and account management

### UI/UX
- **Responsive Design** – Tailwind CSS v4 for modern styling
- **Dropzone** – `react-dropzone` for file uploads
- **CSV Parsing** – `papaparse` for lead import
- **Routing** – React Router v6 for SPA navigation
- **Error Boundaries** – Graceful error handling

---

## 📦 Build & Deployment

### Development Build
```bash
npm run dev
```
- Vite dev server on port 5173 (frontend)
- Express server on port 3000 (backend)
- Hot module replacement enabled

### Production Build
```bash
npm run build
```
Executes:
1. `prisma generate` – Generate Prisma client
2. `tsc -p tsconfig.server.json` – Compile backend to `dist/server`
3. `vite build` – Bundle frontend to `dist/client`

### Vercel Deployment
```bash
npm run vercel-build
```
Executes:
1. `prisma generate`
2. `prisma db push --accept-data-loss` – Auto-migrate schema
3. `tsc -p tsconfig.server.json`
4. `vite build`

**Deployment Config** (`vercel.json`):
- Rewrites `/api/*` requests to `/api/index.ts` (serverless function)
- Rewrites all other requests to `/index.html` (SPA routing)
- Cron jobs configured for background tasks

### Docker Deployment
A multi-stage `.dockerfile` is included for Cloud Run:
```dockerfile
FROM node:18-slim AS build
# Build backend and frontend

FROM node:18-slim
# Copy dist and node_modules, expose port 8080
```

---

## 🔧 Dependencies

### Frontend
- `react` – UI framework
- `react-router-dom` – Client-side routing
- `@clerk/clerk-react` – Authentication UI
- `tailwindcss` – Styling
- `axios` – HTTP client
- `papaparse` – CSV parsing
- `react-dropzone` – File upload

### Backend
- `express` – Web framework
- `prisma` & `@prisma/client` – ORM & database client
- `@neondatabase/serverless` – Neon PostgreSQL driver
- `@clerk/clerk-sdk-node` – Server-side auth
- `mailgun.js` – Email API
- `svix` – Webhook verification
- `bcryptjs` – Password hashing
- `jsonwebtoken` – JWT handling
- `winston` – Logging
- `zod` – Schema validation
- `serverless-http` – HTTP wrapper for serverless

### Build Tools
- `vite` – Build bundler
- `typescript` – Type safety
- `@vitejs/plugin-react` – React plugin

---

## 🧪 Testing & Monitoring

### Health Check
```bash
curl https://midas-aem.vercel.app/api/health
# Returns: { "status": "ok", "timestamp": "2026-..." }
```

### Logging
- **Winston Logger** – Structured JSON logs
- **Environment-aware** – `debug` level in development, `info` in production
- **Console Transport** – Logs to stdout (Vercel compatible)

### Error Handling
- Clerk auth failures return `401 Unauthorized`
- Database errors return `500 Internal Server Error` with logging
- Input validation via Zod schemas
- Error boundary component on frontend

---

## 📝 Development Workflow

### Local Development
```bash
# Terminal 1: Backend (Express + Prisma)
npm run dev

# Terminal 2: Database (if running locally)
docker run -e POSTGRES_PASSWORD=password postgres:15

# Terminal 3: Sync database schema
npx prisma studio  # Open Prisma GUI at http://localhost:5555
```

### Database Migrations
```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Push schema changes (Vercel build)
npx prisma db push

# View database GUI
npx prisma studio
```

### Git Workflow
- **Branch:** `vercel` is the production branch
- **Main branch:** Contains alternate implementations
- **Commits:** Descriptive messages with feature/phase numbers (Phase 3.5, etc.)

---

## 🐛 Known Limitations & Future Work

- **Google Cloud ADK** – Limited support due to API key acquisition challenges
- **Reply Threading** – Basic reply-to tracking; full thread reconstruction in progress
- **Real-time Updates** – Webhook events processed via cron; WebSocket support pending
- **Advanced Analytics** – Campaign performance metrics available via email tracking data

---

## 📄 License

This project includes a LICENSE file. See [LICENSE](https://github.com/Pyrex611/Midas/blob/vercel/LICENSE) for details.

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with clear messages
4. Push to your fork
5. Open a pull request

---

## 📞 Support & Contact

For issues, questions, or feature requests:
- Open a GitHub issue: [Midas Issues](https://github.com/Pyrex611/Midas/issues)
- Contact the author: [Pyrex611](https://github.com/Pyrex611)

---

**Last Updated:** February 2026 | **Phase:** 3.5+ (Reply Analysis & Automation)
