import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
copyFileSync(
  join(root, "core/domain/library.js"),
  join(root, "web/public/moozhak-domain.js"),
);
copyFileSync(
  join(root, "web/lib/client/ui-prefs.js"),
  join(root, "web/public/moozhak-ui-prefs.js"),
);
console.log(
  "sync-domain-client: copied core/domain/library.js -> web/public/moozhak-domain.js; web/lib/client/ui-prefs.js -> web/public/moozhak-ui-prefs.js",
);
