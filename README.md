# SU STORE

**English** · [ภาษาไทย](README.th.md)

The online store of the Mae Fah Luang University Student Union ([sumfu.store](https://sumfu.store)). This repo is the Next.js 14 storefront and the staff back office (`/admin`). Data and the API come from the Python order-api in [SU-STORE-SERVER](https://github.com/Weerapong-gui/SU-STORE-SERVER), which serves the store API under `/v2/` and keeps its data in `store_*` tables.

## Run it locally

You need Docker Desktop or OrbStack, and Node.js 20.

```bash
./dev.sh
```

The script pulls the order-api image from GHCR, starts it with Docker Compose on a sample database in `data/dev/`, then starts Next.js.

- Storefront: `http://localhost:3000`
- Back office: `http://localhost:3000/admin`, sign in with `staff` / `dev` (sample data only)

Options:

- `BACKEND_TAG=<sha> ./dev.sh` runs a specific backend image (it must be published on GHCR, e.g. a tag from `main`).
- `./dev.sh reset` deletes the sample database and starts over. It asks before deleting.

## Checks

```bash
npm test
npx tsc --noEmit
npm run lint
CONTRACT_DIR=../SU-STORE-SERVER/contract npm run contract:sync -- --check
```

## Storefront and back office

- `/admin` manages products, categories, orders, the home page, store settings and payment slips.
- `/admin/staff` lets a superadmin add staff, reset passwords, delete accounts and grant or remove superadmin.
- `/check-order` finds a store order by order number and phone number.
- `/check-order/fp28` redirects to `https://fp28.sumfu.store/check-order/fp28` so old links keep working.
- Order statuses: `pending_payment`, `waiting_confirm`, `paid`, `ready`, `completed`, `cancelled` (source: `store/db.py` in the backend repo).

## Layout

```text
src/        Next.js storefront, admin, proxy routes and the contract copy
scripts/    tool that syncs the contract from the backend
public/     static files and fonts
```

## Contract and API compatibility

The backend's `contract/` folder is the source of truth for shared constants, the receipt template and the OpenAPI description. This repo keeps a copy in `src/contract/`. When the backend changes the contract, run `npm run contract:sync`, check the diff and commit the copy. CI fails if the copy drifts from the backend's `main`.

The backend must always support the storefront that is currently deployed. It may add things, but it may remove a field or endpoint, or change what one means, only after the storefront has stopped using it. For work that touches both sides, merge the backend first.

## Deploy

Merging into `main` deploys to production:

1. CI runs lint, type checks and tests on every pull request.
2. After review, the pull request is merged into `main`.
3. `.github/workflows/deploy.yml` builds a multi-arch image, pushes it to GHCR (tagged with the commit SHA) and deploys it on the production host. If the new container fails its health check, the previous version is restored.

To roll back, run the deploy workflow with an earlier commit: `gh workflow run deploy.yml -f sha=<commit sha>`.

Production runs on Docker Compose behind a Cloudflare Tunnel. Host details, secrets and data paths are kept off this public repo.

The SQLite database runs in WAL mode. Back it up with `sqlite3 .backup()`, never by copying the file with `cp` while the API is running.
