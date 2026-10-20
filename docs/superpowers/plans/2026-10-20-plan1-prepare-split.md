# Plan 1: เตรียมโค้ดก่อนแยก repo (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ใน `SU-STORE-clean` (ยังเป็น repo เดียว) ตัด FP28 ออกจากทั้งสองฝั่ง เพิ่มการจัดการ staff ใน `/v2/admin` + `/admin/staff` และทำ `server/contract/` ให้เป็นแหล่งความจริงเดียวของค่าที่ต้องตรงกันข้ามฝั่ง โดยเทสทุกตัวผ่าน พร้อมแยก repo ในแผน 2

**Architecture:** route สาธารณะ 3 ตัวที่ร้านใหม่ยังใช้ย้ายจาก `legacy_fp28/` ไป `core/public_routes.py` แล้วลบ `legacy_fp28/` ทั้งโฟลเดอร์ การจัดการ staff ใช้รูปแบบเดียวกับใบเสร็จ คือ logic อยู่ใน `store/staff.py` ส่วน route อยู่ใน `store/staff_routes.py` contract เป็นไฟล์ JSON/SVG ใน `server/contract/` Python อ่านค่าตอน import ส่วนหน้าร้านถือสำเนาไว้ที่ `src/contract/` (sync ด้วยสคริปต์ และมีเทสเทียบ)

**Tech Stack:** Python 3.13 (stdlib HTTP server, sqlite3, pytest, ruff 0.16.10) · Next.js 14 App Router, TypeScript, vitest · `openapi-typescript` (devDependency ใหม่)

**Spec:** `docs/superpowers/specs/2026-10-20-repo-split-and-server-move-design.md` (ข้อ 4.1, 4.2, 4.3) แผน 2 (แยก repo, CI/CD, dev) และแผน 3 (เครื่องใหม่, cutover) จะเขียนหลังแผนนี้เสร็จ

## Global Constraints

- ห้ามเปลี่ยน schema หรือ SQL ที่เขียนตาราง `store_*` (spec: "ไม่เปลี่ยน business logic ของร้าน หรือ schema ของตาราง `store_*`")
- shape ของ response `/health`, `/site-status`, `/product-images/<name>` ต้องเหมือนเดิม (ชื่อ field ครบ) แต่ field ตั้งเวลา/"be right back" เป็นค่าปิดเสมอ
- ห้ามลบตาราง FP28 ออกจาก DB ที่มีอยู่ (ไม่ `DROP`) แค่เลิกสร้างและเลิกใช้
- ข้อความที่ผู้ใช้เห็นเป็นภาษาไทย ชื่อในโค้ดเป็นภาษาอังกฤษ server error ใช้ `StoreError(status, ข้อความไทย)`
- หน้า admin ใช้ `adminFetch`, `Card`/`Field`/`Button`, `useToast`, `useConfirm` ห้ามใช้ `window.confirm`/`alert` และห้าม `any`
- ฟังก์ชัน Python ใหม่ต้องมี type hint
- ก่อนปิดแต่ละ task ต้องรันผ่าน: `ruff check server tests` · `npm run lint` · `npx tsc --noEmit` · `npm test` · `python3 -m pytest server/tests/` (env ตาม `.github/workflows/ci.yml`)
- ทุก commit ลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **DB จริงที่คัดลอกมามี `schedule_enabled=1` หรือ `be_right_back_active=1`:** `/site-status` ต้องตอบ `scheduleClosed:false`, `beRightBack:false` เสมอ ไม่ว่าเป็นเวลาไหน → เทสใน Task 2
2. **username ที่มีภาษาไทยหรือช่องว่าง (บัญชีเก่าที่สร้างจาก FP28):** route `/v2/admin/users/<username>` ต้อง percent-decode แล้วหาเจอ → เทสใน Task 3
3. **รีเซ็ตรหัสหรือลบ staff แล้ว token เดิมต้องใช้ไม่ได้ทันที** (`/v2/admin/me` ตอบ 401) → เทสใน Task 3
4. **superadmin สองคนถอดสิทธิ์กันพร้อมกัน** จนไม่เหลือ superadmin: การเช็ก "คนสุดท้าย" ต้องอยู่ใน `BEGIN IMMEDIATE` เดียวกับการเขียน → เทสใน Task 3
5. **เปิด backend ใหม่บน DB ที่มีตาราง FP28 อยู่แล้ว** (สำเนาจาก production): `ensure_db()` ต้องไม่พัง และไม่แตะตาราง FP28 → เทสใน Task 6

