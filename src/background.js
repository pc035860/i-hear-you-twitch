import { local } from './utils/chromeStorage.js';
import pDefer from './utils/pDefer.js';

/**
 * states
 */
const tabState = {
  key: 'tabState',
  async getPool() {
    return local.get(this.key).then((pool) => pool ?? {});
  },
  async setPool(pool) {
    return local.set(this.key, pool);
  },
  async get(tabId) {
    return this.getPool().then((pool) => {
      const frameId = pool[tabId] ?? undefined;
      return frameId;
    });
  },
  async set(tabId, frameId) {
    const self = this;
    return this.getPool().then((pool) => {
      const nextPool = {
        ...pool,
        [tabId]: frameId,
      };
      return self.setPool(nextPool);
    });
  },
  async remove(tabId) {
    const self = this;
    return this.getPool().then((pool) => {
      const nextPool = { ...pool };
      delete nextPool[tabId];
      return self.setPool(nextPool);
    });
  },
};

/**
 * bind events
 */
chrome.action.onClicked.addListener(handleActionClick);
chrome.runtime.onMessage.addListener(handleRuntimeMessage);

function toggleBadge(tabId, active) {
  const action = chrome.action;

  if (active) {
    action.setBadgeText({
      text: 'ON',
      tabId: tabId,
    });
    action.setIcon({
      path: {
        19: chrome.runtime.getURL('images/icon-19-active.png'),
        38: chrome.runtime.getURL('images/icon-38-active.png'),
      },
      tabId: tabId,
    });
  } else {
    action.setBadgeText({
      text: '',
      tabId: tabId,
    });
    action.setIcon({
      path: {
        19: chrome.runtime.getURL('images/icon-19.png'),
        38: chrome.runtime.getURL('images/icon-38.png'),
      },
      tabId: tabId,
    });
  }
}

let activateDfd = null;
let deactivateDfd = null;
function handleActionClick(tab) {
  tabState.get(tab.id).then((frameId) => {
    // top-level frameId is 0, hence we use `typeof` to check if it's undefined
    const isActive = typeof frameId !== 'undefined';
    const message = isActive ? 'deactivate' : 'activate';

    if (frameId) {
      chrome.tabs.sendMessage(tab.id, message, {
        frameId,
      });
    } else {
      chrome.tabs.sendMessage(tab.id, message);
    }

    const dfd = pDefer();
    if (message === 'activate') {
      activateDfd = dfd;
      dfd.promise.then(({ tabId, frameId }) => {
        tabState.set(tabId, frameId);
        toggleBadge(tabId, true);
      });
    } else {
      deactivateDfd = dfd;
      dfd.promise.then(({ tabId, frameId }) => {
        tabState.remove(tabId);
        toggleBadge(tabId, false);
      });
    }
  });
}

function handleRuntimeMessage(message, sender) {
  switch (message) {
    case 'deactivateFromTab':
      const tabId = sender.tab.id;
      tabState.remove(tabId);
      toggleBadge(tabId, false);
      break;
    case 'activate:0':
    case 'activate:1':
      {
        const [, buf] = message.split(':');
        const success = buf === '1';

        if (activateDfd && success) {
          const tabId = sender.tab.id;
          const frameId = sender.frameId;
          activateDfd.resolve({
            tabId,
            frameId,
          });
          activateDfd = null;
        }
      }
      break;
    case 'deactivate:0':
    case 'deactivate:1':
      {
        const [, buf] = message.split(':');
        const success = buf === '1';

        if (deactivateDfd && success) {
          const tabId = sender.tab.id;
          const frameId = sender.frameId;
          deactivateDfd.resolve({
            tabId,
            frameId,
          });
          deactivateDfd = null;
        }
      }
      break;
  }
}
