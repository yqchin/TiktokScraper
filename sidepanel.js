let scrapedData = [];
let accountData = [];
let activeView = 'videos';
const PROFILE_SCAN_MAX_ATTEMPTS = 3;
const IGNORED_CREATOR_USERNAMES = new Set(['3043842031a']);

const scrapeBtn = document.getElementById('scrapeBtn');
const exportCSV = document.getElementById('exportCSV');
const exportJSON = document.getElementById('exportJSON');
const clearBtn = document.getElementById('clearBtn');
const resultsList = document.getElementById('resultsList');
const accountsList = document.getElementById('accountsList');
const videoEmptyState = document.getElementById('videoEmptyState');
const accountEmptyState = document.getElementById('accountEmptyState');
const countBadge = document.getElementById('countBadge');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const scrapeLimit = document.getElementById('scrapeLimit');
const hashtagInput = document.getElementById('hashtagInput');
const hashtagBtn = document.getElementById('hashtagBtn');
const profileVideoLimit = document.getElementById('profileVideoLimit');
const accountSourceLimit = document.getElementById('accountSourceLimit');
const accountHashtagInput = document.getElementById('accountHashtagInput');
const accountListInput = document.getElementById('accountListInput');
const scanAccountsBtn = document.getElementById('scanAccountsBtn');
const fetchBiosBtn = document.getElementById('fetchBiosBtn');
const tabButtons = document.querySelectorAll('.tab-btn');
const videosPanel = document.getElementById('videosPanel');
const accountsPanel = document.getElementById('accountsPanel');
const videosResults = document.getElementById('videosResults');
const accountsResults = document.getElementById('accountsResults');

function setStatus(state, msg) {
  statusDot.className = 'status-dot' + (state ? ` ${state}` : '');
  statusText.textContent = msg;
}

function getScrapeLimit() {
  const raw = parseInt(scrapeLimit.value, 10);
  if (!Number.isFinite(raw) || raw < 1) {
    scrapeLimit.value = '100';
    return 100;
  }

  scrapeLimit.value = String(raw);
  return raw;
}

function getProfileVideoLimit() {
  const raw = parseInt(profileVideoLimit.value, 10);
  if (!Number.isFinite(raw) || raw < 1) {
    profileVideoLimit.value = '50';
    return 50;
  }

  profileVideoLimit.value = String(raw);
  return raw;
}

function getAccountSourceLimit() {
  const raw = parseInt(accountSourceLimit.value, 10);
  if (!Number.isFinite(raw) || raw < 1) {
    accountSourceLimit.value = '100';
    return 100;
  }

  accountSourceLimit.value = String(raw);
  return raw;
}

function getActiveData() {
  return activeView === 'accounts' ? accountData : scrapedData;
}

function updateToolbarState() {
  const count = getActiveData().length;
  countBadge.textContent = activeView === 'accounts'
    ? `${count} account${count !== 1 ? 's' : ''}`
    : `${count} video${count !== 1 ? 's' : ''}`;
  exportCSV.disabled = count === 0;
  exportJSON.disabled = count === 0;
  clearBtn.disabled = count === 0;
}

function setActiveView(view) {
  activeView = view;
  tabButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  videosPanel.classList.toggle('active', view === 'videos');
  accountsPanel.classList.toggle('active', view === 'accounts');
  videosResults.classList.toggle('active', view === 'videos');
  accountsResults.classList.toggle('active', view === 'accounts');
  updateToolbarState();
}

function mergeScrapedItem(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    title: incoming.title || existing.title || '',
    hashtags: incoming.hashtags?.length ? incoming.hashtags : (existing.hashtags || []),
    creatorUsername: incoming.creatorUsername || existing.creatorUsername || '',
    creatorProfileURL: incoming.creatorProfileURL || existing.creatorProfileURL || '',
    videoURL: incoming.videoURL || existing.videoURL || '',
    videoCreatedAt: incoming.videoCreatedAt || existing.videoCreatedAt || '',
    scrapedAt: incoming.scrapedAt || existing.scrapedAt
  };
}

function setScrapeBusy(isBusy) {
  scrapeBtn.disabled = isBusy;
  hashtagBtn.disabled = isBusy;
  scanAccountsBtn.disabled = isBusy;
  fetchBiosBtn.disabled = isBusy;
  scrapeLimit.disabled = isBusy;
  hashtagInput.disabled = isBusy;
  profileVideoLimit.disabled = isBusy;
  accountSourceLimit.disabled = isBusy;
  accountHashtagInput.disabled = isBusy;
  accountListInput.disabled = isBusy;
  tabButtons.forEach(button => {
    button.disabled = isBusy;
  });
}

