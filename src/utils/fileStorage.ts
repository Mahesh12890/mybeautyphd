import { ResearchFileItem } from '../types';

const DB_NAME = 'AuraScholarFilesDB';
const STORE_NAME = 'research_files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllStoredFiles(): Promise<ResearchFileItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB unavailable, falling back:', e);
    const saved = localStorage.getItem('aurascholar_files');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveStoredFile(file: ResearchFileItem): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB write error:', e);
  }
}

export async function deleteStoredFile(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB delete error, falling back:', e);
    try {
      const saved = localStorage.getItem('aurascholar_files');
      if (saved) {
        const files: ResearchFileItem[] = JSON.parse(saved);
        const filtered = files.filter((f) => f.id !== id);
        localStorage.setItem('aurascholar_files', JSON.stringify(filtered));
      }
    } catch {}
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generates clean, standard Microsoft Word (.doc) HTML representation
 * for research notes without decorative boxes or watermarks.
 */
export function generateNoteDocHtml(notes: string, title = 'Fieldwork & Dissertation Research Notes'): string {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedNotes = notes && notes.trim()
    ? notes
        .split('\n')
        .map((p) => {
          const trimmed = p.trim();
          return trimmed
            ? `<p style="margin: 0 0 10pt 0;">${trimmed.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
            : '<br/>';
        })
        .join('')
    : '<p><em>No notes recorded yet.</em></p>';

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000000;
      margin: 1in;
    }
    h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 12pt 0;
      color: #000000;
      border-bottom: 1.5pt solid #000000;
      padding-bottom: 6pt;
    }
    .meta-table {
      width: 100%;
      margin-bottom: 18pt;
      font-size: 11pt;
      color: #222222;
      line-height: 1.5;
    }
    .meta-table td {
      padding: 2.5pt 0;
    }
    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 8pt;
      color: #000000;
    }
    .notes-content {
      font-size: 12pt;
      line-height: 1.8;
      color: #000000;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>

  <table class="meta-table">
    <tr><td><strong>Researcher:</strong> Nadasha • Department of Sociology</td></tr>
    <tr><td><strong>Study Topic:</strong> Cosmetic Surgery in Kerala (Kochi & Kannur)</td></tr>
    <tr><td><strong>Document Type:</strong> Research Fieldwork Notes (.doc)</td></tr>
    <tr><td><strong>Last Updated:</strong> ${dateFormatted} at ${timeFormatted}</td></tr>
  </table>

  <h2>Fieldwork Reflections & Theoretical Notes</h2>
  <div class="notes-content">
    ${formattedNotes}
  </div>
</body>
</html>`;
}

/**
 * Saves research notes as a .doc file in the documents repository (Literature Vault)
 */
export async function saveNotesAsDocFile(
  notesText: string,
  options?: { isSnapshot?: boolean; customTitle?: string }
): Promise<ResearchFileItem> {
  const isSnapshot = options?.isSnapshot ?? false;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeSlug = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

  const id = isSnapshot ? `doc-note-${Date.now()}` : 'doc-fieldwork-notes';
  const name = isSnapshot
    ? `Research_Notes_${dateStr}_${timeSlug}.doc`
    : 'Fieldwork_Research_Notes.doc';

  const docHtml = generateNoteDocHtml(notesText, options?.customTitle);
  const blob = new Blob([docHtml], { type: 'application/msword;charset=utf-8' });

  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  const fileItem: ResearchFileItem = {
    id,
    name,
    fileType: 'document',
    fileSize: blob.size,
    mimeType: 'application/msword',
    dataUrl,
    uploadedAt: dateStr,
    notes: isSnapshot
      ? `Snapshot copy recorded on ${dateStr} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '',
    textContent: notesText,
  };

  await saveStoredFile(fileItem);

  // Notify components of updated file list
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aurascholar_files_updated'));
  }

  return fileItem;
}
