// 由 build/icon.svg 生成 build/icon.png（512×512，打包时用）。
// 用到仓库根目录里的 sharp；生成结果已提交，平时不需要再跑。
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(path.resolve(here, "..", "..", "node_modules", "sharp"));
const build = path.resolve(here, "..", "build");

await sharp(path.join(build, "icon.svg"), { density: 384 })
  .resize(512, 512)
  .png()
  .toFile(path.join(build, "icon.png"));
console.log("wrote build/icon.png");
