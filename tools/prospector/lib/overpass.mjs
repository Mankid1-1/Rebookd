/**
 * OpenStreetMap Overpass API integration.
 * 100% free, no API key, no signup, no credit card.
 * Searches for appointment-based businesses by city + type.
 */

import axios from 'axios';
import { classifyBusinessType } from './template-engine.mjs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// OSM tags for appointment-based businesses
const OSM_QUERIES = {
  salon: [
    '["shop"="hairdresser"]',
    '["shop"="beauty"]',
    '["shop"="nails"]',
  ],
  barber: [
    '["shop"="hairdresser"]["name"~"[Bb]arber"]',
    '["shop"="hairdresser"]', // many barbers tagged as hairdresser
  ],
  spa: [
    '["shop"="beauty"]',
    '["shop"="massage"]',
    '["leisure"="spa"]',
    '["healthcare"="massage_therapist"]',
  ],
  tattoo: [
    '["shop"="tattoo"]',
  ],
  clinic: [
    '["amenity"="dentist"]',
    '["amenity"="clinic"]',
    '["amenity"="doctors"]',
    '["healthcare"="chiropractor"]',
    '["healthcare"="optometrist"]',
    '["healthcare"="dermatologist"]',
  ],
  fitness: [
    '["leisure"="fitness_centre"]',
    '["sport"="yoga"]',
    '["sport"="pilates"]',
  ],
};

/**
 * Search Overpass for businesses in a city.
 * @param {string} businessType - salon, barber, spa, tattoo, clinic, fitness
 * @param {string} city - City name (e.g. "Austin")
 * @param {string} state - State name (e.g. "Texas") — helps narrow the area
 * @returns {Promise<Array>} Normalized business objects
 */
export async function searchOverpass(businessType, city, state) {
  const tags = OSM_QUERIES[businessType];
  if (!tags) {
    console.error(`    [Overpass] Unknown business type: ${businessType}`);
    return [];
  }

  // Build area filter using city + state for accuracy
  const areaFilter = state
    ? `area["name"="${city}"]["admin_level"~"[78]"]->.city;area["name"="${state}"]["admin_level"="4"]->.state;`
    : `area["name"="${city}"]["admin_level"~"[78]"]->.city;`;

  const areaRef = state ? 'area.city' : 'area.city';

  // Build union of all tag queries for this type
  const unionParts = [];
  for (const tag of tags) {
    unionParts.push(`node${tag}(${areaRef});`);
    unionParts.push(`way${tag}(${areaRef});`);
  }

  const query = `
    [out:json][timeout:30];
    ${areaFilter}
    (
      ${unionParts.join('\n      ')}
    );
    out center tags;
  `;

  try {
    const resp = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 35000,
    });

    const elements = resp.data.elements || [];
    const seen = new Set();
    const results = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || '';
      if (!name) continue;

      // Dedupe by name + rough location
      const dedupeKey = `${name.toLowerCase()}_${tags['addr:city'] || city}`.replace(/\s+/g, '');
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      results.push(normalizeOsmElement(el, businessType, city, state));
    }

    return results;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      console.error(`    [Overpass] Query timed out — try a more specific location`);
    } else {
      console.error(`    [Overpass] Error: ${err.response?.data?.remark || err.message}`);
    }
    return [];
  }
}

/**
 * Search multiple business types in a city in one Overpass call.
 * More efficient when searching for all types.
 */
export async function searchAllTypes(city, state, types) {
  const targetTypes = types || Object.keys(OSM_QUERIES);
  const allResults = [];

  // Build one big union query
  const areaFilter = state
    ? `area["name"="${city}"]["admin_level"~"[78]"]->.city;area["name"="${state}"]["admin_level"="4"]->.state;`
    : `area["name"="${city}"]["admin_level"~"[78]"]->.city;`;

  const unionParts = [];
  for (const type of targetTypes) {
    const tags = OSM_QUERIES[type] || [];
    for (const tag of tags) {
      unionParts.push(`node${tag}(area.city);`);
      unionParts.push(`way${tag}(area.city);`);
    }
  }

  const query = `
    [out:json][timeout:60];
    ${areaFilter}
    (
      ${unionParts.join('\n      ')}
    );
    out center tags;
  `;

  try {
    const resp = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 65000,
    });

    const elements = resp.data.elements || [];
    const seen = new Set();

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || '';
      if (!name) continue;

      const dedupeKey = `${name.toLowerCase()}_${tags['addr:city'] || city}`.replace(/\s+/g, '');
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Classify the business type from OSM tags
      const bizType = classifyFromOsmTags(tags) || classifyBusinessType(name);
      allResults.push(normalizeOsmElement(el, bizType, city, state));
    }

    return allResults;
  } catch (err) {
    console.error(`    [Overpass] Batch query error: ${err.response?.data?.remark || err.message}`);
    // Fallback: query each type individually
    console.log(`    [Overpass] Falling back to per-type queries...`);
    for (const type of targetTypes) {
      const results = await searchOverpass(type, city, state);
      allResults.push(...results);
      await sleep(1500); // Be polite to the public server
    }
    return allResults;
  }
}

function normalizeOsmElement(el, hintType, defaultCity, defaultState) {
  const tags = el.tags || {};
  const lat = el.lat || el.center?.lat || null;
  const lng = el.lon || el.center?.lon || null;

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'] || defaultCity || '';
  const state = tags['addr:state'] || defaultState || '';
  const zip = tags['addr:postcode'] || '';

  return {
    id: `osm_${el.type}_${el.id}`,
    source: 'openstreetmap',
    name: tags.name || tags['name:en'] || '',
    business_type: hintType || 'other',
    address: [street, city, state, zip].filter(Boolean).join(', '),
    city,
    state,
    zip,
    phone: tags.phone || tags['contact:phone'] || '',
    website: cleanWebsite(tags.website || tags['contact:website'] || tags.url || ''),
    rating: null, // OSM doesn't have ratings
    review_count: null,
    lat,
    lng,
    opening_hours: tags.opening_hours || '',
    raw: tags,
  };
}

function classifyFromOsmTags(tags) {
  const shop = (tags.shop || '').toLowerCase();
  const amenity = (tags.amenity || '').toLowerCase();
  const healthcare = (tags.healthcare || '').toLowerCase();
  const leisure = (tags.leisure || '').toLowerCase();
  const name = (tags.name || '').toLowerCase();

  if (shop === 'tattoo') return 'tattoo';
  if (shop === 'hairdresser') {
    if (name.includes('barber')) return 'barber';
    return 'salon';
  }
  if (shop === 'beauty' || shop === 'nails') return 'spa';
  if (shop === 'massage' || leisure === 'spa') return 'spa';
  if (amenity === 'dentist') return 'clinic';
  if (amenity === 'clinic' || amenity === 'doctors') return 'clinic';
  if (healthcare === 'chiropractor' || healthcare === 'optometrist') return 'clinic';
  if (leisure === 'fitness_centre') return 'fitness';
  return null;
}

function cleanWebsite(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export { OSM_QUERIES };