---

### Task 1: ย้ายงานที่ยังไม่ได้ commit จาก `SU-STORE` เดิม

**Gate:** ถามเจ้าของงานก่อนว่างาน `DesignPicker` ใน `/Users/park/Projects/SU-STORE` เสร็จแล้วหรือยัง ถ้ายังไม่เสร็จ ให้ข้าม task นี้และบันทึกไว้ใน `## Execution notes` ท้ายแผน

**Files:**
- Modify: `src/components/store/DesignPicker.tsx`, `src/__tests__/designPicker.test.tsx`, ไฟล์ข้อความ i18n ของร้าน (เดิมคือ `src/lib/storeI18n.ts` ซึ่งใน remaster ย้ายไปอยู่ใต้ `src/lib/i18n/` ให้หาจาก `useStoreText`)

- [ ] **Step 1:** `PATCH=$(mktemp) && git -C /Users/park/Projects/SU-STORE diff -- src/ > "$PATCH"` แล้ว apply ด้วย `git apply --3way "$PATCH"` ถ้า path ของ i18n ไม่ตรง ให้แก้ path ใน patch เอง ห้าม apply ทับทั้งไฟล์
- [ ] **Step 2:** `npm test -- designPicker` ต้องผ่าน (รวมเทสใหม่ 5 บรรทัดที่ติดมากับ patch)
- [ ] **Step 3:** commit `feat(store): port pending DesignPicker change from SU-STORE`

---

### Task 2: ย้าย route สาธารณะที่ร้านใหม่ใช้ไปไว้ใน `core/`

**Files:**
- Create: `server/core/public_routes.py`
- Move: `server/legacy_fp28/visitors.py` → `server/core/visitors.py` (เนื้อหาเดิม)
- Modify: `server/core/handler.py` (`_dispatch`)
- Modify: `server/tests/test_visitors.py` (import path)
- Create: `server/tests/test_public_routes.py`

**Interfaces:**
- Produces: `core.public_routes.route(handler: OrderRequestHandler, method: str, path: str) -> bool` คืน `True` ถ้าเป็น route ของตัวเอง (รูปแบบเดียวกับ `store.receipt_routes.route`)
- Produces: `core.visitors.visitor_key`, `record_visit`, `active_count` (signature เดิม)

- [ ] **Step 1: เขียนเทสที่ยัง fail** ใน `server/tests/test_public_routes.py` ใช้ fixture HTTP `server` และ `_call` จาก `test_store_v2.py`

```python
def test_site_status_ignores_fp28_schedule(server):
    # DB copied from production may still carry FP28 schedule flags.
    _set_settings(schedule_enabled="1", be_right_back_active="1",
                  be_right_back_dates=today_bangkok(), site_closed="0")
    body = _call(server, "GET", "/site-status?vid=" + str(uuid4()))[1]
    assert body == {
        "siteClosed": False, "scheduleEnabled": False, "scheduleClosed": False,
        "scheduleWarning": False, "scheduleWarningMessage": "", "activeVisitors": 1,
        "beRightBack": False,
    }

def test_site_status_reports_site_closed(server):
    _set_settings(site_closed="1")
    assert _call(server, "GET", "/site-status")[1]["siteClosed"] is True

def test_health(server):
    assert _call(server, "GET", "/health") == (200, {"status": "ok"})

def test_product_image_rejects_path_tricks(server):
    assert _call(server, "GET", "/product-images/..%2Fdb")[0] == 400
    assert _call(server, "GET", "/product-images/missing.jpg")[0] == 404
```

(`_set_settings` และ `today_bangkok` เป็น helper ในไฟล์เทสนี้: upsert ลง `site_settings` / `datetime.now(TZ_BANGKOK).strftime("%Y-%m-%d")`)

