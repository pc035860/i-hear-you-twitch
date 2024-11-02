const globals = {
  observer: null,
  target: null,
  ver: null,
  currentHref: null,
};

const VER = {
  CLASSIC: 'ver classic',
  V2018: 'ver 2018',
  V2019: 'ver 2019',
  V2020: 'ver 2020',
  MIXER: 'mixer 2019',
  YOUTUBE: 'youtube 2024',
};

const KEY_SOUND = 'sound';
const KEY_VOLUME = 'volume';
const DEFAULT_VOLUME = 0.5;

// Sound service with audio pool
const Sound = {
  _audioPool: [],
  _inited: false,
  _audioUrl: null,
  _volume: DEFAULT_VOLUME,

  init() {
    if (this._inited) {
      return;
    }
    this._inited = true;
    this.buildPool();
    this.updateVolume();
  },

  play() {
    const audio = this._getAvailableAudio();
    audio.volume = this._volume;
    audio.play();
  },

  buildPool() {
    const self = this;
    this._audioPool.length = 0;
    this._getAudioURL().then((url) => {
      self._audioUrl = url;
      this._growPool(5);
    });
  },

  updateVolume() {
    const self = this;
    this._getVolume().then((volume) => {
      self._volume = volume;
    });
  },

  _getAudioURL() {
    return chrome.storage.local.get(KEY_SOUND).then((item) => {
      if (item && item[KEY_SOUND]) {
        return item[KEY_SOUND].dataUrl;
      }
      return chrome.runtime.getURL('new_message.mp3');
    });
  },

  _getVolume() {
    return chrome.storage.local.get(KEY_VOLUME).then((item) => {
      if (item && item[KEY_VOLUME]) {
        return Number(item[KEY_VOLUME]) / 10;
      }
      return DEFAULT_VOLUME;
    });
  },

  _growPool(count) {
    for (let i = 0; i < count; i++) {
      this._audioPool.push(this._createAudio());
    }
  },

  _createAudio() {
    if (!this._audioUrl) {
      throw new Error('Audio URL not set');
    }

    const audio = new Audio(this._audioUrl);
    return audio;
  },

  _getAvailableAudio() {
    const poolSize = this._audioPool.length;
    for (let i = 0; i < poolSize; i++) {
      const audio = this._audioPool[i];

      if (audio.paused || audio.ended) {
        audio.currentTime = 0;
        return audio;
      }
    }

    // 來到這邊表示 pool 不太夠用，長大一倍
    // 上限 30
    if (poolSize < 30) {
      this._growPool(poolSize);
    }

    // 沒有可用的只好硬拿一個
    const audio = this._audioPool[0];
    audio.currentTime = 0;
    return audio;
  },
};

// requestInterval
// ref: https://github.com/nk-components/request-interval
const requestInterval = (function () {
  function interval(delay, fn) {
    var start = Date.now();
    var data = {};
    data.id = requestAnimationFrame(loop);

    return data;

    function loop() {
      data.id = requestAnimationFrame(loop);

      if (Date.now() - start >= delay) {
        fn();
        start = Date.now();
      }
    }
  }

  function clearInterval(data) {
    cancelAnimationFrame(data.id);
  }

  const self = interval;
  self.clear = clearInterval;
  return self;
})();

function _getChatRoomContent() {
  let content = null;
  let ver = null;

  // classic
  content = document.querySelector('.chat-room .tse-content');
  if (content) {
    ver = VER.CLASSIC;
    return { content, ver };
  }

  // 2018 react
  content = document.querySelector('.chat-list__lines .tw-full-height');
  if (content) {
    ver = VER.V2018;
    return { content, ver };
  }

  // 2019 new design
  content = document.querySelector(
    '.chat-list__lines .chat-list__list-container'
  );
  if (content) {
    ver = VER.V2019;
    return { content, ver };
  }

  // 2020 minor update
  content =
    document.querySelector(
      '[data-test-selector=chat-scrollable-area__message-container]'
    ) || document.querySelector('.chat-scrollable-area__message-container');
  if (content) {
    ver = VER.V2020;
    return { content, ver };
  }

  // mixer 2019
  content = document.querySelector('.chat-container [class^=scrollWrapper]');
  if (content) {
    ver = VER.MIXER;
    return { content, ver };
  }

  // youtube 2024
  content = document.querySelector('yt-live-chat-renderer');
  if (content) {
    ver = VER.YOUTUBE;
    return { content, ver };
  }

  return { content, ver };
}

function getChatRoomContentAsync(timeout) {
  const delay = 100;
  const startedAt = now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const { content, ver } = _getChatRoomContent();

      if (content) {
        clearInterval(interval);
        resolve({
          content,
          ver,
        });
      }

      const timePassed = now() - startedAt;
      if (timePassed > timeout) {
        clearInterval(interval);
        reject();
      }
    }, delay);
  });
}

function slice(arraryLikeGuy) {
  return Array.prototype.slice.call(arraryLikeGuy);
}

function now() {
  return +new Date();
}

