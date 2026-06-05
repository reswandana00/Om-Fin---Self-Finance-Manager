import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/sql.js/dist/sql-wasm.wasm");
const destination = resolve(root, "public/assets/sql-wasm.wasm");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

console.log("Copied sql-wasm.wasm to public/assets.");
