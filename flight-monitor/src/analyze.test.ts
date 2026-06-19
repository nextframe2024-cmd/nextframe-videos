// Run with: node --test --experimental-strip-types src/analyze.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyze.ts";
import type { FlightOffer } from "./types.ts";

const offer = (price: number): FlightOffer => ({
  price,
  currency: "USD",
  airline: "China Eastern",
  stops: 1,
});

const base = {
  routeId: "HAN-BUD",
  departDate: "2026-07-23",
  dropThreshold: 0.12,
  dealPrice: 300,
};

test("detects a new all-time low", () => {
  const f = analyze({ ...base, current: offer(280), previousPrice: 400, previousAllTimeLow: 350 });
  const kinds = f.map((x) => x.kind);
  assert.ok(kinds.includes("all-time-low"));
});

test("detects an abnormal drop", () => {
  const f = analyze({ ...base, current: offer(330), previousPrice: 400, previousAllTimeLow: 320 });
  assert.ok(f.some((x) => x.kind === "abnormal-drop")); // 17.5% drop >= 12%
});

test("does not flag a small dip as an abnormal drop", () => {
  const f = analyze({ ...base, current: offer(390), previousPrice: 400, previousAllTimeLow: 380 });
  assert.ok(!f.some((x) => x.kind === "abnormal-drop")); // 2.5% drop
});

test("detects a deal at/below the threshold", () => {
  const f = analyze({ ...base, current: offer(300), previousPrice: 300, previousAllTimeLow: 300 });
  assert.ok(f.some((x) => x.kind === "deal"));
});

test("first observation produces no findings", () => {
  const f = analyze({ ...base, current: offer(500), previousPrice: null, previousAllTimeLow: null });
  assert.deepEqual(f, []);
});
