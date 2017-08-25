/**
 * states
 */
const tabState = {};

/**
 * bind events
 */
chrome.browserAction.onClicked.addListener(handleBrowserActionClick);
chrome.runtime.onMessage.addListener(handleRuntimeMessage);

function toggleBadge(tabId, active) {
  const browserAction = chrome.browserAction;

  if (active) {
    browserAction.setBadgeText({
      text: 'ON',
      tabId: tabId
    });
    browserAction.setIcon({
      path: {
        19: chrome.runtime.getURL('images/icon-19-active.png'),
        38: chrome.runtime.getURL('images/icon-38-active.png')
      },
      tabId: tabId
    });
  }
  else {
    browserAction.setBadgeText({
      text: '',
      tabId: tabId
    });
    browserAction.setIcon({
      path: {
        19: chrome.runtime.getURL('images/icon-19.png'),
        38: chrome.runtime.getURL('images/icon-38.png')
      },
      tabId: tabId
    });
  }
}

function handleBrowserActionClick(tab) {
  const isActive = !!tabState[tab.id];

  const message = isActive ? 'deactivate' : 'activate';
  chrome.tabs.sendMessage(tab.id, message, function (active) {
    tabState[tab.id] = active;
    toggleBadge(tab.id, active);
  });
}

function handleRuntimeMessage(message, sender) {
  switch (message) {
    case 'deactivateFromTab':
      const tabId = sender.tab.id;
      tabState[tabId] = false;
      toggleBadge(tabId, false);
      break;
  }
}