- [ ] **Step 2:** `python3 -m pytest server/tests/test_public_routes.py -v` ต้อง FAIL (`test_site_status_ignores_fp28_schedule` ได้ค่าจาก FP28)
- [ ] **Step 3:** เขียน `core/public_routes.py` ที่มี `/health`, `/site-status` และ `/product-images/<name>` ยก logic ของ `/health` กับ `/product-images` มาจาก `legacy_fp28/web/routes_public.py` (ทั้ง safe filename, mime map และ `Cache-Control`) ส่วน `/site-status` อ่าน `site_closed` อย่างเดียว ส่วน field schedule ให้ตอบเป็นค่าคงที่: `scheduleEnabled/scheduleClosed/scheduleWarning/beRightBack = False`, `scheduleWarningMessage = ""` ใส่คอมเมนต์อธิบายเหตุผลตาม spec ข้อ 4.1 และย้าย `visitors.py` ไป `core/`
- [ ] **Step 4:** ใน `_dispatch` เรียก `public_routes.route(...)` ก่อน loop `ROUTES` แล้วลบ 3 route นั้นออกจาก `legacy_fp28/web/routes.py` (ลบ handler ใน `routes_public.py` ด้วย)
- [ ] **Step 5:** รันเทสใหม่ + `test_visitors.py` + `test_fp28_routes_snapshot.py` ต้องผ่าน ถ้า snapshot ของ FP28 route list เปลี่ยน ให้อัปเดต snapshot เฉพาะ 3 route ที่ย้ายออก
- [ ] **Step 6:** commit `refactor(server): serve health, site-status and product images from core`

---

### Task 3: API จัดการ staff (`/v2/admin/users*`)

**Files:**
- Create: `server/store/staff.py`, `server/store/staff_routes.py`
- Modify: `server/store/api.py` (เรียก `staff_routes.route` ต่อจาก `receipt_routes.route`)
- Create: `server/tests/test_store_staff.py`

**Interfaces:**
- Produces (`store/staff.py`, ทุกฟังก์ชันรับ `conn: sqlite3.Connection` และ commit เอง):
  - `list_staff(conn) -> list[StaffMember]` เรียง superadmin ก่อน แล้วตาม `created_at`
  - `create_staff(conn, username: str, created_by: str) -> tuple[StaffMember, str]` คืน (สมาชิก, รหัสผ่านที่สุ่มให้)
  - `reset_password(conn, username: str) -> str` คืนรหัสผ่านใหม่
  - `set_superadmin(conn, username: str, value: bool, actor: str) -> StaffMember`
  - `delete_staff(conn, username: str, actor: str) -> None`
  - `StaffMember = TypedDict(username: str, isSuperadmin: bool, createdBy: str, createdAt: str)`
- Produces (HTTP): `GET /v2/admin/users` → `{"users": [StaffMember]}` · `POST /v2/admin/users` `{username}` → `{"user": StaffMember, "password": str}` · `POST /v2/admin/users/<u>/reset-password` → `{"password": str}` · `PATCH /v2/admin/users/<u>` `{isSuperadmin: bool}` → `StaffMember` · `DELETE /v2/admin/users/<u>` → `{"ok": true}`

**กติกา (ค่าที่ต้องใช้ตามนี้):**
- ทุก route ต้อง `require_superadmin(handler)` และเขียน `log_audit(conn, "-", "v2_staff_<action>", f"{username} by {actor}")` โดย action เป็น `created`/`password_reset`/`superadmin_on`/`superadmin_off`/`deleted`
- username ใหม่: `^[A-Za-z0-9._-]{1,64}$` ถ้าไม่ผ่านให้ตอบ 400 "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z A-Z 0-9 . _ - ไม่เกิน 64 ตัว" ถ้าซ้ำตอบ 409 "ชื่อผู้ใช้นี้มีอยู่แล้ว" บัญชีเก่าที่ชื่อไม่ตรงรูปแบบยังจัดการได้ตามปกติ (ใน URL ให้ percent-decode ด้วย `urllib.parse.unquote`)
- รหัสผ่านสุ่ม: 12 ตัว จาก `secrets.choice` บนตัวอักษร `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789` (ตัด 0/O/1/l/I ที่สับสนง่ายออก)
- `claim_token = compute_claim_token(username, password)` · `super_token` ให้ตั้งเป็น `compute_super_token(...)` เฉพาะตอนรีเซ็ตรหัสของ superadmin และเป็น `NULL` ในกรณีอื่น (ร้านใหม่ไม่ได้ใช้ ใส่ไว้แค่ให้ column มีค่าตรงกัน)
- ห้ามลบตัวเอง (403 "ลบบัญชีตัวเองไม่ได้") ห้ามลบหรือถอดสิทธิ์ superadmin คนสุดท้าย (409 "ต้องเหลือผู้ดูแลระบบหลักอย่างน้อย 1 คน") การนับกับการเขียนต้องอยู่ใน `BEGIN IMMEDIATE` เดียวกัน
- ไม่พบผู้ใช้ตอบ 404 "ไม่พบผู้ใช้นี้"

