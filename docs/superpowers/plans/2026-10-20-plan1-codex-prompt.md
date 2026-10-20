# Prompt สำหรับ Codex: Plan 1

ใช้รันทีละ task เปลี่ยน `<N>` เป็นเลข task (1–9) และต้องรันตามลำดับ เพราะ task หลังใช้ชื่อที่ task ก่อนสร้างไว้

## คำสั่งรัน (จาก Terminal บน Mac)

```bash
cd /Users/park/Projects/SU-STORE-clean
codex exec -C . -s workspace-write -o /tmp/codex-plan1-task<N>.md "$(sed 's/__TASK__/<N>/g' docs/superpowers/plans/2026-10-20-plan1-codex-prompt.md | sed -n '/^---8<---$/,/^--->8---$/p' | sed '1d;$d')" < /dev/null
```

`< /dev/null` จำเป็น ถ้าไม่ใส่ codex จะค้างรอ stdin

## หลัง Codex จบแต่ละ task (คุณทำเอง)

1. อ่านรายงานใน `/tmp/codex-plan1-task<N>.md` ถ้ามีข้อ "หยุดรอเจ้าของงาน" ให้ตอบก่อนไปต่อ
2. รันเทสที่ต้องเปิด socket ซึ่ง Codex รันใน sandbox ไม่ได้ (ไฟล์ที่ใช้ fixture `server` ดูรายชื่อในรายงาน):
   ```bash
   ORDER_API_DB_PATH=/tmp/su-order-api/orders.db ORDER_API_SLIPS_DIR=/tmp/su-order-api/slips \
   ORDER_API_SLIDES_DIR=/tmp/su-order-api/slides ORDER_API_ASSETS_DIR=/tmp/su-order-api/display2_assets \
   .venv/bin/python -m pytest server/tests/ -v && .venv/bin/python -m pytest tests/ -v
   ```
3. ถ้าผ่าน ให้ commit ด้วยข้อความที่แผนกำหนดไว้ใน step สุดท้ายของ task นั้น แล้วลงท้ายด้วย
   ```
   Co-Authored-By: Codex <noreply@openai.com>
   ```
4. ถ้าอยากให้ Claude รีวิว task ที่เพิ่งจบ ให้บอกว่า "รีวิว task <N> ของ plan 1" ก่อนไป task ถัดไป

---8<---
คุณกำลังลงมือทำ Task __TASK__ ของแผน `docs/superpowers/plans/2026-10-20-plan1-prepare-split.md` ใน repo นี้ (SU STORE, Next.js 14 + Python order-api)

อ่านก่อนเริ่ม ตามลำดับนี้:
1. `CLAUDE.md` และ `server/CLAUDE.md` (กฎของ repo โดยเฉพาะข้อ 3 "กฎที่ห้ามพลาด" และ 3.5 "Clean code")
2. แผนทั้งไฟล์ อ่านส่วน Global Constraints, Review Focus และ Task __TASK__ ให้ละเอียด
3. spec ที่แผนอ้างถึง: `docs/superpowers/specs/2026-10-20-repo-split-and-server-move-design.md`
4. task ก่อนหน้าเสร็จและ commit ไปแล้ว ให้ดูโค้ดจริงแทนการเดาจากแผน

