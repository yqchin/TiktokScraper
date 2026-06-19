// popup.js

let scrapedData = [];
const IGNORED_CREATOR_USERNAMES = new Set(['3043842031a']);

const scrapeBtn     = document.getElementById('scrapeBtn');
const exportCSV     = document.getElementById('exportCSV');
const exportJSON    = document.getElementById('exportJSON');
const clearBtn      = document.getElementById('clearBtn');
const resultsList   = document.getElementById('resultsList');
const emptyState    = document.getElementById('emptyState');
const countBadge    = document.getElementById('countBadge');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const scrapeLimit   = document.getElementById('scrapeLimit');

function normalizeUsername(username) {
  return (username || '').replace(/^@/, '').trim().toLowerCase();
}

function isIgnoredCreator(username) {
  return IGNORED_CREATOR_USERNAMES.has(normalizeUsername(username));
}

// ── Status helpers ──────────────────────────────────────────────────────────
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

// ── Render ──────────────────────────────────────────────────────────────────
function renderResults() {
  resultsList.innerHTML = '';
  const count = scrapedData.length;
  countBadge.textContent = `${count} video${count !== 1 ? 's' : ''}`;
  emptyState.style.display = count === 0 ? 'flex' : 'none';

  const hasBtns = count > 0;
  exportCSV.disabled  = !hasBtns;
  exportJSON.disabled = !hasBtns;
  clearBtn.disabled   = !hasBtns;

  scrapedData.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'video-card';

    const title = item.title || '(No title found)';
    const titleClass = item.title ? 'card-title' : 'card-title empty';

    const tagsHTML = item.hashtags && item.hashtags.length > 0
      ? item.hashtags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')
      : '<span class="no-tags">No hashtags</span>';

    const profileLink = item.creatorProfileURL
      ? `<a class="card-link" href="${escHtml(item.creatorProfileURL)}" target="_blank" title="${escHtml(item.creatorProfileURL)}">${escHtml(truncate(item.creatorProfileURL, 38))}</a>`
      : '<span class="card-value" style="color:var(--muted)">—</span>';

    const videoLink = item.videoURL
      ? `<a class="card-link" href="${escHtml(item.videoURL)}" target="_blank" title="${escHtml(item.videoURL)}">${escHtml(truncate(item.videoURL, 38))}</a>`
      : '<span class="card-value" style="color:var(--muted)">—</span>';
    const createdAt = item.videoCreatedAt ? formatDate(item.videoCreatedAt) : '—';

    card.innerHTML = `
      <div class="card-index">Video #${i + 1} &nbsp;·&nbsp; ${formatDate(item.scrapedAt)}</div>
      <div class="${titleClass}">${escHtml(title)}</div>

      <div class="card-row">
        <span class="card-label">Creator</span>
        <span class="card-value">${item.creatorUsername ? '@' + escHtml(item.creatorUsername) : '—'}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Profile</span>
        ${profileLink}
      </div>
      <div class="card-row">
        <span class="card-label">Video</span>
        ${videoLink}
      </div>
      <div class="card-row">
        <span class="card-label">Created</span>
        <span class="card-value">${escHtml(createdAt)}</span>
      </div>

      <div class="tags-row">${tagsHTML}</div>

      <button class="copy-btn" data-index="${i}" title="Copy as JSON">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
    `;

    resultsList.appendChild(card);
  });

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      navigator.clipboard.writeText(JSON.stringify(scrapedData[idx], null, 2));
      btn.classList.add('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
      }, 1500);
    });
  });
}

// ── Scrape ──────────────────────────────────────────────────────────────────
scrapeBtn.addEventListener('click', async () => {
  const limit = getScrapeLimit();
  setStatus('loading', `Scrolling for up to ${limit} videos…`);
  scrapeBtn.disabled = true;
  scrapeLimit.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('tiktok.com')) {
      setStatus('error', 'Please navigate to TikTok first');
      scrapeBtn.disabled = false;
      scrapeLimit.disabled = false;
      return;
    }

    // Inject content script if not already there
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) { 
      // Already injected or error
      console.log('Script already injected or injection error:', e.message);
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape', limit });

    if (response && response.success) {
      const newItems = response.result.data.filter(item =>
        !isIgnoredCreator(item.creatorUsername) && (item.videoURL || item.creatorUsername || item.title)
      );

      if (newItems.length === 0) {
        setStatus('warning', 'No items found. Make sure page is fully loaded.');
        scrapeBtn.disabled = false;
        scrapeLimit.disabled = false;
        return;
      }

      // Deduplicate by videoURL, but refresh existing rows with newer details.
      let addedCount = 0;
      let updatedCount = 0;
      newItems.forEach(item => {
        const existingIndex = scrapedData.findIndex(d => d.videoURL === item.videoURL && item.videoURL);
        if (existingIndex >= 0) {
          scrapedData[existingIndex] = mergeScrapedItem(scrapedData[existingIndex], item);
          updatedCount += 1;
        } else {
          scrapedData.push(item);
          addedCount += 1;
        }
      });

      // Persist
      await chrome.storage.local.set({ scrapedData });

      const type = response.result.type === 'feed' ? 'feed' : 'video';
      const pageInfo = response.debug ? ` [${response.debug.pageType}]` : '';
      const updateInfo = updatedCount ? `, refreshed ${updatedCount}` : '';
      setStatus('active', `✓ Added ${addedCount}${updateInfo} ${type} item${newItems.length !== 1 ? 's' : ''}${pageInfo} · Total: ${scrapedData.length}`);
      renderResults();
    } else {
      setStatus('error', response?.error || 'Failed to scrape page');
    }
  } catch (err) {
    if (err.message.includes('Could not establish connection')) {
      setStatus('error', 'Content script not ready. Refresh page and try again.');
    } else {
      setStatus('error', 'Error: ' + err.message);
    }
  }

  scrapeBtn.disabled = false;
  scrapeLimit.disabled = false;
});

// ── Export CSV ──────────────────────────────────────────────────────────────
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

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadFile('tiktok-data.csv', csv, 'text/csv');
  setStatus('active', 'CSV exported!');
});

// ── Export JSON ─────────────────────────────────────────────────────────────
exportJSON.addEventListener('click', () => {
  downloadFile('tiktok-data.json', JSON.stringify(scrapedData, null, 2), 'application/json');
  setStatus('active', 'JSON exported!');
});

// ── Clear ───────────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', async () => {
  scrapedData = [];
  await chrome.storage.local.remove('scrapedData');
  setStatus('', 'Cleared. Navigate to TikTok and click Scrape.');
  renderResults();
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function csvEsc(val) {
  const s = (val || '').replace(/"/g, '""');
  return `"${s}"`;
}
function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : str;
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Init: load persisted data ────────────────────────────────────────────────
chrome.storage.local.get('scrapedData', ({ scrapedData: saved }) => {
  if (saved && saved.length > 0) {
    scrapedData = saved.filter(item => !isIgnoredCreator(item.creatorUsername));
    if (scrapedData.length !== saved.length) {
      chrome.storage.local.set({ scrapedData });
    }
    setStatus('active', `Loaded ${scrapedData.length} previously scraped item${scrapedData.length !== 1 ? 's' : ''}`);
    renderResults();
  } else {
    setStatus('', 'Navigate to a TikTok page and click Scrape');
  }
});
