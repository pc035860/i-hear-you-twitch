import { local } from './utils/chromeStorage.js';

const KEY_SOUND = 'sound';
const KEY_VOLUME = 'volume';
const DEFAULT_VOLUME = 5;

const sampleAudio = new Audio();

// sound file input
const soundForm = document.querySelector('.js-sound-form');
const handleSoundChange = (event) => {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const filesize = (file.size / 1024 / 1024).toFixed(2); // in MB

  if (filesize > 2) {
    alert('File size exceeds 2MB. Please choose a smaller file.');
    return;
  }

  // read file and save to storage in dataurl format
  const reader = new FileReader();
  reader.onload = (event) => {
    soundForm.reset();

    const soundData = {
      dataUrl: event.target.result,
      name: file.name,
      createdAt: new Date().toISOString(),
      filesize,
    };

    const dataToSet = {};
    dataToSet[KEY_SOUND] = soundData;

    local.set(KEY_SOUND, soundData).then(() => updateSound());
  };
  reader.readAsDataURL(file);
};
const elmSound = document.querySelector('.js-sound');
elmSound.addEventListener('change', handleSoundChange, false);

// change sound button
const handleSoundButtonClick = () => {
  elmSound.click();
};
document
  .querySelector('.js-sound-btn')
  .addEventListener('click', handleSoundButtonClick, false);

// reset button
const handleResetButtonClick = () => {
  local.remove([KEY_SOUND]).then(() => updateSound());
};
document
  .querySelector('.js-reset')
  .addEventListener('click', handleResetButtonClick, false);

// volume slider
const elmVolume = document.querySelector('.js-volume');
const handleVolumeChange = (event) => {
  const volume = event.target.value;
  local
    .set(KEY_VOLUME, volume)
    .then(() => updateVolume())
    .then(() => playSampleAudio());
};
elmVolume.addEventListener('change', handleVolumeChange, false);

// reset volume button
const handleVolumeReset = () => {
  local
    .remove([KEY_VOLUME])
    .then(() => updateVolume())
    .then(() => playSampleAudio());
};
document
  .querySelector('.js-volume-reset')
  .addEventListener('click', handleVolumeReset, false);

const elmCurrentSound = document.querySelector('.js-current-sound');
const elmVolumeLabel = document.querySelector('.js-volume-label');
function updateSound() {
  // load settings from storage and display
  return local.get(KEY_SOUND).then((soundData) => {
    if (soundData) {
      const { name, filesize, dataUrl } = soundData;
      elmCurrentSound.textContent = `${name} (${filesize}MB)`;
      sampleAudio.src = dataUrl;
    } else {
      elmCurrentSound.textContent = 'Default';
      sampleAudio.src = chrome.runtime.getURL('new_message.mp3');
    }
  });
}

function updateVolume() {
  return local.get(KEY_VOLUME).then((volume) => {
    if (volume) {
      elmVolumeLabel.textContent = `${volume}`;
      elmVolume.value = volume;
      sampleAudio.volume = volume / 10;
    } else {
      elmVolumeLabel.textContent = DEFAULT_VOLUME;
      elmVolume.value = DEFAULT_VOLUME;
      sampleAudio.volume = DEFAULT_VOLUME / 10;
    }
  });
}

function update() {
  updateSound();
  updateVolume();
}

function playSampleAudio() {
  sampleAudio.currentTime = 0;
  sampleAudio.play();
}

update();
