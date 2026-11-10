import { ChessGameRecord, InterviewItem, PhDTask, ProcedureImageItem, ResearchFileItem, UserAccount } from '../types';
import { INITIAL_INTERVIEWS, INITIAL_TASKS, INITIAL_SHOWCASE_PHOTOS } from '../data/initialData';

const DB_NAME = 'NadashaResearchDB';
const DB_VERSION = 3;

export const STORES = {
  USERS: 'users',
  INTERVIEWS: 'interviews',
  FILES: 'research_files',
  TASKS: 'tasks',
  CHESS_GAMES: 'chess_games',
  SHOWCASE_PHOTOS: 'showcase_photos',
  META: 'meta',
} as const;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.USERS)) {
        db.createObjectStore(STORES.USERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.INTERVIEWS)) {
        db.createObjectStore(STORES.INTERVIEWS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        db.createObjectStore(STORES.FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CHESS_GAMES)) {
        const chessStore = db.createObjectStore(STORES.CHESS_GAMES, { keyPath: 'id' });
        chessStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.SHOWCASE_PHOTOS)) {
        const photoStore = db.createObjectStore(STORES.SHOWCASE_PHOTOS, { keyPath: 'id' });
        photoStore.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generic Store Operations
async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB read error on ${storeName}:`, err);
    return [];
  }
}

async function putInStore<T>(storeName: string, item: T): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB write error on ${storeName}:`, err);
  }
}

