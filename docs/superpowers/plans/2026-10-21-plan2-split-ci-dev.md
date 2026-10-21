# Plan 2: แยก repo, CI/CD และ dev ด้วย Docker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** มีสอง repo ที่ทำงานแยกกันได้จริง: backend `SU-STORE-SERVER` กับหน้าร้าน `SU-STORE-clean` แต่ละ repo มี CI บน PR, push เข้า `main` แล้ว build image ขึ้น GHCR และมี job deploy (ปิดไว้จนกว่า plan 3 จะตั้งเครื่องใหม่เสร็จ) และเพื่อนทีมหน้าร้านรัน `./dev.sh` คำสั่งเดียวได้หน้าร้านที่ต่อ backend ใน Docker พร้อมข้อมูลตัวอย่าง

**Architecture:**
- backend แยกออกด้วย `git filter-repo --subdirectory-filter server` จึงยังเก็บประวัติไว้ และเป็นเจ้าของโครงสร้างพื้นฐาน: `compose.yml` ของ production, `ops/deploy-service.sh` ที่ทั้งสอง repo ใช้ deploy และ `contract/`
- image ของทั้งสองฝั่ง build บน GitHub-hosted runner แล้ว push ขึ้น GHCR แบบ public พร้อม tag เป็น git sha
- self-hosted runner บนเครื่องใหม่มีหน้าที่อย่างเดียว คือดึง image ตาม sha มารัน
- หน้าร้านดึง contract จาก `main` ของ backend ทาง raw GitHub

**Tech Stack:** git-filter-repo, GitHub Actions (`docker/build-push-action`, buildx multi-arch), GHCR, Docker Compose, bash, pytest, vitest

**Spec:** `docs/superpowers/specs/2026-10-20-repo-split-and-server-move-design.md` (ข้อ 4.1–4.3, 4.7, 4.8) · plan 1 (`2026-10-20-plan1-prepare-split.md`) ทำเสร็จแล้ว

**ไม่อยู่ใน plan นี้ (plan 3):** สร้าง user/runner/โฟลเดอร์/network บนเครื่องใหม่, tunnel `su-store-cloudflared` ตัวจริง, งาน backup (ข้อ 4.5), การซ้อมและคืนจริง, เปิด `DEPLOY_ENABLED`

## สิ่งที่ผู้วางแผนเลือกเอง (เจ้าของงานตรวจได้)

- **build image บน GitHub-hosted runner แล้ว push ขึ้น GHCR ทั้งสองฝั่ง** แทนการ build บนเครื่องใหม่ เครื่องใหม่จึงแค่ `pull` · เหตุผล: ดิสก์ของเครื่องใหม่เหลือน้อยและใช้ร่วมกับโปรเจกต์อื่น · ยังตรงกับ spec ข้อ 4.7 (tag เป็น sha และเว็บเก่ารันต่อระหว่าง build)
- **`ci.yml` รันเฉพาะ PR ส่วนงานบน `main` อยู่ใน `deploy.yml`** (test → image → deploy) · เหตุผล: กฎข้อ 4.7 ให้ job self-hosted อยู่ได้แค่ใน workflow ที่ trigger ด้วย `push`/`workflow_dispatch` เท่านั้น
- **กันไม่ให้ deploy ซ้อนกันด้วย `flock` บนเครื่อง:** `concurrency` ของ GitHub กันได้แค่ภายใน repo เดียว
- **`deploy-service.sh` มีที่เดียวใน repo backend:** หน้าร้านเรียกใช้จาก `$SU_STORE_DIR/backend/ops/`
- **ตัด `COOKIE_SECRET` ทิ้ง:** ไม่มีโค้ดใน `src/` ใช้ มีแค่ `next.config.mjs` ที่เช็กค่า และถูก bake ลงใน builder stage ของ image
- **demo seed ไม่มีรูปสินค้า**

## Global Constraints

