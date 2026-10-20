"use client";

import { createContext, useContext, type ReactNode } from "react";

import { writeLangCookie } from "@/lib/i18n/langCookie";
import { localePath, switchLocalePath, type Lang } from "@/lib/i18n/locale";
import { assignLocation } from "@/lib/navigate";

export type { Lang } from "@/lib/i18n/locale";

export const translations = {
  en: {
    status: {
      pending_payment: { label: "Awaiting Payment",      description: "Please transfer and upload your slip" },
      waiting_confirm: { label: "Awaiting Confirmation", description: "Our team is verifying your transfer" },
      paid:            { label: "Paid",                  description: "Payment confirmed" },
      preparing:       { label: "Preparing",             description: "Your order is being prepared" },
      shipped:         { label: "Ready for Pickup",      description: "Your order is ready. Show this QR at the pickup point." },
      received:        { label: "Received",              description: "You have collected your order. Thank you!" },
      cancelled:       { label: "Cancelled",             description: "This order has been cancelled" },
      rejected:        { label: "Rejected",              description: "Payment not confirmed. Please contact us" },
      refund:          { label: "Refund Pending",        description: "This product is unavailable. Full refund will be processed by the Student Union." },
      refunded:        { label: "Refunded",              description: "Refund has been completed." },
    },
  },
  th: {
    status: {
      pending_payment: { label: "รอชำระเงิน",      description: "กรุณาชำระเงินและแนบสลิป" },
      waiting_confirm: { label: "รอยืนยันการชำระ", description: "ทีมงานกำลังตรวจสอบสลิปการโอน" },
      paid:            { label: "ชำระเงินแล้ว",    description: "ยืนยันการชำระเงินเรียบร้อย" },
      preparing:       { label: "กำลังเตรียมของ",  description: "กำลังเตรียมสินค้าของคุณ" },
      shipped:         { label: "พร้อมรับสินค้า",  description: "ออเดอร์ของคุณพร้อมแล้ว โปรดแสดง QR นี้ที่จุดรับสินค้า" },
      received:        { label: "รับสินค้าแล้ว",   description: "รับสินค้าเรียบร้อยแล้ว" },
      cancelled:       { label: "ยกเลิก",          description: "ออเดอร์ถูกยกเลิก" },
      rejected:        { label: "ปฏิเสธ",          description: "ไม่ผ่านการยืนยัน กรุณาติดต่อทีมงาน" },
      refund:          { label: "รอคืนเงิน",       description: "สินค้านี้ไม่สามารถจำหน่ายได้ องค์การบริหารองค์การนักศึกษาจะคืนเงินให้เต็มจำนวน" },
      refunded:        { label: "คืนเงินแล้ว",    description: "ดำเนินการคืนเงินเรียบร้อยแล้ว" },
    },
  },
} as const;

type Translations = typeof translations;

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations[Lang];
};

// The server decides the language from the URL; switching means loading the page again
// under the other locale so server-rendered text, <html lang> and metadata all follow.
function setLang(l: Lang) {
  writeLangCookie(l);
  const { pathname, search } = window.location;
  assignLocation(switchLocalePath(pathname, search, l));
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang,
  t: translations.en,
});

export function LanguageProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

export function useLocalePath(): (path: string) => string {
  const { lang } = useLang();
  return (path) => localePath(lang, path);
}
