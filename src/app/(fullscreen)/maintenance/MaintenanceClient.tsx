"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { localePath, stripLocale } from "@/lib/i18n/locale";

type SiteStatus = {
  siteClosed?: boolean;
};

export function MaintenancePolling() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/site-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SiteStatus;
        if (!data.siteClosed) {
          // This page sits outside LanguageProvider, so read the language from the URL.
          router.replace(localePath(stripLocale(window.location.pathname).lang, "/"));
        }
      } catch {
        // ignore
      }
    };

    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
