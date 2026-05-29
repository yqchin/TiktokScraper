# TikTok Data Scraper Chrome Extension

A powerful Chrome extension that scrapes video metadata from TikTok, including titles, hashtags, creator information, and URLs.

## Features

✨ **What It Scrapes**
- **Video Title/Description** - Extracts the video caption
- **Hashtags** - Collects all hashtags from the video description and page links
- **Creator Username** - Gets the creator's @username
- **Creator Profile URL** - Links to the creator's TikTok profile
- **Video URL** - Direct link to the video
- **Timestamp** - Records when the data was scraped

📊 **Functionality**
- Scrape **single videos** from video pages
- Scrape **multiple videos** from feed pages, profile pages, or hashtag pages
- **Automatic deduplication** - Won't collect the same video twice
- **Export to CSV** - Spreadsheet-ready format
- **Export to JSON** - Raw data export
- **Copy to clipboard** - Individual video data as JSON
- **Persistent storage** - Your data stays saved between sessions

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select this folder
5. The extension icon will appear in your Chrome toolbar

## Usage

### Basic Workflow

1. **Navigate to TikTok**
   - Go to https://www.tiktok.com
   - View a single video, user profile, or hashtag page

2. **Click the Extension Icon**
   - The popup will open showing the scraper UI

3. **Click "Scrape Page"**
   - The extension analyzes the page and extracts all available data
   - Status bar updates with results

4. **View Results**
   - Scroll through collected videos in the popup
   - Each card shows: title, creator, hashtags, and URLs

5. **Export Data**
   - Click **CSV** to download a spreadsheet
   - Click **JSON** to download raw data
   - Click the copy button on any card to copy individual video as JSON

### Tips for Best Results

✅ **Single Video Pages**
- Navigate directly to a TikTok video URL (e.g., `https://www.tiktok.com/video/12345...`)
- Click Scrape to extract that video's metadata

✅ **Feed Pages**
- Go to your For You page, Following feed, or a creator's profile
- Click Scrape to collect metadata from visible videos
- Scroll to load more videos and click Scrape again

✅ **Hashtag Pages**
- Search for a hashtag (e.g., search for `#pos`)
- Click Scrape to collect all visible hashtag videos
- Scroll and scrape multiple times to collect more

⚠️ **Important Notes**
- Only **visible videos** on the current page are scraped
- Make sure **page is fully loaded** before scraping
- If no data is found, refresh the page and try again
- Some videos may not have all fields populated (e.g., videos with no caption)

## How It Works

### Architecture

```
content.js (runs on TikTok pages)
    ↓
Scrapes DOM for video metadata
    ↓
popup.js (receives data)
    ↓
Displays & persists to storage
```

### Improved Selectors (Updated)

The extension uses multiple fallback selectors to find data:

**Video Title/Description:**
- Meta tags (`og:description`) - most reliable
- TikTok data-e2e attributes
- Page heading elements

**Creator Username:**
- TikTok data-e2e attributes
- Profile links with `/@` pattern
- Author name elements

**Creator Profile:**
- Avatar links (data-e2e attributes)
- Profile links with `/@` pattern
- Fallback: constructed from username

**Video URL:**
- Canonical link tag (most reliable)
- Video ID extraction from URL
- Current page URL

**Hashtags:**
- Text extraction from title
- Hashtag links on the page
- Deduplication of duplicate tags

### Robust Error Handling

- Filters out empty or invalid data
- Graceful fallbacks for each field
- Duplicate detection by video URL
- Helpful error messages

## Data Format

### Single Item Structure
```json
{
  "title": "My TikTok Video #FYP",
  "hashtags": ["#FYP", "#viral", "#foryoupage"],
  "creatorUsername": "creator_name",
  "creatorProfileURL": "https://www.tiktok.com/@creator_name",
  "videoURL": "https://www.tiktok.com/video/123456789",
  "scrapedAt": "2024-05-28T10:30:45.123Z"
}
```

### CSV Format
```
Title,Hashtags,Creator Username,Creator Profile URL,Video URL,Scraped At
"My Video #FYP","#FYP #viral","username","https://www.tiktok.com/@username","https://www.tiktok.com/video/123","2024-05-28T10:30:45.123Z"
```

## Troubleshooting

### No data found when scraping
- ✅ Make sure you're on a TikTok page with videos
- ✅ Refresh the page completely
- ✅ Wait for videos to fully load
- ✅ Try scraping again after scrolling

### "Please navigate to TikTok first"
- ✅ Make sure you're on `tiktok.com`
- ✅ Check your internet connection

### "Content script not ready"
- ✅ Refresh the TikTok page
- ✅ Try scraping again
- ✅ Reload the extension from chrome://extensions/

### Some fields are empty
- This is normal - not all videos have all data
- Some creators don't use hashtags or descriptions
- The extension extracts whatever data is available

### Data disappearing
- ✅ Don't click "Clear Data" unless you want to reset
- ✅ Data is stored in your browser's local storage
- ✅ Clearing browser data will remove saved scrapes

## Technical Details

### Permissions Used
- `activeTab` - Access the active tab
- `scripting` - Inject content scripts
- `storage` - Save your collected data
- `downloads` - Export CSV/JSON files
- `host_permissions` - Access to tiktok.com

### Browser Support
- Chrome 88+
- Edge 88+ (Chromium-based)

### Manifest Version
- Manifest v3 (latest Chrome extension standard)

## Limitations

- Only scrapes **visible** videos (not paginated/infinite-scroll videos beyond viewport)
- Respects TikTok's DOM structure (may need updates if TikTok changes their site)
- Limited to current session (unless exported)
- No authentication bypass (uses public data only)

## Legal Notice

This extension extracts publicly available information from TikTok. Ensure your usage complies with:
- TikTok's Terms of Service
- Local data protection laws (GDPR, CCPA, etc.)
- Any applicable rate limiting or terms

Use responsibly and ethically.

## Updates & Improvements

### Recent Changes (v1.1)
✨ Improved selector robustness with better fallbacks
✨ Enhanced hashtag extraction from page links
✨ Better error messaging and status reporting
✨ Added debug information to responses
✨ Optimized video URL cleaning
✨ Better handling of edge cases

---

**Need Help?** Check that:
1. Extension is enabled in chrome://extensions/
2. You're on a TikTok page
3. Videos are fully loaded on the page
4. Try refreshing and scraping again
# TiktokScraper