- [ ] **Step 1: เขียนเทสที่ยัง fail** (ใช้ `_conn`, `server`, `_call` จาก `test_store_v2.py` ส่วน helper `_login(server, username, password) -> token` เรียก `/v2/admin/login`)

```python
def test_create_returns_password_once_and_it_logs_in(server): ...
    # POST → 200, len(password) == 12; login with it → 200; GET list has no password/token keys
def test_non_superadmin_gets_403(server): ...            # every route
def test_reset_password_invalidates_old_session(server): ...
    # old token → /v2/admin/me 401; new password logs in
def test_delete_invalidates_session_and_blocks_self(server): ...
def test_last_superadmin_cannot_be_demoted_or_deleted(): ...  # 409 for both
def test_concurrent_demotion_keeps_one_superadmin(tmp_path): ...
    # two superadmins demote each other in threads → exactly one succeeds, count == 1
def test_legacy_thai_username_is_reachable(server): ...
    # seed "สตาฟ หนึ่ง" directly; DELETE /v2/admin/users/%E0%B8%AA... → 200
def test_username_rules(): ...   # "a b" → 400, 65 chars → 400, duplicate → 409
def test_actions_are_audited(): ...  # order_audit_log has v2_staff_created etc.
```

- [ ] **Step 2:** `python3 -m pytest server/tests/test_store_staff.py -v` ต้อง FAIL ทุกตัว (404)
- [ ] **Step 3:** เขียน `store/staff.py` แล้วเขียน `store/staff_routes.py` (handler อ่าน request → เรียก `staff` → ส่ง response ห้ามเขียน SQL ใน route) จากนั้นต่อเข้ากับ `api.py`
- [ ] **Step 4:** เทสใน Step 1 ผ่านทั้งหมด และ `test_store_v2.py` ยังผ่าน
- [ ] **Step 5:** commit `feat(store): staff management under /v2/admin/users`

---

### Task 4: หน้า `/admin/staff`

**Files:**
- Modify: `src/types/store.ts` (เพิ่ม `StaffMember = { username: string; isSuperadmin: boolean; createdBy: string; createdAt: string }`)
- Create: `src/app/admin/(panel)/staff/page.tsx`, `src/components/admin/staff/StaffWorkspace.tsx`, `src/components/admin/staff/PasswordReveal.tsx`
- Modify: `src/components/admin/AdminNav.tsx` (เพิ่ม `{ href: "/admin/staff", label: "จัดการ staff" }` แสดงเมื่อ `/v2/admin/me` ตอบ `isSuperadmin: true` เท่านั้น)
- Create: `src/__tests__/staffWorkspace.test.tsx`

**Interfaces:**
- Consumes: HTTP ของ Task 3 ผ่าน `adminFetch`

**พฤติกรรม:**
- ตารางแสดงชื่อผู้ใช้, ป้าย "ผู้ดูแลระบบหลัก", สร้างโดย, วันที่สร้าง (แสดงเวลาไทยตามกฎ timezone)
- ฟอร์มเพิ่ม staff มีแค่ช่องชื่อผู้ใช้ กดแล้ว `PasswordReveal` แสดงรหัสผ่าน พร้อมปุ่ม "คัดลอก" และข้อความ "รหัสนี้จะแสดงครั้งเดียว จดหรือส่งให้เจ้าของบัญชีตอนนี้" ปิดแล้วเปิดดูอีกไม่ได้
- ปุ่ม "รีเซ็ตรหัสผ่าน", "ลบ" และ "ตั้ง/ถอดผู้ดูแลระบบหลัก" ต้องผ่าน `useConfirm()` ก่อนทุกปุ่ม ส่วน error ของ server ให้แสดงข้อความไทยผ่าน `useToast`
- ไม่ใช่ superadmin: หน้าแสดง `Card` "เฉพาะผู้ดูแลระบบหลักเท่านั้น" และไม่เรียก `/v2/admin/users`

- [ ] **Step 1: เขียนเทสที่ยัง fail** (mock `adminFetch`):
  `renders_users_with_superadmin_badge` · `create_shows_password_once` (ปิด dialog แล้วข้อความรหัสหายจาก DOM) · `delete_asks_for_confirmation_first` (ยังไม่กดยืนยัน = ไม่เรียก DELETE) · `non_superadmin_sees_notice_and_no_request`
