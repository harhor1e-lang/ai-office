# ALI AI COMPANY — Cloud Engine

Cloud-first backend for the GitHub Pages office. It uses Cloudflare Workers AI and D1. No laptop, local server, or terminal is required for the dashboard setup path.

## What works in this phase
- A hosted AI model creates a structured project plan from an Arabic brief.
- Projects and task plans are stored in a remote D1 database.
- The office website connects from a phone using the Worker URL and a private owner token.
- The API exposes project/task records and task status updates.

This phase does **not** yet execute code, create downloadable project files, operate Blender, or publish repositories automatically. Those require separate execution adapters, file storage, testing, and owner approval.

## Deploy from a phone (Cloudflare Dashboard)

Ask a parent/guardian to help with account setup and security settings where required. Follow Cloudflare's age and account rules; never enter a false birth date or share passwords/tokens in chat.

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a **D1** database named `ali-ai-company`.
3. Open that database's SQL console and run the complete contents of `schema.sql` from this folder.
4. Return to **Workers & Pages**, create a Worker named `ali-ai-company-cloud`, and open its code editor.
5. Replace the starter code with the complete contents of `worker.js`, then save/deploy.
6. Open the Worker settings and add a **Workers AI** binding named exactly `AI`.
7. Add a **D1 database** binding named exactly `DB`, selecting the database `ali-ai-company`.
8. Add a plain-text variable named `ALLOWED_ORIGIN` with value `https://harhor1e-lang.github.io`.
9. Add a secret named `ADMIN_TOKEN`. Use a long, unique random secret. Keep it private; do not put it in the website source or send it in chat.
10. Save/deploy the Worker again. Copy its HTTPS Worker URL.
11. Open the ALI AI COMPANY website, enter the Worker URL and the private token in the manager connection panel, then tap **اتصال بالمحرك السحابي**.

The connection check should show the model name and number of saved projects. If it fails, check that the two bindings are named exactly `AI` and `DB`, and that the allowed origin matches the GitHub Pages domain exactly.

## Wrangler alternative

For a developer environment, replace the D1 database ID in `wrangler.toml`, create the database, apply `schema.sql`, set the secret, and deploy with Wrangler. The dashboard route above is the intended no-laptop path.

## API
- `GET /api/health`
- `GET /api/projects` (Bearer token)
- `POST /api/projects/plan` (Bearer token)
- `GET /api/projects/{project_id}/tasks` (Bearer token)
- `PATCH /api/tasks/{task_id}` (Bearer token)

## Free-tier notes

Cloudflare currently documents a free allocation of **10,000 Workers AI Neurons per day**. Workers Free also has request and CPU limits; the free allowance is not unlimited, and requests may fail after quotas are reached. Check current limits and usage in the provider dashboard before relying on it for continuous work.

The configured model is `@cf/zai-org/glm-4.7-flash`, which Cloudflare lists as a Workers AI model and identifies as multilingual with tool-calling support. Availability and free-tier limits can change.

## Security
- Keep `ADMIN_TOKEN` secret and private. Do not send it to anyone or paste it into GitHub.
- The Worker only accepts the configured website origin.
- Never place provider API keys in the public GitHub Pages frontend.
- Do not add unrestricted shell/code execution to the Worker.
- Require owner approval before publishing externally, deleting files, spending money, or sharing project data.
