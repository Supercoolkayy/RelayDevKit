# RelayDevKit

RelayDevKit gives you a **reproducible local Rootstock (RSK) regtest stack** and a small CLI to start it, inspect it, and tear it down. It is meant to lower the barrier to integrating **RIF Relay** and similar flows with a known-good environment.

## Prerequisites

- **Node.js** 18+ (for building the CLI and running `relaydevkit`)
- **Docker** and **Docker Compose** v2 (`docker compose`)
- Enough disk and RAM to run **RSKj** (`rsksmart/rskj`, linux/amd64)

## Quick start (from a clone)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env-example .env
   ```

   Edit `.env` and set at least **`MANAGER_PRIVATE_KEY`** and **`WORKER_PRIVATE_KEY`** (see [Environment variables](#environment-variables)). The example file includes safe **regtest-only** placeholders; replace them for anything beyond local dev.

3. **Build** (TypeScript → `dist/`, infra copied to `dist/infra`)

   ```bash
   npm run build
   ```

4. **Start the stack** (from the same directory as `.env`, or any subdirectory—see below)

   ```bash
   npx relaydevkit up
   ```

   Or, after [linking the package](#link-the-cli-globally-with-npm-link):

   ```bash
   relaydevkit up
   ```

5. **Check status**, **stream logs**, or **shut down**

   ```bash
   relaydevkit status
   relaydevkit logs    # follows logs; Ctrl+C to stop
   relaydevkit down
   ```

Run CLI commands from a directory that contains your `.env`, **or** from a subfolder: the CLI walks **up** the tree to find the first `.env` and passes it to Docker Compose as `--env-file`.

---

## Build

| Command | Purpose |
|--------|---------|
| `npm run build` | Runs `tsc` then copies `infra/**/*` → `dist/infra` (Compose + initializer). |
| `npm run copy:infra` | Copy infra only (after you already compiled). |
| `npm run dev` | Dev entry (tsx watch)—not required for the Docker workflow. |

The published **`bin`** is `relaydevkit` → `dist/cli/index.js`. You **must** run `npm run build` before `npm link` or publishing so `dist/` and `dist/infra` exist.

---

## Link the CLI globally with `npm link`

From the **RelayDevKit repository root** (after `npm install` and `npm run build`):

```bash
npm link
```

This registers the package globally. The `package.json` field `"name": "relaydevkit"` and `"bin": { "relaydevkit": "dist/cli/index.js" }` expose the command:

```bash
relaydevkit --help
relaydevkit up
relaydevkit down
relaydevkit status
relaydevkit logs
```

### Unlink

From the repo root:

```bash
npm unlink -g relaydevkit
# or
npm unlink --global relaydevkit
```

---

## CLI commands

All commands run **Docker Compose** with `cwd` set to **`dist/infra`** inside the installed package (or your linked clone). They prepend `docker compose --env-file <resolved-.env>` when a `.env` is found.

| Command | Description |
|--------|-------------|
| `relaydevkit up` | `docker compose up -d` — starts **rootstock-node** (RSKj regtest) and **initializer** (funds manager/worker from the regtest genesis faucet). |
| `relaydevkit down` | `docker compose down -v` — stops containers and removes volumes. |
| `relaydevkit status` | `docker compose ps` plus a JSON-RPC check to **`RSK_RPC_URL_PUBLIC`** (default `http://127.0.0.1:4444`). Loads `.env` via `dotenv` for that URL. |
| `relaydevkit logs` | `docker compose logs -f` — follows all service logs until you interrupt. |

If no `.env` is found when you run **`up`**, you get a warning; Compose may start with empty secrets and the initializer will fail until keys are provided.

---

## Environment variables

Keep **secrets in `.env`**. The file is listed in `.gitignore`—**do not commit** real keys.

### Used by Docker Compose (from your `.env` via `--env-file`)

These are interpolated when you run `relaydevkit up` / `down` / `logs` / `status` (Compose still reads the file for project consistency).

| Variable | Required | Used by | Description |
|----------|----------|---------|-------------|
| `MANAGER_PRIVATE_KEY` | **Yes** | `initializer` | Hex private key (`0x…`) for the manager account to fund on regtest. **Sensitive.** |
| `WORKER_PRIVATE_KEY` | **Yes** | `initializer` | Hex private key for the worker account. **Sensitive.** |
| `FAUCET_PRIVATE_KEY` | No | `initializer` | Override for the account that sends RBTC. Defaults to the **public** `rsk-dev` genesis demo key (regtest only). **Sensitive** if you set a custom key. |
| `RSK_RPC_HOST_HEADER` | No | `initializer` | HTTP `Host` header for JSON-RPC to RSKj. Default inside the image is derived as `127.0.0.1:<port>` because RSKj’s allowlist rejects `Host: rootstock-node:4444`. Override only if your setup needs it. |
| `RSK_RPC_URL` | No | `initializer` | JSON-RPC URL reachable **from inside the initializer container** (default `http://rootstock-node:4444/`). Override if you rename the node service or use a custom network. |

### Used only by the CLI (Node / `dotenv`)

| Variable | Command | Description |
|----------|---------|-------------|
| `RSK_RPC_URL_PUBLIC` | `status` | Host-facing JSON-RPC URL for the health check (default `http://127.0.0.1:4444`). |

### Inside `infra/initializer/init.js` (container)

The initializer reads **`RSK_RPC_URL`**, **`RSK_RPC_HOST_HEADER`**, **`MANAGER_PRIVATE_KEY`**, **`WORKER_PRIVATE_KEY`**, and **`FAUCET_PRIVATE_KEY`** from the container environment (populated from Compose as above).

---

## Manual Docker Compose (without the CLI)

From the repo after `npm run build`:

```bash
docker compose --env-file .env -f dist/infra/docker-compose.yml up -d
docker compose --env-file .env -f dist/infra/docker-compose.yml logs -f
docker compose --env-file .env -f dist/infra/docker-compose.yml down -v
```

---

## Ports

| Port | Service |
|------|---------|
| **4444** | RSKj HTTP JSON-RPC (mapped to host) |
| **5050** | RSKj peer / node port (mapped to host) |

---

## Security notes

- **Regtest demo keys** (including the built-in faucet key in `init.js`) are **public** and must **never** be used on mainnet or with real funds.
- Treat **`MANAGER_PRIVATE_KEY`**, **`WORKER_PRIVATE_KEY`**, and **`FAUCET_PRIVATE_KEY`** as secrets.
- Prefer **`.env`** for local development; use your CI/secret manager for automation.

---

## Troubleshooting

- **`dependency failed to start: … unhealthy`**: RSKj is still booting; `docker compose` healthcheck may need more time on first run. Run `relaydevkit logs` or `docker compose ps`.
- **Initializer `HTTP 400` to RSK**: Usually fixed by sending **`Host: 127.0.0.1:4444`** (handled automatically; override with `RSK_RPC_HOST_HEADER` if needed).
- **Wrong Compose project / missing env**: Run commands from the directory that contains `.env`, or ensure a parent directory has `.env` (CLI walks upward).
- **Stale initializer image after editing `infra/`**: `npm run build` then `docker compose build --no-cache initializer` and recreate the container.

---

## License

See `package.json` (`ISC`).
