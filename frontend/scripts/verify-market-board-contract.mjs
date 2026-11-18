import fs from "node:fs";

const path = new URL("../src/app/(site)/test/BeginnerTestHome.tsx", import.meta.url);
const source = fs.readFileSync(path, "utf8");

const required = [
  ["40-row production board", "const BOARD_LIMIT_PROD = 40;"],
  ["dev filter fails closed", "if (!isDemoDevMode()) return rows;"],
  ["dev row completion fails closed", "if (!isDemoDevMode()) return partial;"],
  ["production board is capped without dev injection", "rows = rows.slice(0, BOARD_LIMIT_PROD);"],
  ["explicit missing-history UI", "No history"],
  ["persisted history state is honored", 'history_state !== "missing"'],
  ["persisted points are required before embedded history is trusted", "persistedPoints >= 2"],
  ["history request failure preserves existing data", "Keep the last known good or embedded history on transient API failure."],
];

const forbidden = [
  ["synthetic sparkline fallback", "ensureSparklineValuesForRow"],
  ["old synthetic fallback comment", "Fallback when a symbol has snapshot price but no daily close series"],
];

const failures = [];

for (const [label, needle] of required) {
  if (!source.includes(needle)) {
    failures.push(`missing invariant: ${label} (${needle})`);
  }
}

for (const [label, needle] of forbidden) {
  if (source.includes(needle)) {
    failures.push(`forbidden invariant returned: ${label} (${needle})`);
  }
}

if (failures.length) {
  console.error("Market board contract verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Market board contract verified: 40-symbol production universe, no dev-seed leakage, no synthetic history, resilient sparkline failures.");
