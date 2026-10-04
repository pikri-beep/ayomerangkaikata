// Interactive Sticker Book & Diorama Album for Monster Phonics
// Features a clean, crystal-clear 2-Tab experience:
// 1. 📖 Galeri Buku Koleksi: Clean grid of all 17 collectible word stickers with audio preview and direct play
// 2. 🗺️ Panggung Diorama: Full-sized panoramic habitat world with interactive sticker sound & animation reactions

import { wordRepository } from '../services/wordRepository.js';
import { audioEngine } from '../services/audioEngine.js';
import { DIORAMA_SLOTS, getSlotForWord } from '../data/dioramaSlots.js';

const STORAGE_COMPLETED_KEY = 'monster_phonics_completed_words';
const STORAGE_PLACEMENTS_KEY = 'monster_phonics_diorama_stickers';

export class StickerBook {
  constructor(options = {}) {
    this.containerEl = options.containerEl;
    this.onPlayWord = options.onPlayWord || (() => {});

    this.activeTab = 'gallery'; // 'gallery' | 'diorama'
    this.activeCategoryFilter = 'all';

    this.viewportEl = null;
    this.canvasEl = null;
    this.placedStickersContainer = null;
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

  getStickerPlacements() {
    try {
      const stored = localStorage.getItem(STORAGE_PLACEMENTS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  saveStickerPlacement(stickerId, x, y, rotation = 0) {
    try {
      const placements = this.getStickerPlacements();
      placements[stickerId] = { x, y, rotation, isPlaced: true };
      localStorage.setItem(STORAGE_PLACEMENTS_KEY, JSON.stringify(placements));
    } catch {}
  }

  resetAllPlacements() {
    try {
      localStorage.removeItem(STORAGE_PLACEMENTS_KEY);
    } catch {}
  }

  show(initialTab = 'gallery', targetWordId = null) {
    this.activeTab = initialTab;
    const words = wordRepository.getWords();
    const completedIds = this.getCompletedWordIds();
    const totalWords = words.length;
    const completedCount = completedIds.length;
    const progressPercent = Math.round((completedCount / totalWords) * 100);

    this.containerEl.innerHTML = `
      <div class="sticker-book-backdrop diorama-backdrop" role="dialog" aria-modal="true" aria-labelledby="album-main-title">
        <div class="diorama-modal-window album-window animate-pop-in">
          <!-- Washi tape decoration at top -->
          <div class="washi-tape" aria-hidden="true"></div>

          <!-- Clean Header with Progress & Dual Tabs -->
          <div class="album-header">
            <div class="album-brand-section">
              <span class="album-header-icon" aria-hidden="true">📒</span>
              <div>
                <h2 id="album-main-title" class="album-title">Buku Koleksi Stiker</h2>
                <div class="album-progress-text">
                  ⭐ <strong>${completedCount}</strong> dari ${totalWords} Stiker Terkumpul (${progressPercent}%)
                </div>
              </div>
            </div>

            <!-- Big, Friendly Dual Tab Selector -->
            <div class="album-tab-bar" role="tablist">
              <button class="btn-album-tab ${this.activeTab === 'gallery' ? 'active' : ''}" id="tab-btn-gallery" role="tab" aria-selected="${this.activeTab === 'gallery'}">
                <span>📖</span>
                <span>Buku Koleksi</span>
              </button>
              <button class="btn-album-tab ${this.activeTab === 'diorama' ? 'active' : ''}" id="tab-btn-diorama" role="tab" aria-selected="${this.activeTab === 'diorama'}">
                <span>🗺️</span>
                <span>Panggung Diorama</span>
              </button>
            </div>

            <div class="album-header-actions">
              <button class="btn-close-modal btn-album-close" id="btn-close-stickers" aria-label="Tutup Album" title="Tutup Album">✕</button>
            </div>
          </div>

          <!-- Tab Content 1: Sticker Book Gallery View -->
          <div class="album-tab-content ${this.activeTab === 'gallery' ? 'active-view' : 'hidden-view'}" id="album-view-gallery">
            <!-- Category Filter Bar -->
            <div class="gallery-filter-bar">
              <button class="btn-filter-pill ${this.activeCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">🌟 Semua (17)</button>
              <button class="btn-filter-pill ${this.activeCategoryFilter === 'hewan' ? 'active' : ''}" data-cat="hewan">🐱 Hewan (7)</button>
              <button class="btn-filter-pill ${this.activeCategoryFilter === 'buah' ? 'active' : ''}" data-cat="buah">🍎 Buah & Makanan (3)</button>
              <button class="btn-filter-pill ${this.activeCategoryFilter === 'benda' ? 'active' : ''}" data-cat="benda">⚽ Benda & Mobil (4)</button>
              <button class="btn-filter-pill ${this.activeCategoryFilter === 'alam' ? 'active' : ''}" data-cat="alam">☁️ Alam (3)</button>
            </div>

            <!-- Grid of Sticker Cards -->
            <div class="sticker-cards-grid" id="sticker-cards-grid">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- Tab Content 2: Interactive Diorama World View -->
          <div class="album-tab-content ${this.activeTab === 'diorama' ? 'active-view' : 'hidden-view'}" id="album-view-diorama">
            <!-- Zone Jump Ribbons -->
            <div class="diorama-zone-ribbon">
              <span class="zone-ribbon-label">Zona Habitat:</span>
              <button class="btn-zone-jump" data-target-x="0">🌳 Taman Rumput</button>
              <button class="btn-zone-jump" data-target-x="550">🐠 Sungai Ceria</button>
              <button class="btn-zone-jump" data-target-x="1100">🚗 Jalan Kota</button>
              <button class="btn-zone-jump" data-target-x="1650">☁️ Langit Bintang</button>
              <button class="btn-reset-diorama" id="btn-reset-diorama" title="Kembalikan posisi stiker ke habitat aslinya">
                <span>🔄 Tata Ulang</span>
              </button>
            </div>

            <!-- Full-Height Diorama Panorama Viewport -->
            <div class="peel-viewport-wrapper diorama-stage-wrapper">
              <button type="button" class="btn-diorama-slide btn-slide-prev" id="btn-album-slide-prev" aria-label="Geser ke kiri">◀</button>
              <button type="button" class="btn-diorama-slide btn-slide-next" id="btn-album-slide-next" aria-label="Geser ke kanan">▶</button>

              <div class="diorama-viewport" id="diorama-viewport">
                <div class="diorama-canvas" id="diorama-canvas">
                  <!-- Habitat Strips Layer -->
                  <div class="peel-strips-layer" id="diorama-album-strips-layer"></div>

                  <!-- Zone Badges inside canvas -->
                  <div class="diorama-zone" style="left: 0; width: 550px;">
                    <div class="zone-badge">🌳 Padang Rumput & Taman</div>
                  </div>
                  <div class="diorama-zone" style="left: 550px; width: 550px;">
                    <div class="zone-badge">🐠 Sungai & Alam Liar</div>
                  </div>
                  <div class="diorama-zone" style="left: 1100px; width: 550px;">
                    <div class="zone-badge">🚗 Jalan Raya & Kota</div>
                  </div>
                  <div class="diorama-zone" style="left: 1650px; width: 550px;">
                    <div class="zone-badge">☁️ Bukit & Langit Bintang</div>
                  </div>

                  <!-- Placed interactive stickers container -->
                  <div class="diorama-placed-stickers" id="diorama-placed-stickers"></div>
                </div>
              </div>
            </div>

            <!-- Bottom helper hint -->
            <div class="diorama-bottom-hint">
              <span>🖐️</span>
              <span>Ketuk stiker apa saja di panggung untuk melihat reaksi lucunya, atau geser bebas untuk menata duniamu!</span>
            </div>
          </div>

        </div>
      </div>
    `;

    this.containerEl.classList.remove('hidden');

    this.viewportEl = document.getElementById('diorama-viewport');
    this.canvasEl = document.getElementById('diorama-canvas');
    this.placedStickersContainer = document.getElementById('diorama-placed-stickers');

    this.renderGalleryGrid();
    this.renderDioramaCanvas();
    this.bindEvents();

    if (targetWordId && initialTab === 'diorama') {
      setTimeout(() => this.focusWordInDiorama(targetWordId), 250);
    }
  }

  renderGalleryGrid() {
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
            <img src="${wordItem.image}" alt="${wordItem.word}" class="card-diecut-img">
          </div>
          <div class="card-word-title">${wordItem.word}</div>
          <div class="card-category-tag">${wordItem.category}</div>
          <div class="card-buttons-row">
            <button class="btn-card-action btn-card-sound" data-action="sound" title="Dengarkan lafal dan suara ${wordItem.word}">
              <span>🔊</span>
              <span>Bunyi</span>
            </button>
            <button class="btn-card-action btn-card-diorama" data-action="diorama" title="Lihat ${wordItem.word} di Panggung Diorama">
              <span>🗺️</span>
              <span>Diorama</span>
            </button>
            <button class="btn-card-action btn-card-play" data-action="play" title="Mainkan kata ${wordItem.word} sekarang">
              <span>▶️</span>
              <span>Mainkan</span>
            </button>
          </div>
        `;

        // Card button events
        const btnSound = card.querySelector('[data-action="sound"]');
        const btnDiorama = card.querySelector('[data-action="diorama"]');
        const btnPlay = card.querySelector('[data-action="play"]');

        btnSound.addEventListener('click', (e) => {
          e.stopPropagation();
          audioEngine.playPaperGrab();
          this.triggerSoundAndSpeech(wordItem);
        });

        btnDiorama.addEventListener('click', (e) => {
          e.stopPropagation();
          audioEngine.playPaperGrab();
          this.switchTab('diorama');
          setTimeout(() => this.focusWordInDiorama(wordItem.id), 120);
        });

        btnPlay.addEventListener('click', (e) => {
          e.stopPropagation();
          audioEngine.playPaperGrab();
          this.hide();
          this.onPlayWord(wordItem);
        });

      } else {
        card.innerHTML = `
          <div class="card-status-badge locked-status">🔒 Terkunci</div>
          <div class="card-sticker-illustration silhouette-box">
            <span class="locked-big-icon">🔒</span>
          </div>
          <div class="card-word-title locked-title">???</div>
          <div class="card-hint-text">💡 ${wordItem.hint || 'Selesaikan kata di game untuk membuka!'}</div>
          <button class="btn-card-action btn-card-unlock" data-action="unlock-play" title="Mainkan kata ini sekarang untuk membuka stiker!">
            <span>▶️</span>
            <span>Buka Kata Ini</span>
          </button>
        `;

        const btnUnlock = card.querySelector('[data-action="unlock-play"]');
        btnUnlock.addEventListener('click', (e) => {
          e.stopPropagation();
          audioEngine.playPaperGrab();
          this.hide();
          this.onPlayWord(wordItem);
        });
      }

      gridEl.appendChild(card);
    });
  }

  renderDioramaCanvas() {
    if (!this.placedStickersContainer) return;
    this.placedStickersContainer.innerHTML = '';

    const words = wordRepository.getWords();
    const completedIds = this.getCompletedWordIds();
    const placements = this.getStickerPlacements();

    words.forEach(wordItem => {
      const isUnlocked = completedIds.includes(wordItem.id);
      if (!isUnlocked) return;

      // Determine coordinate: saved custom placement OR default habitat slot coordinate
      const defaultSlot = getSlotForWord(wordItem.id);
      const saved = placements[wordItem.id];
      const posX = saved && saved.x !== undefined ? saved.x : (defaultSlot ? defaultSlot.x : 200);
      const posY = saved && saved.y !== undefined ? saved.y : (defaultSlot ? defaultSlot.y : 180);
      const rot = saved && saved.rotation !== undefined ? saved.rotation : 0;

      this.renderCanvasSticker(wordItem, posX, posY, rot);
    });
  }

  renderCanvasSticker(wordItem, x, y, rotation) {
    const stickerEl = document.createElement('div');
    stickerEl.className = 'canvas-placed-sticker die-cut-sticker';
    stickerEl.setAttribute('data-id', wordItem.id);
    stickerEl.style.left = `${x}px`;
    stickerEl.style.top = `${y}px`;
    stickerEl.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

    stickerEl.innerHTML = `
      <div class="canvas-sticker-art">
        ${wordItem.image ? `<img src="${wordItem.image}" alt="${wordItem.word}">` : '🎨'}
      </div>
      <div class="canvas-sticker-tag">${wordItem.word}</div>
    `;

    // Tap to interact (trigger sound & habitat reaction)
    stickerEl.addEventListener('click', () => {
      this.triggerStickerReaction(stickerEl, wordItem);
    });

    // Make placed sticker draggable across canvas to reposition freely
    this.attachCanvasStickerDrag(stickerEl, wordItem);

    this.placedStickersContainer.appendChild(stickerEl);
  }

  focusWordInDiorama(wordId) {
    const defaultSlot = getSlotForWord(wordId);
    const placements = this.getStickerPlacements();
    const saved = placements[wordId];
    const targetX = saved && saved.x !== undefined ? saved.x : (defaultSlot ? defaultSlot.x : 0);

    if (this.viewportEl) {
      const viewWidth = this.viewportEl.clientWidth || 600;
      const scrollPos = Math.max(0, targetX - viewWidth / 2);
      this.viewportEl.scrollTo({ left: scrollPos, behavior: 'smooth' });

      // Highlight the sticker with cheerful bounce
      setTimeout(() => {
        const el = this.placedStickersContainer.querySelector(`[data-id="${wordId}"]`);
        if (el) {
          const word = wordRepository.getWords().find(w => w.id === wordId);
          if (word) this.triggerStickerReaction(el, word);
        }
      }, 350);
    }
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

  triggerStickerReaction(stickerEl, wordItem) {
    audioEngine.playPeelStick();
    stickerEl.classList.remove('jiggle-reaction');
    void stickerEl.offsetWidth; // trigger reflow
    stickerEl.classList.add('jiggle-reaction');

    this.triggerSoundAndSpeech(wordItem);

    if (wordItem.id === 'ikan') {
      this.spawnWaterBubbles(stickerEl);
    } else if (wordItem.id === 'bintang' || wordItem.id === 'bunga' || wordItem.id === 'kupu') {
      this.spawnSparkleShower(stickerEl);
    } else if (wordItem.id === 'awan') {
      this.spawnCloudPuff(stickerEl);
    }
  }

  spawnWaterBubbles(targetEl) {
    if (!this.canvasEl) return;
    const rect = targetEl.getBoundingClientRect();
    const canvasRect = this.canvasEl.getBoundingClientRect();
    const originX = rect.left - canvasRect.left + rect.width / 2;
    const originY = rect.top - canvasRect.top;

    for (let i = 0; i < 5; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'diorama-bubble';
      bubble.style.left = `${originX + (Math.random() - 0.5) * 40}px`;
      bubble.style.top = `${originY + Math.random() * 20}px`;
      bubble.style.animationDelay = `${i * 0.12}s`;
      this.canvasEl.appendChild(bubble);

      setTimeout(() => bubble.remove(), 1400);
    }
  }

  spawnSparkleShower(targetEl) {
    if (!this.canvasEl) return;
    const rect = targetEl.getBoundingClientRect();
    const canvasRect = this.canvasEl.getBoundingClientRect();
    const originX = rect.left - canvasRect.left + rect.width / 2;
    const originY = rect.top - canvasRect.top + rect.height / 2;

    const stars = ['✨', '⭐', '🌟', '💫'];
    for (let i = 0; i < 6; i++) {
      const star = document.createElement('div');
      star.className = 'diorama-sparkle-float';
      star.textContent = stars[i % stars.length];
      star.style.position = 'absolute';
      star.style.left = `${originX + (Math.random() - 0.5) * 50}px`;
      star.style.top = `${originY + (Math.random() - 0.5) * 40}px`;
      star.style.fontSize = `${1.2 + Math.random() * 0.5}rem`;
      star.style.pointerEvents = 'none';
      star.style.zIndex = '60';
      star.style.animation = 'sparkleFloatUp 1.2s ease-out forwards';
      star.style.animationDelay = `${i * 0.08}s`;
      this.canvasEl.appendChild(star);

      setTimeout(() => star.remove(), 1400);
    }
  }

  spawnCloudPuff(targetEl) {
    if (!this.canvasEl) return;
    const rect = targetEl.getBoundingClientRect();
    const canvasRect = this.canvasEl.getBoundingClientRect();
    const originX = rect.left - canvasRect.left + rect.width / 2;
    const originY = rect.top - canvasRect.top + rect.height / 2;

    for (let i = 0; i < 4; i++) {
      const puff = document.createElement('div');
      puff.textContent = '☁️';
      puff.style.position = 'absolute';
      puff.style.left = `${originX + (Math.random() - 0.5) * 60}px`;
      puff.style.top = `${originY + (Math.random() - 0.5) * 30}px`;
      puff.style.fontSize = '1.4rem';
      puff.style.opacity = '0.8';
      puff.style.pointerEvents = 'none';
      puff.style.zIndex = '60';
      puff.style.animation = 'cloudDrift 1.5s ease-out forwards';
      this.canvasEl.appendChild(puff);

      setTimeout(() => puff.remove(), 1600);
    }
  }

  attachCanvasStickerDrag(stickerEl, wordItem) {
    stickerEl.style.touchAction = 'none';

    let isMoving = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    stickerEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      audioEngine.ensureContext();
      audioEngine.playPaperGrab();

      isMoving = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(stickerEl.style.left);
      initialTop = parseFloat(stickerEl.style.top);

      stickerEl.classList.add('is-dragging-on-canvas');
      stickerEl.setPointerCapture(e.pointerId);

      const onPointerMove = (moveEvt) => {
        if (!isMoving) return;
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;

        const newX = Math.max(45, Math.min(2155, initialLeft + dx));
        const newY = Math.max(45, Math.min(335, initialTop + dy));

        stickerEl.style.left = `${newX}px`;
        stickerEl.style.top = `${newY}px`;
        stickerEl.style.transform = `translate(-50%, -50%) scale(1.12) rotate(0deg)`;
      };

      const onPointerUp = () => {
        if (!isMoving) return;
        isMoving = false;
        try { stickerEl.releasePointerCapture(e.pointerId); } catch (_) {}
        stickerEl.classList.remove('is-dragging-on-canvas');
        audioEngine.playPeelStick();

        const finalX = parseFloat(stickerEl.style.left);
        const finalY = parseFloat(stickerEl.style.top);
        this.saveStickerPlacement(wordItem.id, finalX, finalY, 0);

        stickerEl.style.transform = `translate(-50%, -50%) scale(1) rotate(0deg)`;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    const tabGalleryBtn = document.getElementById('tab-btn-gallery');
    const tabDioramaBtn = document.getElementById('tab-btn-diorama');
    const viewGallery = document.getElementById('album-view-gallery');
    const viewDiorama = document.getElementById('album-view-diorama');

    if (tabName === 'gallery') {
      if (tabGalleryBtn) tabGalleryBtn.classList.add('active');
      if (tabDioramaBtn) tabDioramaBtn.classList.remove('active');
      if (viewGallery) { viewGallery.classList.remove('hidden-view'); viewGallery.classList.add('active-view'); }
      if (viewDiorama) { viewDiorama.classList.add('hidden-view'); viewDiorama.classList.remove('active-view'); }
      this.renderGalleryGrid();
    } else {
      if (tabGalleryBtn) tabGalleryBtn.classList.remove('active');
      if (tabDioramaBtn) tabDioramaBtn.classList.add('active');
      if (viewGallery) { viewGallery.classList.add('hidden-view'); viewGallery.classList.remove('active-view'); }
      if (viewDiorama) { viewDiorama.classList.remove('hidden-view'); viewDiorama.classList.add('active-view'); }
      this.renderDioramaCanvas();
    }
  }

  bindEvents() {
    // Tab switching
    const tabGalleryBtn = document.getElementById('tab-btn-gallery');
    const tabDioramaBtn = document.getElementById('tab-btn-diorama');

    if (tabGalleryBtn) {
      tabGalleryBtn.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.switchTab('gallery');
      });
    }

    if (tabDioramaBtn) {
      tabDioramaBtn.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.switchTab('diorama');
      });
    }

    // Category filter pills in Gallery
    const filterBtns = this.containerEl.querySelectorAll('.btn-filter-pill');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.activeCategoryFilter = btn.getAttribute('data-cat') || 'all';
        filterBtns.forEach(b => b.classList.toggle('active', b === btn));
        this.renderGalleryGrid();
      });
    });

    // Close button
    const closeBtn = document.getElementById('btn-close-stickers');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        this.hide();
      });
    }

    // Reset Diorama Placements button
    const resetBtn = document.getElementById('btn-reset-diorama');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Kembalikan semua stiker diorama ke posisi habitat aslinya?')) {
          audioEngine.playPaperGrab();
          this.resetAllPlacements();
          this.renderDioramaCanvas();
        }
      });
    }

    // Zone Jump navigation buttons in Diorama
    const zoneBtns = this.containerEl.querySelectorAll('.btn-zone-jump');
    zoneBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetX = parseInt(btn.getAttribute('data-target-x'), 10) || 0;
        audioEngine.playPaperGrab();
        if (this.viewportEl) {
          this.viewportEl.scrollTo({ left: targetX, behavior: 'smooth' });
        }
      });
    });

    // Slide buttons
    const prevBtn = document.getElementById('btn-album-slide-prev');
    const nextBtn = document.getElementById('btn-album-slide-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        if (this.viewportEl) {
          this.viewportEl.scrollBy({ left: -450, behavior: 'smooth' });
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        audioEngine.playPaperGrab();
        if (this.viewportEl) {
          this.viewportEl.scrollBy({ left: 450, behavior: 'smooth' });
        }
      });
    }

    // Setup viewport drag scroll on diorama
    this.setupViewportDragScroll();
  }

  setupViewportDragScroll() {
    if (!this.viewportEl) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    this.viewportEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.canvas-placed-sticker')) return;
      isDown = true;
      startX = e.pageX - this.viewportEl.offsetLeft;
      scrollLeft = this.viewportEl.scrollLeft;
      this.viewportEl.style.cursor = 'grabbing';
    });

    const onPointerMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - this.viewportEl.offsetLeft;
      const walk = (x - startX) * 1.3;
      this.viewportEl.scrollLeft = scrollLeft - walk;
    };

    const onPointerUp = () => {
      if (!isDown) return;
      isDown = false;
      if (this.viewportEl) this.viewportEl.style.cursor = 'grab';
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  hide() {
    this.containerEl.classList.add('hidden');
    this.containerEl.innerHTML = '';
  }
}
