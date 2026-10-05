// Audio and Custom Words Storage using IndexedDB with optional Supabase Cloud Sync
// Enables parents and teachers to record and store their own voices for words, phonics, and stories.

import { getSupabase, isSupabaseConfigured } from './supabaseClient.js';

const DB_NAME = 'AyoMerangkaiKataDB';
const DB_VERSION = 1;
const STORE_AUDIO = 'custom_audio';
const STORE_WORDS = 'custom_words';
const BUCKET_NAME = 'custom_audio';

class AudioStorage {
  constructor() {
    this.db = null;
    this._cachedKeys = new Set();
    this._cloudAudioMeta = new Map(); // key -> metadata with public_url
    this._cacheInitialized = false;
    this.dbReadyPromise = this.initDB();
  }

  async initDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is not supported in this environment.');
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_WORDS)) {
          db.createObjectStore(STORE_WORDS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this._refreshKeyCache().catch(() => {});
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async _refreshKeyCache() {
    if (!this.db) return;
    try {
      const keys = await new Promise((resolve) => {
        const tx = this.db.transaction(STORE_AUDIO, 'readonly');
        const store = tx.objectStore(STORE_AUDIO);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      this._cachedKeys = new Set(keys);

      // Merge with cloud keys if available
      for (const key of this._cloudAudioMeta.keys()) {
        this._cachedKeys.add(key);
      }

      this._cacheInitialized = true;
    } catch (_) {}
  }

  async getDB() {
    if (!this.db) {
      await this.dbReadyPromise;
    }
    return this.db;
  }

  // --- Audio Storage Methods ---

  /**
   * Save an audio Blob (from microphone or file upload)
   * Saves to local IndexedDB immediately and pushes to Supabase if configured.
   * @param {string} key - e.g. "word_kucing", "meaning_kucing", "letter_A"
   * @param {Blob} blob - The recorded audio blob
   * @param {string} label - Friendly label
   */
  async saveAudio(key, blob, label = '') {
    const db = await this.getDB();
    if (!db) return false;

    const record = {
      key,
      blob,
      label,
      mimeType: blob.type || 'audio/webm',
      size: blob.size,
      updatedAt: Date.now()
    };

    // 1. Save to local IndexedDB
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.put(record);
      req.onsuccess = () => {
        this._cachedKeys.add(key);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });

    // 2. Sync to Supabase in background
    if (isSupabaseConfigured()) {
      this._syncAudioToCloud(key, blob, label).catch(err => {
        console.warn('Gagal sinkronisasi audio ke Supabase:', err);
      });
    }

    return true;
  }

  async _syncAudioToCloud(key, blob, label = '') {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const extension = blob.type?.includes('mp3') ? 'mp3' : blob.type?.includes('wav') ? 'wav' : 'webm';
      const storagePath = `recordings/${key}.${extension}`;

      // Upload to storage bucket
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, blob, {
          contentType: blob.type || 'audio/webm',
          upsert: true
        });

      if (uploadError) {
        console.warn('Storage upload error:', uploadError);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      // Save metadata to table
      const { error: metaError } = await supabase
        .from('custom_audio_meta')
        .upsert({
          key,
          label: label || key,
          mime_type: blob.type || 'audio/webm',
          size: blob.size,
          storage_path: storagePath,
          public_url: publicUrl,
          updated_at: Date.now()
        }, { onConflict: 'key' });

      if (metaError) {
        console.warn('Metadata upsert error:', metaError);
      } else {
        this._cloudAudioMeta.set(key, { key, label, public_url: publicUrl });
      }
    } catch (err) {
      console.warn('Error during _syncAudioToCloud:', err);
    }
  }

  /**
   * Retrieve audio Blob by key
   * First checks local IndexedDB; if missing, pulls from Supabase and caches locally.
   * @param {string} key
   * @returns {Promise<Blob|null>}
   */
  async getAudio(key) {
    const db = await this.getDB();

    // 1. Check local IndexedDB first
    if (db) {
      const localBlob = await new Promise((resolve) => {
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const store = tx.objectStore(STORE_AUDIO);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            resolve(req.result.blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });

      if (localBlob) {
        return localBlob;
      }
    }

    // 2. If not found locally, check Supabase Cloud
    if (isSupabaseConfigured()) {
      try {
        const cloudBlob = await this._fetchAudioFromCloud(key);
        if (cloudBlob && db) {
          // Cache into local IndexedDB for future instant playback
          try {
            const tx = db.transaction(STORE_AUDIO, 'readwrite');
            tx.objectStore(STORE_AUDIO).put({
              key,
              blob: cloudBlob,
              label: key,
              mimeType: cloudBlob.type || 'audio/webm',
              size: cloudBlob.size,
              updatedAt: Date.now()
            });
            this._cachedKeys.add(key);
          } catch (_) {}
          return cloudBlob;
        }
      } catch (err) {
        console.warn('Gagal mengambil audio dari Supabase:', err);
      }
    }

    return null;
  }

  async _fetchAudioFromCloud(key) {
    const supabase = getSupabase();
    if (!supabase) return null;

    // Check in-memory metadata first
    let publicUrl = this._cloudAudioMeta.get(key)?.public_url;

    if (!publicUrl) {
      const { data, error } = await supabase
        .from('custom_audio_meta')
        .select('public_url, mime_type')
        .eq('key', key)
        .maybeSingle();

      if (error || !data || !data.public_url) return null;
      publicUrl = data.public_url;
      this._cloudAudioMeta.set(key, data);
    }

    if (!publicUrl) return null;

    const response = await fetch(publicUrl);
    if (!response.ok) return null;
    return await response.blob();
  }

  /**
   * Check synchronously if custom audio key exists
   * @param {string} key
   * @returns {boolean}
   */
  hasAudioSync(key) {
    return this._cachedKeys.has(key);
  }

  /**
   * Check if custom audio exists for a key
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async hasAudio(key) {
    if (this._cacheInitialized) {
      return this._cachedKeys.has(key);
    }
    const blob = await this.getAudio(key);
    if (blob) this._cachedKeys.add(key);
    return !!blob;
  }

  /**
   * Delete an audio record locally and in Supabase
   * @param {string} key
   */
  async deleteAudio(key) {
    const db = await this.getDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_AUDIO, 'readwrite');
        const store = tx.objectStore(STORE_AUDIO);
        const req = store.delete(key);
        req.onsuccess = () => {
          this._cachedKeys.delete(key);
          resolve(true);
        };
        req.onerror = () => reject(req.error);
      });
    }

    this._cloudAudioMeta.delete(key);

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from('custom_audio_meta').delete().eq('key', key);
          await supabase.storage.from(BUCKET_NAME).remove([`recordings/${key}.webm`, `recordings/${key}.mp3`, `recordings/${key}.wav`]);
        }
      } catch (err) {
        console.warn('Gagal menghapus audio di Supabase:', err);
      }
    }

    return true;
  }

  /**
   * Get all custom audio keys and their metadata
   */
  async getAllAudioMetadata() {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_AUDIO, 'readonly');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result || []).map(item => ({
          key: item.key,
          label: item.label,
          mimeType: item.mimeType,
          size: item.size,
          updatedAt: item.updatedAt
        }));
        resolve(list);
      };

      req.onerror = () => resolve([]);
    });
  }

  // --- Custom Words Storage Methods ---

  /**
   * Get all custom words from IndexedDB
   */
  async getAllCustomWords() {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_WORDS, 'readonly');
      const store = tx.objectStore(STORE_WORDS);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Save or update a word in custom words store and Supabase
   */
  async saveWord(wordData) {
    const db = await this.getDB();
    if (!db) return false;

    // 1. Save to IndexedDB
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORDS, 'readwrite');
      const store = tx.objectStore(STORE_WORDS);
      const req = store.put(wordData);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });

    // 2. Sync to Supabase in background
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from('custom_words').upsert({
            id: wordData.id,
            word: wordData.word,
            phonetic: wordData.phonetic || '',
            syllables: wordData.syllables || [],
            hint: wordData.hint || '',
            category: wordData.category || '',
            level: wordData.level || '',
            emoji: wordData.emoji || '',
            updated_at: Date.now()
          }, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Gagal menyimpan kata ke Supabase:', err);
      }
    }

    return true;
  }

  /**
   * Delete a custom word locally and in Supabase
   */
  async deleteWord(id) {
    const db = await this.getDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_WORDS, 'readwrite');
        const store = tx.objectStore(STORE_WORDS);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from('custom_words').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('Gagal menghapus kata di Supabase:', err);
      }
    }

    return true;
  }

  // --- Full Cloud Sync (Pull latest from Supabase) ---

  async syncAllFromSupabase() {
    if (!isSupabaseConfigured()) {
      return { success: false, reason: 'unconfigured' };
    }

    const supabase = getSupabase();
    if (!supabase) return { success: false, reason: 'no_client' };

    const db = await this.getDB();
    let wordsSynced = 0;
    let audioSynced = 0;

    try {
      // 1. Sync Custom Words from Cloud
      const { data: wordsData, error: wordsError } = await supabase
        .from('custom_words')
        .select('*');

      if (!wordsError && Array.isArray(wordsData)) {
        if (db) {
          const tx = db.transaction(STORE_WORDS, 'readwrite');
          const store = tx.objectStore(STORE_WORDS);
          for (const item of wordsData) {
            store.put(item);
            wordsSynced++;
          }
        }
      }

      // 2. Sync Audio Metadata from Cloud
      const { data: audioData, error: audioError } = await supabase
        .from('custom_audio_meta')
        .select('*');

      if (!audioError && Array.isArray(audioData)) {
        for (const meta of audioData) {
          this._cloudAudioMeta.set(meta.key, meta);
          this._cachedKeys.add(meta.key);
          audioSynced++;
        }
      }

      return { success: true, wordsSynced, audioSynced };
    } catch (err) {
      console.warn('Gagal sinkronisasi data dari Supabase:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Export all recorded audio & custom words as a backup object
   */
  async exportBackup() {
    const db = await this.getDB();
    if (!db) return null;

    const audioMeta = await this.getAllAudioMetadata();
    const audioData = {};

    for (const item of audioMeta) {
      const blob = await this.getAudio(item.key);
      if (blob) {
        const base64 = await new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
        audioData[item.key] = {
          ...item,
          dataUrl: base64
        };
      }
    }

    const words = await this.getAllCustomWords();

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      words,
      audio: audioData
    };
  }

  /**
   * Import data from backup object
   */
  async importBackup(backupData) {
    if (!backupData || !backupData.version) {
      throw new Error('Format data backup tidak valid.');
    }

    // 1. Import Words
    if (Array.isArray(backupData.words)) {
      for (const word of backupData.words) {
        await this.saveWord(word);
      }
    }

    // 2. Import Audio
    if (backupData.audio) {
      for (const [key, item] of Object.entries(backupData.audio)) {
        if (item.dataUrl) {
          const res = await fetch(item.dataUrl);
          const blob = await res.blob();
          await this.saveAudio(key, blob, item.label || '');
        }
      }
    }

    return true;
  }

  /**
   * Reset all custom audio and custom words
   */
  async resetAll() {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_AUDIO, STORE_WORDS], 'readwrite');
      tx.objectStore(STORE_AUDIO).clear();
      tx.objectStore(STORE_WORDS).clear();
      tx.oncomplete = () => {
        this._cachedKeys.clear();
        this._cloudAudioMeta.clear();
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const audioStorage = new AudioStorage();
