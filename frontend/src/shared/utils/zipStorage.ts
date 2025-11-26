/**
 * ZIP文件存储工具
 * 用于管理保存在IndexedDB中的ZIP文件
 */

const DB_NAME = 'xcodereviewer_files';
const STORE_NAME = 'zipFiles';

/**
 * 保存ZIP文件到IndexedDB
 */
export async function saveZipFile(projectId: string, file: File): Promise<void> {
  // 检查浏览器是否支持IndexedDB
  if (!window.indexedDB) {
    throw new Error('您的浏览器不支持IndexedDB，无法保存ZIP文件');
  }

  return new Promise((resolve, reject) => {
    // 不指定版本号，让IndexedDB使用当前最新版本
    const dbRequest = indexedDB.open(DB_NAME);
    
    dbRequest.onupgradeneeded = (event) => {
      try {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      } catch (error) {
        console.error('创建对象存储失败:', error);
        reject(new Error('创建存储结构失败，请检查浏览器设置'));
      }
    };

    dbRequest.onsuccess = async (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 检查对象存储是否存在，如果不存在则需要升级数据库
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        // 增加版本号以触发onupgradeneeded
        const upgradeRequest = indexedDB.open(DB_NAME, db.version + 1);
        
        upgradeRequest.onupgradeneeded = (event) => {
          try {
            const upgradeDb = (event.target as IDBOpenDBRequest).result;
            if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
              upgradeDb.createObjectStore(STORE_NAME);
            }
          } catch (error) {
            console.error('升级数据库时创建对象存储失败:', error);
          }
        };
        
        upgradeRequest.onsuccess = async (event) => {
          const upgradeDb = (event.target as IDBOpenDBRequest).result;
          await performSave(upgradeDb, file, projectId, resolve, reject);
        };
        
        upgradeRequest.onerror = (event) => {
          const error = (event.target as IDBOpenDBRequest).error;
          console.error('升级数据库失败:', error);
          reject(new Error(`升级数据库失败: ${error?.message || '未知错误'}`));
        };
      } else {
        await performSave(db, file, projectId, resolve, reject);
      }
    };

    dbRequest.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error('打开IndexedDB失败:', error);
      const errorMsg = error?.message || '未知错误';
      reject(new Error(`无法打开本地存储，可能是隐私模式或存储权限问题: ${errorMsg}`));
    };

    dbRequest.onblocked = () => {
      console.warn('数据库被阻塞，可能有其他标签页正在使用');
      reject(new Error('数据库被占用，请关闭其他标签页后重试'));
    };
  });
}

async function performSave(
  db: IDBDatabase,
  file: File,
  projectId: string,
  resolve: () => void,
  reject: (error: Error) => void
) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const putRequest = store.put({
      buffer: arrayBuffer,
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    }, projectId);
    
    putRequest.onerror = (event) => {
      const error = (event.target as IDBRequest).error;
      console.error('写入数据失败:', error);
      reject(new Error(`保存ZIP文件失败: ${error?.message || '未知错误'}`));
    };
    
    transaction.oncomplete = () => {
      console.log(`ZIP文件已保存到项目 ${projectId} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      db.close();
      resolve();
    };
    
    transaction.onerror = (event) => {
      const error = (event.target as IDBTransaction).error;
      console.error('事务失败:', error);
      reject(new Error(`保存事务失败: ${error?.message || '未知错误'}`));
    };
    
    transaction.onabort = () => {
      console.error('事务被中止');
      reject(new Error('保存操作被中止'));
    };
  } catch (error) {
    console.error('保存ZIP文件时发生异常:', error);
    reject(error as Error);
  }
}

/**
 * 从IndexedDB加载ZIP文件
 */
export async function loadZipFile(projectId: string): Promise<File | null> {
  return new Promise((resolve, reject) => {
    // 不指定版本号，让IndexedDB使用当前最新版本
    const dbRequest = indexedDB.open(DB_NAME);
    
    dbRequest.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    dbRequest.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        resolve(null);
        return;
      }
      
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(projectId);
      
      getRequest.onsuccess = () => {
        const savedFile = getRequest.result;
        
        if (savedFile && savedFile.buffer) {
          const blob = new Blob([savedFile.buffer], { type: 'application/zip' });
          const file = new File([blob], savedFile.fileName, { type: 'application/zip' });
          resolve(file);
        } else {
          resolve(null);
        }
      };
      
      getRequest.onerror = () => {
        reject(new Error('读取ZIP文件失败'));
      };
    };

    dbRequest.onerror = () => {
      // 数据库打开失败，可能是首次使用，返回null而不是报错
      console.warn('打开ZIP文件数据库失败，可能是首次使用');
      resolve(null);
    };
  });
}

/**
 * 删除ZIP文件
 */
export async function deleteZipFile(projectId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 不指定版本号，让IndexedDB使用当前最新版本
    const dbRequest = indexedDB.open(DB_NAME);
    
    dbRequest.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    dbRequest.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        resolve();
        return;
      }
      
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const deleteRequest = store.delete(projectId);
      
      deleteRequest.onsuccess = () => {
        console.log(`已删除项目 ${projectId} 的ZIP文件`);
        resolve();
      };
      
      deleteRequest.onerror = () => {
        reject(new Error('删除ZIP文件失败'));
      };
    };

    dbRequest.onerror = () => {
      // 数据库打开失败，可能文件不存在，直接resolve
      console.warn('打开ZIP文件数据库失败，跳过删除操作');
      resolve();
    };
  });
}

/**
 * 检查是否存在ZIP文件
 */
export async function hasZipFile(projectId: string): Promise<boolean> {
  try {
    const file = await loadZipFile(projectId);
    return file !== null;
  } catch {
    return false;
  }
}

