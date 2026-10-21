# Prompt สำหรับ Codex: Plan 2

ใช้กับ Task 2–9 ของ `2026-10-21-plan2-split-ci-dev.md` รันทีละ task ตามลำดับ ส่วน Task 1 และ 10 ผู้ควบคุมทำเอง เพราะต้อง push และเรียก GitHub API

- Task 2–6 ทำใน repo backend `/Users/park/Projects/SU-STORE-SERVER`
- Task 7–9 ทำใน repo หน้าร้าน `/Users/park/Projects/SU-STORE-clean`

## คำสั่งรัน (Terminal บน Mac)

เปลี่ยน `N` เป็นเลข task และ `REPO` ตามตารางข้างบน

```bash
N=2; REPO=/Users/park/Projects/SU-STORE-SERVER
PROMPT=/Users/park/Projects/SU-STORE-clean/docs/superpowers/plans/2026-10-21-plan2-codex-prompt.md
cd "$REPO" && codex exec -C . -s workspace-write -o /tmp/codex-plan2-task$N.md \
  "$(sed "s/__TASK__/$N/g" "$PROMPT" | sed -n '/^---8<---$/,/^--->8---$/p' | sed '1d;$d')" < /dev/null
```

`< /dev/null` จำเป็น ไม่งั้น codex จะค้างรอ stdin

## หลัง Codex จบแต่ละ task

1. อ่าน `/tmp/codex-plan2-task<N>.md` ถ้ารายงานว่า "หยุดรอเจ้าของงาน" ให้ตอบก่อน
2. รันเทส HTTP ที่ sandbox รันไม่ได้ ตามคำสั่งตรวจของ repo นั้นด้านล่าง
3. commit ด้วยข้อความจาก step commit ของแผน ต่อท้ายด้วย `Co-Authored-By: Codex <noreply@openai.com>`
4. ถ้าอยากให้ Claude รีวิว ให้บอกว่า "รีวิว task <N> ของ plan 2"

---8<---
คุณกำลังลงมือทำ Task __TASK__ ของแผน `/Users/park/Projects/SU-STORE-clean/docs/superpowers/plans/2026-10-21-plan2-split-ci-dev.md`

ตอนนี้งานแยกเป็นสอง repo แล้ว (Task 1 เสร็จแล้ว):
- backend: `/Users/park/Projects/SU-STORE-SERVER` เป็น Python order-api โดย root = `server/` เดิม มีโฟลเดอร์ `core/`, `store/`, `contract/`, `tests/`
- หน้าร้าน: `/Users/park/Projects/SU-STORE-clean` เป็น Next.js 14 ตอนนี้ยังมี `server/` ค้างอยู่ จะลบใน Task 7

ทำงานใน repo ที่ task นี้กำหนด (Task 2–6 = backend, Task 7–9 = หน้าร้าน) อีก repo อ่านได้อย่างเดียว ห้ามแก้

อ่านก่อนเริ่ม ตามลำดับนี้:
1. `CLAUDE.md` ของ repo ที่ทำงาน (ถูก gitignore ไว้ แต่มีอยู่ในเครื่อง) และ `/Users/park/Projects/SU-STORE-clean/CLAUDE.md` หัวข้อ 3.5 Clean code
2. แผนทั้งไฟล์ อ่านส่วน "สิ่งที่ผู้วางแผนเลือกเอง", Global Constraints, Review Focus และ Task __TASK__ ให้ละเอียด
3. spec `/Users/park/Projects/SU-STORE-clean/docs/superpowers/specs/2026-10-20-repo-split-and-server-move-design.md` ข้อที่ task อ้างถึง
4. task ก่อนหน้า commit แล้ว ให้ดูโค้ดจริงแทนการเดาจากแผน