function mergeItems(items) {
  let addedCount = 0;
  let updatedCount = 0;

  items.forEach(item => {
    if (isIgnoredCreator(item.creatorUsername)) {
      return;
    }

    const existingIndex = scrapedData.findIndex(existing =>
      existing.videoURL === item.videoURL && item.videoURL
    );

    if (existingIndex >= 0) {
      scrapedData[existingIndex] = mergeScrapedItem(scrapedData[existingIndex], item);
      updatedCount += 1;
    } else {
      scrapedData.push(item);
      addedCount += 1;
    }
  });

  return { addedCount, updatedCount };
}

function cleanAccountTitle(title) {
  const cleaned = (title || '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\u2026\s|:-]+/, '')
    .replace(/#[\w\u0080-\uFFFF]+/g, '')
    .replace(/^Watch .*?'s video\s*/i, '')
    .replace(/^Watch @?[\w.-]+'?s video\s*/i, '')
    .replace(/^@?[\w.-]+'?s video\s*[:|-]?\s*/i, '')
    .replace(/^original sound\s*-\s*/i, '')
    .replace(/\s*\|\s*TikTok\s*$/i, '')
    .replace(/\s*-\s*TikTok\s*$/i, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();

  if (/['\u2019]s profile$/i.test(cleaned)) {
    return '';
  }

  return cleaned;
}

function formatNumberedTitles(titles) {
  return (titles || [])
    .map(cleanAccountTitle)
    .filter(Boolean)
    .map((title, index) => `Video ${index + 1}: ${title}`);
}

function normalizeUsername(username) {
  return (username || '').replace(/^@/, '').trim().toLowerCase();
}

function isIgnoredCreator(username) {
  return IGNORED_CREATOR_USERNAMES.has(normalizeUsername(username));
}

function normalizeAccount(account) {
  const username = normalizeUsername(account.creatorUsername);
  const videos = account.videos || [];
  const titles = account.titles?.length
    ? account.titles.map(cleanAccountTitle).filter(Boolean)
    : videos.map(video => cleanAccountTitle(video.title)).filter(Boolean);
  const hashtags = account.hashtags?.length
    ? account.hashtags
    : [...new Set(videos.flatMap(video => video.hashtags || []))];
  const sourceHashtags = [...new Set(account.sourceHashtags || [])];

  return {
    creatorUsername: username,
    creatorProfileURL: account.creatorProfileURL || (username ? `https://www.tiktok.com/@${username}` : ''),
    nickname: account.nickname || '',
    bio: account.bio || '',
    followerCount: account.followerCount ?? '',
    followingCount: account.followingCount ?? '',
    heartCount: account.heartCount ?? '',
    tiktokVideoCount: account.tiktokVideoCount ?? '',
    videoCount: account.videoCount || videos.length,
    titles,
    hashtags,
    sourceHashtags,
    videos,
    scrapedAt: account.scrapedAt || new Date().toISOString()
  };
}

function mergeAccount(account) {
  const incoming = normalizeAccount(account);
  if (!incoming.creatorUsername || isIgnoredCreator(incoming.creatorUsername)) {
    return 'ignored';
  }

  const existingIndex = accountData.findIndex(existing =>
    normalizeUsername(existing.creatorUsername) === incoming.creatorUsername && incoming.creatorUsername
  );

  if (existingIndex >= 0) {
    accountData[existingIndex] = {
      ...accountData[existingIndex],
      ...incoming,
      nickname: incoming.nickname || accountData[existingIndex].nickname || '',
      bio: incoming.bio || accountData[existingIndex].bio || '',
      followerCount: incoming.followerCount ?? accountData[existingIndex].followerCount ?? '',
      followingCount: incoming.followingCount ?? accountData[existingIndex].followingCount ?? '',
      heartCount: incoming.heartCount ?? accountData[existingIndex].heartCount ?? '',
      tiktokVideoCount: incoming.tiktokVideoCount ?? accountData[existingIndex].tiktokVideoCount ?? '',
      titles: incoming.titles?.length ? incoming.titles : (accountData[existingIndex].titles || []),
      hashtags: incoming.hashtags?.length ? incoming.hashtags : (accountData[existingIndex].hashtags || []),
      sourceHashtags: [
        ...new Set([
          ...(accountData[existingIndex].sourceHashtags || []),
          ...(incoming.sourceHashtags || [])
        ])
      ],
      videos: incoming.videos?.length ? incoming.videos : (accountData[existingIndex].videos || [])
    };
    return 'updated';
  }

  accountData.push(incoming);
  return 'added';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function waitForTabLoad(tabId, timeoutMs = 30000) {
  return new Promise(resolve => {
    let done = false;
    const timeoutId = setTimeout(finish, timeoutMs);

    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        finish();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function navigateTab(tabId, url, active = true) {
  const loadPromise = waitForTabLoad(tabId);
  await chrome.tabs.update(tabId, { url, active });
  await loadPromise;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTab(tabId, limit) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (err) {
    console.log('Content script injection skipped:', err.message);
  }

  const response = await chrome.tabs.sendMessage(tabId, { action: 'scrape', limit });
  if (!response?.success) {
    throw new Error(response?.error || 'Unable to scrape this page.');
  }

  return response.result.data.filter(item =>
    !isIgnoredCreator(item.creatorUsername) && (item.videoURL || item.creatorUsername || item.title)
  );
}

async function scrapeProfileTab(tabId, limit) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (err) {
    console.log('Content script injection skipped:', err.message);
  }

  const response = await chrome.tabs.sendMessage(tabId, { action: 'scrapeProfile', limit });
  if (!response?.success) {
    throw new Error(response?.error || 'Unable to scrape this profile.');
  }

  return normalizeAccount(response.result.data);
}

function parseHashtags(value) {
  return [...new Set(
    value
      .split(',')
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
  )];
}

function parseAccountList(value) {
  const creatorMap = new Map();

  value
    .split(/[\n,]+/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .forEach(entry => {
      const profileMatch = entry.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([^/?#\s]+)/i);
      const rawUsername = profileMatch ? profileMatch[1] : entry.replace(/^@/, '');
      const username = normalizeUsername(rawUsername.replace(/[?#].*$/, ''));
      if (!username || isIgnoredCreator(username)) return;

      creatorMap.set(username, {
        creatorUsername: username,
        creatorProfileURL: `https://www.tiktok.com/@${username}`,
        sourceHashtags: [],
        sourceVideos: []
      });
    });

  return Array.from(creatorMap.values());
}

function getHashtagURL(tag) {
  return `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`;
}

function normalizeSourceVideo(item) {
  return {
    title: cleanAccountTitle(item.title),
    hashtags: item.hashtags || [],
    creatorUsername: normalizeUsername(item.creatorUsername),
    creatorProfileURL: item.creatorProfileURL || '',
    videoURL: item.videoURL || '',
    videoCreatedAt: item.videoCreatedAt || '',
    scrapedAt: item.scrapedAt || new Date().toISOString()
  };
}

function mergeVideosByURL(videos) {
  const videoMap = new Map();

  videos.forEach(video => {
    if (!video) return;
    const key = video.videoURL || `${cleanAccountTitle(video.title)}|${video.videoCreatedAt || ''}`;
    if (!key.trim()) return;

    const existing = videoMap.get(key) || {};
    videoMap.set(key, {
      ...existing,
      ...video,
      title: cleanAccountTitle(video.title) || cleanAccountTitle(existing.title),
      hashtags: video.hashtags?.length ? video.hashtags : (existing.hashtags || [])
    });
  });

  return Array.from(videoMap.values());
}

function limitVideos(videos, limit) {
  const parsed = parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return videos || [];
  }

  return (videos || []).slice(0, parsed);
}

function getUniqueCreatorsFromVideos() {
  const creatorMap = new Map();

  scrapedData.forEach(item => {
    const username = normalizeUsername(item.creatorUsername);
    if (!username || isIgnoredCreator(username)) return;

    const existing = creatorMap.get(username) || {
      creatorUsername: username,
      creatorProfileURL: item.creatorProfileURL || `https://www.tiktok.com/@${username}`,
      sourceVideos: []
    };

    existing.sourceVideos = mergeVideosByURL([
      ...(existing.sourceVideos || []),
      normalizeSourceVideo(item)
    ]);

    creatorMap.set(username, existing);
  });

  return Array.from(creatorMap.values());
}

function getCreatorsFromExistingAccounts() {
  return accountData
    .map(account => normalizeAccount(account))
    .filter(account => account.creatorUsername && !isIgnoredCreator(account.creatorUsername))
    .map(account => ({
      creatorUsername: account.creatorUsername,
      creatorProfileURL: account.creatorProfileURL || `https://www.tiktok.com/@${account.creatorUsername}`,
      sourceHashtags: account.sourceHashtags || [],
      sourceVideos: account.videos || []
    }));
}

function addCreatorsFromItems(creatorMap, items, sourceTag = '') {
  items.forEach(item => {
    const username = normalizeUsername(item.creatorUsername);
    if (!username || isIgnoredCreator(username)) return;

    const existing = creatorMap.get(username) || {
      creatorUsername: username,
      creatorProfileURL: item.creatorProfileURL || `https://www.tiktok.com/@${username}`,
      sourceHashtags: [],
      sourceVideos: []
    };

    if (!existing.creatorProfileURL && item.creatorProfileURL) {
      existing.creatorProfileURL = item.creatorProfileURL;
    }
    if (sourceTag) {
      existing.sourceHashtags = [...new Set([...(existing.sourceHashtags || []), `#${sourceTag}`])];
    }
    existing.sourceVideos = mergeVideosByURL([
      ...(existing.sourceVideos || []),
      normalizeSourceVideo(item)
    ]);

    creatorMap.set(username, existing);
  });
}

async function getCreatorsFromAccountHashtags(tabId, tags, limit) {
  const creatorMap = new Map();

  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    setStatus('loading', `Finding accounts in #${tag} (${i + 1}/${tags.length})...`);
    await navigateTab(tabId, getHashtagURL(tag));
    await delay(2500);

    const items = await scrapeTab(tabId, limit);
    addCreatorsFromItems(creatorMap, items, tag);
  }

  return Array.from(creatorMap.values());
}

async function getAccountSourceCreators(tabId, tags, sourceLimit, accountList) {
  if (accountList.length) {
    return accountList;
  }
  if (tags.length) {
    return getCreatorsFromAccountHashtags(tabId, tags, sourceLimit);
  }

  const videoCreators = getUniqueCreatorsFromVideos();
  if (videoCreators.length) {
    return videoCreators;
  }

  return getCreatorsFromExistingAccounts();
}

function splitPendingCreators(creators, profileLimit) {
  const pending = [];
  let skippedCount = 0;

  creators.forEach(creator => {
    const username = normalizeUsername(creator.creatorUsername);
    if (!username || isIgnoredCreator(username)) return;
    const existing = accountData.find(account =>
      normalizeUsername(account.creatorUsername) === username
    );
    const hasScrapedVideos = Boolean(
      existing && ((existing.videos || []).length > 0 || (existing.titles || []).length > 0)
    );

    if (hasScrapedVideos) {
      mergeCreatorSourceIntoExistingAccount(creator, profileLimit);
      skippedCount += 1;
      return;
    }

    pending.push({
      ...creator,
      creatorUsername: username
    });
  });

  return { pending, skippedCount };
}

function mergeCreatorSourceIntoExistingAccount(creator, profileLimit) {
  const username = normalizeUsername(creator.creatorUsername);
  const existingIndex = accountData.findIndex(account =>
    normalizeUsername(account.creatorUsername) === username
  );

  if (existingIndex < 0) return;

  const existing = normalizeAccount(accountData[existingIndex]);
  const combinedVideos = limitVideos(mergeVideosByURL([
    ...(creator.sourceVideos || []),
    ...(existing.videos || [])
  ]), profileLimit);
  const combinedHashtags = [
    ...new Set([
      ...combinedVideos.flatMap(video => video.hashtags || [])
    ])
  ];

  accountData[existingIndex] = {
    ...existing,
    videoCount: combinedVideos.length,
    titles: combinedVideos.map(video => cleanAccountTitle(video.title)).filter(Boolean),
    hashtags: combinedHashtags,
    sourceHashtags: [
      ...new Set([
        ...(existing.sourceHashtags || []),
        ...(creator.sourceHashtags || [])
      ])
    ],
    videos: combinedVideos
  };
}

function getUserDetailFromProfileHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const script = doc.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
  if (!script?.textContent) {
    throw new Error('Profile data JSON not found.');
  }

  const json = JSON.parse(script.textContent);
  const detail = json.__DEFAULT_SCOPE__?.['webapp.user-detail'] || json['webapp.user-detail'];
  const userInfo = detail?.userInfo || {};
  const user = userInfo.user || {};
  const stats = userInfo.stats || {};
  const username = normalizeUsername(user.uniqueId);

  if (!username) {
    throw new Error('Profile username not found.');
  }

  return {
    creatorUsername: username,
    creatorProfileURL: `https://www.tiktok.com/@${username}`,
    nickname: user.nickname || '',
    bio: user.signature || '',
    followerCount: stats.followerCount ?? '',
    followingCount: stats.followingCount ?? '',
    heartCount: stats.heartCount ?? '',
    tiktokVideoCount: stats.videoCount ?? '',
    scrapedAt: new Date().toISOString()
  };
}

async function fetchAccountBio(creator, profileLimit = Infinity) {
  const username = normalizeUsername(creator.creatorUsername);
  const profileURL = creator.creatorProfileURL || `https://www.tiktok.com/@${username}`;
  const response = await fetch(profileURL, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Profile fetch failed with ${response.status}.`);
  }

  const html = await response.text();
  if (/Access Denied|errors\.edgesuite\.net/i.test(html)) {
    throw new Error('TikTok blocked profile fetch.');
  }

  return {
    ...getUserDetailFromProfileHTML(html),
    sourceHashtags: creator.sourceHashtags || [],
    videos: limitVideos(creator.sourceVideos || [], profileLimit)
  };
}

async function scanCreatorInTab(tabId, creator, profileLimit, position, total) {
  const profileURL = creator.creatorProfileURL || `https://www.tiktok.com/@${creator.creatorUsername}`;
  let lastError;

  for (let attempt = 1; attempt <= PROFILE_SCAN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const attemptText = attempt > 1 ? ` retry ${attempt}/${PROFILE_SCAN_MAX_ATTEMPTS}` : '';
      setStatus('loading', `Opening @${creator.creatorUsername} (${position}/${total})${attemptText}...`);
      await navigateTab(tabId, profileURL);
      await delay(2500 + ((attempt - 1) * 1500));

      setStatus('loading', `Scanning @${creator.creatorUsername} (${position}/${total})${attemptText}...`);
      const account = await scrapeProfileTab(tabId, profileLimit);
      return mergeProfileWithSourceVideos(account, creator, profileURL, profileLimit);
    } catch (err) {
      lastError = err;
      if (attempt < PROFILE_SCAN_MAX_ATTEMPTS) {
        await delay(1500 * attempt);
      }
    }
  }

  throw lastError || new Error(`Unable to scan @${creator.creatorUsername}`);
}

function mergeProfileWithSourceVideos(account, creator, profileURL, profileLimit) {
  const combinedVideos = limitVideos(mergeVideosByURL([
    ...(creator.sourceVideos || []),
    ...(account.videos || [])
  ]), profileLimit);
  const combinedHashtags = [
    ...new Set([
      ...combinedVideos.flatMap(video => video.hashtags || [])
    ])
  ];

  return {
    ...account,
    creatorUsername: account.creatorUsername || creator.creatorUsername,
    creatorProfileURL: account.creatorProfileURL || profileURL,
    videoCount: combinedVideos.length,
    titles: combinedVideos.map(video => cleanAccountTitle(video.title)).filter(Boolean),
    hashtags: combinedHashtags,
    videos: combinedVideos,
    sourceHashtags: [
      ...new Set([
        ...(creator.sourceHashtags || []),
        ...(account.sourceHashtags || [])
      ])
    ]
  };
}

async function scanCreatorsInCurrentTab(tabId, creators, profileLimit) {
  let completedCount = 0;
  let addedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < creators.length; i += 1) {
    try {
      const account = await scanCreatorInTab(tabId, creators[i], profileLimit, i + 1, creators.length);
      const merged = mergeAccount(account);
      if (merged === 'added') {
        addedCount += 1;
      } else if (merged === 'updated') {
        updatedCount += 1;
      }

      await chrome.storage.local.set({ accountData });
      renderAccounts();
    } catch (err) {
      failedCount += 1;
      console.log(`Unable to scan @${creators[i].creatorUsername}:`, err.message);
    } finally {
      completedCount += 1;
      setStatus('loading', `Scanned ${completedCount}/${creators.length} accounts in current tab...`);
    }
  }

  return { addedCount, updatedCount, failedCount };
}

function renderResults() {
  resultsList.innerHTML = '';
  const count = scrapedData.length;
  videoEmptyState.style.display = count === 0 ? 'flex' : 'none';

  scrapedData.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'video-card';

    const cleanedTitle = cleanAccountTitle(item.title);
    const title = cleanedTitle || 'No title found';
    const titleClass = item.title ? 'card-title' : 'card-title empty';
    const tagsHTML = item.hashtags?.length
      ? item.hashtags.map(tag => `<span class="tag">${escHtml(tag)}</span>`).join('')
      : '<span class="no-tags">No hashtags found</span>';

    const creator = item.creatorUsername ? `@${item.creatorUsername}` : '-';
    const profile = item.creatorProfileURL
      ? `<a class="card-link" href="${escAttr(item.creatorProfileURL)}" target="_blank" title="${escAttr(item.creatorProfileURL)}">${escHtml(truncate(item.creatorProfileURL, 44))}</a>`
      : '<span class="meta-value">-</span>';
    const video = item.videoURL
      ? `<a class="card-link" href="${escAttr(item.videoURL)}" target="_blank" title="${escAttr(item.videoURL)}">${escHtml(truncate(item.videoURL, 44))}</a>`
      : '<span class="meta-value">-</span>';
    const created = item.videoCreatedAt ? formatDate(item.videoCreatedAt) : '-';

    card.innerHTML = `
      <div class="card-header">
        <span class="card-index">#${index + 1} · ${formatDate(item.scrapedAt)}</span>
        <button class="copy-btn copy-video" data-index="${index}" title="Copy JSON" aria-label="Copy JSON">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <h2 class="${titleClass}">${escHtml(title)}</h2>
      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">Creator</span>
          <span class="meta-value">${escHtml(creator)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Profile</span>
          ${profile}
        </div>
        <div class="meta-row">
          <span class="meta-label">Video</span>
          ${video}
        </div>
        <div class="meta-row">
          <span class="meta-label">Created</span>
          <span class="meta-value">${escHtml(created)}</span>
        </div>
      </div>
      <div class="tags-row">${tagsHTML}</div>
    `;

    resultsList.appendChild(card);
  });

  document.querySelectorAll('.copy-video').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index, 10);
      navigator.clipboard.writeText(JSON.stringify(scrapedData[index], null, 2));
      button.classList.add('copied');
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m20 6-11 11-5-5"></path>
        </svg>
      `;
      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        `;
      }, 1400);
    });
  });

  updateToolbarState();
}

function renderAccounts() {
  accountsList.innerHTML = '';
  const count = accountData.length;
  accountEmptyState.style.display = count === 0 ? 'flex' : 'none';

  accountData.forEach((account, index) => {
    const card = document.createElement('article');
    card.className = 'account-card';

    const username = account.creatorUsername ? `@${account.creatorUsername}` : 'Unknown creator';
    const profile = account.creatorProfileURL
      ? `<a class="card-link" href="${escAttr(account.creatorProfileURL)}" target="_blank" title="${escAttr(account.creatorProfileURL)}">${escHtml(truncate(account.creatorProfileURL, 44))}</a>`
      : '<span class="meta-value">-</span>';
    const bio = account.bio || 'No bio found';
    const numberedTitles = formatNumberedTitles(account.titles);
    const titlesHTML = numberedTitles.length
      ? numberedTitles.map(title => `<li>${escHtml(title)}</li>`).join('')
      : '<li>No titles found</li>';
    const tagsHTML = account.hashtags?.length
      ? account.hashtags.map(tag => `<span class="tag">${escHtml(tag)}</span>`).join('')
      : '<span class="no-tags">No hashtags found</span>';
    const sourceTagsHTML = account.sourceHashtags?.length
      ? account.sourceHashtags.map(tag => `<span class="tag">${escHtml(tag)}</span>`).join('')
      : '';

    card.innerHTML = `
      <div class="card-header">
        <span class="card-index">#${index + 1} · ${formatDate(account.scrapedAt)}</span>
        <button class="copy-btn copy-account" data-index="${index}" title="Copy JSON" aria-label="Copy JSON">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <h2 class="card-title">${escHtml(username)}</h2>
      <p class="card-bio">${escHtml(bio)}</p>
      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">Profile</span>
          ${profile}
        </div>
        <div class="meta-row">
          <span class="meta-label">Videos</span>
          <span class="meta-value">${escHtml(String(account.videoCount || 0))}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">TikTok</span>
          <span class="meta-value">${escHtml(String(account.tiktokVideoCount || '-'))}</span>
        </div>
      </div>
      ${sourceTagsHTML ? `
        <div class="summary-block">
          <span class="summary-label">Found From</span>
          <div class="tags-row">${sourceTagsHTML}</div>
        </div>
      ` : ''}
      <div class="summary-block">
        <span class="summary-label">Titles</span>
        <ul class="title-list">${titlesHTML}</ul>
      </div>
      <div class="summary-block">
        <span class="summary-label">Hashtags</span>
        <div class="tags-row">${tagsHTML}</div>
      </div>
    `;

    accountsList.appendChild(card);
  });

  document.querySelectorAll('.copy-account').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index, 10);
      navigator.clipboard.writeText(JSON.stringify(accountData[index], null, 2));
      button.classList.add('copied');
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m20 6-11 11-5-5"></path>
        </svg>
      `;
      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        `;
      }, 1400);
    });
  });

  updateToolbarState();
}

