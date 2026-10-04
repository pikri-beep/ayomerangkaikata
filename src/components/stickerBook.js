// Pure Physical Sticker Album Book for Monster Phonics
// Features:
// 1. Realistic 3D hardware-accelerated Book-Opening animation (60/120fps smooth, zero lag)
// 2. Pure physical sticker album experience: collection progress, category filter, die-cut sticker slots
// 3. One-tap audio preview & direct play button on each sticker card

import { wordRepository } from '../services/wordRepository.js';
import { audioEngine } from '../services/audioEngine.js';

const STORAGE_COMPLETED_KEY = 'monster_phonics_completed_words';

export class StickerBook {
  constructor(options = {}) {
    this.containerEl = options.containerEl;
    this.onPlayWord = options.onPlayWord || (() => {});
    this.activeCategoryFilter = 'all';
  }

  getCompletedWordIds() {
    try {
      const stored = localStorage.getItem(STORAGE_COMPLETED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveCompletedWord(wordId) {
    try {
      const completed = this.getCompletedWordIds();
      if (!completed.includes(wordId)) {
        completed.push(wordId);
        localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(completed));
      }
    } catch {}
  }

  show(initialCategory = 'all') {
    audioEngine.stopAllSpeech();
    audioEngine.playPaperGrab();

    this.activeCategoryFilter = initialCategory;
    const words = wordRepository.getWords();
    const completedIds = this.getCompletedWordIds();
    const totalWords = words.length;
    const completedCount = completedIds.length;
    const progressPercent = Math.round((completedCount / totalWords) * 100);

    this.containerEl.innerHTML = `
      <div class="sticker-book-backdrop" id="sticker-book-backdrop" role="dialog" aria-modal="true" aria-labelledby="album-main-title">
        <!-- 3D Book Stage for Book-Opening Animation -->
        <div class="sticker-book-stage">
          <div class="sticker-book-open-wrapper animate-book-open">
            
            <!-- Book Spine Binding Decoration -->
            <div class="book-spine-binding" aria-hidden="true">
              <span class="spine-stitch"></span>
              <span class="spine-stitch"></span>
              <span class="spine-stitch"></span>
              <span class="spine-stitch"></span>
              <span class="spine-stitch"></span>
            </div>

            <!-- Main Album Paper Sheet -->
            <div class="sticker-book-sheet">
              <!-- Washi tape at top -->
              <div class="washi-tape" aria-hidden="true"></div>

              <!-- Album Header Bar -->
              <div class="album-book-header">
                <div class="album-brand-section">
                  <span class="album-header-icon" aria-hidden="true">📒</span>
                  <div>
                    <h2 id="album-main-title" class="album-title">Buku Album Stiker</h2>
                    <div class="album-progress-text">
                      ⭐ <strong>${completedCount}</strong> dari ${totalWords} Stiker Terkumpul (${progressPercent}%)
                    </div>
                  </div>
                </div>

                <!-- Clean Category Filter Bar -->
                <div class="album-filter-pills" role="tablist" aria-label="Filter Kategori Stiker">
                  <button class="btn-filter-pill ${this.activeCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">🌟 Semua (${totalWords})</button>
                  <button class="btn-filter-pill ${this.activeCategoryFilter === 'hewan' ? 'active' : ''}" data-cat="hewan">🐱 Hewan (7)</button>
                  <button class="btn-filter-pill ${this.activeCategoryFilter === 'buah' ? 'active' : ''}" data-cat="buah">🍎 Buah (3)</button>
                  <button class="btn-filter-pill ${this.activeCategoryFilter === 'benda' ? 'active' : ''}" data-cat="benda">⚽ Benda (4)</button>
                  <button class="btn-filter-pill ${this.activeCategoryFilter === 'alam' ? 'active' : ''}" data-cat="alam">☁️ Alam (3)</button>
                </div>

                <!-- Close Album Button -->
                <div class="album-header-actions">
                  <button class="btn-close-modal btn-album-close" id="btn-close-stickers" aria-label="Tutup Buku Album" title="Tutup Buku Album">✕ Tutup</button>
                </div>
              </div>

              <!-- Grid of Physical Sticker Slots -->
              <div class="sticker-cards-grid" id="sticker-cards-grid">
                <!-- Dynamically populated below -->
              </div>

              <!-- Book Bottom Note -->
              <div class="album-book-footer">
                <span>📖 Selesaikan kata di arena permainan untuk mengoleksi semua stiker kertas monster!</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    this.containerEl.classList.remove('hidden');

    this.renderCards();
    this.bindEvents();
  }

  renderCards() {
    const gridEl = document.getElementById('sticker-cards-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const words = wordRepository.getWords();
    const completedIds = this.getCompletedWordIds();

    const filteredWords = words.filter(wordItem => {
      if (this.activeCategoryFilter === 'all') return true;
      const cat = (wordItem.category || '').toLowerCase();
      if (this.activeCategoryFilter === 'hewan') return cat.includes('hewan');
      if (this.activeCategoryFilter === 'buah') return cat.includes('buah') || cat.includes('makanan');
      if (this.activeCategoryFilter === 'benda') return cat.includes('benda');
      if (this.activeCategoryFilter === 'alam') return cat.includes('alam');
      return true;
    });

    filteredWords.forEach(wordItem => {
      const isUnlocked = completedIds.includes(wordItem.id);
      const card = document.createElement('div');
      card.className = `gallery-sticker-card ${isUnlocked ? 'card-unlocked' : 'card-locked'}`;

      if (isUnlocked) {
        card.innerHTML = `
          <div class="card-status-badge">✅ Terkumpul</div>
          <div class="card-sticker-illustration">
            <img src="${wordItem.image}" alt="${wordItem.word}" class="card-diecut-img" loading="lazy" decoding="async">
          </div>
          <div class="card-word-title">${wordItem.word}</div>
          <div class="card-category-tag">${wordItem.category}</div>
          <div class="card-buttons-row">
            <button class="btn-card-action btn-card-sound" data-action="sound" title="Dengarkan lafal ${wordItem.word}">
              <span>🔊</span>
              <span>Bunyi</span>
            </button>
            <button class="btn-card-action btn-card-play" data-action="play" title="Mainkan kata ${wordItem.word}">
              <span>▶️</span>
              <span>Mainkan</span>
            </button>
          </div>
        `;

        const btnSound = card.querySelector('[data-action="sound"]');
        const btnPlay = card.querySelector('[data-action="play"]');

        btnSound.addEventListener('click', (e) => {
          e.stopPropagation();
          audioEngine.stopAllSpeech();
          audioEngine.playPaperGrab();
          this.triggerSoundAndSpeech(wordItem);
        });

        btnPlay.addEventListener('click', (e) => {
          e.stopPropagation();
          audioEngine.stopAllSpeech();
          audioEngine.playPaperGrab();
          this.hide();
          this.onPlayWord(wordItem);
        });

      } else {
        card.innerHTML = `
          <div class="card-status-badge locked-status">🔒 Belum Terbuka</div>
          <div class="card-sticker-illustration silhouette-box">
            <span class="locked-big-icon">🔒</span>
          </div>
          <div class="card-word-title locked-title">???</div>
          <div class="card-hint-text">💡 ${wordItem.hint || 'Selesaikan kata di game untuk membuka stiker ini!'}</div>
          <button class="btn-card-action btn-card-unlock" data-action="unlock-play" title="Buka kata ini di permainan!">
            <span>▶️</span>
            <span>Buka Kata Ini</span>
          </button>
        `;

        const btnUnlock = card.querySelector('[data-action="unlock-play"]');
        btnUnlock.addEventListener('click', (e) => {
          e.stopPropagation();
          audioEngine.stopAllSpeech();
          audioEngine.playPaperGrab();
          this.hide();
          this.onPlayWord(wordItem);
        });
      }

      gridEl.appendChild(card);
    });
  }

  triggerSoundAndSpeech(wordItem) {
    const soundMap = {
      ikan: 'splash',
      mobil: 'vroom',
      kucing: 'meow',
      apel: 'crunch',
      bola: 'bounce',
      bebek: 'quack',
      singa: 'roar',
      buku: 'rustle',
      bintang: 'twinkle',
      roti: 'crunch',
      topi: 'cheer',
      awan: 'whoosh',
      bunga: 'twinkle',
      kelinci: 'bounce',
      kereta: 'train',
      kupu: 'flutter',
      gajah: 'trumpet'
    };

    const soundType = soundMap[wordItem.id] || wordItem.vignette?.actionSound || 'twinkle';
    audioEngine.playVignetteSound(soundType);
    audioEngine.speakWordSequence(wordItem);
  }

  bindEvents() {
    // Category filter pills
    const filterBtns = this.containerEl.querySelectorAll('.btn-filter-pill');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.activeCategoryFilter = btn.getAttribute('data-cat') || 'all';
        filterBtns.forEach(b => b.classList.toggle('active', b === btn));
        this.renderCards();
      });
    });

    // Close button
    const closeBtn = document.getElementById('btn-close-stickers');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        audioEngine.stopAllSpeech();
        audioEngine.playPaperGrab();
        this.hide();
      });
    }

    // Close on backdrop click (outside book sheet)
    const backdrop = document.getElementById('sticker-book-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          audioEngine.stopAllSpeech();
          audioEngine.playPaperGrab();
          this.hide();
        }
      });
    }
  }

  hide() {
    audioEngine.stopAllSpeech();
    this.containerEl.classList.add('hidden');
    this.containerEl.innerHTML = '';
  }
}
