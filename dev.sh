#!/usr/bin/env bash
# Start the sample backend in Docker and the storefront with Next.js.
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT_DIR"

if [ "${1:-}" = "reset" ]; then
  printf 'ลบฐานข้อมูลตัวอย่างใน data/dev แล้วเริ่มใหม่หรือไม่? [y/N] '
  read -r answer
  case "$answer" in
    y|Y|yes|YES) rm -rf -- "$ROOT_DIR/data/dev" ;;
    *) printf 'ยกเลิกการ reset\n'; exit 0 ;;
  esac
elif [ "$#" -gt 0 ]; then
  printf 'วิธีใช้: BACKEND_TAG=<tag> ./dev.sh [reset]\n' >&2
  exit 64
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'ไม่พบ docker กรุณาติดตั้ง Docker Desktop หรือ OrbStack แล้วลองอีกครั้ง\n' >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
ORDER_API_BASE_URL=http://127.0.0.1:10000
BYPASS_TOKEN=dev-bypass
ALWAYS_OPEN=1
EOF
  printf 'สร้าง .env.local แล้ว\n'
fi

stop_backend() {
  docker compose -f compose.dev.yml stop
}
trap stop_backend EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ ! -d node_modules ]; then
  npm install
fi

docker compose -f compose.dev.yml up -d --wait
printf 'หน้าร้าน: http://localhost:3000 · หลังร้าน: http://localhost:3000/admin\n'
npm run dev
