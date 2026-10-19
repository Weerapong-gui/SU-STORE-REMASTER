import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryCovers } from "@/components/store/CategoryCovers";
import type { StoreCategory } from "@/types/store";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const category = (coverImage: string): StoreCategory => ({
  id: 1, slug: "keychain", name: "พวงกุญแจ", nameEn: "Keychain", tagline: "", taglineEn: "",
  coverImage, visible: true, sortOrder: 0, productCount: 1,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("CategoryCovers title band", () => {
  it("lays the title on a frosted bar over a full-card cover photo", () => {
    act(() => root.render(<CategoryCovers categories={[category("/cover.jpg")]} />));
    const bar = container.querySelector("h3")?.parentElement;
    expect(bar?.className).toContain("absolute");
    expect(bar?.className).toContain("backdrop-blur-sm");
    expect(container.querySelector("a img")?.getAttribute("src")).toBe("/cover.jpg");
    expect(container.querySelector("a")?.className).not.toContain("bg-mist");
  });

  it("keeps the title above a grey placeholder when there is no cover", () => {
    act(() => root.render(<CategoryCovers categories={[category("")]} />));
    expect(container.querySelector("a img")).toBeNull();
    expect(container.querySelector("h3")?.parentElement?.className).not.toContain("absolute");
    expect(container.querySelector("a")?.className).toContain("bg-mist");
  });
});
