// Drag and Drop Engine for Monster Phonics
// Full Pointer Events support (Mouse, Touch, Stylus) + Keyboard & Tap-to-Place
// Provides real-time phonics sound looping, bouncy physics, and snapping feedback

import { audioEngine } from '../services/audioEngine.js';
import { createMonsterSVG, createSlotContent } from './monsterFactory.js';

export class DragDropEngine {
  constructor(options = {}) {
    this.targetBoardEl = options.targetBoardEl;
    this.trayEl = options.trayEl;
    this.onWordCompleted = options.onWordCompleted || (() => {});
    this.activePointerId = null;
    this.activeMonsterEl = null;
    this.activeSlot = null;
    this.dragGhost = null;
    this.originRect = null;
    this.targetSlots = [];
    this.prevX = 0;
    this.prevY = 0;
    this.velocityX = 0;
    this.isDragging = false;
    this.pickupAngle = 0;
    this.topZIndex = 30;
    this._wordCompletionPending = false;
  }

  setTargetSlots(slots) {
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
    this.isDragging = false;
    this.targetSlots = slots;
    this._wordCompletionPending = false;

    // Attach click-to-unseat listener on each target slot
    this.targetSlots.forEach(slot => {
      if (slot.el) {
        slot.el.style.cursor = 'pointer';
        slot.el.addEventListener('click', () => {
          if (slot.isFilled && !this._wordCompletionPending) {
            this.unseatSlot(slot);
          }
        });
      }
    });
  }

  /**
   * Scatters letter cards organically across the play desk
   * Uses an adaptive grid-based layout with organic jitter so letters never overlap or overflow
   */
  scatterLetters() {
    if (!this.trayEl) return;
    const cards = Array.from(this.trayEl.querySelectorAll('.monster-letter-card:not(.is-placed)'));
    if (cards.length === 0) return;

    const rect = this.trayEl.getBoundingClientRect();
    const deskW = rect.width > 0 ? rect.width : (this.trayEl.clientWidth || 360);
    const deskH = rect.height > 0 ? rect.height : (this.trayEl.clientHeight || 280);

    const pad = Math.max(6, Math.min(12, deskH * 0.04));
    const n = cards.length;

    // Detect bottom edge of mission card so initial scatter stays in "Tempat Huruf"
    const missionCard = document.querySelector('.word-mission-card');
    let startY = pad;
    if (missionCard) {
      const mRect = missionCard.getBoundingClientRect();
      startY = Math.max(pad, Math.round(mRect.bottom - rect.top + 4));
    } else {
      startY = Math.round(deskH * 0.36);
    }
    // Safety clamp: ensure letters start area never exceeds 44% of desk height
    if (startY > deskH * 0.44) {
      startY = Math.round(deskH * 0.38);
    }
    const availableH = Math.max(80, deskH - startY - pad);

    // Distribute columns and rows smartly based on aspect ratio
    const isWide = deskW / availableH > 1.8;
    let cols = isWide
      ? Math.max(1, Math.min(n, Math.floor((deskW - pad * 2) / 52)))
      : Math.max(1, Math.min(n, Math.floor((deskW - pad * 2) / 64)));
    let rows = Math.ceil(n / cols);

    const maxWPerCard = Math.floor((deskW - pad * 2) / cols) - 6;
    const maxHPerCard = Math.floor((availableH - pad) / rows) - 6;

    // Standard card aspect ratio is ~1 : 1.15
    let cardW = Math.min(78, Math.max(38, Math.min(maxWPerCard, maxHPerCard / 1.15)));
    let cardH = Math.round(cardW * 1.15);

    if (cardH > maxHPerCard && maxHPerCard > 26) {
      cardH = maxHPerCard;
      cardW = Math.round(cardH / 1.15);
    }

    const cellW = (deskW - pad * 2) / cols;
    const cellH = Math.max(cardH + 4, (availableH - pad) / rows);

    // Max jitter is half of remaining space in each cell, clamped so cards stay inside cell
    const maxJitterX = Math.max(0, (cellW - cardW) / 2 - 3);
    const maxJitterY = Math.max(0, (cellH - cardH) / 2 - 3);

    cards.forEach((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const jitterX = (Math.random() - 0.5) * 2 * maxJitterX;
      const jitterY = (Math.random() - 0.5) * 2 * maxJitterY;

      const posX = Math.max(pad, Math.min(deskW - cardW - pad, pad + col * cellW + (cellW - cardW) / 2 + jitterX));
      const posY = Math.max(startY, Math.min(deskH - cardH - pad, startY + row * cellH + (cellH - cardH) / 2 + jitterY));

      card.style.width = `${cardW}px`;
      card.style.height = `${cardH}px`;
      card.style.position = 'absolute';
      card.style.left = `${posX}px`;
      card.style.top = `${posY}px`;
      card.style.transform = 'rotate(0deg) scale(1)';
      card.style.zIndex = `${10 + idx}`;
      card.style.visibility = 'visible';
    });
  }

