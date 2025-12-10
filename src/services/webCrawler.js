/**
 * Web Crawler Service
 * Crawls documentation sites to discover and load related pages
 * 
 * Features:
 * - BFS (breadth-first) crawling
 * - Depth limiting
 * - Same-domain filtering
 * - Deduplication
 * - Progress tracking
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * Crawl a website starting from a URL
 * 
 * @param {string} startUrl - Starting URL to crawl
 * @param {Object} options - Crawl options
 * @returns {Promise<Object>} Crawl results
 */
export async function crawlWebsite(startUrl, options = {}) {
  const {
    maxDepth = 2,           // Maximum depth to crawl
    maxPages = 30,          // Maximum pages to crawl
    sameDomain = true,      // Only crawl same domain
    skipLoaded = true,      // Skip URLs already loaded
    loadedUrls = new Set(), // Already loaded URLs (from KB)
  } = options;

  // Validate start URL
  let baseUrl;
  try {
    baseUrl = new URL(startUrl);
  } catch (error) {
    throw new Error(`Invalid start URL: ${startUrl}`);
  }

  // Crawl state
  const discovered = new Set([startUrl]); // All discovered URLs
  const crawled = new Set();              // Successfully crawled URLs
  const failed = [];                      // Failed URLs
  const queue = [{ url: startUrl, depth: 0 }]; // BFS queue

  console.log(`🕷️  Starting crawl from: ${startUrl}`);
  console.log(`   Max depth: ${maxDepth}, Max pages: ${maxPages}`);

  // BFS crawl
  while (queue.length > 0 && crawled.size < maxPages) {
    const { url, depth } = queue.shift();

    // Skip if already crawled
    if (crawled.has(url)) {
      continue;
    }

    // Skip if already loaded (optional)
    if (skipLoaded && loadedUrls.has(url)) {
      console.log(`   ⏭️  Skipping (already loaded): ${url}`);
      crawled.add(url);
      continue;
    }

    // Skip if max depth exceeded
    if (depth > maxDepth) {
      console.log(`   ⏭️  Skipping (max depth): ${url}`);
      continue;
    }

    // Crawl the page
    try {
      console.log(`   📄 [${crawled.size + 1}/${maxPages}] Depth ${depth}: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AssuranceAI-Crawler/1.0)',
        },
      });

      if (!response.headers['content-type']?.includes('text/html')) {
        console.log(`   ⏭️  Skipping (not HTML): ${url}`);
        crawled.add(url);
        continue;
      }

      const $ = cheerio.load(response.data);
      
      // Extract links from page
      const links = new Set();
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          // Resolve relative URLs
          const linkUrl = new URL(href, url);
          
          // Remove hash/fragment
          linkUrl.hash = '';
          const cleanUrl = linkUrl.toString();

          // Apply same-domain filter
          if (sameDomain && linkUrl.hostname !== baseUrl.hostname) {
            return;
          }

          // Skip non-documentation URLs (common patterns)
          if (
            cleanUrl.includes('/api/') ||       // API endpoints
            cleanUrl.includes('/assets/') ||    // Static assets
            cleanUrl.includes('/images/') ||
            cleanUrl.includes('.pdf') ||
            cleanUrl.includes('.zip') ||
            cleanUrl.match(/\.(jpg|jpeg|png|gif|svg|css|js)$/i)
          ) {
            return;
          }

          links.add(cleanUrl);
        } catch (error) {
          // Invalid URL, skip
        }
      });

      // Mark as crawled
      crawled.add(url);

      // Add new links to queue (only if not discovered yet)
      for (const link of links) {
        if (!discovered.has(link) && crawled.size + queue.length < maxPages) {
          discovered.add(link);
          queue.push({ url: link, depth: depth + 1 });
        }
      }

      console.log(`   ✅ Found ${links.size} links (${queue.length} in queue)`);

    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failed.push({ url, error: error.message });
      crawled.add(url); // Mark as processed to avoid retry
    }

    // Small delay to be polite to servers
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const results = {
    startUrl,
    discovered: Array.from(discovered),
    crawled: Array.from(crawled),
    failed,
    stats: {
      discovered: discovered.size,
      crawled: crawled.size,
      failed: failed.length,
      skipped: discovered.size - crawled.size - failed.length,
    },
  };

  console.log(`\n🏁 Crawl complete:`);
  console.log(`   Discovered: ${results.stats.discovered} URLs`);
  console.log(`   Crawled: ${results.stats.crawled} URLs`);
  console.log(`   Failed: ${results.stats.failed} URLs`);
  console.log(`   Skipped: ${results.stats.skipped} URLs`);

  return results;
}

/**
 * Filter URLs by pattern (e.g., only documentation pages)
 * 
 * @param {Array<string>} urls - URLs to filter
 * @param {Object} filters - Filter options
 * @returns {Array<string>} Filtered URLs
 */
export function filterUrls(urls, filters = {}) {
  const {
    includePatterns = [],   // Must match at least one
    excludePatterns = [],   // Must not match any
  } = filters;

  return urls.filter(url => {
    // Check include patterns
    if (includePatterns.length > 0) {
      const matches = includePatterns.some(pattern => {
        if (typeof pattern === 'string') {
          return url.includes(pattern);
        }
        return pattern.test(url); // Regex
      });
      if (!matches) return false;
    }

    // Check exclude patterns
    if (excludePatterns.length > 0) {
      const matches = excludePatterns.some(pattern => {
        if (typeof pattern === 'string') {
          return url.includes(pattern);
        }
        return pattern.test(url); // Regex
      });
      if (matches) return false;
    }

    return true;
  });
}

