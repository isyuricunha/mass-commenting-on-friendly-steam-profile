import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function bundleToFile({ entry, outfile }) {
  await ensureDir(dirname(outfile));

  await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile,
    sourcemap: false,
    minify: false,
    legalComments: "none"
  });
}

async function bundleToText({ entry }) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    write: false,
    sourcemap: false,
    minify: false,
    legalComments: "none"
  });

  const jsOutput =
    result.outputFiles.find((f) => f.path.endsWith(".js")) ??
    result.outputFiles.find((f) => f.path.includes(".js")) ??
    result.outputFiles[0];
  if (!jsOutput) {
    throw new Error("userscript bundling failed: missing js output");
  }

  return jsOutput.text;
}

async function main() {
  const consoleOut = resolve(projectRoot, "mass-script.js");
  const userscriptOut = resolve(projectRoot, "mass-script.user.js");
  const extensionOut = resolve(projectRoot, "extension/content-script.js");

  await bundleToFile({
    entry: resolve(projectRoot, "src/entrypoints/console.ts"),
    outfile: consoleOut
  });

  await bundleToFile({
    entry: resolve(projectRoot, "src/entrypoints/extension.ts"),
    outfile: extensionOut
  });

  const body = await bundleToText({
    entry: resolve(projectRoot, "src/entrypoints/userscript.ts")
  });
  const header = [
    "// ==UserScript==",
    "// @name         steam mass commenter",
    "// @namespace    https://github.com/isyuricunha",
    "// @version      0.0.0",
    "// @description  mass comment on selected steam friends",
    "// @match        https://steamcommunity.com/*/friends*",
    "// @match        https://steamcommunity.com/profiles/*/friends*",
    "// @run-at       document-idle",
    "// @grant        none",
    "// ==/UserScript==",
    ""
  ].join("\n");

  await writeFile(userscriptOut, `${header}\n${body}`, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
