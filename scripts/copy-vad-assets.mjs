import { createRequire } from "module";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const vadDistDir = path.dirname(require.resolve("@ricky0123/vad-web"));
// onnxruntime-web lives as a sibling inside vad-web's pnpm package store
// pnpm: .pnpm/@ricky0123+vad-web@x/node_modules/@ricky0123/vad-web/dist
//       → go up 5 levels to reach .pnpm/, then onnxruntime-web/node_modules/.../dist
const ortDistDir = path.resolve(vadDistDir, "../../../onnxruntime-web/dist");
const destDir = path.resolve("public");

function copy(src, filename) {
  const dest = path.join(destDir, filename ?? path.basename(src));
  try {
    fs.copyFileSync(src, dest);
    console.log(`  copied  ${path.basename(dest)}`);
  } catch (e) {
    console.warn(`  skip    ${path.basename(src)} — ${e.message}`);
  }
}

console.log("copy-vad-assets: copying to public/");

copy(path.join(vadDistDir, "vad.worklet.bundle.min.js"));
copy(path.join(vadDistDir, "silero_vad_v5.onnx"));
copy(path.join(vadDistDir, "silero_vad_legacy.onnx"));

for (const f of fs
  .readdirSync(ortDistDir)
  .filter(
    (f) =>
      f.startsWith("ort-wasm-simd-threaded") &&
      (f.endsWith(".wasm") || f.endsWith(".mjs")),
  )) {
  copy(path.join(ortDistDir, f));
}

console.log("copy-vad-assets: done");