- repo ทั้งสองเป็น **public**: ห้ามมี secret, IP, tunnel ID หรือ path ข้อมูลจริงในไฟล์ที่ commit, ใน image และใน log ของ Actions · `.env` อยู่บน host เท่านั้น
- image: `ghcr.io/weerapong-gui/su-store-server` และ `ghcr.io/weerapong-gui/su-store-web` · tag = git sha เต็ม 40 ตัว + `main` · build สำหรับ `linux/amd64,linux/arm64` (เพื่อนใช้ Mac Apple Silicon)
- ชื่อ container/network/volume ขึ้นต้นด้วย `su-store-` · network `su-store-net` (external) · **ไม่ publish พอร์ตออก host** ใน compose ของ production · ทุก service `restart: unless-stopped` + healthcheck + `logging: {driver: json-file, options: {max-size: "10m", max-file: "3"}}`
- job ที่ `runs-on: self-hosted` อยู่ได้เฉพาะใน workflow ที่ `on:` มีแค่ `push` (branches: `[main]`) และ/หรือ `workflow_dispatch` · ห้ามมี `pull_request_target` ในทุก workflow · job deploy ใช้ `environment: production` และ `if: vars.DEPLOY_ENABLED == 'true'`
- ห้าม `docker system prune` ในสคริปต์ใดๆ · ลบได้เฉพาะ image ของ repo นั้น เก็บ 3 tag ล่าสุด
- deploy ฝั่งเดียวไม่แตะอีกฝั่ง (`up -d --no-deps <service>`) · deploy ของสอง repo ไม่รันซ้อนกัน
- action ทุกตัว pin เป็น major tag ที่ออกมาแล้ว (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`, `docker/setup-qemu-action@v3`, `docker/setup-buildx-action@v3`, `docker/login-action@v3`, `docker/build-push-action@v6`)
- npm/pip package ใหม่ pin version ตรงตัว ที่ออกมาแล้วอย่างน้อย 2 สัปดาห์
- กฎ clean code ของ `CLAUDE.md` ข้อ 3.5 ใช้ทั้งสอง repo · ก่อนจบแต่ละ task รันชุดตรวจของ repo ที่แก้ (backend: `ruff check .` + pytest · หน้าร้าน: lint + `tsc` + `npm test` + `contract:sync -- --check`)
- task ที่ติด **[ผู้ควบคุม]** มีงาน git/push/GitHub API ที่ sandbox ของ Codex ทำไม่ได้ ผู้ควบคุม (Claude) ทำเอง ส่วน task อื่นสั่ง Codex ได้

## Review Focus

1. **PR จาก fork ห้ามได้รันบน self-hosted runner:** เครื่องนี้ใช้ร่วมกับโปรเจกต์ SU อื่น ทั้งสอง repo จึงต้องมีเทส `workflow guard` ที่อ่าน `.github/workflows/*.yml` แล้วยืนยันกฎในข้อ Global Constraints (Task 4, Task 7)
2. **คนใช้ Mac (arm64) ต้องดึง image backend ได้:** image ต้องเป็น multi-arch เทส workflow guard ยืนยันว่า `platforms` มีทั้งสองสถาปัตยกรรม (Task 4) และหลัง push ครั้งแรกต้องเช็กด้วย `docker manifest inspect` (Task 10)
3. **deploy แล้ว container ไม่ healthy หรือ crash-loop:** ต้องย้อนไปใช้ tag ก่อนหน้า แล้ว exit ไม่เป็น 0 · กรณี deploy ครั้งแรกที่ยังไม่มี tag ก่อนหน้า ให้ fail ชัดๆ และไม่พยายามย้อน (Task 5)
4. **merge สองฝั่งในนาทีเดียวกัน:** deploy ต้องต่อคิวกันผ่าน `flock` และถ้ารอนานเกินกำหนดให้ fail พร้อมข้อความ ห้ามรันซ้อนกัน (Task 5)
5. **contract หลุดหรือดึงไม่ได้:** ถ้าดึงจาก GitHub ไม่ได้ (เน็ตล่ม, ได้ 404) `--check` ต้อง fail ด้วยข้อความว่าดึงไม่ได้ ห้ามสรุปว่าตรงกัน (Task 7) · demo seed ห้ามรันกับ DB ที่มีสินค้าอยู่แล้ว (Task 3)

---

## โครงไฟล์หลังจบ plan

**`SU-STORE-SERVER`** (root = `server/` เดิม)
```
order_api.py  ocr.py  core/  store/  contract/  tests/
Dockerfile  .dockerignore  ruff.toml  .gitignore  README.md
compose.yml          # production: su-store-api (+ cloudflared/backup เพิ่มใน plan 3)
compose.dev.yml      # dev: build จาก source + demo seed + 127.0.0.1:10000
dev.sh
ops/deploy-service.sh
.github/workflows/ci.yml       # pull_request: ruff + pytest
.github/workflows/deploy.yml   # push main / workflow_dispatch: test → image → deploy
docs/superpowers/{specs,plans}/2026-10-16-unpaid-order-expiry*.md
```

**`SU-STORE-clean`** (ลบ `server/`, `tests/`, `ruff.toml`, `.env.order-api.example`, `deploy.sh`, `docker-compose.yml`)
```
compose.yml          # production: su-store-web
compose.dev.yml      # dev: backend image จาก GHCR + demo seed
dev.sh  Dockerfile  scripts/sync-contract.mjs
.github/workflows/ci.yml       # pull_request + schedule รายวัน: lint, tsc, vitest, contract check
.github/workflows/deploy.yml   # push main / workflow_dispatch: test → image → deploy
```

---

### Task 1 [ผู้ควบคุม]: push หน้าร้าน และสร้าง repo backend

**Files:** ทั้ง repo `SU-STORE-SERVER`

- [ ] **Step 1:** ใน `SU-STORE-clean` ต้องไม่เจออะไรจากคำสั่ง `git log -p origin/main..main | grep -E "^\+.*(100\.(94|109)\.[0-9]+\.[0-9]+|192\.168\.31|/home/park)"` จากนั้น `git push origin main` (fast-forward เท่านั้น ห้าม force) และลบ branch `backup/pre-scrub-49f4a47`
- [ ] **Step 2:** `brew install git-filter-repo` จากนั้น clone `SU-STORE-clean` ลงโฟลเดอร์ชั่วคราวใน scratchpad แล้วรัน `git filter-repo --subdirectory-filter server` ต้องได้ `order_api.py`, `core/`, `store/`, `contract/`, `tests/` อยู่ที่ root
- [ ] **Step 3:** ตรวจว่าประวัติที่กรองแล้วไม่มี IP หรือ path จริง (`git log -p | grep -cE "100\.(94|109)\.|192\.168\.31|/home/park"` ต้องได้ `0`) ถ้าเจอให้หยุดแล้วถามเจ้าของงาน
- [ ] **Step 4:** เพิ่มไฟล์ (commit เดียว `chore: standalone backend repo layout`):
  - `ruff.toml` คัดจากหน้าร้านมา แก้คอมเมนต์บรรทัดแรกเป็น `ruff check .`
  - `.gitignore` ใส่ `__pycache__/`, `*.pyc`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `data/`, `.env`, `CLAUDE.md`, `AGENTS.md`, `.claude/`
  - `Dockerfile` แก้ `COPY server/x` เป็น `COPY x` ทุกบรรทัด
  - `.dockerignore` ใส่ `tests/`, `.git`, `.github/`, `.venv/`, `data/`, `docs/`, `*.md`, `__pycache__/`
  - `docs/superpowers/specs/2026-10-16-unpaid-order-expiry.md` + plan คู่กันจาก repo `SU-STORE` เดิม (ตามข้อ 5 ของ spec) โดยใส่หมายเหตุบรรทัดแรกว่า path ในเอกสารยังเป็นโครงสร้างเก่า
- [ ] **Step 5:** สร้าง `.venv` (Python 3.11+, `pytest`, `ruff==0.16.10`, `pyyaml==6.0.2`) แล้วรัน `ruff check .` และ `ORDER_API_DB_PATH=/tmp/su-order-api/orders.db ORDER_API_SLIPS_DIR=/tmp/su-order-api/slips .venv/bin/python -m pytest tests/ -q` ต้องผ่านเท่ากับจำนวนเทส backend ใน `SU-STORE-clean`
- [ ] **Step 6:** push เข้า `main` ของ `Weerapong-gui/SU-STORE-SERVER` (repo ยังว่างอยู่) แล้วสร้าง `CLAUDE.md` ไว้ในเครื่อง (ถูก gitignore) โดยคัดส่วน backend จาก `SU-STORE-clean/CLAUDE.md` กับ `server/CLAUDE.md` มารวมกัน
- [ ] **Step 7:** ย้าย `.claude/skills/deploy/` จาก `SU-STORE-clean` ไปไว้ที่ backend ด้วย เพราะ backend ถือโครงสร้างพื้นฐาน (ทั้งคู่ gitignore)

### Task 2: README ของ backend และ CI บน PR

**Files:** Create `README.md`, `.github/workflows/ci.yml`

- [ ] **Step 1:** `README.md` (ภาษาไทย) ต้องมีหัวข้อเหล่านี้:
  - repo นี้คืออะไร
  - รัน dev (`./dev.sh` จาก Task 3)
  - ตรวจ (`.venv` + ruff + pytest พร้อม env)
  - contract (`contract/` เป็นแหล่งความจริง หน้าร้านดึงจาก `main`) พร้อมกฎความเข้ากันได้ คัดตาม spec ข้อ 4.3 คำต่อคำ
  - deploy (ภาพรวมเท่านั้น บอกว่ารายละเอียดอยู่ใน skill `deploy`)
- [ ] **Step 2:** `ci.yml` ชื่อ workflow `CI`
  - `on: pull_request: branches: [main]`
  - job `test` ชื่อ `Backend lint & tests` รันบน `ubuntu-latest` ใช้ Python 3.13
  - `pip install pytest ruff==0.16.10 pyyaml==6.0.2` แล้ว `ruff check .` แล้ว pytest พร้อม env `ORDER_API_DB_PATH` และ `ORDER_API_SLIPS_DIR` ชี้ไป `/tmp`
  - ห้ามมี `runs-on: self-hosted`
- [ ] **Step 3:** commit `ci: lint and test pull requests`

### Task 3: demo seed และ dev ของ backend

**Files:**
- Create: `store/demo_seed.py`, `tests/test_demo_seed.py`, `compose.dev.yml`, `dev.sh`
- Modify: `order_api.py`, `core/config.py`

**Interfaces:**
- Produces: `store.demo_seed.seed_demo(connection: sqlite3.Connection) -> bool` คืน `True` เมื่อ seed และคืน `False` (ไม่แตะอะไร) เมื่อ `store_products` มีแถวอยู่แล้ว
- Produces: env `ORDER_API_DEMO_SEED=1` ทำให้ `order_api.py` เรียก `seed_demo` หลัง `ensure_db()` ใน process หลักเท่านั้น (`core.config.DEMO_SEED: bool`)
- Produces: image dev ฟังที่ `127.0.0.1:10000` ด้วย token `dev-token` บัญชี `staff` / `dev` (`PICKUP_PASSWORD=dev`)

- [ ] **Step 1: เขียนเทส** `tests/test_demo_seed.py` (ใช้ DB ใน `tmp_path` + `ensure_db` ไม่ใช้ socket):
  - `test_seed_creates_catalog_and_orders`: หลัง `seed_demo` ได้ `True` แล้วต้องมีหมวด ≥ 2 · สินค้า `optionKind == "options"` ≥ 1 ตัวที่มีทั้งไซซ์และสี · สินค้า `optionKind == "designs"` ≥ 1 ตัวที่มี ≥ 3 ลาย · `get_home_admin(conn)["published"]` ไม่ว่าง · ออเดอร์ครบทุกสถานะใน `db.ORDER_STATUSES` อย่างน้อยสถานะละ 1 · `get_settings(conn)["payment"]["accountNumber"]` ไม่ว่าง
  - `test_seed_is_noop_when_products_exist`: seed รอบที่สองต้องคืน `False` และจำนวนแถว `store_orders` ไม่เปลี่ยน
  - `test_seed_only_through_business_functions`: เปิด DB หลัง seed แล้ว `list_products(conn, public=True)` ต้องคืนสินค้าที่ seed (ยืนยันว่าข้อมูลผ่าน validation จริง)
- [ ] **Step 2:** รันแล้วต้อง FAIL
- [ ] **Step 3:** เขียน `seed_demo`
  - ใช้แต่ฟังก์ชัน business เดิม: `categories.create_category`, `db.create_product`, `home.save_home_draft` + `publish_home`, `db.update_settings`, `db.create_order`, `db.update_order`
  - ห้ามเขียน SQL ตรง ยกเว้นเช็กว่าว่างก่อน seed
  - ข้อความภาษาไทยและอังกฤษ ไม่ใส่รูป
  - บัญชีรับเงินเป็นค่าปลอมที่ดูออกว่าเป็นตัวอย่าง (`ธนาคารตัวอย่าง`, `000-0-00000-0`)
  - ทำทุกอย่างใน transaction เดียว
- [ ] **Step 4:** ต่อ `ORDER_API_DEMO_SEED` เข้า `order_api.py` แล้วรันเทสให้ผ่าน
- [ ] **Step 5:** `compose.dev.yml`
  - service `su-store-api-dev`: `build: .`, image `su-store-server:dev`, container `su-store-api-dev`, `ports: ["127.0.0.1:10000:10000"]`
  - env: `ORDER_API_TOKEN=dev-token`, `PICKUP_PASSWORD=dev`, `ORDER_API_DEMO_SEED=1`, `ORDER_API_DB_PATH=/var/data/su-order-api/orders.db`, `ORDER_API_SLIPS_DIR=/var/data/su-order-api/slips`
  - volume `./data/dev:/var/data` และ healthcheck แบบเดียวกับ compose เดิม
- [ ] **Step 6:** `dev.sh` (bash, ใช้ได้ทั้ง macOS และ Linux ห้ามใช้ flag ที่มีแต่ GNU)
  - เช็กว่ามี `docker` ถ้าไม่มีให้บอกให้ติดตั้ง Docker Desktop หรือ OrbStack แล้ว exit 1
  - `docker compose -f compose.dev.yml up --build --wait` แล้วพิมพ์ URL `/health`
  - `./dev.sh reset` ลบ `data/dev/` ก่อนเริ่ม (ถามยืนยันก่อน)
- [ ] **Step 7:** commit `feat(dev): demo seed and docker dev setup`

### Task 4: workflow `deploy.yml` (test + image) และเทส workflow guard

**Files:** Create `.github/workflows/deploy.yml`, `tests/test_workflow_guard.py`

**Interfaces:**
- Produces: workflow `Deploy` มี job ชื่อ `test`, `image`, `deploy` (job `deploy` เพิ่มใน Task 6)
- Produces: image `ghcr.io/weerapong-gui/su-store-server:<github.sha>` และ `:main`

- [ ] **Step 1: เขียนเทส** `tests/test_workflow_guard.py` ใช้ `yaml.safe_load` และระวังว่า PyYAML แปลง key `on` เป็น `True`:
  - `test_self_hosted_jobs_only_run_on_main_push_or_dispatch`: ทุก workflow ที่มี job `runs-on` ซึ่งมี `self-hosted` ต้องมี trigger เป็นสับเซตของ `{"push", "workflow_dispatch"}` และ `push.branches == ["main"]`
  - `test_no_pull_request_target_anywhere`
  - `test_self_hosted_jobs_are_gated`: job self-hosted ต้องมี `environment: production` และ `if` ที่มี `vars.DEPLOY_ENABLED == 'true'`
  - `test_image_is_multi_arch`: step ที่ `uses: docker/build-push-action@v6` ต้องมี `platforms: linux/amd64,linux/arm64`
- [ ] **Step 2:** รันแล้วต้อง FAIL (ยังไม่มี `deploy.yml`)
- [ ] **Step 3:** เขียน `deploy.yml`
  - `on: push: branches: [main]` และ `workflow_dispatch` ที่มี input `sha` (string, ไม่บังคับ ใช้ rollback)
  - `concurrency: {group: su-store-deploy, cancel-in-progress: false}`
  - job `test` ใช้ขั้นตอนเดียวกับ `ci.yml` และมี `if: inputs.sha == ''`
  - job `image`
    - `needs: test`, `if: inputs.sha == ''`
    - `permissions: {contents: read, packages: write}`
    - login GHCR ด้วย `GITHUB_TOKEN` แล้วใช้ qemu + buildx + build-push
    - `push: true` และ tag เป็น sha กับ `main`
  - ห้ามส่ง secret เข้า build
- [ ] **Step 4:** รันเทสให้ผ่าน แล้วรัน `actionlint` (`brew install actionlint`) ต้องไม่มี error
- [ ] **Step 5:** commit `ci: build multi-arch image to GHCR on main`

### Task 5: `compose.yml` production และ `ops/deploy-service.sh`

**Files:** Create `compose.yml`, `ops/deploy-service.sh`, `tests/test_deploy_service.py`

**Interfaces:**
- Produces: `ops/deploy-service.sh <backend|frontend> <sha>` ใช้ได้ทั้งสองฝั่ง:

  | part | service/container | image | ตัวแปร tag |
  |---|---|---|---|
  | `backend` | `su-store-api` | `ghcr.io/weerapong-gui/su-store-server` | `API_IMAGE_TAG` |
  | `frontend` | `su-store-web` | `ghcr.io/weerapong-gui/su-store-web` | `WEB_IMAGE_TAG` |

  - อ่าน env `SU_STORE_DIR` (บังคับ) และใช้ไฟล์ `$SU_STORE_DIR/<part>/compose.yml`, `.env`, `REVISION`
  - env ที่ปรับได้: `DEPLOY_HEALTH_TIMEOUT` (default `90`), `DEPLOY_POLL_SECONDS` (`3`), `DEPLOY_LOCK_TIMEOUT` (`600`)
  - exit code: `0` สำเร็จ · `1` ไม่ healthy และย้อนกลับแล้ว · `2` ไม่ healthy และไม่มี tag ก่อนหน้าให้ย้อน · `3` รอ lock เกินเวลา · `64` ใช้ผิดวิธี
- คำสั่ง docker ที่สคริปต์ใช้ (fake ในเทสตอบตามนี้):
  - `docker pull <image>:<sha>`
  - `docker compose -f <compose> --env-file <.env> up -d --no-deps <service>` โดยส่งตัวแปร tag ผ่าน environment
  - `docker inspect --format '{{.State.Health.Status}}' <service>`
  - `docker image ls <image> --format '{{.Tag}}'` (docker เรียงใหม่สุดก่อน)
  - `docker image rm <image>:<tag>`
- lock: `flock -w $DEPLOY_LOCK_TIMEOUT $SU_STORE_DIR/.deploy.lock` ใช้ไฟล์เดียวกันทั้งสองฝั่ง

- [ ] **Step 1: เขียนเทส** `tests/test_deploy_service.py`
  - สร้าง `docker` ปลอม (Python script ใน `tmp_path/bin` ใส่หน้า `PATH`) บันทึก argv ลงไฟล์ แล้วตอบ health ตามลำดับที่ตั้งไว้
  - รันสคริปต์ด้วย `subprocess` และตั้ง `DEPLOY_POLL_SECONDS=0`, `DEPLOY_HEALTH_TIMEOUT=1`
  - ถ้าเครื่องไม่มี `flock` (macOS) ให้ใส่ `flock` ปลอมที่รันคำสั่งต่อเลย ยกเว้นเทส lock ที่ข้ามด้วย `skipif` เมื่อไม่มี `flock` จริง
  - เทสที่ต้องมี:
    - `test_healthy_deploy_writes_revision`: health = `healthy` → exit 0, `REVISION` เป็น sha ใหม่, มีการเรียก `up -d --no-deps su-store-api` โดย `API_IMAGE_TAG=<sha>`
    - `test_unhealthy_rolls_back_to_previous`: เริ่มจาก `REVISION=old` และ health = `unhealthy` ตลอด → exit 1, `up` ครั้งที่สองใช้ `old`, `REVISION` ยังเป็น `old`
    - `test_first_deploy_unhealthy_does_not_roll_back`: ไม่มี `REVISION` → exit 2 และเรียก `up` ครั้งเดียว
    - `test_keeps_three_newest_tags`: `image ls` คืน 5 tag → `image rm` 2 tag ที่เก่าสุด ห้ามลบ tag ปัจจุบันหรือ tag ก่อนหน้า
    - `test_never_prunes`: ทุกการเรียก docker ต้องไม่มี `prune`
    - `test_lock_timeout_exits_3`: ถือ lock ไว้ด้วย `fcntl.flock` แล้วรันด้วย `DEPLOY_LOCK_TIMEOUT=1` → exit 3 ข้อความมีคำว่า `deploy อื่นกำลังรัน`
    - `test_bad_args_exit_64`: part ที่ไม่รู้จัก หรือ sha ไม่ใช่ hex 40 ตัว
- [ ] **Step 2:** รันแล้วต้อง FAIL
- [ ] **Step 3:** เขียน `ops/deploy-service.sh`
  - `set -euo pipefail` และข้อความ log ภาษาไทยขึ้นต้นด้วย `[deploy <part>]`
  - ห้าม echo ค่าใน `.env`
- [ ] **Step 4:** เขียน `compose.yml`
  - service `su-store-api`
    - image `ghcr.io/weerapong-gui/su-store-server:${API_IMAGE_TAG:?}`, `container_name: su-store-api`
    - network `su-store-net` (`external: true`) และไม่มี `ports`
    - env เหมือน compose เดิม (`ORDER_API_*`, `PICKUP_*`) โดยค่าลับอ่านจาก `.env`
    - volume `${SU_STORE_DATA_DIR:?}/order-api:/var/data`
    - `ulimits nofile 65536`, healthcheck เดิม, `restart: unless-stopped`, logging ตาม Global Constraints
  - คอมเมนต์ใน compose ว่า cloudflared และ backup จะเพิ่มใน plan 3
- [ ] **Step 5:** รันเทสให้ผ่าน และ `docker compose -f compose.yml config -q` ผ่าน (ตั้ง env ปลอม) ถ้าเครื่องไม่มี docker ให้บอกในรายงาน
- [ ] **Step 6:** commit `feat(ops): production compose and shared deploy script`

### Task 6: job `deploy` ของ backend

**Files:** Modify `.github/workflows/deploy.yml`

- [ ] **Step 1:** เพิ่ม job `deploy`
  - `needs: [image]` และ `if: always() && vars.DEPLOY_ENABLED == 'true' && (needs.image.result == 'success' || inputs.sha != '')`
  - `runs-on: [self-hosted, su-store]`, `environment: production`, `permissions: {contents: read}`
  - steps:
    1. checkout ที่ `inputs.sha || github.sha`
    2. คัดลอก `compose.yml` กับ `ops/` ไปที่ `${SU_STORE_DIR:?}/backend/` (env นี้ตั้งในเครื่อง runner, plan 3)
    3. รัน `${SU_STORE_DIR}/backend/ops/deploy-service.sh backend "${{ inputs.sha || github.sha }}"`
- [ ] **Step 2:** `pytest tests/test_workflow_guard.py` และ `actionlint` ต้องผ่าน (job ใหม่ต้องผ่านกฎ self-hosted ทุกข้อ)
- [ ] **Step 3:** commit `ci: deploy job on the self-hosted runner (off until DEPLOY_ENABLED)` แล้วผู้ควบคุม push Task 2–6 เข้า `main` ของ backend และดูว่า job `image` เขียว

### Task 7: ตัด backend ออกจากหน้าร้าน และดึง contract จาก GitHub

**Files:**
- Delete: `server/`, `tests/`, `ruff.toml`, `.env.order-api.example`, `.venv` (ในเครื่อง)
- Modify: `scripts/sync-contract.mjs`, `src/__tests__/contract.test.ts`, `.github/workflows/ci.yml`, `next.config.mjs`, `Dockerfile`, `.env.example`, `.dockerignore`, `package.json`
- Create: `src/__tests__/syncContract.test.ts`, `src/__tests__/workflowGuard.test.ts`

**Interfaces:**
- Consumes: `contract/` บน `main` ของ backend (Task 1)
- Produces: `sync-contract.mjs` ดึงไฟล์ `CONTRACT_FILES = ["store-contract.json", "receipt_template_v2.svg", "openapi.json"]`
  - ค่า default ดึงจาก `https://raw.githubusercontent.com/Weerapong-gui/SU-STORE-SERVER/${CONTRACT_REF:-main}/contract/<file>`
  - ถ้าตั้ง `CONTRACT_DIR=<path>` (เช่น `../SU-STORE-SERVER/contract`) ให้อ่านจากโฟลเดอร์นั้นแทน
  - ถ้าดึงไม่สำเร็จ (non-2xx หรือ network error) ให้ exit 2 พร้อมข้อความ `ดึง contract จาก backend ไม่ได้: <file> (<สาเหตุ>)`
  - ถ้าไม่ตรงกันยังคง exit 1 ด้วยข้อความเดิม

- [ ] **Step 1: เขียนเทส**
  - `syncContract.test.ts` spawn `node scripts/sync-contract.mjs --check` และตั้ง `CONTRACT_DIR` เป็นโฟลเดอร์ชั่วคราว:
    - ตรงกัน → 0
    - ไฟล์ต่างกัน → 1 และข้อความ `contract ไม่ตรงกับ backend`
    - ขาดไฟล์ → 2 และข้อความ `ดึง contract จาก backend ไม่ได้`
  - `workflowGuard.test.ts` ใช้ devDependency `yaml@2.6.1` และเทสกฎเดียวกับ Task 4 ทุกข้อ ยกเว้นข้อ multi-arch ซึ่งย้ายไปอยู่ใน Task 8
- [ ] **Step 2:** รันแล้วต้อง FAIL
- [ ] **Step 3:** เขียน `sync-contract.mjs` ใหม่ตาม Interfaces
  - ใช้ `fetch` ของ Node 20
  - generate `api.d.ts` จาก openapi ที่ดึงมา (เขียนลงโฟลเดอร์ชั่วคราวก่อน)
  - ลบไฟล์เก่าใน `src/contract/` ที่ไม่อยู่ใน `CONTRACT_FILES` ยกเว้น `api.d.ts`
  - `contract.test.ts` ตัดส่วนที่เทียบกับ `server/contract` ออก
- [ ] **Step 4:** ลบไฟล์ใน Delete
  - `ci.yml` ตัด job backend ออก
  - ให้ `on:` เป็น `pull_request` (main) + `schedule` (`cron: "0 0 * * *"` = 07:00 ไทย เพื่อจับ contract หลุดหลัง backend merge) โดยไม่มี push
  - job frontend ตั้งชื่อ `Frontend lint & tests` และเพิ่ม step `npm run contract:sync -- --check`
- [ ] **Step 5: ตัด `COOKIE_SECRET`**
  - ไม่มีโค้ดใน `src/` อ่านค่านี้ (ให้ `grep` ยืนยันก่อน ถ้าเจอว่ามีที่ใช้ให้หยุดแล้วถาม)
  - ลบการเช็กใน `next.config.mjs`, `ARG`/`ENV` ใน `Dockerfile`, env ใน CI และใน `.env.example`
  - `.env.example` เหลือแค่ตัวแปรที่ `src/` อ่านจริง (ใช้ `grep process.env` ใน `src/` เป็นตัวตัดสิน) แล้วลบค่าของ FP28 ออก
- [ ] **Step 6:** แก้ `.dockerignore` ตัดบรรทัดของ Python/`server/` ออก แล้วรันชุดตรวจหน้าร้านให้ผ่าน รวม `npm run contract:sync -- --check` ที่ดึงจาก GitHub จริง
- [ ] **Step 7:** commit `refactor: storefront-only repo, contract pulled from the backend`

### Task 8: production + deploy ของหน้าร้าน

**Files:** Create `compose.yml`, `.github/workflows/deploy.yml` · Delete `docker-compose.yml`, `deploy.sh` · Modify `Dockerfile`, `src/__tests__/workflowGuard.test.ts`

- [ ] **Step 1: เขียนเทส** เพิ่มใน `workflowGuard.test.ts` ว่า build-push ใช้ `platforms: linux/amd64,linux/arm64` และรันแล้วต้อง FAIL
- [ ] **Step 2:** `Dockerfile`
  - ต้องไม่มี ARG หรือ ENV ที่เป็นความลับ
  - ถ้า `next.config.mjs` อ่าน `ORDER_API_BASE_URL` ตอน build ให้ใส่ `ARG ORDER_API_BASE_URL=http://su-store-api:10000` ซึ่งไม่ใช่ความลับ
  - ตรวจว่า `src/` ยังใช้ `/app/data` อยู่ไหม ถ้าไม่ใช้ให้ลบ `mkdir` ออก
- [ ] **Step 3:** `compose.yml`
  - service `su-store-web`: image `ghcr.io/weerapong-gui/su-store-web:${WEB_IMAGE_TAG:?}`, container `su-store-web`, network `su-store-net` (`external: true`), ไม่มี `ports`
  - env: `ORDER_API_BASE_URL=http://su-store-api:10000`, `ORDER_API_TOKEN`, `BYPASS_TOKEN`, `ALWAYS_OPEN`, `STAGING_HOST` (ค่า default เปลี่ยนเป็น `next.sumfu.store` ตามข้อ 4.4 ของ spec) โดยค่าลับอ่านจาก `.env`
  - volume `${SU_STORE_DATA_DIR:?}/next-image-cache:/app/.next/cache/images`
  - healthcheck `/api/health`, `restart: unless-stopped`, logging ตาม Global Constraints
  - ไม่มี `depends_on` เพราะอยู่คนละ compose project
- [ ] **Step 4:** `deploy.yml` ใช้โครงเดียวกับของ backend (Task 4 และ 6) มี job `test` → `image` (`ghcr.io/weerapong-gui/su-store-web`) → `deploy`
  - job deploy คัดลอก `compose.yml` ไปที่ `${SU_STORE_DIR}/frontend/`
  - แล้วรัน `${SU_STORE_DIR}/backend/ops/deploy-service.sh frontend <sha>` (สคริปต์อยู่ฝั่ง backend ที่เดียว ถ้าไม่มีไฟล์ให้ fail พร้อมข้อความว่าต้อง deploy backend ก่อน)
- [ ] **Step 5:** ลบ `docker-compose.yml` กับ `deploy.sh` แล้วรันชุดตรวจ + `actionlint` ให้ผ่าน
- [ ] **Step 6:** commit `feat: storefront image and deploy workflow`

### Task 9: dev ของหน้าร้าน (คำสั่งเดียว)

**Files:** Create `compose.dev.yml` · Modify `dev.sh`, `README.md`, `CLAUDE.md` (ในเครื่อง)

- [ ] **Step 1:** `compose.dev.yml`
  - service `su-store-api-dev`: image `ghcr.io/weerapong-gui/su-store-server:${BACKEND_TAG:-main}`, `pull_policy: always`, `ports: ["127.0.0.1:10000:10000"]`
  - env ชุดเดียวกับ dev ของ backend (Task 3 Step 5)
  - volume `./data/dev:/var/data` และมี healthcheck
- [ ] **Step 2:** `dev.sh` (macOS + Linux)
  - เช็กว่ามี `docker` แบบ Task 3
  - ถ้ายังไม่มี `.env.local` ให้สร้าง โดยใส่ `ORDER_API_BASE_URL=http://127.0.0.1:10000`, `ORDER_API_TOKEN=dev-token`, `BYPASS_TOKEN=dev-bypass`, `ALWAYS_OPEN=1`
  - `npm install` ถ้ายังไม่มี `node_modules`
  - `docker compose -f compose.dev.yml up -d --wait`
  - `trap` สั่ง `docker compose -f compose.dev.yml stop` ตอนออก
  - `npm run dev`
  - รองรับ `BACKEND_TAG=<sha> ./dev.sh` สำหรับใช้ backend จาก branch อื่น (image ของ PR ไม่ได้ build ให้ ต้องเป็น sha ที่อยู่บน `main`) และ `./dev.sh reset`
- [ ] **Step 3:** `README.md` หัวข้อ "เริ่มใช้งานในเครื่อง"
  - ต้องมี Docker Desktop หรือ OrbStack + Node 20
  - `./dev.sh` แล้วเข้า `http://localhost:3000` และ `/admin` ด้วย `staff` / `dev`
  - วิธีใช้ `BACKEND_TAG` และ `CONTRACT_DIR`
  - ตัดคำแนะนำเรื่อง `.venv` ออก
- [ ] **Step 4:** ผู้ควบคุมหรือเจ้าของงานรัน `./dev.sh` บนเครื่องที่มี Docker แล้วต้องเห็นหน้าแรกพร้อมสินค้าตัวอย่าง, login `/admin` ได้ และเห็นออเดอร์ทุกสถานะ (เครื่อง Mac ของเจ้าของงานตอนนี้ไม่มี docker ถ้าไม่มีเครื่องทดสอบให้จดไว้ใน Execution notes แล้วไปต่อ)
- [ ] **Step 5:** commit `feat(dev): one-command storefront dev with the backend image`

### Task 10 [ผู้ควบคุม]: ตั้งค่า GitHub ทั้งสอง repo

ใช้ `gh api` ทุกขั้น และให้เจ้าของงานดูคำสั่งก่อนรัน

- [ ] **Step 1:** push Task 7–9 เข้า `main` ของหน้าร้าน แล้วรอให้ job `image` ของทั้งสอง repo เขียว
- [ ] **Step 2:** ตั้ง package `su-store-server` และ `su-store-web` บน GHCR เป็น public (เจ้าของงานกดใน GitHub UI ที่ Package settings) แล้วตรวจว่า `docker manifest inspect ghcr.io/weerapong-gui/su-store-server:main` เห็นทั้ง `amd64` และ `arm64` (ใช้ `docker buildx imagetools inspect` หรือ API ของ GHCR ถ้าเครื่องไม่มี docker)
- [ ] **Step 3:** ruleset ของ `main` ทั้งสอง repo
  - ห้าม push ตรง (ต้องผ่าน PR)
  - ห้าม force push และห้ามลบ branch
  - required status check: `Backend lint & tests` ใน backend และ `Frontend lint & tests` ในหน้าร้าน
  - หน้าร้าน: `required_approving_review_count: 1` และไม่มี bypass
  - backend: `required_approving_review_count: 1` และใส่ bypass actor เป็น role `admin` แบบ `bypass_mode: pull_request` เพื่อให้เจ้าของงาน merge PR ของตัวเองได้ ส่วน PR จากคนอื่นยังต้องได้ approve
- [ ] **Step 4:** ตั้ง fork PR approval เป็น `all_external_contributors` ผ่าน `PUT /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval` และสร้าง environment `production` ที่ deploy ได้เฉพาะ branch `main` (`deployment_branch_policy` แบบ custom + branch policy `main`)
- [ ] **Step 5:** ยังไม่ตั้ง `DEPLOY_ENABLED` (plan 3 จะตั้ง) ตรวจว่า run ล่าสุดของ `deploy.yml` ทั้งสอง repo มี job `deploy` เป็น skipped ไม่ใช่ queued ค้าง
- [ ] **Step 6:** ลองเปิด PR ทดสอบในหน้าร้าน (แก้ README หนึ่งบรรทัด) แล้วตรวจว่า CI รัน, merge ไม่ได้จนกว่าจะมี approve 1 คน จากนั้นปิด PR

## Execution notes

- **2026-10-21 Task 1–10 เสร็จ:**
  - backend `0bc2ab9…36de579`, หน้าร้าน `c8220f8…931118c`
  - workflow Deploy รอบแรกของทั้งสอง repo: test ✓, image ✓, deploy skipped
  - image ทั้งสองตัวดึงได้โดยไม่ต้อง login มีทั้ง amd64 และ arm64
- **Task 1:** หลัง filter-repo เทส 2 ไฟล์ import แบบ `from server.store` ไว้ จึงแก้เป็น `from store` และให้ ruff เรียง import ใหม่ เพราะ `core`/`store` กลายเป็น first-party
- **Task 3:** `db.create_order()` commit เอง seed จึงแบ่ง commit เป็นหลายช่วงแทนการทำใน transaction เดียว ถ้า seed ค้างครึ่งทางให้ใช้ `./dev.sh reset` · เอา `restart: unless-stopped` ออกจาก compose ของ dev
- **Task 5:** เขียน `deploy-service.sh` ใหม่
  - ใช้ `exec 9>lock; flock -w`
  - เพิ่ม exit `4` = ดึง image ไม่ได้ (นอกแผน)
  - หลัง rollback รอ health ด้วย
  - ลบ tag ไม่ได้ก็ไม่ทำให้ deploy แดง
  - เทสใช้ flock ปลอมที่ lock fd จริง จึงรันบน macOS ได้
  - `PICKUP_PASSWORD` กลับมาเป็นแบบไม่บังคับ
- **Task 7:**
  - `src/` ไม่ได้อ่าน `ORDER_API_TOKEN` จึงไม่ส่งให้หน้าร้าน
  - เพิ่ม timeout 15 วินาทีให้ fetch contract
  - job `Backend lint & tests` ใน `ci.yml` ยังค้างอยู่ ทั้ง Codex และผู้รีวิวพลาด เพราะอ่าน diff แค่ส่วนบน แก้ใน PR #2 แล้ว และเพิ่มเทสใน workflow guard
- **Task 8:** `BYPASS_TOKEN` กลับมาเป็นแบบไม่บังคับ
- **Task 9:** ยังไม่ได้รัน `./dev.sh` จริง เพราะเครื่องเจ้าของงานไม่มี Docker ต้องลองบนเครื่องเพื่อนหรือเครื่องใหม่ (Step 4)
- **Task 10:**
  - หน้าร้านไม่มี bypass จึงต้องให้เพื่อนในทีม approve ทุก PR รวมถึง PR ของเจ้าของงาน
  - ใช้ PR #1 ทดสอบว่า merge ถูกบล็อก แล้วปิดทิ้ง
- **ข้อสังเกต:** `2026-10-2x-plan*-codex-prompt.md` มี path `/Users/park/...` ซึ่งเผยแค่ชื่อ user ของ Mac ไม่ใช่ข้อมูล ops
