// 划重点的本地存储。
//
// 写操作都在同一个事务里完成：删除时读到的就是被删掉的那份内容，撤销能原样还原。
import { ANNOTATION_FORMAT, BACKUP_VERSION, mergeBackup, type Annotation } from './annotations';

const DB_NAME = 'agent-evaluation-notes-reader';
const DB_VERSION = 1;
const STORE = 'highlights';

export function openHighlights(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('chapter', 'chapter');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭本站的其他标签页后刷新，才能启用划重点。'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function readHighlights(db: IDBDatabase, chapter: string): Promise<Annotation[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).index('chapter').getAll(chapter);
    tx.oncomplete = () => resolve(request.result as Annotation[]);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

/** 批量写入（可同时删除一条），整个事务提交成功才算保存成功。 */
export function writeHighlights(db: IDBDatabase, items: Annotation[], remove?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const item of items) store.put(item);
    if (remove) store.delete(remove);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export function importHighlights(db: IDBDatabase, imported: Annotation[], chapter: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.index('chapter').getAll(chapter);
    request.onsuccess = () => {
      for (const record of mergeBackup(request.result as Annotation[], imported, () => crypto.randomUUID())) store.put(record);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

/** 读出来再删，同一个事务。返回值就是被删掉的那份内容，撤销据此还原。 */
export function removeHighlight(db: IDBDatabase, id: string): Promise<Annotation | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.delete(id);
    };
    tx.oncomplete = () => resolve(request.result as Annotation | undefined);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export function serialiseBackup(highlights: Annotation[]): string {
  return JSON.stringify({ format: ANNOTATION_FORMAT, version: BACKUP_VERSION, highlights }, null, 2);
}
