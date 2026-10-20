# แยก repo หน้าร้าน/backend และย้ายร้านใหม่ไปเครื่องเซิร์ฟเวอร์ใหม่

วันที่: 2026-10-20 · สถานะ: ร่าง รออนุมัติ

## 1. เป้าหมายและเหตุผล

ทีมมี 3 คน: เจ้าของ repo ทำ backend คนเดียว อีกสองคนทำหน้าร้าน ตอนนี้ยังไม่มีปัญหาร้ายแรง แต่เริ่มทำงานเป็นทีมมากขึ้น จึงต้องการแบ่งพื้นที่ให้ชัด ให้แต่ละฝั่งทำงาน ทดสอบ และขึ้นเว็บจริงได้เองโดยไม่ชนกัน เป้าหมายหลักคือระบบทำงานได้ไหลลื่น ทั้งสำหรับทีมและสำหรับลูกค้า

งานนี้มี 3 ส่วนที่ทำพร้อมกัน
1. แยก `SU-STORE-clean` (remaster ที่ยังมีทั้ง `src/` และ `server/`) ออกเป็นสอง repo
   - `SU-STORE-clean` (remote `Weerapong-gui/SU-STORE-REMASTER`) เป็นหน้าร้าน Next.js
   - `SU-STORE-SERVER` (remote `Weerapong-gui/SU-STORE-SERVER`) เป็น backend ร้านใหม่ ตอนนี้ยังว่าง
2. ย้ายร้านใหม่ (store v2) พร้อมข้อมูลจริงไปรันบนเครื่องใหม่ แล้วสลับ `sumfu.store` ไปที่นั่น
3. ทำ CI/CD: merge เข้า `main` แล้ว deploy อัตโนมัติ

### ความสำเร็จหน้าตาเป็นแบบนี้
- เพื่อนทีมหน้าร้าน clone repo เดียว รันคำสั่งเดียว ก็ได้หน้าร้านที่ต่อกับ backend ในเครื่อง (Docker) พร้อมข้อมูลตัวอย่าง
- เปิด PR → CI ผ่าน + รีวิว 1 คน → merge → เว็บจริงอัปเดตเอง ไม่มีใครต้อง SSH
- deploy ฝั่งหนึ่งไม่ rebuild อีกฝั่ง ลูกค้าไม่เห็นหน้า "Unable to connect" ระหว่าง deploy
- backend เปลี่ยน API แล้วหน้าร้านรู้ได้จาก CI ไม่ต้องรอให้ใครบอก

### Non-goals
- ไม่ย้าย SQLite ไป Postgres (เครื่องใหม่มี `postgres-db` ของโปรเจกต์อื่นอยู่ ห้ามใช้ร่วม)
- ไม่ย้ายระบบ FP28 ไปเครื่องใหม่
- ไม่ต้องการ zero-downtime ระดับ blue/green ยอมให้ container restart ได้ไม่กี่วินาที
- ไม่เปลี่ยน business logic ของร้าน หรือ schema ของตาราง `store_*`

### Anti-goals (ถึงจะทำงานได้ แต่ถือว่าล้มเหลว)
- ข้อมูลออเดอร์ สลิป หรือใบเสร็จหาย/ซ้ำ ระหว่างย้าย โดยเฉพาะเลขใบเสร็จ `SU-R2569-xxxx` ซ้ำกันข้ามเครื่อง
- กระทบโปรเจกต์อื่นบนเครื่องใหม่ (พอร์ต, network, ดิสก์เต็ม)
- เพื่อนทีมหน้าร้านต้องอ่านหรือแก้โค้ด Python เพื่อทำงานประจำ

## 2. สภาพปัจจุบัน (ตรวจแล้ว 2026-10-20)

**`SU-STORE-clean`:** มี commit ที่ยังไม่ได้ push 5 ตัว (แยก `server/` เป็น `core/` + `store/` + `legacy_fp28/`, จัด `src/lib` ใหม่) · `docker-compose.yml`, `deploy.sh`, `dev.sh`, CI ยังเป็นแบบ repo เดียว · `server/Dockerfile` ใช้ build context เป็น root ของ repo

