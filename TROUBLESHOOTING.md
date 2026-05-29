# TikTok Scraper - Infinite Scroll & Issue Resolution Guide

## Common Issues & Solutions

### Issue 1: Missing Video Links (Shows "—")

**Cause:** The video URL wasn't found in the DOM or the link structure is different

**Solutions:**

1. **Make sure the page fully loads**
   - Wait 2-3 seconds after opening the video
   - Ensure thumbnail/video player is visible
   - Refresh if needed

2. **Direct video page vs feed**
   - Best: Open the video directly (e.g., `tiktok.com/video/123456`)
   - Also works: Video in feed (may require wait time)
   - Profile pages work: Open creator profile

3. **Try the improved version**
   - The extension now looks for: `/video/`, `/v/`, `/@creator/video/` patterns
   - Multiple fallback methods are used
   - Refresh and scrape again

---

### Issue 2: Missing Hashtags (Shows "No hashtags")

**Cause:** Video genuinely has no hashtags, OR extraction couldn't find them

**Solutions:**

1. **Check if video actually has hashtags**
   - Open the video in TikTok
   - Look at the description - if there are no `#` symbols, this is normal
   - Some videos just don't have hashtags

2. **Improve hashtag detection**
   - The extension now extracts hashtags from:
     - Video description/title
     - Hashtag links on the page
     - Meta tags
     - Page text content
   - Try scraping again - it's more comprehensive now

3. **On feed pages**
   - Description may be truncated or hidden
   - Open the individual video to see full description
   - Then scrape the video page directly

---

### Issue 3: Missing Video Title

**Cause:** Title/description not found in expected locations

**Solutions:**

1. **Open the video directly**
   - Don't scrape from feed - go to video page
   - Video pages have more reliable title extraction

2. **Wait for content to load**
   - TikTok lazy-loads content
   - Wait 2+ seconds before scraping
   - Make sure text is visible

3. **Check the video description**
   - Some videos have captions instead of descriptions
   - Captions may not be in the title field
   - This is expected for some content types

---

## Handling Infinite Scroll

TikTok uses infinite scroll to load videos. Here's how to use the scraper with it:

### Workflow for Scraping Feed with Infinite Scroll

#### ✅ Method 1: Multiple Scrapes (Recommended)

1. **Go to TikTok feed/profile/hashtag**
   ```
   https://www.tiktok.com/foryou
   https://www.tiktok.com/@creator
   https://www.tiktok.com/tag/hashtag
   ```

2. **Let videos load fully** (wait 2-3 seconds)

3. **Click "Scrape Page"**
   - Extension gets all visible videos

4. **Scroll down to load more**
   - TikTok loads new videos via infinite scroll

