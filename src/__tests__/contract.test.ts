import { describe, expect, it } from "vitest";
import contract from "@/contract/store-contract.json";
import { STORE_FONTS } from "@/lib/theme/fonts";
import { DEFAULT_LAYOUT } from "@/lib/receipt/layout";
import { BLOCK_INFO } from "@/components/admin/home/blocks";

describe("shared store contract", () => {
  it("uses the contract receipt layout and font ids", () => {
    expect(DEFAULT_LAYOUT).toEqual(contract.receiptDefaultLayout);
    expect(STORE_FONTS.map(font => font.id)).toEqual(contract.homeFonts);
    expect(Object.keys(BLOCK_INFO)).toEqual(expect.arrayContaining(contract.homeBlockTypes));
    expect(Object.keys(BLOCK_INFO)).toHaveLength(contract.homeBlockTypes.length);
  });
});
