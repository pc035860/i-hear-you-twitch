const globals = {
  observer: null,
  target: null,
  currentHref: null
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
      this._audioPool.push(this._createAudio())
    }
  },

  _createAudio() {
    return new Audio(
      chrome.runtime.getURL('new_message.mp3')
    );
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

function getChatRoomContentAsync(timeout) {
  const delay = 100;
  const startedAt = now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const tseContent = document.querySelector('.chat-room .tse-content');
      if (tseContent) {
        clearInterval(interval);
        resolve(tseContent);
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
  return +(new Date());
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
    getChatRoomContentAsync(10000)
    .then(tseContent => {
      Sound.init();

      globals.observer = new MutationObserver(onMutation);
      globals.target = tseContent;
    }, () => {
      console.warn('[I Hear You] Chatroom DOM not found on this page');
    });
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

      // 確定是聊天訊息
      if (classList.indexOf('chat-line') < 0) {
        return false;
      }
      // 不是系統訊息
      if (classList.indexOf('admin') >= 0) {
        return false;
      }

      return true;
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
      attributes: true, childList: true, characterData: true,
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
        }
        else {
          sendResponse(false /* active */);
        }
        break;
      case 'deactivate':
        if (deactivate()) {
          sendResponse(false /* active */);
        }
        else {
          sendResponse(true /* active */);
        }
        break;
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage);
}

main();