**backend ร้านใหม่ยังพึ่ง `legacy_fp28/` อยู่:**
- `core/handler.py` dispatch ไปที่ `legacy_fp28.web.routes.ROUTES` สำหรับ path ที่ไม่ใช่ `/v2`
- หน้าร้านยังต้องใช้ route จาก `legacy_fp28/web/routes_public.py` 3 ตัว คือ `GET /health` (healthcheck), `GET /site-status` (สถานะเปิด/ปิดร้าน + นับคนออนไลน์ผ่าน `legacy_fp28/visitors.py`, ใช้ใน `src/middleware.ts`) และ `GET /product-images/<name>`
- `order_api.py` เปิด thread `legacy_fp28.backups.run_scheduled_backup` (backup ตาราง FP28 `orders` ลงใน DB)
- `core/database.py` สร้างตาราง FP28 ทั้งหมด (`orders`, `khantok_*`, `display*` …) และตารางที่ร้านใหม่ใช้ร่วม: `admin_users` (login หลังร้าน), `site_settings` (`site_closed`), `order_audit_log` (`log_audit`), `slip_ocr_results` (OCR สลิปใน `core/slips.py` รันกับสลิปร้านใหม่ด้วย)

**ค่าที่ต้องตรงกันข้ามสองฝั่ง** (ตอนนี้กันหลุดด้วยคอมเมนต์ "keep in sync" อย่างเดียว):
- block types + limits หน้าแรก (`home.py` ↔ `src/components/admin/home/blocks.ts`)
- font ids (`HOME_FONTS` ↔ `src/lib/theme/fonts.ts`), `DEFAULT_RADIUS` ↔ `src/lib/theme/radius.ts`
- `MAX_DESIGN_IMAGES` ↔ `designRows.ts`, จำนวนรูปสินค้า ↔ `ImagesCard.tsx`
- `DEFAULT_LAYOUT` + bounds ของใบเสร็จ (`receipts.py` ↔ `src/lib/receipt/layout.ts`, `editorMath.ts`)
- สถานะที่ออกใบเสร็จได้ ↔ `ReceiptPanel.tsx`, `MAX_CART_LINES` ↔ `MAX_ITEMS_PER_ORDER`
- `src/types/store.ts` (shape ของ response `/v2` เขียนมือ)
- เทสที่อ่านไฟล์ข้ามฝั่ง: `server/tests/test_store_receipts.py:360` อ่าน `layout.ts` และ `src/__tests__/receiptRender.test.ts:7` อ่าน `server/store/templates/receipt_template_v2.svg`

**FP28 ที่ยังค้างในหน้าร้าน:** `src/app/(main)/check-order/fp28`, `src/app/api/check-order`, `src/app/api/order/[orderId]/feedback`, `src/components/legacy-fp28/`

**เครื่องใหม่ `<new-host>`** (เข้าผ่าน Tailscale, รายละเอียดอยู่ใน skill `deploy`):
- Manjaro Linux, 24 core, RAM 15GB, Docker 29.7 + Compose 5.5, `park` อยู่ในกลุ่ม `docker`
- ดิสก์ `/` ใช้ไป 82% เหลือ 30GB
- เป็นเซิร์ฟเวอร์ประจำ รีบูตนานๆ ครั้ง
- ใช้ร่วมกับโปรเจกต์อื่นของ SU: `su-server`, `su-web`, clubfair, stats dashboard, `postgres-db` แต่ละตัวมี container `cloudflared` ของตัวเอง ไม่มี cloudflared แบบ systemd
- พอร์ตบน host ที่ถูกใช้แล้ว: 22, 80 (nginx), 3000, 3001, 3002, 5432, 8080

**เครื่องเก่า `<old-host>`:** รันทั้ง FP28 และร้านใหม่จาก repo `SU-STORE` (ดู `CLAUDE.md` ของ repo นั้น) DB อยู่ที่ `<old-data-dir>/order-api/su-order-api/orders.db`

## 3. การตัดสินใจที่เจ้าของงานเลือกเอง

