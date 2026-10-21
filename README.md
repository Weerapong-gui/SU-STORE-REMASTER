# SU STORE

เว็บร้านค้าขององค์การนักศึกษา มหาวิทยาลัยแม่ฟ้าหลวง ใช้ Next.js 14 เป็น storefront และ Python order-api สำหรับ API/ข้อมูล ร้านใหม่อยู่ใต้ `/v2/` และจัดเก็บข้อมูลในตาราง `store_*`

## เริ่มใช้งานในเครื่อง

```bash
./dev.sh
```

คำสั่งนี้เริ่ม order-api และ Next.js พร้อม DB ทดลองใน `data/dev/` เข้าหลังร้านที่ `http://localhost:3000/admin` ด้วยบัญชี `staff` / `dev` สำหรับข้อมูลตัวอย่างเท่านั้น

## ตรวจสอบ

ต้องมี Python 3.11+ สร้าง `.venv` ครั้งแรกด้วย `python3.11 -m venv .venv && .venv/bin/pip install pytest ruff==0.16.10`

```bash
npm test
npx tsc --noEmit
COOKIE_SECRET=ci-cookie-secret-minimum-32-chars npm run lint  # next.config.mjs ต้องมี COOKIE_SECRET

.venv/bin/ruff check server tests
ORDER_API_DB_PATH=/tmp/su-order-api/orders.db ORDER_API_SLIPS_DIR=/tmp/su-order-api/slips \
  .venv/bin/python -m pytest server/tests/ -v
npm run contract:sync -- --check
```

## หน้าร้านและหลังร้าน

- `/admin` ใช้จัดการสินค้า, หมวดหมู่, ออเดอร์, หน้าแรก, การตั้งค่าร้าน และข้อมูลสลิป
- `/admin/staff` ให้ superadmin เพิ่ม staff, รีเซ็ตรหัสผ่าน, ลบบัญชี และจัดการสิทธิ์ superadmin
- `/check-order` ค้นหาออเดอร์ร้านด้วยเลขออเดอร์และเบอร์โทร
- `/check-order/fp28` redirect ไป `https://fp28.sumfu.store/check-order/fp28` เพื่อรองรับลิงก์เดิม
- สถานะออเดอร์ร้านใหม่: `pending_payment`, `waiting_confirm`, `paid`, `ready`, `completed`, `cancelled` (ดู source ที่ `server/store/db.py`)

## โครงสร้างหลัก

```text
src/                 Next.js storefront, admin, proxy routes และ contract copy
server/core/          HTTP server, config, DB, auth และ public routes
server/store/         business logic และ API ของร้าน
server/contract/      แหล่งความจริงของค่าร่วม, ใบเสร็จ และ OpenAPI
server/tests/         pytest ของ backend
```

## Contract และ API compatibility

`server/contract/` เป็นแหล่งความจริงของค่าที่ใช้ร่วมกัน, receipt template และ OpenAPI ส่วนหน้าร้านเก็บสำเนาใน `src/contract/` เมื่อ backend เปลี่ยน contract ให้รัน `npm run contract:sync` จากนั้นตรวจ diff และ commit สำเนาฝั่งหน้าร้านด้วย

Backend ต้องรองรับหน้าร้านที่ deploy อยู่ปัจจุบันเสมอ เพิ่มของใหม่ได้ แต่จะลบหรือเปลี่ยนความหมายของ field/endpoint ได้ก็ต่อเมื่อหน้าร้านเลิกใช้แล้ว งานที่ต้องแก้สองฝั่งให้ merge backend ก่อน

## Deploy และข้อมูลปฏิบัติการ

production ใช้ Docker Compose และ Cloudflare Tunnel รายละเอียด host, SSH, tunnel, secrets และ path ของข้อมูลจริงเก็บไว้ใน skill `deploy` บนเครื่องเจ้าของงาน ไม่เก็บใน repo

สคริปต์ deploy ใช้ `DEPLOY_HOST` และ `DEPLOY_DIR` จาก environment ส่วน Compose ใช้ `SU_STORE_DATA_DIR` สำหรับ bind mount ข้อมูลจริง ตั้งค่าตาม skill `deploy` ก่อนใช้งาน

ข้อมูล SQLite ที่เปิด WAL ต้องสำรองด้วย `sqlite3 .backup()` ห้ามคัดลอกไฟล์ DB ด้วย `cp` ขณะ API ทำงาน
