// Sprawdza nieużywane zależności i podatności. Uruchom: bun run deps:check
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = [...walk("src"), "tailwind.config.ts", "vite.config.ts", "postcss.config.js", "eslint.config.js"];
const text = files.map((f) => readFileSync(f, "utf8")).join("\n");
const alwaysOk = new Set(["typescript", "autoprefixer", "postcss", "tailwindcss", "vite", "@types/node", "@types/react", "@types/react-dom", "typescript-eslint", "eslint", "globals"]);
const unused = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter((n) => !alwaysOk.has(n) && !text.includes(`"${n}"`) && !text.includes(`'${n}'`) && !text.includes(`${n}/`));
console.log(unused.length ? `Możliwie nieużywane: ${unused.join(", ")}` : "Brak nieużywanych zależności.");
const a = spawnSync("bun", ["audit"], { stdio: "inherit" });
process.exit(unused.length || a.status ? 1 : 0);
