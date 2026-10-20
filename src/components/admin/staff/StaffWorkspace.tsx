"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { Button, Card, Field, inputClass, useToast } from "@/components/admin/ui";
import { adminFetch, formatThaiDateTime } from "@/lib/api/adminApi";
import type { StaffMember } from "@/types/store";
import { PasswordReveal } from "./PasswordReveal";

type CurrentUser = { username: string; isSuperadmin: boolean };
type StaffList = { users: StaffMember[] };
type PasswordResponse = { password: string };
type CreateResponse = { user: StaffMember; password: string };

export function StaffWorkspace() {
  const confirm = useConfirm();
  const toast = useToast();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");
  const [accessChecked, setAccessChecked] = useState(false);
  const [users, setUsers] = useState<StaffMember[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const result = await adminFetch<StaffList>("users");
      setUsers(result.users);
    } catch (error) {
      toast(error instanceof Error ? error.message : "โหลดรายชื่อ staff ไม่สำเร็จ", "error");
    }
  }, [toast]);

  const checkAccess = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const me = await adminFetch<CurrentUser>("me");
      if (!isActive()) return;
      setCurrentUsername(me.username);
      setIsSuperadmin(me.isSuperadmin);
      if (me.isSuperadmin) await loadUsers();
    } catch (error) {
      if (isActive()) toast(error instanceof Error ? error.message : "ตรวจสอบสิทธิ์ไม่สำเร็จ", "error");
    } finally {
      if (isActive()) setAccessChecked(true);
    }
  }, [loadUsers, toast]);

  useEffect(() => {
    let active = true;
    void checkAccess(() => active);
    return () => { active = false; };
  }, [checkAccess]);

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await adminFetch<CreateResponse>("users", { method: "POST", json: { username } });
      setUsername("");
      setPassword(result.password);
      await loadUsers();
    } catch (error) {
      toast(error instanceof Error ? error.message : "เพิ่ม staff ไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(user: StaffMember) {
    if (!(await confirm({ title: `รีเซ็ตรหัสผ่านของ ${user.username}?`, message: "รหัสผ่านเดิมจะใช้ไม่ได้ทันที", confirmLabel: "รีเซ็ตรหัสผ่าน", tone: "danger" }))) return;
    setBusy(true);
    try {
      const result = await adminFetch<PasswordResponse>(`users/${encodeURIComponent(user.username)}/reset-password`, { method: "POST" });
      setPassword(result.password);
    } catch (error) {
      toast(error instanceof Error ? error.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStaff(user: StaffMember) {
    if (!(await confirm({ title: "ลบบัญชี staff นี้?", message: `บัญชี ${user.username} จะถูกลบและออกจากระบบทันที`, confirmLabel: "ลบ", tone: "danger" }))) return;
    setBusy(true);
    try {
      await adminFetch(`users/${encodeURIComponent(user.username)}`, { method: "DELETE" });
      await loadUsers();
    } catch (error) {
      toast(error instanceof Error ? error.message : "ลบ staff ไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuperadmin(user: StaffMember) {
    const nextValue = !user.isSuperadmin;
    const action = nextValue ? "ตั้ง" : "ถอด";
    if (!(await confirm({ title: `${action} ${user.username} เป็นผู้ดูแลระบบหลัก?`, confirmLabel: action, tone: nextValue ? "default" : "danger" }))) return;
    setBusy(true);
    try {
      await adminFetch<StaffMember>(`users/${encodeURIComponent(user.username)}`, { method: "PATCH", json: { isSuperadmin: nextValue } });
      // Demoting yourself ends access to this page, so re-check instead of reloading the list.
      await (user.username === currentUsername ? checkAccess() : loadUsers());
    } catch (error) {
      toast(error instanceof Error ? error.message : "เปลี่ยนสิทธิ์ไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!accessChecked) return <Card title="จัดการ staff"><p className="text-sm text-zinc-500">กำลังตรวจสอบสิทธิ์…</p></Card>;
  if (!isSuperadmin) return <Card><p>เฉพาะผู้ดูแลระบบหลักเท่านั้น</p></Card>;

  return (
    <div className="space-y-5">
      <Card title="เพิ่ม staff" hint="ระบบจะสร้างรหัสผ่านชั่วคราวให้ และแสดงเพียงครั้งเดียว">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={createStaff}>
          <div className="flex-1"><Field label="ชื่อผู้ใช้"><input className={inputClass} name="username" autoComplete="off" required value={username} onChange={(event) => setUsername(event.target.value)} /></Field></div>
          <Button type="submit" disabled={busy || !username.trim()}>เพิ่ม staff</Button>
        </form>
      </Card>
      <Card title="รายชื่อ staff">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b border-zinc-200 text-zinc-500"><th className="py-3 pr-4">ชื่อผู้ใช้</th><th className="py-3 pr-4">สร้างโดย</th><th className="py-3 pr-4">วันที่สร้าง</th><th className="py-3">จัดการ</th></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.username} className="border-b border-zinc-100 align-top">
                <td className="py-3 pr-4 font-medium">{user.username}{user.isSuperadmin && <span className="ml-2 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">ผู้ดูแลระบบหลัก</span>}</td>
                <td className="py-3 pr-4">{user.createdBy || "—"}</td>
                <td className="py-3 pr-4">{formatThaiDateTime(user.createdAt)}</td>
                <td className="py-3"><div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => void resetPassword(user)}>รีเซ็ตรหัสผ่าน</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void toggleSuperadmin(user)}>{user.isSuperadmin ? "ถอดผู้ดูแลระบบหลัก" : "ตั้งผู้ดูแลระบบหลัก"}</Button>
                  {user.username !== currentUsername && (
                    <Button variant="danger" disabled={busy} onClick={() => void deleteStaff(user)}>ลบ</Button>
                  )}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
          {users.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">ยังไม่มี staff</p>}
        </div>
      </Card>
      {password !== null && <PasswordReveal password={password} onClose={() => setPassword(null)} />}
    </div>
  );
}
