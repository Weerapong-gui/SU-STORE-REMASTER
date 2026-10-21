# SU STORE

เว็บร้านค้าขององค์การนักศึกษา มหาวิทยาลัยแม่ฟ้าหลวง ใช้ Next.js 14 เป็น storefront และเชื่อม Python order-api จาก repo [SU-STORE-SERVER](https://github.com/Weerapong-gui/SU-STORE-SERVER) สำหรับ API/ข้อมูล ร้านใหม่อยู่ใต้ `/v2/` และจัดเก็บข้อมูลในตาราง `store_*`

## เริ่มใช้งานในเครื่อง

ต้องติดตั้ง Docker Desktop หรือ OrbStack และ Node.js 20 ก่อน

```bash
./dev.sh
```

สคริปต์ดึง order-api image จาก GHCR มาเปิดด้วย Docker Compose ใช้ฐานข้อมูลตัวอย่างใน `data/dev/` แล้วเริ่ม Next.js เข้าหน้าร้านที่ `http://localhost:3000` และเข้าหลังร้านที่ `http://localhost:3000/admin` ด้วยบัญชี `staff` / `dev` สำหรับข้อมูลตัวอย่างเท่านั้น

เลือก tag ของ backend ได้ด้วย `BACKEND_TAG=<sha> ./dev.sh` (ต้องเป็น image ที่เผยแพร่บน GHCR เช่น tag จาก `main`) และตรวจ contract จาก checkout ในเครื่องได้ด้วย `CONTRACT_DIR=../SU-STORE-SERVER/contract npm run contract:sync -- --check`.
ใช้ `./dev.sh reset` เพื่อลบฐานข้อมูลตัวอย่างและเริ่มใหม่ โดยสคริปต์จะถามยืนยันก่อน

## ตรวจสอบ

```bash
npm test
npx tsc --noEmit
npm run lint
CONTRACT_DIR=../SU-STORE-SERVER/contract npm run contract:sync -- --check
```

## หน้าร้านและหลังร้าน

- `/admin` ใช้จัดการสินค้า, หมวดหมู่, ออเดอร์, หน้าแรก, การตั้งค่าร้าน และข้อมูลสลิป
- `/admin/staff` ให้ superadmin เพิ่ม staff, รีเซ็ตรหัสผ่าน, ลบบัญชี และจัดการสิทธิ์ superadmin
- `/check-order` ค้นหาออเดอร์ร้านด้วยเลขออเดอร์และเบอร์โทร
- `/check-order/fp28` redirect ไป `https://fp28.sumfu.store/check-order/fp28` เพื่อรองรับลิงก์เดิม
- สถานะออเดอร์ร้านใหม่: `pending_payment`, `waiting_confirm`, `paid`, `ready`, `completed`, `cancelled` (ดู source ที่ `store/db.py` ของ repo backend)

## โครงสร้างหลัก

```text
src/                 Next.js storefront, admin, proxy routes และ contract copy
scripts/             เครื่องมือ sync contract จาก backend
```

## Contract และ API compatibility

`contract/` ของ repo backend เป็นแหล่งความจริงสำหรับค่าที่ใช้ร่วมกัน, receipt template และ OpenAPI ส่วนหน้าร้านเก็บสำเนาใน `src/contract/` เมื่อ backend เปลี่ยน contract ให้รัน `npm run contract:sync` จากนั้นตรวจ diff และ commit สำเนาฝั่งหน้าร้านด้วย

Backend ต้องรองรับหน้าร้านที่ deploy อยู่ปัจจุบันเสมอ เพิ่มของใหม่ได้ แต่จะลบหรือเปลี่ยนความหมายของ field/endpoint ได้ก็ต่อเมื่อหน้าร้านเลิกใช้แล้ว งานที่ต้องแก้สองฝั่งให้ merge backend ก่อน

## Deploy และข้อมูลปฏิบัติการ

production ใช้ Docker Compose และ Cloudflare Tunnel รายละเอียด host, SSH, tunnel, secrets และ path ของข้อมูลจริงเก็บไว้ใน skill `deploy` บนเครื่องเจ้าของงาน ไม่เก็บใน repo

สคริปต์ deploy ใช้ `DEPLOY_HOST` และ `DEPLOY_DIR` จาก environment ส่วน Compose ใช้ `SU_STORE_DATA_DIR` สำหรับ bind mount ข้อมูลจริง ตั้งค่าตาม skill `deploy` ก่อนใช้งาน

ข้อมูล SQLite ที่เปิด WAL ต้องสำรองด้วย `sqlite3 .backup()` ห้ามคัดลอกไฟล์ DB ด้วย `cp` ขณะ API ทำงาน

<!-- ruleset check: PR นี้ปิดทิ้ง ไม่ merge -->