- แยก repo ตามข้างบน: หน้าร้าน = `SU-STORE-clean`, backend = `SU-STORE-SERVER`
- เครื่องใหม่รันแค่ร้านใหม่ ส่วน FP28 (ใบเสร็จ FP28, claim station, ออเดอร์ `FP28…`) อยู่เครื่องเก่าที่ `admin.sumfu.xyz` ต่อไป
- ย้ายข้อมูลจริงไปเครื่องใหม่ แล้วสลับ `sumfu.store`
- ปิดร้านช่วงดึกระหว่างย้ายได้
- ทุกงานเข้าทาง PR: CI ผ่าน + รีวิว 1 คน → merge → deploy อัตโนมัติ
- เพื่อนทีมหน้าร้านรัน backend ในเครื่องตัวเองผ่าน Docker
- ทั้งสอง repo เป็น **public**
- ทำหน้า "จัดการ staff" ใหม่ใน `sumfu.store/admin` (แทนหน้าของ FP28 ที่ตัดออก)
- **หยุดแก้ repo `SU-STORE` เดิม** ตั้งแต่ 2026-10-20 งานใหม่ทั้งหมดทำใน repo ใหม่ ยกเว้นการบล็อก `/v2` บนเครื่องเก่าตอน cutover (ข้อ 4.6)

## 4. การออกแบบ

### 4.1 Repo backend (`SU-STORE-SERVER`)

- ย้ายเนื้อหา `server/` ของ `SU-STORE-clean` ขึ้นมาเป็น root ของ repo และเก็บประวัติด้วย `git filter-repo --subdirectory-filter server` *(ผู้ออกแบบเลือกเอง)*
- **ตัด `legacy_fp28/` ออก** แต่ย้าย 3 route ที่หน้าร้านยังใช้ (`/health`, `/site-status` + `visitors`, `/product-images`) ไปไว้ใต้ `store/` หรือ `core/` path และ shape ของ response ต้องเหมือนเดิมทุกอย่าง หน้าร้านจะได้ไม่ต้องแก้ ส่วน backup thread ของ FP28 ให้ลบทิ้ง เพราะ backup ใหม่อยู่ข้อ 4.5
  - `/site-status`: ส่ง field ตั้งเวลา/"be right back" ของ FP28 (`scheduleEnabled`, `scheduleClosed`, `scheduleWarning*`, `beRightBack*`) เป็นค่าปิดเสมอ ไม่อ่านจาก `site_settings` ร้านใหม่เปิด/ปิดด้วย `site_closed` อย่างเดียว *(ผู้ออกแบบเลือกเอง: กันไม่ให้ค่าใน DB ที่คัดลอกมาทำให้ร้านปิดตัวเองทุกคืน โดยไม่มีปุ่มให้ปิดตัวตั้งเวลา)* แล้วลบโค้ดหน้าร้านที่ใช้ field พวกนี้ (เช่น `ScheduleWarningBanner`) ในงานเดียวกัน เมื่อหน้าร้านเลิกใช้แล้วค่อยลบ field ตามกฎความเข้ากันได้ข้อ 4.3
- **จัดการ staff (`admin_users`) ย้ายมาอยู่ใต้ `/v2/admin/users*`:** ดูรายชื่อ, เพิ่ม, รีเซ็ตรหัสผ่าน, ลบ, ตั้ง/ถอด superadmin ใช้กฎเดียวกับของ FP28 เดิมใน `legacy_fp28/web/routes_admin.py` (อ่านเป็นต้นแบบก่อนตัดทิ้ง) ทุก action ต้อง `is_superadmin` และ `log_audit` ห้ามลบหรือถอดสิทธิ์ superadmin คนสุดท้าย และห้ามลบบัญชีตัวเอง
- ฟังก์ชัน seed `PICKUP_USERNAME` จาก env ใน `core/database.py` ยังเก็บไว้ เพื่อให้ DB ใหม่ (dev) มีบัญชีแรกเสมอ
- `core/database.py` สร้างเฉพาะตารางที่ร้านใหม่ใช้ ตาราง FP28 ที่ติดมากับ DB ที่คัดลอกมาไม่ต้องลบในงานนี้ ปล่อยไว้เฉยๆ ไม่มีโค้ดไหนอ่านหรือเขียน
- Dockerfile ใช้ context เป็น root ของ repo ใหม่ เก็บ OCR (tesseract) ไว้ เพราะสลิปร้านใหม่ใช้
- route ใดที่ไม่ใช่ของร้านใหม่ หรือ 3 ตัวข้างบน ต้องตอบ 404
- ย้าย `tests/` ที่เกี่ยวข้องมาด้วย เทส FP28 ลบทิ้ง และเทส `test_default_layout_matches_typescript_copy` ให้เปลี่ยนไปใช้ contract ในข้อ 4.3 แทน
- `CLAUDE.md`/`README.md` ของ repo ใหม่: ย้ายส่วนที่เป็นของ backend จาก `CLAUDE.md` เดิมมา (กฎข้อมูลออเดอร์, timezone, เลขใบเสร็จ, clean code ฝั่ง Python) แล้วตัดส่วน FP28 ทิ้ง

