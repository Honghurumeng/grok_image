// 使用 IndexedDB 存储图片
const DB_NAME = 'ImageCacheDB'
const STORE_NAME = 'images'
const DB_VERSION = 1

// 初始化数据库
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' })
      }
    }
  })
}

// 保存图片到 IndexedDB
export const saveImageToCache = async (url, blob) => {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    await store.put({ url, blob, timestamp: Date.now() })

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch (err) {
    console.error('保存图片失败:', err)
  }
}

// 从 IndexedDB 获取图片
export const getImageFromCache = async (url) => {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(url)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.blob)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('获取缓存图片失败:', err)
    return null
  }
}

// 仅从缓存获取（不请求网络）
export const getImageFromCacheOnly = async (url) => {
  const cachedBlob = await getImageFromCache(url)
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob)
  }
  return null
}

// 获取图片（优先从缓存，否则从网络）
export const getImage = async (url) => {
  // 先尝试从缓存获取
  let cachedBlob = await getImageFromCache(url)

  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob)
  }

  // 缓存中没有，从网络获取
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    // 保存到缓存
    await saveImageToCache(url, blob)

    return URL.createObjectURL(blob)
  } catch (err) {
    console.error('获取图片失败:', err)
    return url // 失败时返回原始 URL
  }
}

// 清空所有缓存
export const clearImageCache = async () => {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    await store.clear()

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch (err) {
    console.error('清空缓存失败:', err)
  }
}