  /**
   * Tidies all letters neatly on the play desk in an orderly row/grid
   */
  tidyLetters() {
    if (!this.trayEl) return;
    const cards = Array.from(this.trayEl.querySelectorAll('.monster-letter-card:not(.is-placed)'));
    if (cards.length === 0) return;

    audioEngine.playPaperGrab();

    const rect = this.trayEl.getBoundingClientRect();
    const deskW = rect.width > 0 ? rect.width : (this.trayEl.clientWidth || 360);
    const deskH = rect.height > 0 ? rect.height : (this.trayEl.clientHeight || 280);

    const pad = Math.max(6, Math.min(12, deskH * 0.04));
    const n = cards.length;

    const missionCard = document.querySelector('.word-mission-card');
    let startY = pad;
    if (missionCard) {
      const mRect = missionCard.getBoundingClientRect();
      startY = Math.max(pad, Math.round(mRect.bottom - rect.top + 4));
    } else {
      startY = Math.round(deskH * 0.36);
    }
    // Safety clamp: ensure letters start area never exceeds 44% of desk height
    if (startY > deskH * 0.44) {
      startY = Math.round(deskH * 0.38);
    }
    const availableH = Math.max(80, deskH - startY - pad);

    const isWide = deskW / availableH > 1.8;
    let cols = isWide
      ? Math.max(1, Math.min(n, Math.floor((deskW - pad * 2) / 52)))
      : Math.max(1, Math.min(n, Math.floor((deskW - pad * 2) / 64)));
    let rows = Math.ceil(n / cols);

    const maxWPerCard = Math.floor((deskW - pad * 2) / cols) - 6;
    const maxHPerCard = Math.floor((availableH - pad) / rows) - 6;

    let cardW = Math.min(78, Math.max(38, Math.min(maxWPerCard, maxHPerCard / 1.15)));
    let cardH = Math.round(cardW * 1.15);

    if (cardH > maxHPerCard && maxHPerCard > 26) {
      cardH = maxHPerCard;
      cardW = Math.round(cardH / 1.15);
    }

    const cellW = (deskW - pad * 2) / cols;
    const cellH = Math.max(cardH + 4, (availableH - pad) / rows);

    cards.forEach((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const posX = pad + col * cellW + (cellW - cardW) / 2;
      const posY = startY + row * cellH + (cellH - cardH) / 2;

      card.style.transition = 'transform 0.25s ease, left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease';
      card.style.width = `${cardW}px`;
      card.style.height = `${cardH}px`;
      card.style.position = 'absolute';
      card.style.left = `${posX}px`;
      card.style.top = `${posY}px`;
      card.style.transform = 'rotate(0deg) scale(1)';
      card.style.zIndex = `${10 + idx}`;
      card.style.visibility = 'visible';

      setTimeout(() => {
        card.style.transition = '';
      }, 280);
    });
  }

