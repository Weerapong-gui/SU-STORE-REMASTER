# SU STORE

[English](README.md) · **ภาษาไทย**

เว็บร้านค้าขององค์การนักศึกษา มหาวิทยาลัยแม่ฟ้าหลวง ([sumfu.store](https://sumfu.store)) repo นี้คือหน้าร้าน Next.js 14 และหลังร้านสำหรับ staff (`/admin`) ส่วนข้อมูลและ API มาจาก Python order-api ใน repo [SU-STORE-SERVER](https://github.com/Weerapong-gui/SU-STORE-SERVER) ซึ่งให้บริการ API ร้านใต้ `/v2/` และเก็บข้อมูลในตาราง `store_*`

## รันในเครื่อง

ต้องมี Docker Desktop หรือ OrbStack และ Node.js 20

```bash
./dev.sh
```

สคริปต์จะดึง image ของ order-api จาก GHCR มาเปิดด้วย Docker Compose กับฐานข้อมูลตัวอย่างใน `data/dev/` แล้วเริ่ม Next.js

- หน้าร้าน: `http://localhost:3000`
- หลังร้าน: `http://localhost:3000/admin` login ด้วย `staff` / `dev` (ใช้ได้กับข้อมูลตัวอย่างเท่านั้น)

ตัวเลือก:

- `BACKEND_TAG=<sha> ./dev.sh` เลือก image ของ backend (ต้องเป็น image ที่เผยแพร่บน GHCR แล้ว เช่น tag จาก `main`)
- `./dev.sh reset` ลบฐานข้อมูลตัวอย่างแล้วเริ่มใหม่ สคริปต์จะถามยืนยันก่อน

## ตรวจสอบ

```bash
npm test
npx tsc --noEmit
npm run lint
CONTRACT_DIR=../SU-STORE-SERVER/contract npm run contract:sync -- --check
```

## หน้าร้านและหลังร้าน

- `/admin` จัดการสินค้า หมวดหมู่ ออเดอร์ หน้าแรก การตั้งค่าร้าน และสลิป
- `/admin/staff` ให้ superadmin เพิ่ม staff รีเซ็ตรหัสผ่าน ลบบัญชี และให้หรือถอดสิทธิ์ superadmin
- `/check-order` ค้นออเดอร์ร้านด้วยเลขออเดอร์และเบอร์โทร
- `/check-order/fp28` redirect ไป `https://fp28.sumfu.store/check-order/fp28` เพื่อให้ลิงก์เดิมยังใช้ได้
- สถานะออเดอร์: `pending_payment`, `waiting_confirm`, `paid`, `ready`, `completed`, `cancelled` (ดูที่ `store/db.py` ของ repo backend)

## โครงสร้าง

```text
src/        หน้าร้าน หลังร้าน proxy routes และสำเนา contract
scripts/    เครื่องมือ sync contract จาก backend
public/     ไฟล์ static และฟอนต์
```

## Contract และความเข้ากันได้ของ API

`contract/` ของ repo backend เป็นแหล่งความจริงของค่าที่ใช้ร่วมกัน template ใบเสร็จ และ OpenAPI ส่วน repo นี้เก็บสำเนาไว้ใน `src/contract/` เมื่อ backend เปลี่ยน contract ให้รัน `npm run contract:sync` ตรวจ diff แล้ว commit สำเนา CI จะ fail ถ้าสำเนาไม่ตรงกับ `main` ของ backend

backend ต้องรองรับหน้าร้านที่ deploy อยู่ปัจจุบันเสมอ เพิ่มของใหม่ได้ แต่จะลบหรือเปลี่ยนความหมายของ field/endpoint ได้ก็ต่อเมื่อหน้าร้านเลิกใช้แล้ว งานที่ต้องแก้สองฝั่งให้ merge backend ก่อน

## Deploy

merge เข้า `main` = deploy ขึ้น production

1. ทุก pull request ต้องผ่าน CI (lint, type check, test)
2. หลัง review แล้ว merge เข้า `main`
3. `.github/workflows/deploy.yml` build image multi-arch ขึ้น GHCR (tag เป็น commit SHA) แล้ว deploy บนเครื่อง production ถ้า container ใหม่ไม่ผ่าน health check ระบบจะถอยกลับเป็นเวอร์ชันเดิมเอง

ถอยกลับเวอร์ชันเก่า: `gh workflow run deploy.yml -f sha=<commit sha>`

production รันด้วย Docker Compose ผ่าน Cloudflare Tunnel รายละเอียดเครื่อง secret และ path ข้อมูลจริงไม่เก็บใน repo public นี้

ฐานข้อมูล SQLite เปิด WAL อยู่ ต้องสำรองด้วย `sqlite3 .backup()` ห้ามคัดลอกไฟล์ด้วย `cp` ขณะ API ทำงาน