### 4.2 Repo หน้าร้าน (`SU-STORE-clean`)

- ลบ `server/`, `tests/` (Python), `ruff.toml`, `.env.order-api.example` และ job backend ใน CI ออก
- ลบหน้าและโค้ด FP28 ที่ค้าง (รายการในข้อ 2) แล้วให้ `/check-order/fp28` redirect 308 ไปที่ `https://fp28.sumfu.store/check-order/fp28` (ดูข้อ 4.6)
- `/check-order` ใช้ค้นออเดอร์ `SU…` ได้อย่างเดียว
- **หน้าใหม่ `/admin/staff`** (อยู่ใน `(panel)` ใช้ `adminFetch`, `Card`/`Field`/`Button`, `useToast`, `useConfirm`) เห็นเมนูเฉพาะ superadmin (`isSuperadmin` จาก `/v2/admin/me`) staff ทั่วไปเปิด URL ตรงๆ จะเจอข้อความว่าไม่มีสิทธิ์ การลบและรีเซ็ตรหัสผ่านต้องกดยืนยันก่อน รหัสผ่านที่รีเซ็ตแสดงครั้งเดียว
- ย้ายงานที่ยังไม่ได้ commit ใน `SU-STORE` เดิม (`src/components/store/DesignPicker.tsx`, `src/lib/storeI18n.ts`, `src/__tests__/designPicker.test.tsx`) มาลงใน repo นี้ก่อนเริ่มงานอื่น เจ้าของงานต้องยืนยันก่อนว่างานนั้นเสร็จแล้วหรือยัง
- เทส `receiptRender.test.ts` เปลี่ยนไปอ่าน template จาก contract (ข้อ 4.3)
- ปรับ `CLAUDE.md`/`README.md` ให้เหลือเฉพาะของหน้าร้าน และบอกวิธีรัน backend ผ่าน Docker

### 4.3 สัญญา API ระหว่างสองฝั่ง (contract)

ต้องมีแหล่งความจริงเดียวอยู่ใน **repo backend** แล้วหน้าร้านถือสำเนาไว้ ถ้าสำเนาหลุดจากต้นฉบับ CI ต้องแดง *(ผู้ออกแบบเลือกเอง รายละเอียดกลไกให้ builder ตัดสิน)*
- เก็บใน `contract/` ของ repo backend:
  - ค่าคงที่ที่ต้องตรงกันทุกตัวในข้อ 2 ในไฟล์ JSON เดียว โดย Python อ่านจากไฟล์นี้แทนการ hardcode
  - `receipt_template_v2.svg`
  - คำอธิบาย endpoint `/v2` ที่หน้าร้านใช้ (OpenAPI หรือ JSON schema) ให้พอ generate หรือเช็ก `src/types/store.ts` ได้
