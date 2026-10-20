// Small promise helpers around IndexedDB

export const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

export const openDatabase = (
  name: string,
  version: number,
  upgrade: (db: IDBDatabase, oldVersion: number) => void
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`Failed to open ${name}`));
  });

/** Turn storage-quota failures into a message a user can act on. */
export const describeStorageError = (error: unknown): Error => {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') {
    return new Error('browser storage is full — export the project or free up space');
  }
  return error instanceof Error ? error : new Error(String(error));
};
