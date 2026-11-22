import { describe, expect, it } from "vitest";
import {
  AMOUNT_PRESETS,
  filterByAmount,
  isAmountFilterActive,
  matchesAmount,
  nextSort,
  NO_AMOUNT_FILTER,
  parseMinAmount,
  sortInvoices,
  summarize,
  type AmountPresetId,
} from "../lib/amountFilter";

const preset = (id: AmountPresetId) => ({ preset: id, minAmount: null });

describe("amount presets (boundary values)", () => {
  it.each([
    [49_999.99, "UNDER_50K"],
    [50_000, "50K_TO_100K"],
    [99_999.99, "50K_TO_100K"],
    [100_000, "100K_TO_500K"],
    [499_999.99, "100K_TO_500K"],
    [500_000, "500K_PLUS"],
    [0.01, "UNDER_50K"],
    [9_000_000, "500K_PLUS"],
  ] as const)("₱%d falls in %s and no other preset", (amount, expected) => {
    const matching = AMOUNT_PRESETS.filter((p) => p.id !== "ALL" && matchesAmount(amount, preset(p.id))).map(
      (p) => p.id,
    );
    expect(matching).toEqual([expected]);
  });

  it("'All' matches every amount", () => {
    for (const amount of [0.01, 49_999.99, 50_000, 499_999.99, 500_000]) {
      expect(matchesAmount(amount, NO_AMOUNT_FILTER)).toBe(true);
    }
  });
});

describe("custom minimum amount", () => {
  it("keeps amounts at or above the minimum", () => {
    const filter = { preset: "ALL" as const, minAmount: 50_000 };
    expect(matchesAmount(49_999.99, filter)).toBe(false);
    expect(matchesAmount(50_000, filter)).toBe(true);
  });
  it("combines with a preset (both must pass)", () => {
    const filter = { preset: "100K_TO_500K" as const, minAmount: 250_000 };
    expect(matchesAmount(200_000, filter)).toBe(false);
    expect(matchesAmount(300_000, filter)).toBe(true);
    expect(matchesAmount(500_000, filter)).toBe(false);
  });
  it.each([
    ["", { value: null, valid: true }],
    ["100000", { value: 100_000, valid: true }],
    ["100,000", { value: 100_000, valid: true }],
    ["₱ 499,999.99", { value: 499_999.99, valid: true }],
    ["abc", { value: null, valid: false }],
    ["-5", { value: null, valid: false }],
    ["1.234", { value: null, valid: false }],
  ])("reads %j", (text, expected) => {
    expect(parseMinAmount(text)).toEqual(expected);
  });
  it("knows when a filter is active", () => {
    expect(isAmountFilterActive(NO_AMOUNT_FILTER)).toBe(false);
    expect(isAmountFilterActive(preset("UNDER_50K"))).toBe(true);
    expect(isAmountFilterActive({ preset: "ALL", minAmount: 1 })).toBe(true);
  });
});

describe("filterByAmount and summarize", () => {
  const list = [49_999.99, 50_000, 499_999.99, 500_000].map((amount_php, i) => ({
    invoice_no: `SI-${i}`,
    amount_php,
  }));
  it("filters a list and totals it without rounding drift", () => {
    const big = filterByAmount(list, preset("100K_TO_500K"));
    expect(big.map((i) => i.invoice_no)).toEqual(["SI-2"]);
    expect(summarize(list)).toEqual({ count: 4, total: 1_099_999.98 });
    expect(summarize([])).toEqual({ count: 0, total: 0 });
  });
});

describe("sorting", () => {
  const rows = [
    { invoice_no: "A", amount_php: 100, days: 5 },
    { invoice_no: "B", amount_php: 300, days: 1 },
    { invoice_no: "C", amount_php: 200, days: 9 },
    { invoice_no: "D", amount_php: 200, days: 9 },
  ];
  const days = (r: (typeof rows)[number]) => r.days;

  it("amount, highest first (ties by invoice no.)", () => {
    expect(sortInvoices(rows, { key: "amount", direction: "desc" }, days).map((r) => r.invoice_no)).toEqual([
      "B",
      "C",
      "D",
      "A",
    ]);
  });
  it("amount, lowest first", () => {
    expect(sortInvoices(rows, { key: "amount", direction: "asc" }, days).map((r) => r.invoice_no)).toEqual([
      "A",
      "C",
      "D",
      "B",
    ]);
  });
  it("days, highest first; ties broken by higher amount", () => {
    expect(sortInvoices(rows, { key: "days", direction: "desc" }, days).map((r) => r.invoice_no)).toEqual([
      "C",
      "D",
      "A",
      "B",
    ]);
  });
  it("does not change the original list", () => {
    const copy = [...rows];
    sortInvoices(rows, { key: "amount", direction: "asc" }, days);
    expect(rows).toEqual(copy);
  });
  it("clicking a header: new column starts highest first, same column flips", () => {
    expect(nextSort(null, "amount")).toEqual({ key: "amount", direction: "desc" });
    expect(nextSort({ key: "amount", direction: "desc" }, "amount")).toEqual({ key: "amount", direction: "asc" });
    expect(nextSort({ key: "amount", direction: "asc" }, "days")).toEqual({ key: "days", direction: "desc" });
  });
});
