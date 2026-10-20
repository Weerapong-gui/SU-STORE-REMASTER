"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api/adminApi";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "ภาพรวม" },
  { href: "/admin/products", label: "สินค้า" },
  { href: "/admin/categories", label: "หมวดหมู่" },
  { href: "/admin/orders", label: "ออเดอร์" },
  { href: "/admin/home", label: "ตกแต่งหน้าแรก" },
  { href: "/admin/settings", label: "ตั้งค่าร้าน" },
];

const STAFF_ITEM = { href: "/admin/staff", label: "จัดการ staff" };

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    let active = true;
    adminFetch<{ isSuperadmin: boolean }>("me")
      .then((me) => { if (active) setIsSuperadmin(me.isSuperadmin); })
      // Hiding the staff link is the safe fallback; the page itself reports the error.
      .catch(() => { if (active) setIsSuperadmin(false); });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <nav className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3">
        <span className="mr-3 text-sm font-bold text-zinc-900">SU STORE · หลังร้าน</span>
        {[...NAV_ITEMS, ...(isSuperadmin ? [STAFF_ITEM] : [])].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              pathname.startsWith(item.href) ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </nav>
  );
}