scrapeBtn.addEventListener('click', async () => {
  const limit = getScrapeLimit();
  setStatus('loading', `Scrolling for up to ${limit} videos...`);
  setScrapeBusy(true);

  try {
    const tab = await getActiveTab();

    if (!tab?.url || !tab.url.includes('tiktok.com')) {
      setStatus('error', 'Open a TikTok tab first.');
      return;
    }

    const newItems = await scrapeTab(tab.id, limit);

    if (newItems.length === 0) {
      setStatus('warning', 'No videos found on the loaded page.');
      return;
    }

    const { addedCount, updatedCount } = mergeItems(newItems);
    await chrome.storage.local.set({ scrapedData });

    const updateText = updatedCount ? `, refreshed ${updatedCount}` : '';
    setStatus('active', `Added ${addedCount}${updateText}. Total ${scrapedData.length}.`);
    renderResults();
  } catch (err) {
    const message = err.message.includes('Could not establish connection')
      ? 'Refresh the TikTok tab, then try again.'
      : err.message;
    setStatus('error', message);
  } finally {
    setScrapeBusy(false);
  }
});

hashtagBtn.addEventListener('click', async () => {
  const tags = parseHashtags(hashtagInput.value);
  const limit = getScrapeLimit();

  if (tags.length === 0) {
    setStatus('warning', 'Enter hashtags separated by commas.');
    return;
  }

  setScrapeBusy(true);

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus('error', 'Open a browser tab first.');
      return;
    }

    let totalAdded = 0;
    let totalUpdated = 0;

    for (let i = 0; i < tags.length; i += 1) {
      const tag = tags[i];
      setStatus('loading', `Opening #${tag} (${i + 1}/${tags.length})...`);

      await navigateTab(tab.id, getHashtagURL(tag));
      await delay(2500);

      setStatus('loading', `Scraping #${tag} (${i + 1}/${tags.length})...`);
      const items = await scrapeTab(tab.id, limit);
      const { addedCount, updatedCount } = mergeItems(items);
      totalAdded += addedCount;
      totalUpdated += updatedCount;

      await chrome.storage.local.set({ scrapedData });
      renderResults();
    }

    const updateText = totalUpdated ? `, refreshed ${totalUpdated}` : '';
    setStatus('active', `Hashtags done. Added ${totalAdded}${updateText}. Total ${scrapedData.length}.`);
  } catch (err) {
    setStatus('error', err.message || 'Unable to scrape hashtag pages.');
  } finally {
    setScrapeBusy(false);
  }
});

