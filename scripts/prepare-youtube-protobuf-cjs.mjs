import { build } from "esbuild";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function main() {
  const protobufEntryPath = require.resolve("@bufbuild/protobuf");
  const protobufRoot = path.resolve(path.dirname(protobufEntryPath), "..", "..");
  const esmWireEntryPath = path.join(protobufRoot, "dist", "esm", "wire", "index.js");
  const cjsWireEntryPath = path.join(protobufRoot, "dist", "cjs", "wire", "index.js");
  const cjsPackageJsonPath = path.join(protobufRoot, "dist", "cjs", "package.json");

  await access(esmWireEntryPath);
  await mkdir(path.dirname(cjsWireEntryPath), { recursive: true });
  await writeFile(cjsPackageJsonPath, '{"type":"commonjs"}\n', "utf8");

  await build({
    entryPoints: [esmWireEntryPath],
    outfile: cjsWireEntryPath,
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    logLevel: "silent",
  });

  console.log("Prepared CommonJS protobuf wire shim for Netlify functions.");
}

main().catch((error) => {
  console.error("Failed to prepare CommonJS protobuf wire shim.", error);
  process.exitCode = 1;
});
