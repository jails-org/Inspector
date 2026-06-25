/**
 * Service Worker - Background script
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('Jails Inspector extension installed');
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.action !== 'jailsComponentStateUpdated' || !sender.tab) {
    return;
  }

  chrome.runtime.sendMessage({
    action: 'jailsDevtoolsStateUpdated',
    tabId: sender.tab.id,
    componentId: message.componentId,
  });
});