// ref: https://gist.github.com/andrewchilds/30a7fb18981d413260c7a36428ed13da
function deepGet(obj, query, defaultVal) {
  query = Array.isArray(query)
    ? query
    : query
        .replace(/(\[(\d)\])/g, '.$2')
        .replace(/^\./, '')
        .split('.');
  if (!(query[0] in obj)) {
    return defaultVal;
  }
  obj = obj[query[0]];
  if (obj && query.length > 1) {
    return deepGet(obj, query.slice(1), defaultVal);
  }
  return obj;
}

function main() {
  href = location.href;
  onPageRender();

  requestInterval(500, () => {
    if (location.href !== globals.currentHref) {
      globals.currentHref = location.href;
      onHrefChange();
    }
  });

  function onHrefChange() {
    deactivate();
    chrome.runtime.sendMessage('deactivateFromTab');

    globals.observer = null;
    globals.target = null;

    requestAnimationFrame(function () {
      onPageRender();
    });
  }

  function onPageRender() {
    getChatRoomContentAsync(10000).then(
      ({ content, ver }) => {
        Sound.init();

        globals.observer = new MutationObserver(onMutation);
        globals.target = content;
        globals.ver = ver;
      },
      () => {
        console.warn('[I Hear You] Chatroom DOM not found on this page');
      }
    );
  }

  function onMutation(mutations) {
    const m = mutations.filter((mutation) => {
      if (!mutation.addedNodes || mutation.addedNodes.length === 0) {
        return false;
      }
      const newNode = mutation.addedNodes[0];

      // 必須是 element node
      if (newNode.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      const classList = slice(newNode.classList);

      const ver = globals.ver;

      if (ver === VER.CLASSIC) {
        // 確定是聊天訊息的一種
        if (classList.indexOf('chat-line') < 0) {
          return false;
        }
        // 不是系統訊息
        if (classList.indexOf('admin') >= 0) {
          return false;
        }

        return true;
      }

      if (ver === VER.V2018 || ver === VER.V2019) {
        // 是聊天訊息(不會是別的)
        // 新版用 BEM CSS 分得比較開
        if (classList.indexOf('chat-line__message') >= 0) {
          return true;
        }

        return false;
      }

      if (ver === VER.V2020) {
        if (newNode.dataset.testSelector === 'chat-line-message') {
          return true;
        }
        if (classList.indexOf('chat-line__message') >= 0) {
          return true;
        }

        // 2024/10 sometimes message is wrapped in other elements
        const isChild = newNode.querySelector('.chat-line__message');
        if (isChild) {
          return true;
        }

        return false;
      }

      if (ver === VER.MIXER) {
        // 是聊天訊息(不會是別的)
        // 因為有用 scope CSS，無法保證 message__ 後面的內容
        if (classList.join(' ').indexOf('message__') >= 0) {
          return true;
        }
        return false;
      }

      if (ver === VER.YOUTUBE) {
        if (classList.indexOf('yt-live-chat-item-list-renderer') >= 0) {
          return true;
        }
        return false;
      }

      return false;
    });

    if (m.length > 0) {
      Sound.play();
    }
  }

  /**
   * HyperChat extension inserts extension sand-boxed iframe into the page,
   * there's no way to access the content of the iframe directly,
   * hence we listen to the `messageReceive` event to get the chat messages.
   *
   * The `messageReceive` event is dispatched by the extension when it receives
   * new chat messages which are originally fetched with youtube API.
   */
  function handleHyperChatEvent(evt) {
    const json = evt.detail;

    let data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      return;
    }

    const liveChatActions = deepGet(
      data,
      'continuationContents.liveChatContinuation.actions',
      []
    );
    const chatMessages = liveChatActions.filter(
      (action) => action.addChatItemAction
    );
    if (chatMessages.length > 0) {
      Sound.play();
    }
  }

  function activate() {
    window.addEventListener('messageReceive', handleHyperChatEvent);
    if (!globals.observer) {
      return false;
    }
    globals.observer.observe(globals.target, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    return true;
  }

  function deactivate() {
    window.removeEventListener('messageReceive', handleHyperChatEvent);
    if (!globals.observer) {
      return false;
    }
    globals.observer.disconnect();
    return true;
  }

  function handleMessage(message, sender) {
    const sendMessage = chrome.runtime.sendMessage;
    switch (message) {
      case 'activate':
        if (activate()) {
          sendMessage('activate:1');
        } else {
          sendMessage('activate:0');
        }
        break;
      case 'deactivate':
        if (deactivate()) {
          sendMessage('deactivate:1');
        } else {
          sendMessage('deactivate:0');
        }
        break;
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage);

  function handleStorageChanged(changes, areaName) {
    if (areaName === 'local') {
      if (KEY_SOUND in changes) {
        Sound.buildPool();
      } else if (KEY_VOLUME in changes) {
        Sound.updateVolume();
      }
    }
  }
  chrome.storage.onChanged.addListener(handleStorageChanged);
}

main();
