/**
 * Loads shared domain helpers before app.js (classic script).
 * Must stay in sync with core/domain/library.js (see npm run sync:domain).
 */
import * as MoozhakDomain from './moozhak-domain.js';

window.MoozhakDomain = MoozhakDomain;
