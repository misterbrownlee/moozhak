/**
 * Loads library UI prefs helpers before app.js (classic script).
 * Must stay in sync with web/lib/client/ui-prefs.js (see npm run sync:domain).
 */
import * as MoozhakUiPrefs from './moozhak-ui-prefs.js';

window.MoozhakUiPrefs = MoozhakUiPrefs;