scanAccountsBtn.addEventListener('click', async () => {
  const profileLimit = getProfileVideoLimit();
  const sourceLimit = getAccountSourceLimit();
  const tags = parseHashtags(accountHashtagInput.value);
  const accountList = parseAccountList(accountListInput.value);

  setScrapeBusy(true);
  setActiveView('accounts');

  try {
    const tab = tags.length && !accountList.length ? await getActiveTab() : null;
    if (tags.length && !accountList.length && !tab?.id) {
      setStatus('error', 'Open a browser tab first.');
      return;
    }

    const creators = await getAccountSourceCreators(tab?.id, tags, sourceLimit, accountList);

    if (creators.length === 0) {
      const message = tags.length
        ? 'No creator accounts found from those hashtags.'
        : 'Paste accounts, scrape videos first, enter hashtags, or keep accounts in the Accounts tab.';
      setStatus('warning', message);
      return;
    }

    const { pending, skippedCount } = splitPendingCreators(creators, profileLimit);
    if (skippedCount > 0) {
      await chrome.storage.local.set({ accountData });
      renderAccounts();
    }

    if (pending.length === 0) {
      setStatus('active', `All ${skippedCount} account${skippedCount !== 1 ? 's' : ''} already scanned. Total ${accountData.length}.`);
      return;
    }

    setStatus('loading', `Skipping ${skippedCount}, scanning ${pending.length} account${pending.length !== 1 ? 's' : ''}...`);

    const { addedCount, updatedCount, failedCount } = await scanCreatorsInCurrentTab(
      tab.id,
      pending,
      profileLimit
    );

    const updateText = updatedCount ? `, refreshed ${updatedCount}` : '';
    const failedText = failedCount ? `, failed ${failedCount}` : '';
    const skippedText = skippedCount ? `, skipped ${skippedCount}` : '';
    setStatus('active', `Accounts done in current tab. Added ${addedCount}${updateText}${failedText}${skippedText}. Total ${accountData.length}.`);
  } catch (err) {
    setStatus('error', err.message || 'Unable to scan creator accounts.');
  } finally {
    setScrapeBusy(false);
  }
});

