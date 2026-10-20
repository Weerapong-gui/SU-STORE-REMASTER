import { describe, expect, it } from "vitest";
// @ts-expect-error Next config is JavaScript and has no declaration file.
import nextConfig from "../../next.config.mjs";

describe("FP28 storefront redirect", () => {
  it("redirects both locale paths to the old storefront", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toContainEqual({
      source: "/check-order/fp28",
      destination: "https://fp28.sumfu.store/check-order/fp28",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/th/check-order/fp28",
      destination: "https://fp28.sumfu.store/check-order/fp28",
      permanent: true,
    });
  });

  it("sends old student-ID lookups on /check-order to the old storefront", async () => {
    const redirects = await nextConfig.redirects?.();

    for (const source of ["/check-order", "/th/check-order"]) {
      for (const key of ["studentCode", "orderId"]) {
        expect(redirects).toContainEqual({
          source,
          has: [{ type: "query", key }],
          destination: "https://fp28.sumfu.store/check-order/fp28",
          permanent: true,
        });
      }
    }
  });
});