5. **Click "Scrape Page" again**
   - Extension gets newly loaded videos
   - Automatically deduplicates (won't repeat)

6. **Repeat steps 4-5** as needed

#### ✅ Method 2: Export After Each Scrape

1. Scrape visible videos
2. Export to CSV/JSON (save the file)
3. Scrape after scrolling
4. Export again
5. You'll have separate files - you can combine later

#### ✅ Method 3: Manual Scrolling Pattern

```
1. Load page → 2. Wait 2s → 3. Scrape → 4. Scroll
5. Wait 1s → 6. Scrape → 7. Scroll → 8. Repeat
```

---

## Technical Improvements (v1.2+)

### Video URL Detection
Now detects:
- `/video/123456` - standard format
- `/v/123456` - shorthand format
- `/@creator/video/123456` - profile video format
- Extracts video ID and constructs clean URL
- Falls back to provided URL if extraction fails

### Hashtag Extraction
Now searches:
- Description text (regex: `#\w+`)
- Hashtag links on page
- Meta tags (og:description)
- Page text content (limited to 50 most common)
- Deduplicates automatically

### Video Card Detection
Now finds:
- TikTok data-e2e attributes (primary)
- Generic container classes
- Article elements
- Role-based elements
- Fallback: Links to videos
- **Works with infinite scroll** - finds newly loaded cards

### URL Cleaning
- Removes query parameters (`?lang=...`, etc.)
- Removes hash fragments (`#...`)
- Returns clean canonical URL

---

## Why Does Infinite Scroll Need Multiple Scrapes?

**TikTok loads videos dynamically:**

- Initial page load: ~3-5 videos visible
- Each scroll: ~2-3 new videos added to DOM
- Videos are added to the same page
- Each video has its own card/element

**What the extension does:**

1. Finds all video cards currently in the DOM
2. Extracts data from each
3. Removes duplicates by URL
4. Returns only new items

**Why multiple scrapes:**
- Each scrape only gets what's loaded at that moment
- To get more videos, you scroll (which loads more)
- Then scrape again
- This is more efficient than auto-scrolling

---

## Best Practices for Data Collection

### For Feed Videos
```
1. Go to For You or Following
2. Scrape
3. Scroll down (load 3-5 more)
4. Scrape
5. Repeat until you have enough data
```

### For Profile Videos
```
1. Open creator profile
2. Scrape (gets all visible videos)
3. Scroll down
4. Scrape again
5. Continue until profile ends
```

### For Hashtag Videos
```
1. Search hashtag (e.g., #viral)
2. Wait for videos to load
3. Scrape
4. Scroll to load more
5. Scrape again
6. Repeat for desired volume
```

---

## Data Quality Checklist

### ✅ Good Data
```
{
  "title": "My awesome TikTok video #FYP",
  "hashtags": ["#FYP", "#viral"],
  "creatorUsername": "creator_name",
  "creatorProfileURL": "https://www.tiktok.com/@creator_name",
  "videoURL": "https://www.tiktok.com/video/123456789"
}
```

### ⚠️ Partially Complete (Normal)
```
{
  "title": "",  // Video has no description
  "hashtags": [], // No hashtags used
  "creatorUsername": "creator_name",
  "creatorProfileURL": "https://www.tiktok.com/@creator_name",
  "videoURL": "https://www.tiktok.com/video/123456789"
}
```

### ❌ Empty (Investigate)
- Video URL missing: Refresh page, scrape direct video link
- Creator info missing: Scroll to see user card, refresh
- Title missing: Video might not have description - this is OK

---

## Debugging Tips

### Issue: No data after scraping

**Check 1:** Are you on tiktok.com?
- ✓ Should see "tiktok.com" in URL bar
- ✓ Extension only works on TikTok

**Check 2:** Is content visible?
- ✓ Can you see videos on the page?
- ✓ Wait for videos to load completely

**Check 3:** Try direct video link
- ✓ Open a specific video
- ✓ Click scrape on that video page
- ✓ Should get at least creator info

**Check 4:** Refresh and try again
- ✓ Refresh the TikTok page (Cmd+R)
- ✓ Wait 2 seconds
- ✓ Try scraping again

### Issue: Some fields are empty

This is NORMAL if:
- Video has no description (no title)
- Video uses no hashtags
- Creator account is private (might not show profile)

### Issue: URL has query params

Old versions might show: `https://www.tiktok.com/@user?lang=en`

**Fixed in v1.2+**
- Now cleans all URLs
- Removes `?lang=...`, `#...` etc.
- Returns: `https://www.tiktok.com/@user`

---

## Supported Page Types

| Page Type | Works? | Notes |
|-----------|--------|-------|
| Single video | ✅ Best | Full metadata |
| For You feed | ✅ Good | Needs scrolling for more |
| Following feed | ✅ Good | Same as FYP |
| Creator profile | ✅ Good | All creator's videos |
| Hashtag page | ✅ Good | All hashtag videos |
| Sound page | ✅ Works | Videos using that sound |
| Trend page | ✅ Works | Trending videos |
| Search results | ✅ Works | Video results from search |

---

## Export & Data Handling

### CSV Export
```
Title | Hashtags | Creator Username | Creator Profile URL | Video URL | Scraped At
------|----------|------------------|----------------------|-----------|----------
My video | #fyp #viral | username | https://tiktok.com/@username | https://tiktok.com/video/123 | 2024-05-28...
```

### JSON Export
```json
[
  {
    "title": "My video",
    "hashtags": ["#fyp", "#viral"],
    "creatorUsername": "username",
    "creatorProfileURL": "https://www.tiktok.com/@username",
    "videoURL": "https://www.tiktok.com/video/123",
    "scrapedAt": "2024-05-28T10:30:45.123Z"
  }
]
```

---

## Recent Updates (v1.2)

✨ **Improved Video URL Detection**
- Now finds `/v/` shorthand URLs
- Extracts video IDs more reliably
- Better handling of profile video URLs
- Clean URL construction

✨ **Better Hashtag Extraction**
- Searches meta tags
- Checks page text content
- More comprehensive
- Automatic deduplication

✨ **Enhanced Infinite Scroll Support**
- Better video card selectors
- Finds newly loaded content
- Works with TikTok's DOM changes
- Fallback methods for edge cases

✨ **URL Cleaning**
- Removes query parameters
- Removes fragments
- Returns canonical URLs
- Handles all TikTok URL formats

---

## Still Having Issues?

1. **Check this guide** - Most issues are covered above
2. **Refresh the page** - TikTok DOM changes frequently
3. **Try a direct video** - Easiest to debug
4. **Check browser console** - May have useful errors
5. **Reload extension** - Go to chrome://extensions, reload

---

## Limitations to Know

- ⚠️ Only scrapes visible videos (not beyond viewport)
- ⚠️ TikTok changes its DOM structure frequently
- ⚠️ Some videos may have incomplete data
- ⚠️ Rate limiting: Don't scrape 1000s of videos at once
- ⚠️ Private accounts may have limited info

---

## Tips for Best Results

✅ Use the direct video URL when possible  
✅ Wait 2-3 seconds for content to load  
✅ Scroll gradually, scrape frequently  
✅ Export after significant collections  
✅ Check data before using it  
✅ Respect TikTok's terms of service  
✅ Use data responsibly  

---

Last updated: May 2026 (v1.2)