- [ ] **Step 2:** `npm test -- staffWorkspace` ต้อง FAIL
- [ ] **Step 3:** เขียน component และหน้า แล้วเพิ่มเมนูใน nav
- [ ] **Step 4:** `npm test` · `npx tsc --noEmit` · `npm run lint` ต้องผ่าน
- [ ] **Step 5:** commit `feat(admin): staff management page`

---

### Task 5: ตัด FP28 ออกจากหน้าร้าน

**Files (ลบ):** `src/app/(main)/check-order/fp28/`, `src/app/api/check-order/`, `src/app/api/order/`, `src/components/legacy-fp28/`, `src/components/layout/ScheduleWarningBanner.tsx` รวมถึงเทส, key คำแปล และ CSS ที่ใช้เฉพาะของพวกนี้
**Files (แก้):** `next.config.mjs`, `src/middleware.ts`, `src/app/(fullscreen)/maintenance/page.tsx` + `MaintenanceClient.tsx`, `src/app/api/site-status/route.ts`, `src/components/store/StoreShell.tsx`, `src/components/store/TrackOrder.tsx`, `src/components/store/OrderView.tsx`, `src/components/layout/Navbar.tsx`, `src/components/admin/AdminNav.tsx` (ลบ `LEGACY_ADMIN_URL`), `src/__tests__/languageProvider.test.tsx`

- [ ] **Step 1: เขียนเทสที่ยัง fail** ใน `src/__tests__/middlewareLocale.test.ts` (หรือไฟล์ใหม่ `middlewareSiteStatus.test.ts` ใช้ `middlewareHarness`): ถ้า fake `/site-status` ตอบ `{siteClosed:false, scheduleClosed:true, beRightBack:true}` หน้า `/products` ต้องไม่ถูก rewrite ไป `/maintenance` เพราะร้านใหม่ใช้ `siteClosed` อย่างเดียว
- [ ] **Step 2:** รันแล้วต้อง FAIL
- [ ] **Step 3:** middleware กับหน้า maintenance ให้ดูแค่ `siteClosed` (ลบ reason `schedule`/`beRightBack` และข้อความของสองอันนั้น) แล้วลบ `ScheduleWarningBanner` ออกจาก `StoreShell`
- [ ] **Step 4:** ลบไฟล์ FP28 ตามรายการ จากนั้นเพิ่ม `redirects()` ใน `next.config.mjs`: `{ source: "/check-order/fp28", destination: "https://fp28.sumfu.store/check-order/fp28", permanent: true }` และอีกตัวสำหรับ `/th/check-order/fp28` เพราะ locale อยู่ใน path ตาม `src/lib/locale.ts` จากนั้น `grep -rn "fp28\|FP28\|check-order\b" src` ต้องเหลือแค่ redirect กับคอมเมนต์ที่อธิบาย redirect
- [ ] **Step 5:** `TrackOrder`/`OrderView`/`Navbar`: ลบลิงก์หรือ branch ที่พาไป FP28 ให้ `/check-order` ค้นได้แค่เลข `SU…` + เบอร์โทร
- [ ] **Step 6:** `npm test` · `npx tsc --noEmit` · `npm run lint` ต้องผ่าน
- [ ] **Step 7:** commit `refactor(store): drop FP28 pages and schedule closing from the storefront`

---

### Task 6: ตัด `legacy_fp28/` ออกจาก backend

**Files:**
- Delete: `server/legacy_fp28/`, `server/tests/test_display2.py`, `test_khantok_claim.py`, `test_fp28_routes_snapshot.py`, `server/tests/snapshots/` (ถ้าใช้เฉพาะ FP28), และใน `test_order_api.py` / `test_order_api_critical.py` / `tests/` ให้ลบเทสที่ทดสอบ FP28 ส่วนที่ทดสอบ `core/` ให้เก็บไว้
- Modify: `server/order_api.py` (ลบ backup thread), `server/core/handler.py` (ลบ `ROUTES` เหลือ `/v2/` → `store_api`, `public_routes` และ 404 JSON `{"message": "not found"}`, ลบ `has_superadmin_authorization` กับ helper ของ FP28 ที่ไม่มีใครใช้), `server/core/database.py` (`ensure_db` สร้างแค่ `admin_users`, `site_settings`, `order_audit_log`, `slip_ocr_results` แล้วเรียก `store_db.ensure_store_db` เลิก seed `products`), `server/core/config.py` (ลบค่า FP28: `ORDER_PREFIX`, `ORDER_ROUND`, khantok, Google Sheets, `DEFAULT_PRODUCTS`, `ORDER_STATUSES`, `PAYMENT_STATUS_BY_ORDER_STATUS`, `SLIDES_DIR`, `ASSETS_DIR`, `STATION_BY_SLUG` ฯลฯ ที่ grep แล้วไม่มีใครใช้), `server/tests/test_module_layout.py` (ลบ `legacy_fp28` จาก `_sources` และ `SWAPPABLE`), `server/Dockerfile` (ลบ `COPY server/legacy_fp28/`), `docker-compose.yml` + `.github/workflows/ci.yml` (ลบ env ของ FP28)
- Create: `server/tests/test_fp28_removed.py`