- หน้าร้านมีสคริปต์ดึง `contract/` จาก `main` ของ backend มาไว้ในโฟลเดอร์ของตัวเอง (commit ไว้) และโค้ด TS import ค่าคงที่จากตรงนี้แทนการ hardcode
- CI ของหน้าร้านเทียบสำเนากับ `main` ของ backend ถ้าไม่ตรงให้ fail พร้อมบอกคำสั่งที่ต้องรัน
- CI ของ backend มีเทสยืนยันว่าโค้ด Python ใช้ค่าตรงกับ `contract/`
- **กฎความเข้ากันได้:** backend ต้องรองรับหน้าร้านที่ deploy อยู่ปัจจุบันเสมอ เพิ่มของใหม่ได้ แต่จะลบหรือเปลี่ยนความหมายของ field/endpoint ได้ก็ต่อเมื่อหน้าร้านเลิกใช้แล้ว งานที่ต้องแก้สองฝั่งให้ merge backend ก่อน กฎนี้ต้องเขียนไว้ใน `CLAUDE.md` ของทั้งสอง repo

### 4.4 การรันบนเครื่องใหม่

- โฟลเดอร์บน host: `<deploy-dir>/` แยกเป็น `frontend/`, `backend/` และ `data/` (DB, `slips/`, `product-images/`, `next-image-cache/`, `backups/`) *(ผู้ออกแบบเลือกเอง)*
- docker network แบบ external ชื่อ `su-store-net` สร้างครั้งเดียว ทั้งสอง compose project join เข้ามา
- **repo backend ถือโครงสร้างพื้นฐาน:** compose ของ backend มี `su-store-api` + `su-store-cloudflared` (tunnel ใหม่ของ zone `sumfu.store` ชี้ `sumfu.store`, `www.sumfu.store` และ `next.sumfu.store` สำหรับซ้อม ไปที่ `http://su-store-web:3000`) + งาน backup
- compose ของหน้าร้านมีแค่ `su-store-web` ต่อ backend ที่ `http://su-store-api:10000`
- **ไม่ publish พอร์ตออก host เลย** เพื่อไม่ให้ชนกับโปรเจกต์อื่น ถ้าจะ debug ให้ใช้ `docker exec` หรือ publish ผูกกับ `127.0.0.1` บนพอร์ตที่ว่างจริง (ตรวจก่อน)
- backend ไม่มี subdomain สาธารณะ เพราะ browser เข้าผ่าน proxy ของ Next.js อยู่แล้ว (`/api/store`, `/api/admin/v2`)
- ทุก container ตั้ง `restart: unless-stopped` มี healthcheck และตั้ง log rotation (`max-size`) เพราะดิสก์เหลือน้อย
- ชื่อ container/network/volume ทุกตัวขึ้นต้นด้วย `su-store-` เพื่อไม่ชนกับโปรเจกต์อื่น
- `.env` แยกต่อ repo อยู่บน host เท่านั้น ใช้ `ORDER_API_TOKEN` ค่าเดียวกันทั้งสองฝั่ง

### 4.5 Backup

- ทุกวันเวลา 04:00 (เวลาไทย): `sqlite3 .backup()` ของ `orders.db` ลง `data/backups/` เก็บไว้ 14 วัน *(ผู้ออกแบบเลือกเอง)*
- ส่งสำเนา backup + สลิป + รูปสินค้าไปเครื่องเก่าผ่าน Tailscale ด้วย `rsync` (แบบเพิ่มอย่างเดียว ไม่ลบฝั่งปลายทาง)
- ถ้า backup หรือ rsync ล้มเหลว ต้องเห็นได้ (อย่างน้อยเป็น log + exit code ที่ตรวจได้ วิธีแจ้งเตือนให้ builder เลือก)

### 4.6 FP28 บนเครื่องเก่าหลังสลับ

