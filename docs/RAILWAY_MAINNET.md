# STLRemit Railway Mainnet runbook

STLRemit runs as one Docker-based Railway service.

## Prepare the service

1. Create a Railway project from `tuananhh209/stlremitv2`.
2. Keep the repository root as the service root.
3. Railway uses `railway.json` and the root `Dockerfile`.
4. Add all production variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://mainnet.sorobanrpc.com
ESCROW_CONTRACT_ID=CCNRSZLLMHW36GOZQPR5VRRMNB5CH7AXOZMFN4KURNIQSO7LKELG65DE
USDC_TOKEN_ID=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
AGENT_PUBLIC_KEY=G...
AGENT_SECRET_KEY=S...
NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN.up.railway.app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=3000
```

`NEXT_PUBLIC_*` values are compiled into the browser bundle. After changing them, trigger a new deployment rather than only restarting the existing container.

## Create the domain

1. Open **Settings → Networking**.
2. Select **Generate Domain**.
3. Put the generated HTTPS URL in `NEXT_PUBLIC_APP_URL`.
4. Redeploy and wait for the deployment state to become `SUCCESS`.

Production application: `https://stlremitv2-production.up.railway.app/`.

## Database readiness

The service uses the existing Neon PostgreSQL connection. Keep `sslmode=require`; run the repository's Drizzle/schema setup against that database before onboarding users. Never place the database URL in README, browser variables or build logs.

## Mainnet smoke checks

1. `GET /api/health` returns HTTP 200.
2. Connect Freighter and verify it shows `PUBLIC`.
3. The application links to `stellar.expert/explorer/public`.
4. Contract token read returns `CCW67...JMI75`.
5. Escrow balance initially reads `0 USDC`.
6. Before a real flow, fund the agent with a small amount of USDC and enough XLM for fees.
7. Complete one low-value accept → receiver-confirm flow and save both transaction hashes.
8. Test the timeout/refund path separately with a low-value request.

## Failure checks

If Railway reports a failed build, confirm that every variable above exists. In particular, the Mainnet `NEXT_PUBLIC_*` variables must be available during Docker build, while database, agent and Cloudinary secrets must be present at runtime.
