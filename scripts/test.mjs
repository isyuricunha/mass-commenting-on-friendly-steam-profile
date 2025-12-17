import { build } from "esbuild";
import { rm, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const outdir = resolve(projectRoot, ".test-dist");

async function run() {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  await build({
    entryPoints: [resolve(projectRoot, "test/index.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    outdir,
    sourcemap: false,
    legalComments: "none"
  });

  const proc = spawn(process.execPath, ["--test", resolve(outdir, "index.js")], {
    stdio: "inherit"
  });

  const code = await new Promise((res) => proc.on("close", res));
  if (code !== 0) {
    process.exitCode = code ?? 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
