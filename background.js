chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.windowId) return;

  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (err) {
    // Chrome may already be opening the panel via openPanelOnActionClick.
  }
});
