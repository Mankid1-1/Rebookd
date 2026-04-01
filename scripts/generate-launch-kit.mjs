/**
 * Standalone runner — generates Rebooked_Launch_Kit.pdf in the project root.
 * The PDF logic lives in tools/prospector/lib/launch-kit-generator.mjs
 * and is also called automatically by generate-outreach.mjs.
 *
 * Usage:
 *   node scripts/generate-launch-kit.mjs [outputPath]
 */

import { generateLaunchKit } from '../tools/prospector/lib/launch-kit-generator.mjs';
import { resolve } from 'path';

const outPath = process.argv[2] || resolve('Rebooked_Launch_Kit.pdf');

generateLaunchKit(outPath)
  .then(() => console.log('PDF written to:', outPath))
  .catch(err => { console.error('Error:', err); process.exit(1); });
