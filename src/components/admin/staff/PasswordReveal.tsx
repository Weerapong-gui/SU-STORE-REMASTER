"use client";

import { useState } from "react";
import { Button, Card, useToast } from "@/components/admin/ui";

export function PasswordReveal({ password, onClose }: { password: string; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
      toast("คัดลอกไม่สำเร็จ กรุณาจดรหัสไว้เอง", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="password-title">
      <Card title="รหัสผ่านใหม่">
        <div className="space-y-4">
          <h2 id="password-title" className="sr-only">รหัสผ่านใหม่</h2>
          <p className="rounded-lg bg-zinc-100 px-4 py-3 text-center font-mono text-lg" data-testid="revealed-password">{password}</p>
          <p className="text-sm text-amber-800">รหัสนี้จะแสดงครั้งเดียว จดหรือส่งให้เจ้าของบัญชีตอนนี้</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={copyPassword}>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</Button>
            <Button onClick={onClose}>ปิด</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
