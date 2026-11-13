/**
 * Runner dos testes do motor.
 *
 * O projeto é ESM (`"type": "module"` no package.json), mas o build de
 * teste é CommonJS (o tsc não reescreve caminhos de import, então ESM
 * quebraria nos imports relativos sem extensão). Este script marca a pasta
 * de build como CommonJS e chama o runner nativo do Node.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = resolve(root, ".test-build");

mkdirSync(buildDir, { recursive: true });
writeFileSync(resolve(buildDir, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2));

const result = spawnSync(process.execPath, ["--test", ".test-build/scripts/tests/*.test.js"], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
