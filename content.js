// Content script for Conversation Master
// This script runs on AI chat pages and can be used for additional functionality

console.log('Conversation Master loaded on:', window.location.href);

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ready' });
  }
  return true;
});
