import { readFileSync } from "node:fs";
import { join } from "node:path";

export const mobileRoot = join(__dirname, "../..");

export function read(relativePath: string): string {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}