- เครื่องเก่ายังรัน order-api ตัวเดิมที่ `admin.sumfu.xyz` สำหรับ FP28
- container `su-store` (Next.js เดิม) บนเครื่องเก่ายังเปิดอยู่ แต่ย้ายไปใช้ hostname `fp28.sumfu.store` (เพิ่มใน tunnel `cloudflared-store`) เพื่อให้หน้า `/check-order/fp28` ใช้ได้ ส่วน `sumfu.store` / `www` ย้ายไปอยู่ tunnel ใหม่ *(ผู้ออกแบบเลือกเอง)*
- กันไม่ให้ร้านใหม่บนเครื่องเก่าถูกใช้ต่อ: บล็อกคำขอ `/v2/` ทั้งหมดบน order-api เครื่องเก่าให้ตอบ 410 ด้วย commit เดียวใน repo `SU-STORE` (deploy ด้วย `./deploy.sh api`) เป็นข้อยกเว้นเดียวของการหยุดแก้ repo เดิม
- บล็อก `/v2` แล้วค่อยตั้ง `site_closed=0` บนเครื่องเก่า เพื่อเปิด `fp28.sumfu.store` กลับมา
- redirect ด้วย Cloudflare Redirect Rule (ไม่ต้องแก้โค้ดเก่า): บน `fp28.sumfu.store` ทุก path ยกเว้น `/check-order/fp28*`, `/api/check-order*`, `/_next/*` และไฟล์ static ให้ redirect 302 ไป path เดียวกันบน `https://sumfu.store` รวมถึง `/` ด้วย *(ผู้ออกแบบเลือกเอง)*

### 4.7 CI/CD

- **CI (lint/type/test):** รันบน GitHub-hosted runner ทุก PR และทุก push เข้า `main` ตามชุดคำสั่งเดิมของแต่ละฝั่ง (`ruff` + pytest / `tsc` + lint + vitest)
- **branch protection บน `main` ทั้งสอง repo:** ต้องผ่าน CI ห้าม push ตรง ส่วนเรื่อง approve ดูหัวข้อ "การอนุมัติ PR" ด้านล่าง
- **Deploy:** ใช้ GitHub Actions self-hosted runner บนเครื่องใหม่ (หนึ่ง runner ต่อ repo หรือ runner เดียวที่ลงทะเบียนทั้งสอง repo) รันเฉพาะ job deploy ที่ trigger จาก push เข้า `main` หลัง CI ผ่าน **ห้ามให้ PR รันบน self-hosted runner** เพราะ repo เป็น public คนนอกเปิด PR จาก fork ได้ และเครื่องนี้ใช้ร่วมกับโปรเจกต์ SU อื่น ต้องทำครบทุกข้อ:
  - job ที่ใช้ `runs-on: self-hosted` มีเฉพาะใน workflow ที่ trigger ด้วย `push` เข้า `main` หรือ `workflow_dispatch` เท่านั้น ห้ามใช้ `pull_request_target`
  - ตั้ง Actions ให้ "Require approval for all outside collaborators" สำหรับ workflow จาก fork
  - ใช้ GitHub Environment `production` ที่จำกัดให้ deploy ได้จาก `main` เท่านั้น
  - runner รันด้วย user แยกที่ไม่ใช่ `park` อยู่ในกลุ่ม `docker` แต่เข้าถึงไฟล์นอก `<deploy-dir>/` ไม่ได้ *(ผู้ออกแบบเลือกเอง)*
- **ห้ามมีความลับใน repo, ใน image, หรือใน log ของ Actions** image backend บน GHCR เป็น public (เพื่อนดึงได้โดยไม่ต้อง login) จึงห้ามมี secret ตอน build ส่วน `.env` อยู่บน host เท่านั้น
- **ข้อมูล ops ไม่อยู่ใน repo public:** IP ของเครื่อง (Tailscale/LAN), tunnel ID, path ของข้อมูลจริง และวิธี SSH เก็บใน skill `deploy` ของเจ้าของงานที่ `~/.claude/` บนเครื่องตัวเอง ใน `CLAUDE.md`/`README.md` ของ repo เขียนได้แค่ภาพรวม *(ผู้ออกแบบเลือกเอง)* · เอกสารนี้มี IP อยู่ ให้ย้ายส่วนนั้นออกก่อน push
- **การอนุมัติ PR:** repo หน้าร้านบังคับ CI ผ่าน + approve 1 คน ส่วน repo backend บังคับ CI ผ่าน และให้เจ้าของงาน merge ได้โดยไม่ต้องรอ approve เพราะ GitHub ไม่ให้ approve PR ของตัวเอง แต่ถ้า PR backend มาจากคนอื่นต้องให้เจ้าของงาน approve *(ผู้ออกแบบเลือกเอง เพราะคำถามนี้ยังไม่ได้คำตอบ)*
- ขั้นตอน deploy:
  1. build image ติด tag เป็น git sha (เว็บเก่ายังรันอยู่ระหว่าง build)
  2. `up -d` service ของ repo นั้นตัวเดียว
  3. รอ healthcheck
  4. ถ้าไม่ healthy ใน ~90 วินาที ให้ย้อนไปใช้ image tag ก่อนหน้าแล้ว fail job
  5. เขียน `REVISION`
  6. เก็บ image ของ repo นั้นไว้ 3 tag ล่าสุด ลบที่เหลือ (ลบเฉพาะ image `su-store-*` ห้าม `docker system prune` เพราะเครื่องนี้ใช้ร่วมกับโปรเจกต์อื่น)
