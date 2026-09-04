import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) throw new Error("Missing manifest path");

const manifest = JSON.parse(readFileSync(target, "utf8"));
manifest.host_permissions = manifest.host_permissions.filter(
  (permission) => !permission.startsWith("http://localhost:"),
);
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
