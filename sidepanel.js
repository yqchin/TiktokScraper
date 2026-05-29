let scrapedData = [];

const scrapeBtn = document.getElementById('scrapeBtn');
const exportCSV = document.getElementById('exportCSV');
const exportJSON = document.getElementById('exportJSON');
const clearBtn = document.getElementById('clearBtn');
const resultsList = document.getElementById('resultsList');
const emptyState = document.getElementById('emptyState');
const countBadge = document.getElementById('countBadge');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const scrapeLimit = document.getElementById('scrapeLimit');
const hashtagInput = document.getElementById('hashtagInput');
const hashtagBtn = document.getElementById('hashtagBtn');

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
  scrapeLimit.disabled = isBusy;
  hashtagInput.disabled = isBusy;
}

function mergeItems(items) {
  let addedCount = 0;
  let updatedCount = 0;

  items.forEach(item => {
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

async function navigateTab(tabId, url) {
  const loadPromise = waitForTabLoad(tabId);
  await chrome.tabs.update(tabId, { url, active: true });
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
    item.videoURL || item.creatorUsername || item.title
  );
}

function parseHashtags(value) {
  return [...new Set(
    value
      .split(',')
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
  )];
}

function getHashtagURL(tag) {
  return `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`;
}

function renderResults() {
  resultsList.innerHTML = '';
  const count = scrapedData.length;
  countBadge.textContent = `${count} video${count !== 1 ? 's' : ''}`;
  emptyState.style.display = count === 0 ? 'flex' : 'none';

  const hasData = count > 0;
  exportCSV.disabled = !hasData;
  exportJSON.disabled = !hasData;
  clearBtn.disabled = !hasData;

  scrapedData.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'video-card';

    const title = item.title || 'No title found';
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
        <button class="copy-btn" data-index="${index}" title="Copy JSON" aria-label="Copy JSON">
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

  document.querySelectorAll('.copy-btn').forEach(button => {
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

exportCSV.addEventListener('click', () => {
  const headers = ['Title', 'Hashtags', 'Creator Username', 'Creator Profile URL', 'Video URL', 'Video Created At', 'Scraped At'];
  const rows = scrapedData.map(item => [
    csvEsc(item.title),
    csvEsc((item.hashtags || []).join(' ')),
    csvEsc(item.creatorUsername),
    csvEsc(item.creatorProfileURL),
    csvEsc(item.videoURL),
    csvEsc(item.videoCreatedAt),
    csvEsc(item.scrapedAt)
  ]);

  downloadFile('tiktok-data.csv', [headers.join(','), ...rows.map(row => row.join(','))].join('\n'), 'text/csv');
  setStatus('active', 'CSV exported.');
});

exportJSON.addEventListener('click', () => {
  downloadFile('tiktok-data.json', JSON.stringify(scrapedData, null, 2), 'application/json');
  setStatus('active', 'JSON exported.');
});

clearBtn.addEventListener('click', async () => {
  scrapedData = [];
  await chrome.storage.local.remove('scrapedData');
  setStatus('', 'Open TikTok, then scrape the current tab.');
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

chrome.storage.local.get('scrapedData', ({ scrapedData: saved }) => {
  if (saved?.length) {
    scrapedData = saved;
    setStatus('active', `Loaded ${saved.length} saved video${saved.length !== 1 ? 's' : ''}.`);
  } else {
    setStatus('', 'Open TikTok, then scrape the current tab.');
  }

  renderResults();
});