async function deleteFromStore(storeName: string, id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB delete error on ${storeName}:`, err);
  }
}

async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`IndexedDB clear error on ${storeName}:`, err);
  }
}

// ================= CHESS GAMES REPOSITORY =================
export async function getAllChessGames(): Promise<ChessGameRecord[]> {
  const games = await getAllFromStore<ChessGameRecord>(STORES.CHESS_GAMES);
  if (games.length === 0) {
    // Check fallback localStorage
    try {
      const local = localStorage.getItem('aurascholar_chess_history');
      if (local) {
        const parsed: ChessGameRecord[] = JSON.parse(local);
        for (const g of parsed) {
          await putInStore(STORES.CHESS_GAMES, g);
        }
        return parsed;
      }
    } catch {}
  }
  // Return sorted newest first
  return games.sort((a, b) => b.timestamp - a.timestamp);
}

export async function saveChessGame(game: ChessGameRecord): Promise<void> {
  await putInStore(STORES.CHESS_GAMES, game);
  try {
    const existing = await getAllChessGames();
    localStorage.setItem('aurascholar_chess_history', JSON.stringify(existing));
  } catch {}
}

export async function deleteChessGame(id: string): Promise<void> {
  await deleteFromStore(STORES.CHESS_GAMES, id);
  try {
    const existing = await getAllChessGames();
    localStorage.setItem('aurascholar_chess_history', JSON.stringify(existing.filter((g) => g.id !== id)));
  } catch {}
}

export async function clearAllChessGames(): Promise<void> {
  await clearStore(STORES.CHESS_GAMES);
  try {
    localStorage.removeItem('aurascholar_chess_history');
  } catch {}
}

// ================= USERS & AUTHENTICATION =================
export async function getAllUsers(): Promise<UserAccount[]> {
  return await getAllFromStore<UserAccount>(STORES.USERS);
}

export async function saveUser(user: UserAccount): Promise<void> {
  await putInStore(STORES.USERS, user);
}

export function getCurrentUserSession(): UserAccount | null {
  try {
    const saved = localStorage.getItem('aurascholar_current_user');
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function setCurrentUserSession(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem('aurascholar_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aurascholar_current_user');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aurascholar_user_changed', { detail: user }));
    }
  } catch {}
}

// ================= INTERVIEWS REPOSITORY =================
export async function getStoredInterviews(): Promise<InterviewItem[]> {
  const fromDB = await getAllFromStore<InterviewItem>(STORES.INTERVIEWS);
  if (fromDB.length > 0) return fromDB;

  try {
    const local = localStorage.getItem('aurascholar_interviews');
    if (local) {
      const parsed: InterviewItem[] = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const it of parsed) {
          await putInStore(STORES.INTERVIEWS, it);
        }
        return parsed;
      }
    }
  } catch {}

  // Seed defaults
  for (const it of INITIAL_INTERVIEWS) {
    await putInStore(STORES.INTERVIEWS, it);
  }
  return INITIAL_INTERVIEWS;
}

export async function saveStoredInterview(interview: InterviewItem): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORES.INTERVIEWS, 'readwrite');
    } catch (error) {
      reject(error);
      return;
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save interview in IndexedDB.'));
    tx.onabort = () => reject(tx.error || new Error('Interview save was cancelled.'));
    tx.objectStore(STORES.INTERVIEWS).put(interview);
  });

  try {
    const all = await getStoredInterviews();
    const textOnlyInterviews = all.map(({ audioBlob: _audioBlob, audioUrl: _audioUrl, ...item }) => item);
    localStorage.setItem('aurascholar_interviews', JSON.stringify(textOnlyInterviews));
  } catch (error) {
    console.warn('Could not update the local interview backup; the IndexedDB record was saved:', error);
  }
}

export async function deleteStoredInterview(id: string): Promise<void> {
  await deleteFromStore(STORES.INTERVIEWS, id);
  try {
    const all = await getStoredInterviews();
    localStorage.setItem('aurascholar_interviews', JSON.stringify(all.filter((i) => i.id !== id)));
  } catch {}
}

// ================= TASKS & ROADMAP =================
export async function getStoredTasks(): Promise<PhDTask[]> {
  const fromDB = await getAllFromStore<PhDTask>(STORES.TASKS);
  if (fromDB.length > 0) return fromDB;

  try {
    const local = localStorage.getItem('aurascholar_tasks');
    if (local) {
      const parsed: PhDTask[] = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const t of parsed) {
          await putInStore(STORES.TASKS, t);
        }
        return parsed;
      }
    }
  } catch {}

  for (const t of INITIAL_TASKS) {
    await putInStore(STORES.TASKS, t);
  }
  return INITIAL_TASKS;
}

export async function saveStoredTask(task: PhDTask): Promise<void> {
  await putInStore(STORES.TASKS, task);
  try {
    const all = await getStoredTasks();
    localStorage.setItem('aurascholar_tasks', JSON.stringify(all));
  } catch {}
}

export async function deleteStoredTask(id: string): Promise<void> {
  await deleteFromStore(STORES.TASKS, id);
  try {
    const all = await getStoredTasks();
    localStorage.setItem('aurascholar_tasks', JSON.stringify(all.filter((t) => t.id !== id)));
  } catch {}
}

// Showcase Photos Operations (IndexedDB + Server Backup for large photo datasets)
export async function getAllShowcasePhotos(): Promise<ProcedureImageItem[]> {
  try {
    let photos = await getAllFromStore<ProcedureImageItem>(STORES.SHOWCASE_PHOTOS);

    // Filter out any obsolete unsplash demo images
    photos = (photos || []).filter(
      (p) =>
        p &&
        p.beforeImage &&
        !p.beforeImage.includes('unsplash.com') &&
        p.afterImage &&
        !p.afterImage.includes('unsplash.com')
    );

    // If IndexedDB had none, migrate any existing photos from localStorage
    if (photos.length === 0) {
      try {
        const raw = localStorage.getItem('aurascholar_showcase_items');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const valid = parsed.filter(
              (p: ProcedureImageItem) =>
                p &&
                p.beforeImage &&
                !p.beforeImage.includes('unsplash.com') &&
                p.afterImage &&
                !p.afterImage.includes('unsplash.com')
            );
            if (valid.length > 0) {
              for (const item of valid) {
                await putInStore(STORES.SHOWCASE_PHOTOS, item);
              }
              photos = valid;
            }
          }
        }
      } catch (e) {
        console.warn('Could not migrate showcase items from localStorage:', e);
      }
    }

    // Attempt to merge or sync with server backup in background
    try {
      const res = await fetch('/api/showcase/all');
      if (res.ok) {
        const serverPhotos: ProcedureImageItem[] = await res.json();
        if (Array.isArray(serverPhotos) && serverPhotos.length > 0) {
          const map = new Map<string, ProcedureImageItem>();
          for (const p of photos) map.set(p.id, p);
          let added = false;
          for (const sp of serverPhotos) {
            if (!map.has(sp.id)) {
              map.set(sp.id, sp);
              await putInStore(STORES.SHOWCASE_PHOTOS, sp);
              added = true;
            }
          }
          if (added) {
            photos = Array.from(map.values());
          }
        }
      }
    } catch {}

    // Ensure initial uploaded showcase photos (e.g. Breast augmentation sets) are guaranteed present
    if (INITIAL_SHOWCASE_PHOTOS.length > 0) {
      const map = new Map<string, ProcedureImageItem>();
      for (const p of photos) map.set(p.id, p);
      let seeded = false;
      for (const initPhoto of INITIAL_SHOWCASE_PHOTOS) {
        if (!map.has(initPhoto.id)) {
          map.set(initPhoto.id, initPhoto);
          await putInStore(STORES.SHOWCASE_PHOTOS, initPhoto);
          seeded = true;
        }
      }
      if (seeded) {
        photos = Array.from(map.values());
      }
    }

    return photos;
  } catch (err) {
    console.error('Failed to get showcase photos from IndexedDB:', err);
    return [];
  }
}

export async function saveShowcasePhoto(photo: ProcedureImageItem): Promise<void> {
  await putInStore(STORES.SHOWCASE_PHOTOS, photo);

  // Sync with localStorage safely (catch quota errors if images are large)
  try {
    const all = await getAllFromStore<ProcedureImageItem>(STORES.SHOWCASE_PHOTOS);
    localStorage.setItem('aurascholar_showcase_items', JSON.stringify(all));
  } catch (quotaErr) {
    console.warn('LocalStorage quota exceeded (expected for high-res photos). IndexedDB holds full data.');
  }

  // Backup to server
  try {
    await fetch('/api/showcase/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(photo),
    });
  } catch (err) {
    console.warn('Server backup skipped (offline or not reachable):', err);
  }
}

export async function saveAllShowcasePhotos(photos: ProcedureImageItem[]): Promise<void> {
  for (const p of photos) {
    await putInStore(STORES.SHOWCASE_PHOTOS, p);
  }

  try {
    localStorage.setItem('aurascholar_showcase_items', JSON.stringify(photos));
  } catch {}

  try {
    await fetch('/api/showcase/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(photos),
    });
  } catch {}
}

export async function deleteShowcasePhoto(id: string): Promise<void> {
  await deleteFromStore(STORES.SHOWCASE_PHOTOS, id);

  try {
    const all = await getAllFromStore<ProcedureImageItem>(STORES.SHOWCASE_PHOTOS);
    localStorage.setItem('aurascholar_showcase_items', JSON.stringify(all));
  } catch {}

  try {
    await fetch(`/api/showcase/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {}
}

// Database stats helper
export async function getDatabaseStats() {
  const [users, interviews, files, tasks, chessGames, showcasePhotos] = await Promise.all([
    getAllUsers(),
    getStoredInterviews(),
    getAllFromStore<ResearchFileItem>(STORES.FILES),
    getStoredTasks(),
    getAllChessGames(),
    getAllFromStore<ProcedureImageItem>(STORES.SHOWCASE_PHOTOS),
  ]);

  return {
    usersCount: users.length,
    interviewsCount: interviews.length,
    filesCount: files.length,
    tasksCount: tasks.length,
    chessGamesCount: chessGames.length,
    showcasePhotosCount: showcasePhotos.length,
    databaseName: DB_NAME,
    version: DB_VERSION,
  };
}