- deploy ของสอง repo ต้องไม่รันซ้อนกัน (ใช้ `concurrency` group)
- ต้องยังสั่ง deploy เองได้ (`workflow_dispatch`) และสั่ง rollback ไป sha ที่ระบุได้
- **image สำหรับ dev:** CI ของ backend push image ขึ้น GHCR (`ghcr.io/weerapong-gui/su-store-server`) ทุกครั้งที่ merge เข้า `main`

### 4.8 Dev ในเครื่องของทีมหน้าร้าน

- repo หน้าร้านมี compose สำหรับ dev ที่ดึง backend image จาก GHCR และใช้ DB ทดลองใน `data/dev/` พร้อม seed ข้อมูลตัวอย่าง (สินค้าแบบไซซ์/สี, สินค้าหลายลาย, หมวดหมู่, หน้าแรก, ออเดอร์ตัวอย่างหลายสถานะ) และบัญชี `staff` / `dev` เหมือน `dev.sh` เดิม
- คำสั่งเดียวเปิดทั้ง backend (Docker) + `next dev` บนเครื่อง ใช้ได้ทั้ง macOS และ Linux
- ถ้าเพื่อนอยากใช้ backend จาก branch ที่ยังไม่ merge ให้ตั้ง env ชี้ไปที่ image tag อื่นได้
- repo backend ก็มีวิธีรันแบบเดียวกัน (ไม่มีหน้าร้าน) สำหรับเจ้าของงาน

### 4.9 วันสลับเครื่อง (cutover)

**ซ้อม (ร้านเปิดปกติที่เครื่องเก่า):**
1. ตั้งทั้งสองฝั่งบนเครื่องใหม่ด้วย DB ที่คัดลอกจาก `sqlite3 .backup()` ของเครื่องเก่า + สลิป + รูปสินค้า
2. เปิดผ่าน `next.sumfu.store` แล้วเช็ก: สินค้า/หมวด/หน้าแรกแสดงครบ, ออเดอร์เก่าเปิดดูได้พร้อมสลิป, login หลังร้านได้, ใบเสร็จเดิมพิมพ์ซ้ำได้
3. ห้ามออกใบเสร็จหรือสร้างออเดอร์จริงตอนซ้อม เพราะ DB จะถูกเขียนทับในคืนจริงอยู่แล้ว แต่เลขที่ออกตอนซ้อมไม่ถูกนับ
4. เขียน script ของคืนจริงให้ซ้อมได้ครบทุกขั้น

**คืนจริง (ช่วงดึก ใช้เวลาไม่เกิน ~30 นาที):**
1. ปิดร้านที่เครื่องเก่า (`site_closed`) แล้วรอให้ไม่มีคำขอเขียนค้าง
2. `sqlite3 .backup()` บนเครื่องเก่า → คัดลอก DB + สลิปเฉพาะของออเดอร์ `SU…` (ดึงรายการ path จาก `store_orders` ใน DB ที่ backup แล้ว) + รูปสินค้าไปเครื่องใหม่ สลิป FP28 ไม่ต้องย้าย *(ผู้ออกแบบเลือกเอง)* · ส่วนสลิปเก่ากับรูปสินค้า rsync ล่วงหน้าไว้ตั้งแต่ตอนซ้อม คืนจริงส่งแค่ส่วนที่เพิ่มขึ้น จะได้จบใน ~30 นาที
3. ตรวจ: จำนวนแถว `store_orders`, `store_order_items`, `store_receipts`, `admin_users`, ค่า `store_counters` ต้องตรงกันสองฝั่ง และสลิปทุกไฟล์ที่ `store_orders` อ้างถึงต้องมีอยู่จริงบนเครื่องใหม่ ถ้าไม่ตรงให้หยุดและเปิดร้านที่เครื่องเก่าเหมือนเดิม
   - DB เก็บ path สลิปเป็น path เต็มใน container (`core/slips.py`) container ใหม่จึงต้อง mount ข้อมูลที่ `/var/data/su-order-api/...` เหมือนเครื่องเก่า โครงสร้างโฟลเดอร์บน host จะเป็นแบบไหนก็ได้
