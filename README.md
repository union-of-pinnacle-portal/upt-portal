# upt-portal

Monorepo with a Next.js frontend and an AWS CDK backend.

## Layout

| Path     | What it is                                            |
| -------- | ----------------------------------------------------- |
| `app/`   | Frontend — Next.js (App Router, TypeScript, Tailwind v4, shadcn/ui) |
| `infra/` | Backend infrastructure — AWS CDK (TypeScript)         |

## Frontend (`app/`)

```bash
cd app
npm install        # first time only
npm run dev        # dev server at http://localhost:3000
npm run build      # production build
npm start          # serve the production build
```

Add shadcn/ui components with `npx shadcn@latest add <name>`.

## Infra (`infra/`)

```bash
cd infra
npm install        # first time only
npx cdk synth      # synthesize the CloudFormation template
npx cdk diff       # diff against the deployed stack
npx cdk deploy     # deploy (requires AWS credentials)
```

Stack definition lives in `infra/lib/infra-stack.ts`; the app entrypoint is `infra/bin/infra.ts`.
