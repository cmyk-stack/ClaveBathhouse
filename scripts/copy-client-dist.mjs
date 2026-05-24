import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const rootDist = resolve("dist");
const clientDist = resolve("packages/client/dist");

await rm(rootDist, { force: true, recursive: true });
await cp(clientDist, rootDist, { recursive: true });