fetchBiosBtn.addEventListener('click', async () => {
  const profileLimit = getProfileVideoLimit();
  const sourceLimit = getAccountSourceLimit();
  const tags = parseHashtags(accountHashtagInput.value);
  const accountList = parseAccountList(accountListInput.value);

  setScrapeBusy(true);
  setActiveView('accounts');

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus('error', 'Open a browser tab first.');
      return;
    }

    const creators = await getAccountSourceCreators(tab.id, tags, sourceLimit, accountList);
    if (creators.length === 0) {
      const message = tags.length
        ? 'No creator accounts found from those hashtags.'
        : 'Paste accounts, scrape videos first, enter hashtags, or keep accounts in the Accounts tab.';
      setStatus('warning', message);
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < creators.length; i += 1) {
      const creator = creators[i];
      try {
        setStatus('loading', `Fetching bio @${creator.creatorUsername} (${i + 1}/${creators.length})...`);
        const account = await fetchAccountBio(creator, profileLimit);
        const merged = mergeAccount(account);
        if (merged !== 'ignored') {
          updatedCount += 1;
        }
        await chrome.storage.local.set({ accountData });
        renderAccounts();
        await delay(450);
      } catch (err) {
        failedCount += 1;
        console.log(`Unable to fetch bio @${creator.creatorUsername}:`, err.message);
      }
    }

    const failedText = failedCount ? `, failed ${failedCount}` : '';
    setStatus('active', `Bios fetched ${updatedCount}${failedText}. Total ${accountData.length}.`);
  } catch (err) {
    setStatus('error', err.message || 'Unable to fetch account bios.');
  } finally {
    setScrapeBusy(false);
  }
});

