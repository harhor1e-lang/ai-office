# ALI AI COMPANY — Cloud Engine

Cloud-first backend for the GitHub Pages office. It uses Cloudflare Workers AI and D1; no laptop or local server is needed.

## What is real in this phase
- Cloud AI creates a structured project plan.
- Projects and tasks are stored in a remote D1 database.
- The website can connect from a phone using the Worker URL and a private owner token.
- Task statuses can be updated through the API.

This phase does **not** yet execute code, create website files, operate Blender, or publish repositories automatically. Those require separate execution adapters and approval controls.

## Deploy (account owner / guardian assistance may be required)
1. Create a Cloudflare account and open Workers & Pages. Follow the provider's age and account requirements; do not enter a false birth date.
2. Create a D1 database named `ali-ai-company`.
3. In the Cloudflare dashboard, open the D1 database console and run the SQL in `schema.sql`.
4. Open the Worker deployment flow or use Wrangler from a trusted development environment. Create a Worker named `ali-ai-company-cloud` and upload `worker.js`.
5. Add the Workers AI binding named `AI` and the D1 binding named `DB` pointing to the database you created.
6. Set the variable `ALLOWED_ORIGIN` to `https://harhor1e-lang.github.io`.
7. Set the secret `ADMIN_TOKEN` to a long, unique random value using the Cloudflare secret controls. Never place it in GitHub source code.
8. Deploy the Worker. Copy its HTTPS URL.
9. In the ALI AI COMPANY website, open the manager connection panel, paste the Worker URL and owner token, then connect.

## Wrangler alternative
Replace the D1 database ID in `wrangler.toml`, then run:
```sh
npx wrangler d1 create ali-ai-company
npx wrangler d1 execute ali-ai-company --remote --file=schema.sql
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```
Bind the AI and DB resources as described above. Do not commit secrets.

## API
- `GET /api/health`
- `GET /api/projects` (Bearer token)
- `POST /api/projects/plan` (Bearer token)
- `GET /api/projects/{project_id}/tasks` (Bearer token)
- `PATCH /api/tasks/{task_id}` (Bearer token)

## Free-tier notes
Cloudflare currently lists 10,000 Workers AI Neurons/day at no charge on Workers Free. Workers Free also has request and CPU limits. Usage is not unlimited; requests can fail when daily quotas are reached. Check the current dashboard before relying on it for ongoing work.

## Security
- Keep `ADMIN_TOKEN` secret and private.
- The Worker only accepts the configured website origin.
- Do not use the public frontend for secrets other than your own private session token.
- Do not add arbitrary shell/code execution to the Worker.
- Require owner approval before external publishing, destructive changes, purchases, or sharing.