- [ ] **Step 1: เขียนเทสที่ยัง fail** ใน `test_fp28_removed.py`

```python
def test_fp28_paths_are_gone(server):
    for method, path in [("GET", "/admin"), ("GET", "/orders"), ("GET", "/claim-station"),
                         ("GET", "/check-order?studentCode=6931"), ("POST", "/orders"), ("GET", "/")]:
        assert _call(server, method, path) == (404, {"message": "not found"})

def test_ensure_db_on_copied_production_db(tmp_path):
    # Build a DB with the FP28 tables + a row, as production has, then run ensure_db.
    # It must not raise, must keep the FP28 row, and must create store_* tables.

def test_no_fp28_package():
    assert not (SERVER / "legacy_fp28").exists()
```

ตอนสร้างตาราง FP28 ใน `test_ensure_db_on_copied_production_db` ให้คัด `CREATE TABLE orders ...` ชุดเดิมจาก `core/database.py` ก่อนลบมาไว้ในไฟล์เทส เพราะเป็น fixture ที่แทนสภาพ DB จริง

- [ ] **Step 2:** รันแล้วต้อง FAIL
- [ ] **Step 3:** ลบและแก้ไฟล์ตามรายการ ถ้า `store/db.py`, `dashboard.py` หรือ `api.py` ยังอ่านตาราง `orders`/`products` ของ FP28 อยู่ ให้หยุดแล้วถามเจ้าของงาน ห้ามเดา (grep `\borders\b` กับ `\bproducts\b` ในบริบท SQL)
- [ ] **Step 4:** `ruff check server tests` + `python3 -m pytest server/tests/ tests/` ต้องผ่าน และ `docker build -f server/Dockerfile .` ต้อง build ได้
- [ ] **Step 5:** commit `refactor(server): remove legacy FP28 package`

---

### Task 7: contract ค่าคงที่และ template ใบเสร็จ

**Files:**
- Create: `server/contract/store-contract.json`, `server/store/contract.py`
- Move: `server/store/templates/receipt_template_v2.svg` → `server/contract/receipt_template_v2.svg`
- Modify: `server/store/home.py`, `designs.py`, `db.py`, `receipts.py`, `receipt_routes.py` (path ของ SVG), `server/Dockerfile` (`COPY server/contract/ ./contract/`)
- Create: `scripts/sync-contract.mjs`, `src/contract/` (สำเนาที่ commit ไว้), `src/__tests__/contract.test.ts`
- Modify (TS อ่านจาก `@/contract/store-contract.json` แทน hardcode): `src/components/admin/home/blocks.ts`, `src/lib/theme/fonts.ts` (เช็ก id ตรงกับ `homeFonts`), `src/lib/theme/radius.ts`, `src/components/admin/product/designRows.ts`, `src/components/admin/product/ImagesCard.tsx`, `src/components/admin/receipt/ReceiptPanel.tsx`, `src/lib/receipt/layout.ts`, `src/lib/receipt/editorMath.ts`, `src/components/store/CartProvider.tsx`, `src/__tests__/receiptRender.test.ts` (อ่าน SVG จาก `src/contract/`)
- Modify: `package.json` (`"contract:sync": "node scripts/sync-contract.mjs"`)
- Modify: `server/tests/test_store_receipts.py` (แทน `test_default_layout_matches_typescript_copy` ด้วยเทสในไฟล์ใหม่ `server/tests/test_contract.py`)