exportCSV.addEventListener('click', () => {
  if (activeView === 'accounts') {
    const headers = ['Creator Username', 'Creator Profile URL', 'Nickname', 'Bio', 'Follower Count', 'Following Count', 'Heart Count', 'TikTok Video Count', 'Scraped Video Count', 'Video Titles', 'All Hashtags', 'Found From Hashtags', 'Scraped At'];
    const rows = accountData.map(item => [
      csvEsc(item.creatorUsername),
      csvEsc(item.creatorProfileURL),
      csvEsc(item.nickname),
      csvEsc(item.bio),
      csvEsc(String(item.followerCount ?? '')),
      csvEsc(String(item.followingCount ?? '')),
      csvEsc(String(item.heartCount ?? '')),
      csvEsc(String(item.tiktokVideoCount ?? '')),
      csvEsc(String(item.videoCount || 0)),
      csvEsc(formatNumberedTitles(item.titles).join('\n')),
      csvEsc((item.hashtags || []).join(' ')),
      csvEsc((item.sourceHashtags || []).join(' ')),
      csvEsc(item.scrapedAt)
    ]);

    downloadFile('tiktok-accounts.csv', [headers.join(','), ...rows.map(row => row.join(','))].join('\n'), 'text/csv');
    setStatus('active', 'Accounts CSV exported.');
    return;
  }

  const headers = ['Title', 'Hashtags', 'Creator Username', 'Creator Profile URL', 'Video URL', 'Video Created At', 'Scraped At'];
  const rows = scrapedData.map(item => [
    csvEsc(cleanAccountTitle(item.title)),
    csvEsc((item.hashtags || []).join(' ')),
    csvEsc(item.creatorUsername),
    csvEsc(item.creatorProfileURL),
    csvEsc(item.videoURL),
    csvEsc(item.videoCreatedAt),
    csvEsc(item.scrapedAt)
  ]);

  downloadFile('tiktok-data.csv', [headers.join(','), ...rows.map(row => row.join(','))].join('\n'), 'text/csv');
  setStatus('active', 'Videos CSV exported.');
});

