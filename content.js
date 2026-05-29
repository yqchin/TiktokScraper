// content.js - Injected into TikTok pages to extract video data

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[\w\u0080-\uFFFF]+/g);
  return matches ? [...new Set(matches)] : [];
}

function cleanURL(url) {
  if (!url) return '';
  try {
    // If it's a relative URL, make it absolute first
    if (!url.startsWith('http')) {
      url = `https://www.tiktok.com${url}`;
    }
    const urlObj = new URL(url);
    // Remove query parameters and hash
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch (e) {
    // If URL parsing fails, return the URL without query params
    return url.split('?')[0].split('#')[0];
  }
}

function getVideoIdFromURL(url) {
  if (!url) return '';
  const match = url.match(/\/video\/(\d+)|\/v\/(\d+)/);
  return match ? (match[1] || match[2]) : '';
}

function getVideoCreatedAt(videoId) {
  if (!videoId || !/^\d+$/.test(videoId)) return '';

  try {
    const timestamp = Number(BigInt(videoId) >> 32n);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    return new Date(timestamp * 1000).toISOString();
  } catch (err) {
    return '';
  }
}

function normalizeVideoURL(url) {
  if (!url) return '';

  const absoluteURL = cleanURL(url);
  if (/\/@[^/]+\/video\/\d+/.test(absoluteURL)) {
    return absoluteURL;
  }

  const videoId = getVideoIdFromURL(url);
  if (videoId) {
    return `https://www.tiktok.com/video/${videoId}`;
  }
  return absoluteURL;
}

function extractCreatorFromURL(url) {
  if (!url) return '';
  const match = url.match(/\/@([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function absoluteTikTokURL(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://www.tiktok.com${url}`;
}

function getVideoLinkCount(el) {
  if (!el) return 0;
  return el.querySelectorAll('a[href*="/video/"], a[href*="/v/"]').length;
}

function findScopedVideoCard(videoLink) {
  const selectors = [
    '[data-e2e="user-post-item"]',
    '[data-e2e="recommend-list-item-container"]',
    '[data-e2e="search-card"]',
    'article',
    'div[role="article"]',
    'div[data-testid*="video"]',
    'div[class*="FeedItem"]',
    'div[class*="VideoCard"]'
  ];

  for (const selector of selectors) {
    const card = videoLink.closest(selector);
    if (card && getVideoLinkCount(card) <= 1) {
      return card;
    }
  }

  let node = videoLink.parentElement;
  while (node && node !== document.body) {
    const linkCount = getVideoLinkCount(node);
    if (linkCount === 1) {
      return node;
    }
    node = node.parentElement;
  }

  return videoLink;
}

function getHashtagsFromPage() {
  const hashtags = new Set();
  
  // Method 1: Extract from hashtag links
  document.querySelectorAll('a[href*="/tag/"]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/\/tag\/([^/?]+)/);
    if (match) {
      hashtags.add(`#${decodeURIComponent(match[1])}`);
    }
  });

  // Method 2: Extract from meta tags
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    const content = ogDescription.getAttribute('content') || '';
    const matches = content.match(/#[\w\u0080-\uFFFF]+/g);
    if (matches) {
      matches.forEach(tag => hashtags.add(tag));
    }
  }

  return Array.from(hashtags);
}

function cleanFallbackTitle(title) {
  const cleaned = (title || '')
    .replace(/\s+/g, ' ')
    .replace(/^Watch .*?'s video\s*/i, '')
    .replace(/^original sound\s*-\s*/i, '')
    .trim();

  if (
    !cleaned ||
    /^TikTok$/i.test(cleaned) ||
    /^Photo by /i.test(cleaned) ||
    /^(like|comment|share|follow|views?|play|pause)$/i.test(cleaned) ||
    /^\d+(\.\d+)?[KMB]?$/.test(cleaned)
  ) {
    return '';
  }

  return cleaned;
}

function getTitleFromFeedCard(card, videoLink) {
  const selectors = [
    '[data-e2e="video-desc"]',
    '[data-e2e="browse-video-desc"]',
    'img[alt]',
    '[aria-label]',
    '[title]'
  ];

  for (const selector of selectors) {
    const el = card.querySelector(selector);
    const raw = el?.getAttribute('alt') ||
                el?.getAttribute('aria-label') ||
                el?.getAttribute('title') ||
                el?.innerText ||
                el?.textContent ||
                '';
    const title = cleanFallbackTitle(raw);
    if (title) return title;
  }

  return cleanFallbackTitle(
    videoLink.getAttribute('aria-label') ||
    videoLink.getAttribute('title') ||
    videoLink.querySelector('img')?.getAttribute('alt') ||
    ''
  );
}

function findTikTokItemInJSON(value, videoId, state) {
  if (!value || state.visited > 20000) return null;
  if (typeof value !== 'object') return null;
  if (state.seen.has(value)) return null;

  state.seen.add(value);
  state.visited += 1;

  if (value.ItemModule && videoId && value.ItemModule[videoId]) {
    return value.ItemModule[videoId];
  }

  if (value.itemStruct) {
    const item = value.itemStruct;
    if (!videoId || String(item.id || '') === videoId) {
      return item;
    }
  }

  if (
    (!videoId || String(value.id || '') === videoId) &&
    (typeof value.desc === 'string' || Array.isArray(value.textExtra) || value.author)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTikTokItemInJSON(item, videoId, state);
      if (found) return found;
    }
    return null;
  }

  for (const key of Object.keys(value)) {
    const found = findTikTokItemInJSON(value[key], videoId, state);
    if (found) return found;
  }

  return null;
}

function getStructuredVideoData(doc, videoId) {
  const scripts = Array.from(doc.querySelectorAll('script')).filter(script => {
    const id = script.id || '';
    const type = script.type || '';
    return id.includes('SIGI') ||
           id.includes('UNIVERSAL') ||
           id.includes('REHYDRATION') ||
           type.includes('json');
  });

  for (const script of scripts) {
    const text = script.textContent || '';
    if (!text.trim()) continue;

    try {
      const json = JSON.parse(text);
      const item = findTikTokItemInJSON(json, videoId, {
        seen: new Set(),
        visited: 0
      });

      if (!item) continue;

      const hashtags = new Set(extractHashtags(item.desc || ''));
      (item.textExtra || []).forEach(extra => {
        if (extra.hashtagName) {
          hashtags.add(`#${extra.hashtagName}`);
        }
      });

      const creator = item.author?.uniqueId ||
                      item.authorInfo?.uniqueId ||
                      item.authorStats?.uniqueId ||
                      '';

      return {
        title: item.desc || '',
        hashtags: Array.from(hashtags),
        creatorUsername: creator
      };
    } catch (err) {
      // Ignore non-JSON scripts.
    }
  }

  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function scrapeCurrentVideo() {
  const result = {
    title: "",
    hashtags: [],
    creatorUsername: "",
    creatorProfileURL: "",
    videoURL: window.location.href,
    scrapedAt: new Date().toISOString()
  };

  // ── Video title / description ──────────────────────────────────────────
  // Method 1: Try meta tags first (most reliable)
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    result.title = ogDescription.getAttribute('content') || "";
  }

  // Method 2: Check TikTok-specific selectors
  if (!result.title) {
    const descSelectors = [
      '[data-e2e="browse-video-desc"]',
      '[data-e2e="video-desc"]',
      'h1[data-e2e="browse-video-desc"]',
      'h2[data-e2e="browse-video-desc"]',
      '.video-desc',
      '[class*="VideoDesc"]'
    ];

    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText || el.textContent;
        if (text && text.trim().length > 0) {
          result.title = text.trim();
          break;
        }
      }
    }
  }

  // Method 3: Look in all text for description-like content
  if (!result.title) {
    const textElements = document.querySelectorAll('span, p, div');
    for (const el of textElements) {
      const text = (el.innerText || el.textContent || '').trim();
      if (text && text.length > 10 && text.length < 500 && 
          (text.includes('#') || text.match(/[a-z]/i))) {
        // Skip navigation and UI text
        if (!text.match(/^(Save|Share|Comment|Like|Subscribe|Following|Follow|Report|Share to|Copy link)/i)) {
          result.title = text;
          break;
        }
      }
    }
  }

  // ── Extract hashtags from title and page ────────────────────────────────
  if (result.title) {
    result.hashtags = extractHashtags(result.title);
  }
  
  // Merge with hashtags from links on the page
  const pageHashtags = getHashtagsFromPage();
  result.hashtags = [...new Set([...result.hashtags, ...pageHashtags])];

  // ── Creator username ───────────────────────────────────────────────────
  // Method 1: Use data-e2e attributes (most reliable)
  const usernameSelectors = [
    '[data-e2e="browse-username"]',
    '[data-e2e="video-author-uniqueid"]',
    'span[data-e2e="browse-username"]',
    'h2[data-e2e="browse-username"]'
  ];

  for (const sel of usernameSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText || el.textContent;
      if (text && text.trim().length > 0) {
        result.creatorUsername = text.trim().replace(/^@/, '');
        break;
      }
    }
  }

  // Method 2: Extract from profile link
  if (!result.creatorUsername) {
    const profileLink = document.querySelector('a[href*="/@"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href');
      if (href) {
        const match = href.match(/\/@([^/?]+)/);
        if (match) {
          result.creatorUsername = match[1];
        }
      }
    }
  }

  // Method 3: Check for author name in common selectors
  if (!result.creatorUsername) {
    const authorSelectors = [
      'span[class*="UniqueId"]',
      'span[class*="uniqueId"]',
      '[class*="AuthorName"] span',
      'a[href*="/@"] span'
    ];
    for (const sel of authorSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText || el.textContent;
        if (text && text.trim().length > 0 && text.includes('@')) {
          result.creatorUsername = text.trim().replace(/^@/, '');
          break;
        }
      }
    }
  }

  // ── Creator profile URL ────────────────────────────────────────────────
  // Method 1: Use avatar link (most reliable)
  const avatarLinkSelectors = [
    'a[data-e2e="browse-user-avatar"]',
    'a[data-e2e="video-author-avatar"]'
  ];

  for (const sel of avatarLinkSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const href = el.getAttribute('href');
      if (href && href.includes('/@')) {
        result.creatorProfileURL = cleanURL(href);
        if (!result.creatorUsername && href.includes('/@')) {
          const match = href.match(/\/@([^/?]+)/);
          if (match) {
            result.creatorUsername = match[1];
          }
        }
        break;
      }
    }
  }

  // Method 2: Find profile link in common locations
  if (!result.creatorProfileURL) {
    const profileLinks = document.querySelectorAll('a[href*="/@"]');
    for (const link of profileLinks) {
      const href = link.getAttribute('href');
      if (href && !href.includes('/video/')) {
        result.creatorProfileURL = cleanURL(href);
        if (!result.creatorUsername) {
          const match = href.match(/\/@([^/?]+)/);
          if (match) {
            result.creatorUsername = match[1];
          }
        }
        break;
      }
    }
  }

  // Fallback: build profile URL from username
  if (!result.creatorProfileURL && result.creatorUsername) {
    result.creatorProfileURL = `https://www.tiktok.com/@${result.creatorUsername}`;
  }

  // ── Video URL cleanup ──────────────────────────────────────────────────
  const canonical = document.querySelector('link[rel="canonical"]');
  const canonicalURL = canonical?.getAttribute('href') || '';
  if (canonicalURL) {
    result.videoURL = normalizeVideoURL(canonicalURL);
  } else {
    // For video pages, extract the clean URL
    const url = new URL(window.location.href);
    result.videoURL = normalizeVideoURL(`${url.origin}${url.pathname}`);
  }

  const videoId = getVideoIdFromURL(result.videoURL);
  result.videoCreatedAt = getVideoCreatedAt(videoId);

  const structured = getStructuredVideoData(document, videoId);
  if (structured?.title) {
    result.title = structured.title;
  }
  if (structured?.hashtags?.length) {
    result.hashtags = structured.hashtags;
  }
  if (!result.creatorUsername && structured?.creatorUsername) {
    result.creatorUsername = structured.creatorUsername;
    result.creatorProfileURL = `https://www.tiktok.com/@${structured.creatorUsername}`;
  }

  return result;
}

