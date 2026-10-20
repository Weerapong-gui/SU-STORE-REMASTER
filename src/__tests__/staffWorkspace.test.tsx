import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "@/components/admin/ConfirmDialog";
import { StaffWorkspace } from "@/components/admin/staff/StaffWorkspace";
import { ToastProvider } from "@/components/admin/ui";
import type { StaffMember } from "@/types/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const adminFetch = vi.fn();
vi.mock("@/lib/api/adminApi", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
  formatThaiDateTime: (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
}));

let container: HTMLDivElement;
let root: Root;
let isSuperadmin = true;
const users: StaffMember[] = [
  { username: "owner", isSuperadmin: true, createdBy: "ระบบ", createdAt: "2026-10-01T00:00:00+07:00" },
  { username: "counter", isSuperadmin: false, createdBy: "owner", createdAt: "2026-10-02T00:00:00+07:00" },
];

async function render() {
  await act(async () => {
    root.render(
      <ToastProvider>
        <ConfirmProvider>
          <StaffWorkspace />
        </ConfirmProvider>
      </ToastProvider>
    );
  });
}

const button = (label: string) => [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);

beforeEach(() => {
  isSuperadmin = true;
  adminFetch.mockReset();
  adminFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "me") return { username: "owner", isSuperadmin };
    if (path === "users" && init?.method === "POST") return { user: users[1], password: "aB23456789Cd" };
    if (path === "users/owner" && init?.method === "PATCH") {
      isSuperadmin = false;
      return { ...users[0], isSuperadmin: false };
    }
    return { users };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("StaffWorkspace", () => {
  it("renders users with the superadmin badge", async () => {
    await render();
    expect(document.body.textContent).toContain("owner");
    expect(document.body.textContent).toContain("ผู้ดูแลระบบหลัก");
    expect(document.body.textContent).toContain("counter");
  });

  it("shows a created password once and removes it when closed", async () => {
    await render();
    const input = document.querySelector<HTMLInputElement>('input[name="username"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "newstaff");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("เพิ่ม staff")!.click());
    expect(document.body.textContent).toContain("aB23456789Cd");
    expect(document.body.textContent).toContain("รหัสนี้จะแสดงครั้งเดียว จดหรือส่งให้เจ้าของบัญชีตอนนี้");
    await act(async () => button("ปิด")!.click());
    expect(document.body.textContent).not.toContain("aB23456789Cd");
  });

  it("asks for confirmation before deleting a staff member", async () => {
    await render();
    await act(async () => button("ลบ")!.click());
    expect(document.body.textContent).toContain("ลบบัญชี staff นี้?");
    expect(adminFetch).not.toHaveBeenCalledWith("users/counter", expect.objectContaining({ method: "DELETE" }));
  });

  it("offers no delete button on your own row", async () => {
    await render();
    const deleteButtons = [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "ลบ");
    expect(deleteButtons).toHaveLength(1);
    expect(deleteButtons[0].closest("tr")?.textContent).toContain("counter");
  });

  it("drops to the notice after demoting yourself", async () => {
    await render();
    await act(async () => button("ถอดผู้ดูแลระบบหลัก")!.click());
    await act(async () => button("ถอด")!.click());
    expect(document.body.textContent).toContain("เฉพาะผู้ดูแลระบบหลักเท่านั้น");
    expect(button("ลบ")).toBeUndefined();
  });

  it("shows a notice and does not request the user list for non-superadmins", async () => {
    isSuperadmin = false;
    await render();
    expect(document.body.textContent).toContain("เฉพาะผู้ดูแลระบบหลักเท่านั้น");
    expect(adminFetch).toHaveBeenCalledWith("me");
    expect(adminFetch.mock.calls.some(([path]) => path === "users")).toBe(false);
  });
});
