/**
 * Generates a 3-email cold outreach sequence per prospect.
 * Solo founder voice — "I" not "we", warm, plain English.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, buildTemplateData } from './template-engine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

let templates = null;

function loadTemplates() {
  if (templates) return templates;
  templates = {
    email1: readFileSync(join(TEMPLATES_DIR, 'cold-email-1.txt'), 'utf-8'),
    email2: readFileSync(join(TEMPLATES_DIR, 'cold-email-2.txt'), 'utf-8'),
    email3: readFileSync(join(TEMPLATES_DIR, 'cold-email-3.txt'), 'utf-8'),
  };
  return templates;
}

export function generateEmailSequence(prospect, business) {
  const t = loadTemplates();
  const data = buildTemplateData(prospect, business);

  return {
    email1: {
      step: 1,
      day: 'Day 0',
      subject: render('Quick question about {{business_name}}', data),
      body: render(t.email1, data),
    },
    email2: {
      step: 2,
      day: 'Day 3',
      subject: render('Re: Quick question about {{business_name}}', data),
      body: render(t.email2, data),
    },
    email3: {
      step: 3,
      day: 'Day 7',
      subject: render('Should I close your file, {{owner_name}}?', data),
      body: render(t.email3, data),
    },
    metadata: {
      to_email: data.email,
      to_name: data.owner_full_name,
      business_name: data.business_name,
      business_type: data.business_type,
    },
  };
}
