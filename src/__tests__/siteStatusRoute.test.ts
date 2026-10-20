import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("site status proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("only exposes the siteClosed flag used by the storefront", async () => {
    vi.resetModules();
    vi.stubEnv("ORDER_API_BASE_URL", "http://order-api:10000");
    vi.stubEnv("ALWAYS_OPEN", "0");
    vi.stubEnv("STAGING_HOST", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      siteClosed: false,
      scheduleClosed: true,
      beRightBack: true,
      activeVisitors: 3,
    })));

    const { GET } = await import("@/app/api/site-status/route");
    const response = await GET(new NextRequest("https://sumfu.store/api/site-status"));

    expect(await response.json()).toEqual({ siteClosed: false, activeVisitors: 3 });
  });
});