**Interfaces:**
- Produces: `store-contract.json` keys (camelCase):
  `homeBlockTypes: string[]`, `maxHomeBlocks`, `maxHeroSlides`, `maxFeatured`, `maxHomeCategories`, `homeFonts: string[]`, `defaultRadius`, `maxDesignImages`, `maxDesignCodeLength`, `maxProductImages`, `maxItemsPerOrder`, `maxQtyPerItem`, `receiptIssuableStatuses: string[]`, `receiptViewBox: {width, height}`, `receiptLayoutMax`, `receiptFontSizeMin`, `receiptFontSizeMax`, `receiptDefaultLayout` (เนื้อหาเดียวกับ `DEFAULT_LAYOUT` ปัจจุบัน)
  ค่าเริ่มต้นต้องเป็นค่าปัจจุบันในโค้ด (เช่น `maxHomeBlocks: 20`, `maxProductImages: 10`, `defaultRadius: 100`, `receiptViewBox: {812.98, 597.12}`) ตัวไหนไม่แน่ใจให้ grep หาค่าจริงก่อน
- Produces: `store.contract.CONTRACT: dict[str, Any]` และ `store.contract.RECEIPT_TEMPLATE_PATH: Path` โมดูล Python ตั้งค่าคงที่เดิม (`MAX_HOME_BLOCKS` ฯลฯ) จาก `CONTRACT` เพื่อให้โค้ดที่ใช้อยู่ไม่ต้องแก้
- Produces: `scripts/sync-contract.mjs` มีตัวแปร `CONTRACT_SOURCE` ที่ตอนนี้ชี้ `server/contract` แผน 2 จะเปลี่ยนให้ดึงจาก GitHub คัดลอกไฟล์ทุกตัวไป `src/contract/` และมีโหมด `--check` ที่ exit 1 พร้อมพิมพ์ "contract ไม่ตรงกับ backend: รัน npm run contract:sync" เมื่อไฟล์ต่างกัน

- [ ] **Step 1: เขียนเทสที่ยัง fail**
  - `server/tests/test_contract.py`: `test_python_constants_match_contract` (assert ทุกค่าคงที่ของ Python ทีละตัว เช่น `home.MAX_HOME_BLOCKS == CONTRACT["maxHomeBlocks"]`, `receipts.DEFAULT_LAYOUT == CONTRACT["receiptDefaultLayout"]`) · `test_receipt_template_served_from_contract` (GET `/v2/admin/receipt-template` ได้ bytes เท่ากับไฟล์ใน `contract/`)
  - `src/__tests__/contract.test.ts`: `src/contract` ตรงกับ `server/contract` ทุกไฟล์ (byte ต่อ byte เทสข้ามถ้าไม่มี `server/contract` แผน 2 จะย้ายไปเช็กใน CI) · `DEFAULT_LAYOUT` ใน `layout.ts` เท่ากับ `receiptDefaultLayout` · `STORE_FONTS` id ชุดเดียวกับ `homeFonts`
- [ ] **Step 2:** รันแล้วต้อง FAIL
- [ ] **Step 3:** สร้าง JSON + `contract.py` แล้วให้โมดูล Python อ่านจาก `CONTRACT` จากนั้นย้าย SVG
- [ ] **Step 4:** เขียน `sync-contract.mjs` รัน `npm run contract:sync` แล้วเปลี่ยน TS ให้ import จาก `@/contract/store-contract.json` และลบคอมเมนต์ "keep in sync" / "Mirrors …" ที่ไม่จำเป็นแล้วทั้งสองฝั่ง
- [ ] **Step 5:** ตรวจครบทั้ง 5 คำสั่งใน Global Constraints แล้วรัน `npm run contract:sync -- --check` ต้อง exit 0
- [ ] **Step 6:** commit `feat: single source contract for cross-side constants`

---

### Task 8: contract ของ endpoint (`openapi.json`) และ type ที่ generate

**Files:**
- Create: `server/contract/openapi.json` (OpenAPI 3.1)
- Create: `server/tests/schema_check.py`, `server/tests/test_contract_openapi.py`
- Modify: `package.json` (devDependency `openapi-typescript` pin version ที่ปล่อยมาแล้วอย่างน้อย 2 สัปดาห์ และให้ `contract:sync` generate `src/contract/api.d.ts` ต่อท้าย)
- Modify: `src/types/store.ts` (payload type เปลี่ยนเป็น alias ของ `components["schemas"][...]`)