กติกา:
- ทำเฉพาะ Task __TASK__ ห้ามทำ task อื่น ห้ามแก้ไฟล์นอกรายการ Files ของ task เว้นแต่จำเป็นจริงๆ ถ้าแก้ ให้บอกในรายงานว่าแก้อะไรและทำไม
- ทำตาม step แบบ TDD: เขียนเทสก่อน → รันให้เห็นว่า fail → เขียนโค้ด → รันให้ผ่าน
- **ห้าม commit และห้ามแตะ `.git`** เพราะ sandbox เขียน `.git` ไม่ได้ เจ้าของงานจะ commit เอง ข้าม step "commit" ไปได้เลย
- sandbox เปิด socket localhost ไม่ได้ เทสที่ใช้ fixture `server` / `_call` (HTTP จริง) ให้เขียนให้ครบแต่ไม่ต้องรัน แล้วบอกชื่อเทสพวกนั้นในรายงาน ส่วนเทสที่ไม่ใช้ socket ต้องรันให้ผ่าน
- ห้ามแก้ไฟล์ snapshot ใน `server/tests/snapshots/` ด้วยมือ เพราะรันเทส snapshot ใน sandbox ไม่ได้ ถ้าคิดว่า snapshot ต้องเปลี่ยน ให้บอกในรายงาน เจ้าของงานจะรัน `UPDATE_SNAPSHOT=1` เอง
- เทสที่เขียนลง DB ตรงๆ ต้องใส่ทุก column ที่เป็น `NOT NULL` (เช่น `site_settings.updated_at`) ดู `CREATE TABLE` ใน `server/core/database.py` ก่อนเขียน
- Python ต้องเป็น 3.11+ ถ้ายังไม่มี `.venv` ให้สร้างด้วย `/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv .venv && .venv/bin/pip install pytest ruff==0.16.10` (`python3` ของระบบเป็น 3.9 ใช้ไม่ได้) ตอนรัน pytest ให้ตั้ง env `ORDER_API_DB_PATH=/tmp/su-order-api/orders.db ORDER_API_SLIPS_DIR=/tmp/su-order-api/slips ORDER_API_SLIDES_DIR=/tmp/su-order-api/slides ORDER_API_ASSETS_DIR=/tmp/su-order-api/display2_assets`
- ถ้าต้องติดตั้ง npm package (Task 8) แล้ว sandbox ออกเน็ตไม่ได้ ให้แก้ `package.json` ไว้ แล้วบอกเจ้าของงานให้รัน `npm install` เอง จากนั้นหยุด
- **หยุดแล้วถามเจ้าของงาน แทนการเดา** ในกรณีต่อไปนี้: gate ของ Task 1, เงื่อนไข "หยุดแล้วถาม" ใน Task 6 Step 3, หรือแผนขัดกับโค้ดจริงจนต้องเปลี่ยนการออกแบบ (ชื่อ interface, route, หรือ schema) ส่วนเรื่องเล็กที่ไม่เปลี่ยนสิ่งที่ส่งมอบ ตัดสินใจเองได้ แต่ต้องบอกในรายงาน
- ห้ามแตะข้อมูลจริง ห้าม SSH ห้าม deploy ห้ามรัน `./deploy.sh`

ก่อนจบต้องรันคำสั่งเหล่านี้ (ตัวไหนรันไม่ได้เพราะ sandbox ให้บอกว่าเพราะอะไร):
- `.venv/bin/ruff check server tests`
- `.venv/bin/python -m pytest server/tests/ -v` และ `.venv/bin/python -m pytest tests/ -v` (เทสที่ fail เพราะเปิด socket ไม่ได้ ไม่นับ)
- `COOKIE_SECRET=ci-cookie-secret-minimum-32-chars npm run lint` (`next.config.mjs` จะ throw ถ้าไม่มี `COOKIE_SECRET`) · `npx tsc --noEmit` · `npm test`

รายงานตอนจบ (ภาษาไทย สั้น):
1. สถานะ: เสร็จ / เสร็จบางส่วน / หยุดรอเจ้าของงาน (ถ้าหยุด ให้บอกคำถามที่ต้องการคำตอบ)
2. ไฟล์ที่สร้าง แก้ และลบ
3. ผลของแต่ละคำสั่งตรวจ (ผ่าน/ไม่ผ่าน พร้อม output สั้นๆ ถ้าไม่ผ่าน)
4. รายชื่อเทสที่ต้องให้เจ้าของงานรันเอง (ใช้ socket)
5. สิ่งที่ตัดสินใจเองหรือทำต่างจากแผน พร้อมเหตุผล
6. ข้อความ commit ที่แนะนำ (เอาจาก step commit ของแผน)
--->8---