var FEED_MAX_SCROLLS = 160;
var FEED_IDLE_ROUNDS = 6;
var FEED_SCROLL_DELAY_MS = 1100;

function normalizeScrapeLimit(limit) {
  const parsed = parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return parsed;
}

function collectVisibleFeedVideos(videoMap, limit) {
  const profileUsername = /^\/@[^/]+\/?$/.test(window.location.pathname)
    ? extractCreatorFromURL(window.location.href)
    : '';
  const videoLinks = Array.from(document.querySelectorAll('a[href*="/video/"], a[href*="/v/"]'));

  for (const videoLink of videoLinks) {
    if (videoMap.size >= limit) {
      break;
    }

    const href = videoLink.getAttribute('href') || '';
    const videoId = getVideoIdFromURL(href);
    if (!videoId || videoMap.has(videoId)) {
      continue;
    }

    const card = findScopedVideoCard(videoLink);
    const data = {
      title: getTitleFromFeedCard(card, videoLink),
      hashtags: [],
      creatorUsername: "",
      creatorProfileURL: "",
      videoURL: normalizeVideoURL(href),
      videoCreatedAt: getVideoCreatedAt(videoId),
      sourceURL: absoluteTikTokURL(href),
      scrapedAt: new Date().toISOString()
    };

    // ── Extract creator information ────────────────────────────────────
    // Look for profile link - prioritize non-video links
    const profileLinks = Array.from(card.querySelectorAll('a[href*="/@"]'));
    const profileLink = profileLinks.find(a => {
      const href = a.getAttribute('href') || '';
      return !href.includes('/video/');
    }) || profileLinks[0];

    if (profileLink) {
      const href = profileLink.getAttribute('href');
      if (href && !href.includes('/video/')) {
        data.creatorProfileURL = cleanURL(href);
        const match = href.match(/\/@([^/?]+)/);
        if (match) {
          data.creatorUsername = match[1];
        }
      } else if (href && href.includes('/video/')) {
        // Extract creator from video URL
        const creatorMatch = href.match(/\/@([^/]+)/);
        if (creatorMatch) {
          data.creatorUsername = creatorMatch[1];
          data.creatorProfileURL = `https://www.tiktok.com/@${creatorMatch[1]}`;
        }
      }
    }

    if (!data.creatorUsername) {
      data.creatorUsername = extractCreatorFromURL(href) || profileUsername;
    }

    if (!data.creatorProfileURL && data.creatorUsername) {
      data.creatorProfileURL = `https://www.tiktok.com/@${data.creatorUsername}`;
    }

    videoMap.set(videoId, data);
  }
}

