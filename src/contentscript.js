const globals = {
  observer: null,
  target: null,
  ver: null,
  currentHref: null
};

const VER = {
  CLASSIC: 'ver classic',
  V2018: 'ver 2018',
  V2019: 'ver 2019'
};

// Sound service with audio pool
const Sound = {
  _audioPool: [],
  _inited: false,

  init() {
    if (this._inited) {
      return;
    }
    this._inited = true;
    this._growPool(5);
  },

  play() {
    const audio = this._getAvailableAudio();
    audio.play();
  },

  _growPool(count) {
    for (let i = 0; i < count; i++) {
      this._audioPool.push(this._createAudio());
    }
  },

  _createAudio() {
    const audio = new Audio(chrome.runtime.getURL('new_message.mp3'));
    audio.volume = 0.5;
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
  }
};

// requestInterval
// ref: https://github.com/nk-components/request-interval
const requestInterval = (function() {
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
  content = document.querySelector('.chat-list__lines .chat-list__list-container');
  if (content) {
    ver = VER.V2019;
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
          ver
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

    requestAnimationFrame(function() {
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
    const m = mutations.filter(mutation => {
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

      return false;
    });

    if (m.length > 0) {
      Sound.play();
    }
  }

  function activate() {
    if (!globals.observer) {
      return false;
    }
    globals.observer.observe(globals.target, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
    return true;
  }

  function deactivate() {
    if (!globals.observer) {
      return false;
    }
    globals.observer.disconnect();
    return true;
  }

  function handleMessage(message, sender, sendResponse) {
    switch (message) {
      case 'activate':
        if (activate()) {
          sendResponse(true /* active */);
        } else {
          sendResponse(false /* active */);
        }
        break;
      case 'deactivate':
        if (deactivate()) {
          sendResponse(false /* active */);
        } else {
          sendResponse(true /* active */);
        }
        break;
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage);
}

main();
