/**
 * Generates personalized cold call scripts per prospect.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, buildTemplateData } from './template-engine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

let template = null;

function loadTemplate() {
  if (template) return template;
  template = readFileSync(join(TEMPLATES_DIR, 'cold-call-script.txt'), 'utf-8');
  return template;
}

export function generateCallScript(prospect, business) {
  const t = loadTemplate();
  const data = buildTemplateData(prospect, business);
  return {
    script: render(t, data),
    phone: data.phone,
    contact_name: data.owner_full_name,
    business_name: data.business_name,
    business_type: data.business_type,
    opening_hook: data.hook,
  };
}