กติกา:
- ทำเฉพาะ Task __TASK__ ห้ามแก้ไฟล์นอกรายการ Files เว้นแต่จำเป็นจริงๆ ถ้าแก้ ให้บอกในรายงานว่าแก้อะไรและทำไม
- ทำแบบ TDD: เขียนเทสก่อน → รันให้เห็นว่า fail → เขียนโค้ด → รันให้ผ่าน
- **ห้าม commit, ห้าม push, ห้ามแตะ `.git` และห้ามเรียก GitHub API** ข้าม step commit/push ไปได้เลย เจ้าของงานจะทำเอง
- sandbox **เปิด socket localhost ไม่ได้ และออกเน็ตไม่ได้**:
  - เทสที่ใช้ fixture `server`/`_call` ให้เขียนให้ครบแต่ไม่ต้องรัน และใส่ชื่อเทสพวกนี้ไว้ในรายงาน
  - เทส HTTP ใน backend ให้ import fixture ด้วย `from .test_store_v2 import _call, server  # noqa: F401 (import pytest fixture)` fixture นี้ seed `staff1`/`pw` ไว้เป็น staff ธรรมดา ไม่ใช่ superadmin และใช้ token กลาง `Bearer test-token` ได้
  - คำสั่งที่ต้องใช้เน็ต (`docker pull`, `npm install`, ดึง contract จาก GitHub) ให้ใช้ทางเลือกที่ไม่ต้องใช้เน็ตแทน แล้วบอกในรายงาน
  - ใน Task 7 ให้ตรวจด้วย `CONTRACT_DIR=/Users/park/Projects/SU-STORE-SERVER/contract`
- ติดตั้งไว้ให้แล้ว ไม่ต้องติดตั้งเพิ่ม: `.venv` ของ backend (Python 3.11, pytest, ruff 0.16.10, pyyaml 6.0.2), `yaml@2.6.1` ในหน้าร้าน, `actionlint` (`/opt/homebrew/bin/actionlint`), `openapi-typescript` · เครื่องนี้ไม่มี `docker` ขั้นที่ต้องใช้ docker ให้ข้ามแล้วบอกในรายงาน
- ห้ามแก้ไฟล์ snapshot ด้วยมือ · เทสที่เขียนลง DB ตรงๆ ต้องใส่ทุก column ที่เป็น `NOT NULL`
- shell script ต้องใช้ได้ทั้ง macOS (bash 3.2, BSD tools) และ Linux · ห้ามใช้ flag ที่มีแต่ GNU (เช่น `sed -i` ที่ไม่มี argument, `readlink -f`, `date -d`)
- workflow ของ GitHub Actions ต้องผ่าน `actionlint` และเทส workflow guard
- repo เป็น public: ห้ามใส่ IP, tunnel ID, path ข้อมูลจริง หรือ secret ในไฟล์ใดๆ
- **หยุดแล้วถามเจ้าของงาน แทนการเดา** เมื่อเจอกรณี "หยุดแล้วถาม" ที่แผนระบุไว้ หรือเมื่อแผนขัดกับโค้ดจริงจนต้องเปลี่ยนการออกแบบ (ชื่อ interface, ชื่อไฟล์/service/image, exit code, trigger ของ workflow) ส่วนเรื่องเล็กที่ไม่เปลี่ยนสิ่งที่ส่งมอบ ตัดสินใจเองได้แต่ต้องบอกในรายงาน
- ห้ามแตะข้อมูลจริง ห้าม SSH ห้าม deploy

ก่อนจบต้องรันคำสั่งตรวจของ repo ที่ทำงาน (ตัวไหนรันไม่ได้เพราะ sandbox ให้บอกเหตุผล):
- backend: `.venv/bin/ruff check .` · `ORDER_API_DB_PATH=/tmp/su-order-api/orders.db ORDER_API_SLIPS_DIR=/tmp/su-order-api/slips .venv/bin/python -m pytest tests/ -v` · ถ้ามี workflow ให้รัน `actionlint` ด้วย
- หน้าร้าน: `npm run lint` · `npx tsc --noEmit` · `npm test` · `CONTRACT_DIR=/Users/park/Projects/SU-STORE-SERVER/contract npm run contract:sync -- --check` · ถ้ามี workflow ให้รัน `actionlint` ด้วย (ถ้า `next.config.mjs` ยังเช็ก `COOKIE_SECRET` อยู่ ให้ตั้ง `COOKIE_SECRET=ci-cookie-secret-minimum-32-chars` ตอนรัน lint)

รายงานตอนจบ (ภาษาไทย สั้น):
1. สถานะ: เสร็จ / เสร็จบางส่วน / หยุดรอเจ้าของงาน (ถ้าหยุด ให้บอกคำถามที่ต้องการคำตอบ)
2. ไฟล์ที่สร้าง แก้ และลบ
3. ผลของแต่ละคำสั่งตรวจ
4. เทสหรือขั้นตอนที่เจ้าของงานต้องรันเอง (socket, docker, เน็ต)
5. สิ่งที่ตัดสินใจเองหรือทำต่างจากแผน พร้อมเหตุผล
6. ข้อความ commit ที่แนะนำ (เอาจากแผน)
--->8---
