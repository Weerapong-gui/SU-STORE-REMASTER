import { Suspense } from "react";
import Image from "next/image";
import { MaintenancePolling } from "./MaintenanceClient";
import { getStoreMeta } from "@/lib/api/storeApi";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const announcement = (await getStoreMeta())?.announcement?.trim();

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-[#f5f5f7] px-6 py-12 text-center">
      <Image
        src="/images/SUSTORE.png"
        alt="SU STORE"
        width={1235}
        height={1009}
        priority
        sizes="96px"
        className="h-16 w-auto md:h-20"
      />

      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-[#1d1d1f] md:text-5xl">ร้านปิดอยู่ตอนนี้</h1>
      <p className="mt-2 text-lg text-[#6e6e73] md:text-xl">The store is closed</p>

      <p className="mt-6 max-w-md text-base text-[#1d1d1f]">ยังไม่เปิดรับออเดอร์ แวะกลับมาใหม่อีกครั้งนะ</p>
      <p className="mt-1 max-w-md text-sm text-[#6e6e73]">We&apos;re not taking orders right now. Please check back soon.</p>

      {announcement && (
        <div className="mt-8 max-w-md rounded-2xl bg-white px-6 py-4 text-sm font-medium text-[#1d1d1f] shadow-sm ring-1 ring-black/5">
          {announcement}
        </div>
      )}

      <p className="mt-12 text-xs text-[#86868b]">องค์การนักศึกษา มหาวิทยาลัยแม่ฟ้าหลวง</p>

      <Suspense>
        <MaintenancePolling />
      </Suspense>
    </main>
  );
}