**Interfaces:**
- Consumes: `src/contract/` + `sync-contract.mjs` จาก Task 7
- Produces: `components.schemas` ชื่อตรงกับ type ใน `src/types/store.ts` ทุกตัว (`StoreCategory`, `StoreVariant`, `StoreProduct`, `StoreOrderItem`, `StoreOrder`, `StoreMeta`, `StoreSettings`, `Dashboard`, `HeroSlide`, `HomeBlock`, `HomeLayout`, `ResolvedHome`, `HomeAdminState`, `ReceiptLayout`, `StoreReceipt`, `IssuedReceipt`, `ReceiptSettings`, `ReceiptPage`, `StaffMember`, …) แปลจาก TS ตรงตัว รวม union และ nullable
- Produces: `paths` ครบทุก `/v2/*` ที่ `src/` เรียก (grep `ORDER_API_BASE}/v2`, `/api/store/`, `/api/admin/v2/`) ใส่ method และ response schema ส่วน request body ใส่เฉพาะ endpoint ที่รับ JSON
- Produces: `schema_check.assert_matches(payload: Any, schema: dict, spec: dict) -> None` รองรับ `type` (รวม list ที่มี `"null"`), `properties`, `required`, `items`, `enum`, `$ref`, `oneOf`, `additionalProperties: false` ถ้าไม่ตรงให้ raise `AssertionError` พร้อม JSON path

- [ ] **Step 1: เขียนเทสที่ยัง fail** ใน `test_contract_openapi.py`: สร้างข้อมูลด้วย helper ของ `test_store_v2.py` (สินค้าแบบ options + แบบ designs, หมวด, ออเดอร์ทุกสถานะ, ใบเสร็จ 1 ใบ, staff 1 คน) แล้วเรียกทุก GET path ใน `openapi.json` ที่ไม่ต้องใช้ input พิเศษ ตรวจว่า response ตรงกับ schema ด้วย `assert_matches` และมีเทส `test_every_documented_path_is_routable` ที่ทุก path/method ใน spec ต้องไม่ตอบ 404 "not found"
- [ ] **Step 2:** รันแล้วต้อง FAIL (ยังไม่มี `openapi.json`)
- [ ] **Step 3:** เขียน `openapi.json` และ `schema_check.py`
- [ ] **Step 4:** `python3 -m pytest server/tests/test_contract_openapi.py -v` ต้องผ่าน ถ้า schema ไม่ตรงกับ response จริง ให้แก้ schema ห้ามแก้ API
- [ ] **Step 5:** `npm run contract:sync` แล้วเปลี่ยน `store.ts` เป็น alias จากนั้น `npx tsc --noEmit` ต้องผ่าน ถ้า tsc เจอว่า type ไม่ตรงกับที่โค้ดใช้อยู่ ให้แก้ schema ให้ตรงความจริงของ API ไม่ใช่ใส่ cast
- [ ] **Step 6:** ตรวจครบ 5 คำสั่ง แล้ว commit `feat: OpenAPI contract for /v2 with generated storefront types`

---

### Task 9: เอกสาร

**Files:** `CLAUDE.md`, `server/CLAUDE.md`, `README.md`

- [ ] **Step 1:** ลบส่วนของ FP28 (บัตรขันโตก, slug/category ของ FP28, order statuses ของ FP28, display, claim station) ออก แล้วเพิ่ม: `server/contract/` คือแหล่งความจริงและวิธี `npm run contract:sync`, กฎความเข้ากันได้ของ API (spec ข้อ 4.3 คัดตามคำ), หน้า `/admin/staff`, `/check-order/fp28` redirect ไป `fp28.sumfu.store`
- [ ] **Step 2:** ห้ามใส่ IP, tunnel ID หรือ path ของข้อมูลจริงในไฟล์ที่ commit (repo จะเป็น public) ถ้ามีอยู่ใน `CLAUDE.md`/`README.md`/`server/CLAUDE.md`/spec ให้ลบออก และย้ายไปบอกเจ้าของงานให้เก็บใน skill `deploy` ที่ `~/.claude/` บนเครื่องตัวเองแทน
- [ ] **Step 3:** `git grep -nE "100\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.|/home/[p]ark"` ต้องไม่เจออะไรเลยในไฟล์ที่ git track อยู่
- [ ] **Step 4:** commit `docs: storefront and backend guides after removing FP28`

## Execution notes

(ผู้ลงมือบันทึกสิ่งที่ข้ามหรือเจอระหว่างทำไว้ตรงนี้)
