import type { ReceiptLayout } from "@/types/store";
import contract from "@/contract/store-contract.json";

export const DEFAULT_LAYOUT = contract.receiptDefaultLayout as ReceiptLayout;