4. เริ่ม backend ใหม่บน DB จริง และตรวจผ่าน `next.sumfu.store`
5. ย้าย hostname `sumfu.store` + `www` ไป tunnel ใหม่ เพิ่ม `fp28.sumfu.store` ให้ tunnel เก่า และตั้ง Redirect Rule (ข้อ 4.6) ขั้นนี้เป็น checklist ที่คนกดใน Cloudflare dashboard เอง ส่วนขั้นอื่นเป็น script *(ผู้ออกแบบเลือกเอง ถ้าเจ้าของงานให้ API token ของ zone `sumfu.store` ค่อยทำเป็น script)* แล้ว deploy การบล็อก `/v2` บนเครื่องเก่า และตั้ง `site_closed=0` ที่เครื่องเก่า
6. เปิดร้านที่เครื่องใหม่ แล้วลองสั่งซื้อจริงหนึ่งออเดอร์ (ยกเลิกทีหลัง)

**ถอยกลับ:** ภายในคืนนั้น ถ้ามีปัญหาให้ย้าย hostname กลับ tunnel เก่าและยกเลิกการบล็อก `/v2` เครื่องเก่ายังมีข้อมูลครบ แต่หลังเปิดร้านที่เครื่องใหม่แล้ว จะถอยกลับไม่ได้ถ้าไม่ย้ายออเดอร์ใหม่ย้อนกลับไปด้วย ซึ่งไม่ได้อยู่ในขอบเขตงานนี้

## 5. ลำดับงาน (ข้อเสนอ)

1. push 5 commit ที่ค้างของ `SU-STORE-clean` และย้ายงานที่ยังไม่ได้ commit จาก `SU-STORE` เดิมเข้ามา
2. ทำ contract, หน้าจัดการ staff และตัด `legacy_fp28` ให้เสร็จใน `SU-STORE-clean` ขณะที่ยังเป็น repo เดียว (เทสทุกตัวยังผ่าน)
3. แยก repo
4. ทำ compose/CI/CD/dev ของแต่ละ repo
5. ตั้งเครื่องใหม่ → ซ้อม → คืนจริง
6. ปรับเครื่องเก่า (`fp28.sumfu.store`, บล็อก `/v2`)

ฟีเจอร์ "ยกเลิกออเดอร์ที่ไม่จ่ายอัตโนมัติ" (spec + plan ใน `SU-STORE/docs/superpowers/specs/2026-10-16-unpaid-order-expiry.md`) **ไม่อยู่ในงานนี้** ให้คัดลอก spec/plan มาไว้ที่ repo backend แล้วทำเป็นงานแยกหลัง cutover โดยต้องปรับ path ให้ตรงกับโครงสร้างใหม่ *(ผู้ออกแบบเลือกเอง)*

## 6. ที่เหลือให้ builder ตัดสิน

- กลไกการ sync และเทียบ contract (git submodule, ดึงจาก raw GitHub ด้วย token, หรือ package) ขอแค่ให้ได้ผลตามข้อ 4.3
- จะ generate `src/types/store.ts` จาก schema หรือแค่เช็กว่าตรงกัน
- runner ตัวเดียวหรือสองตัว และวิธี rollback แบบละเอียด
- วิธีแจ้งเตือนเมื่อ backup/deploy ล้มเหลว
- รูปแบบ seed data