  attachMonster(monsterEl, letter) {
    monsterEl.style.touchAction = 'none';

    let downTime = 0;
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e) => {
      // Only single touch / primary mouse button; not if already dragging something
      if (this.isDragging || (e.button !== undefined && e.button !== 0)) return;
      if (monsterEl.classList.contains('is-placed')) return;
      e.preventDefault();

      downTime = Date.now();
      downX = e.clientX;
      downY = e.clientY;

      // Cache target slot positions once on pickup — eliminates layout reflow during drag!
      this._cachedSlotRects = this.targetSlots.map(slot => {
        if (!slot.el) return null;
        const r = slot.el.getBoundingClientRect();
        return {
          slot,
          expectedLetter: slot.expectedLetter,
          centerX: r.left + r.width / 2,
          centerY: r.top + r.height / 2,
          rect: r
        };
      }).filter(Boolean);

      // Audio context unlock & tactile paper grab
      audioEngine.ensureContext();
      audioEngine.playPaperGrab();

      this.isDragging = true;
      this.activePointerId = e.pointerId;
      this.activeMonsterEl = monsterEl;
      this.activeSlot = null;
      monsterEl.setPointerCapture(e.pointerId);

      this.topZIndex = (this.topZIndex || 30) + 1;
      monsterEl.style.zIndex = this.topZIndex;

      this.originRect = monsterEl.getBoundingClientRect();
      this.prevX = e.clientX;
      this.prevY = e.clientY;

      // Start looping phonics chant
      audioEngine.startPhonicsChant(letter);

      this.pickupAngle = 0;

      // Create hardware-accelerated drag ghost
      this.createDragGhost(letter, e.clientX, e.clientY, 0);
      monsterEl.classList.add('is-being-dragged', 'paper-lifted');
      monsterEl.style.visibility = 'hidden';

      let pendingX = e.clientX;
      let pendingY = e.clientY;
      let pendingTilt = 0;

      const onPointerMove = (moveEvt) => {
        if (!this.isDragging || moveEvt.pointerId !== this.activePointerId) return;
        moveEvt.preventDefault();

        // Calculate velocity
        this.velocityX = moveEvt.clientX - this.prevX;
        this.prevX = moveEvt.clientX;
        this.prevY = moveEvt.clientY;

        pendingTilt = Math.max(-10, Math.min(10, this.velocityX * 0.9));
        pendingX = moveEvt.clientX;
        pendingY = moveEvt.clientY;

        // Schedule GPU transform update and hit-testing on animation frame (smooth 60/120fps)
        if (!this._rafId) {
          this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            if (this.dragGhost) {
              this.dragGhost.style.transform = `translate3d(${pendingX}px, ${pendingY}px, 0) translate(-50%, -50%) scale(1.12) rotate(${pendingTilt}deg)`;
            }
            this.checkSlotProximity(pendingX, pendingY, letter);
          });
        }
      };

      const cleanup = (upEvt) => {
        if (upEvt && upEvt.pointerId !== this.activePointerId) return;
        this.isDragging = false;

        if (this._rafId) {
          cancelAnimationFrame(this._rafId);
          this._rafId = null;
        }

        try { monsterEl.releasePointerCapture(this.activePointerId); } catch (_) {}
        monsterEl.removeEventListener('pointermove', onPointerMove);
        monsterEl.removeEventListener('pointerup', cleanup);
        monsterEl.removeEventListener('pointercancel', cleanup);

        audioEngine.stopPhonicsChant();

        // Clear slot highlights
        this.targetSlots.forEach(s => s.el && s.el.classList.remove('slot-hover-snap'));

        if (upEvt) {
          // Direct drag-and-drop: NO TAP-TO-PLACE (trains child's fine motor skills)
          this.handleDrop(upEvt.clientX, upEvt.clientY, letter, monsterEl);
        } else {
          this._restoreCard(monsterEl);
        }
      };

      monsterEl.addEventListener('pointermove', onPointerMove);
      monsterEl.addEventListener('pointerup', cleanup);
      monsterEl.addEventListener('pointercancel', cleanup);
    };

    monsterEl.addEventListener('pointerdown', onPointerDown);
  }

  _restoreCard(monsterEl) {
    if (this.dragGhost) { this.dragGhost.remove(); this.dragGhost = null; }
    monsterEl.classList.remove('is-being-dragged', 'paper-lifted');
    monsterEl.style.visibility = 'visible';
  }

  createDragGhost(letter, x, y, initialAngle = 0) {
    if (this.dragGhost) this.dragGhost.remove();

    const w = this.originRect ? Math.round(this.originRect.width) : 74;
    const h = this.originRect ? Math.round(this.originRect.height) : Math.round(w * 1.15);

    const ghost = document.createElement('div');
    ghost.className = 'monster-drag-ghost paper-lifted paper-drag-lifted';
    ghost.style.position = 'fixed';
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.willChange = 'transform';
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(1.1) rotate(${initialAngle}deg)`;
    ghost.style.width = `${w}px`;
    ghost.style.height = `${h}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.innerHTML = createMonsterSVG(letter, { state: 'dragging' });

    document.body.appendChild(ghost);
    this.dragGhost = ghost;
  }

  checkSlotProximity(clientX, clientY, letter) {
    let hoveredSlot = null;
    const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 500;
    let minDistance = isSmallScreen ? 60 : 85;

    if (!this._cachedSlotRects) return;

    for (let i = 0; i < this._cachedSlotRects.length; i++) {
      const item = this._cachedSlotRects[i];
      if (item.slot.isFilled) continue;
      if (item.expectedLetter !== letter) continue;

      const dist = Math.hypot(clientX - item.centerX, clientY - item.centerY);
      if (dist < minDistance) {
        minDistance = dist;
        hoveredSlot = item.slot;
      }
    }

    if (hoveredSlot !== this.activeSlot) {
      if (this.activeSlot && this.activeSlot.el) {
        this.activeSlot.el.classList.remove('slot-hover-snap');
      }
      this.activeSlot = hoveredSlot;
      if (this.activeSlot && this.activeSlot.el) {
        this.activeSlot.el.classList.add('slot-hover-snap');
        audioEngine.playSlotSnapHover();
      }
    }
  }

  snapCardToSlot(monsterEl, targetSlot, letter) {
    targetSlot.isFilled = true;
    this.activeSlot = null;

    const slotRect = targetSlot.el.getBoundingClientRect();
    const targetX = slotRect.left + slotRect.width / 2;
    const targetY = slotRect.top + slotRect.height / 2;

    const ghost = this.dragGhost || this._createQuickGhost(monsterEl, letter);
    this.dragGhost = null;

    if (ghost) {
      ghost.classList.remove('paper-drag-lifted', 'paper-lifted');
      ghost.classList.add('paper-sticking');
      ghost.style.transition = 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      ghost.style.left = '0px';
      ghost.style.top = '0px';
      ghost.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) scale(1) rotate(0deg)`;

      setTimeout(() => {
        ghost.remove();
        this._finalizeSlot(monsterEl, targetSlot, letter, targetX, targetY);
      }, 230);
    } else {
      this._finalizeSlot(monsterEl, targetSlot, letter, targetX, targetY);
    }
  }

  _createQuickGhost(monsterEl, letter) {
    const rect = monsterEl.getBoundingClientRect();
    const w = Math.round(rect.width) || 74;
    const h = Math.round(rect.height) || Math.round(w * 1.15);
    const ghost = document.createElement('div');
    ghost.className = 'monster-drag-ghost paper-sticking';
    ghost.style.position = 'fixed';
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.transform = `translate3d(${rect.left + rect.width / 2}px, ${rect.top + rect.height / 2}px, 0) translate(-50%, -50%) scale(1)`;
    ghost.style.width = `${w}px`;
    ghost.style.height = `${h}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.innerHTML = createMonsterSVG(letter, { state: 'dragging' });
    document.body.appendChild(ghost);
    return ghost;
  }

  _finalizeSlot(monsterEl, targetSlot, letter, targetX, targetY) {
    targetSlot.el.innerHTML = createMonsterSVG(letter, { state: 'snapped' });
    targetSlot.el.classList.add('slot-filled', 'paper-stuck');
    targetSlot.filledMonsterEl = monsterEl;

    monsterEl.classList.add('is-placed');
    monsterEl.classList.remove('is-being-dragged', 'paper-lifted');
    monsterEl.style.visibility = 'hidden';

    audioEngine.playTapeSnap();
    this.spawnSparkleParticles(targetX, targetY);
    this.checkWordCompletion();
  }

  unseatSlot(slot) {
    if (!slot || !slot.isFilled) return;

    slot.isFilled = false;
    slot.el.innerHTML = createSlotContent(slot.expectedLetter);
    slot.el.classList.remove('slot-filled', 'paper-stuck');

    const monsterEl = slot.filledMonsterEl;
    slot.filledMonsterEl = null;

    if (monsterEl) {
      monsterEl.classList.remove('is-placed');
      monsterEl.style.visibility = 'visible';
      audioEngine.playPaperLand();
      this.scatterLetters();
    }

    this._wordCompletionPending = false;
  }

  unseatLastFilledSlot() {
    for (let i = this.targetSlots.length - 1; i >= 0; i--) {
      const slot = this.targetSlots[i];
      if (slot.isFilled && !this._wordCompletionPending) {
        this.unseatSlot(slot);
        return;
      }
    }
  }

  placeLetterFromKey(letter) {
    const char = letter.toUpperCase();
    const targetSlot = this.targetSlots.find(s => !s.isFilled && s.expectedLetter === char);
    if (!targetSlot) return;

    if (!this.trayEl) return;
    const cards = Array.from(this.trayEl.querySelectorAll('.monster-letter-card:not(.is-placed)'));
    const monsterEl = cards.find(c => c.getAttribute('data-letter') === char);
    if (!monsterEl) return;

    this.snapCardToSlot(monsterEl, targetSlot, char);
  }

  handleDrop(clientX, clientY, letter, monsterEl) {
    // Clear slot highlights
    this.targetSlots.forEach(s => s.el && s.el.classList.remove('slot-hover-snap'));

    // Check if dropped near or over any unfilled matching slot (generous radius for child motorics)
    let matchedSlot = null;
    let minDistance = 85;

    for (const slot of this.targetSlots) {
      if (slot.isFilled || slot.expectedLetter !== letter || !slot.el) continue;
      const rect = slot.el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Check geometric overlap with 35px padding or radial distance
      const isInside = clientX >= (rect.left - 35) && clientX <= (rect.right + 35) &&
                       clientY >= (rect.top - 35) && clientY <= (rect.bottom + 35);
      const dist = Math.hypot(clientX - centerX, clientY - centerY);

      if (isInside || dist < minDistance) {
        matchedSlot = slot;
        minDistance = dist;
      }
    }

    if (matchedSlot) {
      this.activeSlot = null;
      this.snapCardToSlot(monsterEl, matchedSlot, letter);
      return;
    }

    // FREE DROP — letter lands where the child released it on the full white play table
    audioEngine.playPaperLand();
    this.activeSlot = null;

      const trayRect = this.trayEl.getBoundingClientRect();
      const cardW = monsterEl.offsetWidth || 76;
      const cardH = monsterEl.offsetHeight || 84;

      let newX = clientX - trayRect.left - cardW / 2;
      let newY = clientY - trayRect.top - cardH / 2;

      // Clamp so the letter never gets lost outside the arena bounds
      newX = Math.max(6, Math.min(trayRect.width - cardW - 6, newX));
      newY = Math.max(6, Math.min(trayRect.height - cardH - 6, newY));
      const dropRot = (Math.random() - 0.5) * 16; // natural resting paper angle

      const applyPosition = () => {
        monsterEl.style.position = 'absolute';
        monsterEl.style.left = `${newX}px`;
        monsterEl.style.top = `${newY}px`;
        monsterEl.style.transform = `rotate(${dropRot}deg) scale(1)`;
        monsterEl.style.visibility = 'visible';
        monsterEl.classList.remove('is-being-dragged', 'paper-lifted');
      };

      if (this.dragGhost) {
        const ghost = this.dragGhost;
        this.dragGhost = null;
        ghost.classList.remove('paper-drag-lifted', 'paper-lifted');
        ghost.style.transition = 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)';
        ghost.style.left = `${trayRect.left + newX + cardW / 2}px`;
        ghost.style.top = `${trayRect.top + newY + cardH / 2}px`;
        ghost.style.transform = `translate(-50%, -50%) scale(1) rotate(${dropRot}deg)`;

        setTimeout(() => {
          ghost.remove();
          applyPosition();
        }, 180);
      } else {
        applyPosition();
      }
  }

  spawnSparkleParticles(x, y) {
    const container = document.createElement('div');
    container.className = 'sparkle-burst-container';
    container.style.position = 'fixed';
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.pointerEvents = 'none';
    container.style.zIndex = '10000';

    const colors = ['#FFD166', '#06D6A0', '#118AB2', '#FF5964', '#FF85A1'];
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'sparkle-star';
      p.textContent = '★';
      p.style.color = colors[i % colors.length];
      const angle = (i / 12) * Math.PI * 2;
      const dist = 35 + Math.random() * 35;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      p.style.animation = `sparklePop 0.65s cubic-bezier(0.1, 0.8, 0.3, 1) forwards`;
      container.appendChild(p);
    }

    document.body.appendChild(container);
    setTimeout(() => container.remove(), 700);
  }

  checkWordCompletion() {
    // Guard: only fire once per word
    if (this._wordCompletionPending) return;
    const allFilled = this.targetSlots.length > 0 && this.targetSlots.every(s => s.isFilled);
    if (allFilled) {
      this._wordCompletionPending = true;
      // Trigger word completion!
      setTimeout(() => {
        this.onWordCompleted();
      }, 350);
    }
  }
}