async function scrapeFeedVideos(limit = 100) {
  limit = normalizeScrapeLimit(limit);
  const videoMap = new Map();
  let idleRounds = 0;
  let lastCount = 0;
  let previousHeight = 0;

  collectVisibleFeedVideos(videoMap, limit);

  for (let i = 0; i < FEED_MAX_SCROLLS && idleRounds < FEED_IDLE_ROUNDS && videoMap.size < limit; i += 1) {
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    window.scrollTo(0, scrollHeight);
    await delay(FEED_SCROLL_DELAY_MS);
    collectVisibleFeedVideos(videoMap, limit);

    const currentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    if (videoMap.size === lastCount && currentHeight === previousHeight) {
      idleRounds += 1;
    } else {
      idleRounds = 0;
      lastCount = videoMap.size;
      previousHeight = currentHeight;
    }
  }

  const videos = Array.from(videoMap.values()).slice(0, limit);
  return videos.map(({ sourceURL, ...video }) => ({
    ...video,
    hashtags: video.hashtags?.length ? video.hashtags : extractHashtags(video.title)
  }));
}

// Listen for messages from popup
if (!window.__tiktokScraperContentListenerInstalled) {
  window.__tiktokScraperContentListenerInstalled = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrape') {
      (async () => {
        try {
          const url = window.location.href;
          let result;

          // Better detection for video pages
          const isVideoPage = url.includes('/video/') || 
                              url.match(/\/@[\w._-]+\/video\/\d+/) ||
                              url.includes('/v/');

          if (isVideoPage) {
            // Single video page - scrape specific video
            const videoData = scrapeCurrentVideo();
            result = { type: 'single', data: [videoData] };
          } else {
            // Try to scrape feed first
            const feedVideos = await scrapeFeedVideos(request.limit);
            if (feedVideos.length > 0) {
              result = { type: 'feed', data: feedVideos };
            } else {
              result = { type: 'feed', data: [] };
            }
          }

          sendResponse({ 
            success: true, 
            result,
            debug: {
              url,
              itemsFound: result.data.length,
              pageType: result.type
            }
          });
        } catch (err) {
          sendResponse({ 
            success: false, 
            error: err.message,
            stack: err.stack
          });
        }
      })();
    }
    return true; // keep channel open for async
  });
}
