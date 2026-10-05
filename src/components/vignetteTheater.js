// Real Object Picture Showcase & Celebration Theater for Monster Phonics
// When children complete spelling a word, celebrates with joyful confetti and
// displays the real, authentic image of the object with educational facts and pronunciation.

import confetti from 'canvas-confetti';
import { audioEngine } from '../services/audioEngine.js';

export class VignetteTheater {
  constructor(options = {}) {
    this.containerEl = options.containerEl;
    this.stickerBook = options.stickerBook || null;
    this.onNextWord = options.onNextWord || (() => {});
    this.onOpenStickerBook = options.onOpenStickerBook || (() => {});
    this.onSaveSticker = options.onSaveSticker || (() => {});
    this.currentWordData = null;
  }

  show(wordData) {
    this._cleanup();
    this.currentWordData = wordData;

    // Save unlock progress immediately to sticker book
    if (this.stickerBook) {
      this.stickerBook.saveCompletedWord(wordData.id);
    } else {
      this.onSaveSticker(wordData.id);
    }

    // Play celebration audio & voice narration
    audioEngine.playVignetteSound(wordData.vignette?.actionSound || 'twinkle');
    audioEngine.speakWordSequence(wordData);
    this.triggerConfetti();

    // Render Real Object Picture Celebration DOM (Minimal text, maximum visual clarity for kids)
    this.containerEl.innerHTML = `
      <div class="theater-backdrop celebration-modal-backdrop" id="celebration-backdrop" role="dialog" aria-modal="true" aria-label="Kata ${wordData.word} selesai!">
        <div class="celebration-window animate-pop-in">
          <!-- Washi tape at top of paper frame -->
          <div class="washi-tape" aria-hidden="true"></div>

          <!-- Close button -->
          <button type="button" class="celebration-close-btn" id="btn-theater-close" aria-label="Tutup">✕</button>

          <!-- Real Object Picture (Papercraft Polaroid Showcase) -->
          <div class="celebration-photo-frame" id="celebration-photo-frame" title="Ketuk gambar untuk dengarkan suara">
            <div class="celebration-img-container">
              <img src="${wordData.image}" alt="${wordData.word}" class="celebration-real-img" loading="eager">
            </div>
          </div>

          <!-- Content Column: Big Word & Kid-Friendly Actions -->
          <div class="celebration-content-col">
            <div class="celebration-word-row">
              <h2 class="celebration-word-title">${wordData.word}</h2>
              <button type="button" class="btn-paper-audio celebration-audio-btn" id="btn-theater-sound" aria-label="Dengarkan Suara Kata">
                <span class="btn-icon">🔊</span>
              </button>
            </div>

            <!-- Action Buttons Row -->
            <div class="celebration-actions-row">
              <button type="button" class="btn-celebration-action btn-celebration-next" id="btn-theater-next" aria-label="Lanjut">
                <span>▶️</span>
                <span>Lanjut</span>
              </button>
              <button type="button" class="btn-celebration-action btn-celebration-album" id="btn-theater-album" aria-label="Buka Album">
                <span>📒</span>
                <span>Album</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    this.containerEl.classList.remove('hidden');
    this.bindEvents();
  }

  bindEvents() {
    // 1. Next Word Button
    const btnNext = document.getElementById('btn-theater-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.hide();
        this.onNextWord();
      });
    }

    // 2. Open Sticker Album Button
    const btnAlbum = document.getElementById('btn-theater-album');
    if (btnAlbum) {
      btnAlbum.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.hide();
        this.onOpenStickerBook();
      });
    }

    // 3. Audio pronunciation button
    const btnAudio = document.getElementById('btn-theater-sound');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        if (this.currentWordData) {
          audioEngine.speakWordSequence(this.currentWordData);
        }
      });
    }

    // 4. Tap on the photo itself to replay audio
    const photoFrame = document.getElementById('celebration-photo-frame');
    if (photoFrame) {
      photoFrame.addEventListener('click', () => {
        photoFrame.classList.remove('animate-photo-bounce');
        void photoFrame.offsetWidth; // trigger reflow
        photoFrame.classList.add('animate-photo-bounce');
        if (this.currentWordData) {
          audioEngine.playVignetteSound(this.currentWordData.vignette?.actionSound || 'twinkle');
          audioEngine.speakWordSequence(this.currentWordData);
        }
      });
    }

    // 5. Close button
    const btnClose = document.getElementById('btn-theater-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.hide();
      });
    }

    // 6. Click backdrop outside card to close
    const backdrop = document.getElementById('celebration-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          audioEngine.playPaperGrab();
          this.hide();
        }
      });
    }
  }

  triggerConfetti() {
    try {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF7582', '#7AE7C7', '#FFD166', '#62B6CB', '#CDB4DB']
      });
    } catch {}
  }

  hide() {
    audioEngine.stopAllSpeech();
    this.containerEl.classList.add('hidden');
    this.containerEl.innerHTML = '';
  }

  _cleanup() {
    audioEngine.stopAllSpeech();
  }
}