exportJSON.addEventListener('click', () => {
  if (activeView === 'accounts') {
    downloadFile('tiktok-accounts.json', JSON.stringify(accountData, null, 2), 'application/json');
    setStatus('active', 'Accounts JSON exported.');
    return;
  }

  downloadFile('tiktok-data.json', JSON.stringify(scrapedData, null, 2), 'application/json');
  setStatus('active', 'Videos JSON exported.');
});

clearBtn.addEventListener('click', async () => {
  if (activeView === 'accounts') {
    accountData = [];
    await chrome.storage.local.remove('accountData');
    setStatus('', 'Account rows cleared.');
    renderAccounts();
    return;
  }

  scrapedData = [];
  await chrome.storage.local.remove('scrapedData');
  setStatus('', 'Video rows cleared.');
  renderResults();
});

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, '&#39;');
}

function csvEsc(value) {
  const text = (value || '').replace(/"/g, '""');
  return `"${text}"`;
}

function truncate(str, length) {
  return str && str.length > length ? `${str.slice(0, length)}...` : str;
}

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    setActiveView(button.dataset.view);
  });
});

chrome.storage.local.get(['scrapedData', 'accountData'], ({ scrapedData: savedVideos, accountData: savedAccounts }) => {
  if (savedVideos?.length) {
    scrapedData = savedVideos.filter(item => !isIgnoredCreator(item.creatorUsername));
  }

  if (savedAccounts?.length) {
    accountData = savedAccounts
      .map(normalizeAccount)
      .filter(account => account.creatorUsername && !isIgnoredCreator(account.creatorUsername));
  }

  if (savedVideos?.length !== scrapedData.length || savedAccounts?.length !== accountData.length) {
    chrome.storage.local.set({ scrapedData, accountData });
  }

  if (scrapedData.length || accountData.length) {
    const videoText = `${scrapedData.length} video${scrapedData.length !== 1 ? 's' : ''}`;
    const accountText = `${accountData.length} account${accountData.length !== 1 ? 's' : ''}`;
    setStatus('active', `Loaded ${videoText} and ${accountText}.`);
  } else {
    setStatus('', 'Open TikTok, then scrape the current tab.');
  }

  renderResults();
  renderAccounts();
  setActiveView('videos');
});
