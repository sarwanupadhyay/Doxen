# Doxen — AI-Powered BRD Generator

> Transform scattered business communications (emails, Slack messages, meeting transcripts, documents) into structured, professional **Business Requirements Documents** using AI.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Local Development Setup](#local-development-setup)
   - [Prerequisites](#prerequisites)
   - [Clone & Install](#clone--install)
4. [Backend Setup (Lovable Cloud)](#backend-setup-lovable-cloud)
5. [Self-Hosted Supabase Setup](#self-hosted-supabase-setup)
   - [Create a Supabase Project](#1-create-a-supabase-project)
   - [Run Database Migrations](#2-run-database-migrations)
   - [Configure Environment Variables](#3-configure-environment-variables)
   - [Set Up Storage Buckets](#4-set-up-storage-buckets)
6. [LLM / AI Setup](#llm--ai-setup)
   - [Option A — Lovable AI Gateway (Recommended)](#option-a--use-lovable-ai-gateway-recommended)
   - [Option B — BYO OpenAI / Google AI Key](#option-b--use-your-own-openai--google-ai-key)
7. [Slack Integration](#slack-integration)
8. [Edge Functions Setup](#edge-functions-setup)
   - [Install Supabase CLI](#install-supabase-cli)
   - [Link Your Project](#link-your-project)
   - [Set Edge Function Secrets](#set-edge-function-secrets)
   - [Deploy Edge Functions](#deploy-edge-functions)
9. [Run Locally](#run-locally)
10. [Project Structure](#project-structure)
11. [Database Schema](#database-schema)
12. [RLS Policies](#rls-policies)
13. [Full Production Deployment](#full-production-deployment)
14. [Authentication Setup](#authentication-setup)
15. [Performance Notes](#performance-notes)
16. [Troubleshooting](#troubleshooting)

---

## Project Overview

Doxen is a full-stack web application that:

- Accepts business communications (documents, transcripts, pasted text, Slack channels) as data sources
- Runs AI-powered requirement extraction via serverless edge functions
- Generates a structured, multi-section **Business Requirements Document (BRD)**
- Supports **Slack channel import** — connect your Slack workspace and pull messages directly
- Allows natural language refinement of the BRD (e.g. "Add a security section")
- Exports the final document as a **PDF** or **Markdown**
- Provides a full **traceability table** linking every requirement back to its source

The app is fully authenticated — users can only see and manage their own projects and data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui, Radix UI |
| Routing | React Router v6 |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Backend / Database | Lovable Cloud (Supabase — Auth, Postgres, Storage, Edge Functions) |
| AI / LLM | Lovable AI Gateway (Gemini 3 Flash) or BYO key |
| PDF Export | jsPDF |
| Markdown | react-markdown |
| Slack Integration | Slack Web API (OAuth bot token) |
| Background Effects | CSS radial gradients (hardware-accelerated, zero WebGL cost) |

> **Note:** The WebGL `ogl` Aurora background was replaced with lightweight CSS radial gradient blobs to achieve consistent 60fps on mobile and reduce GPU overhead.

---

## Local Development Setup

### Prerequisites

Make sure you have the following installed:

```bash
# Node.js (v18 or higher recommended)
node --version

# bun (faster, recommended) OR npm
bun --version

# Supabase CLI (for edge functions and migrations)
supabase --version

# Deno (required for running Supabase Edge Functions locally)
deno --version
```

**Install guides:**
- **Node.js**: https://nodejs.org/ or use [nvm](https://github.com/nvm-sh/nvm)
- **Bun**: https://bun.sh/
- **Supabase CLI**: https://supabase.com/docs/guides/cli
- **Deno**: https://deno.land/

---

### Clone & Install

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd doxen

# 2. Install all dependencies
bun install
# OR
npm install
```

---

## Backend Setup (Lovable Cloud)

If you opened this project through **Lovable**, the backend is already provisioned for you via **Lovable Cloud**. No Supabase account or setup is required.

The `.env` file is auto-generated with:
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

All database tables, RLS policies, and edge functions are deployed automatically.

> ⚠️ Once Lovable Cloud is enabled on a project, it cannot be disconnected. You can disable it for future projects via **Settings → Connectors → Lovable Cloud → Disable Cloud**.

---

## Self-Hosted Supabase Setup

If you are running this **outside of Lovable Cloud**, you need your own Supabase project.

### 1. Create a Supabase Project

1. Go to https://supabase.com and sign up / log in
2. Click **"New project"**
3. Choose a name, database password, and region
4. Wait for provisioning (~1-2 minutes)
5. Copy your:
   - **Project URL** (e.g. `https://xyzxyz.supabase.co`)
   - **Anon / Public Key** (safe for frontend)
   - **Service Role Key** (for edge functions only — keep secret)

---

### 2. Run Database Migrations

Open the **Supabase SQL Editor** and run the following SQL:

```sql
-- ── Profiles ──────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── Projects ──────────────────────────────────────────────────────────
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ── Data Sources ──────────────────────────────────────────────────────
CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

-- ── Extracted Requirements ────────────────────────────────────────────
CREATE TABLE public.extracted_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_excerpt TEXT,
  confidence_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.extracted_requirements ENABLE ROW LEVEL SECURITY;

-- ── Generated BRDs ────────────────────────────────────────────────────
CREATE TABLE public.generated_brds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_brds ENABLE ROW LEVEL SECURITY;

-- ── Auto-update trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brds_updated_at
  BEFORE UPDATE ON public.generated_brds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# .env (never commit this file)
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_public_key_here
VITE_SUPABASE_PROJECT_ID=your_project_id_here
```

> ⚠️ The anon key is safe for frontend use. **Never** expose the `service_role` key in frontend code.

---

### 4. Set Up Storage Buckets

In the Supabase Dashboard → **Storage**, create a `documents` bucket (private):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

CREATE POLICY "Users can upload to documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## LLM / AI Setup

The app uses AI for:
1. **Requirement extraction** from source documents (`process-sources` edge function)
2. **BRD generation** (`generate-brd` edge function)
3. **BRD refinement** via natural language commands (`refine-brd` edge function)

---

### Option A — Use Lovable AI Gateway (Recommended)

Pre-configured when using Lovable Cloud. No API key needed.

Gateway endpoint:
```
https://ai.gateway.lovable.dev/v1/chat/completions
```

Default model used: `google/gemini-3-flash-preview`

Available models:
- `google/gemini-3-flash-preview` ← default
- `google/gemini-2.5-pro`
- `google/gemini-2.5-flash`
- `openai/gpt-5`
- `openai/gpt-5-mini`

---

### Option B — Use Your Own OpenAI / Google AI Key

Modify the three edge functions (`process-sources`, `generate-brd`, `refine-brd`) to point to your own API:

**OpenAI:**
```typescript
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "gpt-4o-mini", messages: [...] }),
});
```

**Google Gemini:**
```typescript
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
  {
    headers: { Authorization: `Bearer ${GOOGLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-2.0-flash", messages: [...] }),
  }
);
```

Then set the secret (see [Set Edge Function Secrets](#set-edge-function-secrets)).

---

## Slack Integration

Doxen supports importing Slack channel messages directly into a project as a data source.

### Setup

1. **Create a Slack App** at https://api.slack.com/apps
2. Under **OAuth & Permissions**, add these **Bot Token Scopes**:
   - `channels:read` — list public channels
   - `channels:history` — read messages from public channels
   - `groups:read` *(optional)* — list private channels
   - `groups:history` *(optional)* — read messages from private channels
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (`xoxb-...`)
5. Set it as a secret:
   ```bash
   supabase secrets set SLACK_BOT_TOKEN=xoxb-your-token-here
   ```
6. **Invite the bot to any channel you want to import:**
   ```
   /invite @YourBotName
   ```

### How It Works

- The `slack-import` edge function calls the Slack Web API
- It lists public channels (and private if scopes allow)
- When a channel is imported, the last **N messages** are fetched and stored as a `data_source` record
- The stored messages can then be processed by **Extract Requirements**

> ⚠️ The bot must be **invited to a channel** before it can read that channel's history. If you see a `not_in_channel` error, run `/invite @YourBotName` in that Slack channel.

---

## Edge Functions Setup

### Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# npm (all platforms)
npm install -g supabase

# Verify
supabase --version
```

---

### Link Your Project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
```

---

### Set Edge Function Secrets

```bash
# Required — Supabase service role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Option A — Lovable AI Gateway
supabase secrets set LOVABLE_API_KEY=your_lovable_api_key_here

# Option B — BYO LLM key
supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here
# OR
supabase secrets set GOOGLE_API_KEY=your-google-ai-key-here

# Slack integration
supabase secrets set SLACK_BOT_TOKEN=xoxb-your-slack-bot-token-here

# Verify
supabase secrets list
```

---

### Deploy Edge Functions

```bash
supabase functions deploy process-sources
supabase functions deploy generate-brd
supabase functions deploy refine-brd
supabase functions deploy slack-import

# Or all at once
supabase functions deploy
```

> ⚠️ Edge functions use **Deno** runtime. Do not use `npm install` for edge function dependencies — import from `https://deno.land/std/` or `https://esm.sh/`.

---

## Run Locally

```bash
# Start the frontend dev server
bun run dev
# OR
npm run dev
```

App available at: **http://localhost:8080**

**To run Edge Functions locally:**

```bash
# In a separate terminal
supabase functions serve

# Functions available at:
# http://localhost:54321/functions/v1/process-sources
# http://localhost:54321/functions/v1/generate-brd
# http://localhost:54321/functions/v1/refine-brd
# http://localhost:54321/functions/v1/slack-import
```

When running locally, update `.env`:
```bash
VITE_SUPABASE_URL=http://localhost:54321
```

---

## Project Structure

```
doxen/
├── src/
│   ├── assets/               # Static assets (logos, images)
│   ├── components/
│   │   ├── ui/               # shadcn/ui base components
│   │   ├── brd/              # BRD viewer & editor components
│   │   ├── projects/         # Project card, create/edit dialogs
│   │   ├── requirements/     # Requirements list & traceability table
│   │   └── sources/          # Source upload, Slack import, transcript input
│   ├── hooks/                # Custom React hooks (data fetching, auth)
│   ├── integrations/
│   │   ├── lovable/          # Lovable AI gateway client
│   │   └── supabase/         # Supabase client & generated types
│   ├── pages/
│   │   ├── Landing.tsx       # Public landing page
│   │   ├── Auth.tsx          # Sign in / sign up
│   │   ├── UsernameSetup.tsx # First-time username selection
│   │   ├── Dashboard.tsx     # Projects list
│   │   └── Project.tsx       # Single project workspace
│   └── index.css             # Global design tokens & utility classes
├── supabase/
│   ├── functions/
│   │   ├── process-sources/  # AI requirement extraction
│   │   ├── generate-brd/     # BRD generation
│   │   ├── refine-brd/       # Natural language BRD refinement
│   │   └── slack-import/     # Slack channel message import
│   └── config.toml
├── public/                   # Static public assets
└── index.html
```

---

## Database Schema

| Table | Description |
|---|---|
| `profiles` | User profile data (username, display name, avatar) |
| `projects` | User projects (name, description, status) |
| `data_sources` | Imported sources per project (documents, transcripts, Slack messages) |
| `extracted_requirements` | AI-extracted requirements linked to sources |
| `generated_brds` | Generated BRD content (versioned JSONB) |

All tables have **Row Level Security (RLS)** enabled.

---

## RLS Policies

Each table enforces user-scoped access:

| Table | Policy |
|---|---|
| `profiles` | Users can read/update only their own profile |
| `projects` | Users can CRUD only their own projects |
| `data_sources` | Access via project ownership |
| `extracted_requirements` | Access via project ownership |
| `generated_brds` | Access via project ownership |

---

## Full Production Deployment

### Deploy Frontend

The app is deployed automatically via **Lovable** when you publish. For custom hosting:

```bash
bun run build
# Output in: dist/
```

Then deploy `dist/` to **Vercel**, **Netlify**, **Cloudflare Pages**, or any static host.

**Vercel:**
```bash
npx vercel --prod
```

Set environment variables in the Vercel dashboard (same as `.env`).

### Deploy Edge Functions

```bash
supabase functions deploy
```

---

## Authentication Setup

Doxen uses **email + password** authentication with optional **Google OAuth**.

### Email Auth
Enabled by default. Users receive a confirmation email before they can sign in.

### Google OAuth
1. Create OAuth credentials at https://console.cloud.google.com/
2. Add your domain to **Authorised JavaScript origins**
3. Add the Supabase callback URL to **Authorised redirect URIs**:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
4. Enable Google provider in Supabase Auth settings

### Username Setup
After first sign-in, users are redirected to a username setup page before reaching the dashboard. Usernames must be unique and are stored in the `profiles` table.

---

## Performance Notes

### Background Effects
The background color effect across all pages (Landing, Auth, Dashboard) uses **pure CSS radial gradients** — no WebGL, no canvas, no animation loops:

```css
/* Red blob — top-left */
radial-gradient(circle, hsl(0 100% 50% / 0.28) 0%, transparent 70%)
filter: blur(48px)

/* Green blob — top-center */
radial-gradient(circle, hsl(152 100% 40% / 0.22) 0%, transparent 70%)
filter: blur(56px)
```

This achieves consistent **60fps on mobile** with zero GPU WebGL overhead. The blobs are compositor-thread only and never block the main thread.

### Mobile Optimisations
- All glass panels use `will-change: transform` and `translateZ(0)` for GPU layer promotion
- Blur radii are reduced on mobile via media query
- Sticky/fixed elements are promoted to their own compositor layers
- `touch-action: manipulation` on interactive elements eliminates 300ms tap delay

### Code Splitting
Heavy components are lazy-loaded:
- `BRDViewer` — loaded only when a BRD exists
- `TraceabilityTable` — loaded only when the traceability tab is active

---

## Troubleshooting

### "Missing Supabase environment variables"
Make sure your `.env` file exists and contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Restart the dev server after adding them.

### "Edge function returned 500"
Check the edge function logs:
```bash
supabase functions logs process-sources
supabase functions logs generate-brd
supabase functions logs slack-import
```

Common causes:
- Missing `LOVABLE_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` secret
- Malformed JSON request body

### "not_in_channel" error from Slack
The Slack bot hasn't been invited to that channel. In Slack, type:
```
/invite @YourBotName
```
Then retry the import.

### "missing_scope" error from Slack
Your Slack bot token doesn't have the required OAuth scopes. Go to your Slack App settings → **OAuth & Permissions** → add `channels:read` and `channels:history`, then reinstall the app to your workspace.

### PDF export is blank
The BRD content must be generated first. Go to the BRD tab and click **Generate BRD** before exporting.

### Auth redirect loop
Clear your browser cookies/local storage, or sign out and sign back in. This usually happens when a session token expires mid-session.

---

## License

MIT — Feel free to use, modify, and distribute.
