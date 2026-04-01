/**
 * Reddit API integration for finding complaint threads.
 * Searches for business owners complaining about no-shows, cancellations, etc.
 * Free read access via OAuth app credentials.
 */

import axios from 'axios';
import { config } from './config.mjs';

const PAIN_KEYWORDS = [
  'no show', 'no-show', 'noshow',
  'cancellation', 'canceled', 'cancelled', 'last minute cancel',
  'missed appointment', 'missed booking',
  'empty chair', 'empty slot',
  'ghosted', 'ghost client',
  'lost revenue', 'losing money',
  'booking system', 'scheduling nightmare',
];

const SUBREDDITS = [
  'hairstylist', 'hairdresser', 'cosmetology',
  'Barber', 'barbers',
  'tattoo', 'tattooartists',
  'esthetician', 'Esthetics',
  'dentistry', 'dental',
  'massage', 'MassageTherapists',
  'smallbusiness', 'Entrepreneur',
  'personaltraining', 'yoga',
  'spa',
];

let _accessToken = null;
let _tokenExpiry = 0;

/**
 * Get Reddit OAuth access token (application-only auth).
 */
async function getRedditToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const { clientId, clientSecret, userAgent } = config.reddit;
  if (!clientId || !clientSecret) throw new Error('REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set');

  const resp = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: clientSecret },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
    }
  );

  _accessToken = resp.data.access_token;
  _tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
  return _accessToken;
}

/**
 * Search Reddit for complaint posts.
 * @param {string} query - Search query
 * @param {object} opts - { subreddit, limit, sort, time }
 * @returns {Promise<Array>} Normalized complaint objects
 */
export async function searchReddit(query, opts = {}) {
  const token = await getRedditToken();
  const limit = opts.limit || 25;
  const sort = opts.sort || 'relevance';
  const time = opts.time || 'year';

  const subreddit = opts.subreddit ? `r/${opts.subreddit}` : 'r/all';
  const url = `https://oauth.reddit.com/${subreddit}/search`;

  try {
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': config.reddit.userAgent,
      },
      params: {
        q: query,
        restrict_sr: opts.subreddit ? 'on' : 'off',
        sort,
        t: time,
        limit,
        type: 'link',
      },
    });

    const posts = resp.data.data?.children || [];
    return posts
      .filter(p => p.data.selftext || p.data.title)
      .map(p => normalizeRedditPost(p.data));
  } catch (err) {
    console.error(`    [Reddit] Error searching "${query}": ${err.message}`);
    return [];
  }
}

/**
 * Search all relevant subreddits for pain-point complaints.
 * @param {string} industry - salon, barber, tattoo, etc.
 * @param {object} opts - { limit }
 * @returns {Promise<Array>} Aggregated and deduped complaints
 */
export async function findComplaints(industry, opts = {}) {
  const allComplaints = [];
  const seenIds = new Set();

  // Build industry-specific queries
  const queries = PAIN_KEYWORDS.map(kw => {
    const industryTerm = industry || 'appointment';
    return `${kw} ${industryTerm}`;
  });

  // Search a selection of queries (avoid hammering the API)
  const selectedQueries = queries.slice(0, 5);

  for (const query of selectedQueries) {
    const results = await searchReddit(query, {
      limit: opts.limit || 10,
      sort: 'relevance',
      time: 'year',
    });

    for (const r of results) {
      if (!seenIds.has(r.reddit_id)) {
        seenIds.add(r.reddit_id);
        r.industry = industry || classifyIndustryFromSubreddit(r.subreddit);
        allComplaints.push(r);
      }
    }

    // Small delay between requests to be polite
    await sleep(500);
  }

  // Sort by score (engagement) descending
  allComplaints.sort((a, b) => (b.score || 0) - (a.score || 0));

  return allComplaints;
}

/**
 * Search specifically for subreddits where business owners discuss problems.
 */
export async function findComplaintsAcrossSubreddits(opts = {}) {
  const allComplaints = [];
  const seenIds = new Set();
  const queryCombos = [
    'no show appointment client',
    'cancellation last minute booking',
    'losing money missed appointments',
    'client ghosted booking',
    'empty schedule no shows',
  ];

  // Search targeted subreddits
  const targetSubs = opts.subreddits || SUBREDDITS.slice(0, 8);
  for (const sub of targetSubs) {
    for (const query of queryCombos.slice(0, 2)) {
      const results = await searchReddit(query, {
        subreddit: sub,
        limit: 5,
        time: 'all',
      });

      for (const r of results) {
        if (!seenIds.has(r.reddit_id)) {
          seenIds.add(r.reddit_id);
          r.industry = classifyIndustryFromSubreddit(sub);
          allComplaints.push(r);
        }
      }
      await sleep(300);
    }
  }

  allComplaints.sort((a, b) => (b.score || 0) - (a.score || 0));
  return allComplaints;
}

function normalizeRedditPost(post) {
  return {
    reddit_id: post.id,
    source: 'reddit',
    subreddit: post.subreddit || '',
    title: post.title || '',
    url: `https://reddit.com${post.permalink}`,
    body: (post.selftext || '').slice(0, 2000),
    author: post.author || '',
    score: post.score || 0,
    num_comments: post.num_comments || 0,
    created_utc: post.created_utc,
    pain_point: detectPainPoint(post.title + ' ' + (post.selftext || '')),
  };
}

function detectPainPoint(text) {
  const lower = text.toLowerCase();
  if (lower.includes('no show') || lower.includes('no-show') || lower.includes('noshow')) return 'No-shows';
  if (lower.includes('cancel')) return 'Cancellations';
  if (lower.includes('ghost')) return 'Client ghosting';
  if (lower.includes('lost revenue') || lower.includes('losing money')) return 'Revenue loss';
  if (lower.includes('missed') && lower.includes('appointment')) return 'Missed appointments';
  if (lower.includes('booking') && (lower.includes('system') || lower.includes('software'))) return 'Booking system issues';
  return 'General frustration';
}

function classifyIndustryFromSubreddit(sub) {
  const lower = (sub || '').toLowerCase();
  if (/hair|cosmetol/.test(lower)) return 'salon';
  if (/barber/.test(lower)) return 'barber';
  if (/tattoo/.test(lower)) return 'tattoo';
  if (/esthet|spa/.test(lower)) return 'spa';
  if (/dent/.test(lower)) return 'clinic';
  if (/massage/.test(lower)) return 'spa';
  if (/personal\s?train|yoga|fitness/.test(lower)) return 'fitness';
  return 'general';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export { PAIN_KEYWORDS, SUBREDDITS };
