import { useState, useEffect } from 'react'
import './App.css'
import { getImage, getImageFromCacheOnly } from './imageCache'

function App() {
  const [config, setConfig] = useState({
    url: localStorage.getItem('apiUrl') || '',
    apiKey: localStorage.getItem('apiKey') || '',
    model: localStorage.getItem('model') || 'grok-2-vision-1212'
  })

  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('imageHistory')
    return saved ? JSON.parse(saved) : []
  })
  const [previewImage, setPreviewImage] = useState(null)
  const [cachedImages, setCachedImages] = useState({})
  const [configExpanded, setConfigExpanded] = useState(false)
  const [loadFromNetwork, setLoadFromNetwork] = useState(true)

  useEffect(() => {
    localStorage.setItem('apiUrl', config.url)
    localStorage.setItem('apiKey', config.apiKey)
    localStorage.setItem('model', config.model)
  }, [config])

  useEffect(() => {
    localStorage.setItem('imageHistory', JSON.stringify(history))
  }, [history])

  // 加载缓存的图片
  useEffect(() => {
    const loadCachedImages = async () => {
      const urls = [
        ...images.map(img => img.url),
        ...history.map(item => item.image?.url).filter(Boolean)
      ]

      for (const url of urls) {
        if (!cachedImages[url]) {
          // 先尝试仅从缓存获取
          const cachedUrl = await getImageFromCacheOnly(url)
          if (cachedUrl) {
            setCachedImages(prev => ({ ...prev, [url]: cachedUrl }))
          } else if (loadFromNetwork) {
            // 缓存中没有且允许网络请求，从网络获取
            const networkUrl = await getImage(url)
            setCachedImages(prev => ({ ...prev, [url]: networkUrl }))
          }
        }
      }
    }

    loadCachedImages()
  }, [images, history, loadFromNetwork])

  const getCachedImageUrl = (url) => {
    return cachedImages[url] || url
  }

  const usePrompt = (promptText) => {
    setPrompt(promptText)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const generateImage = async () => {
    if (!config.url || !config.apiKey || !prompt) {
      setError('请填写完整的配置信息和提示词')
      return
    }

    setLoading(true)
    setError('')
    setImages([])

    try {
      const response = await fetch(`${config.url}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const imageUrls = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue

          const data = line.replace(/^data:\s*/, '').trim()
          if (data === '[DONE]' || data === '') continue

          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content || ''
            
            // 从 content 中提取图片 URL（只保留 final 图片）
            const imageRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g
            let match
            while ((match = imageRegex.exec(content)) !== null) {
              const url = match[1]
              if (url.includes('-final') && !imageUrls.includes(url)) {
                imageUrls.push(url)
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      if (imageUrls.length > 0) {
        const now = Date.now()
        const newImages = imageUrls.map((url, index) => ({
          url,
          stage: 'completed',
          index,
          created_at: new Date().toISOString()
        }))
        
        setImages(newImages)
        
        // 保存第一张图片到历史
        const historyItem = {
          id: now,
          prompt: prompt,
          image: newImages[0],
          timestamp: new Date().toISOString()
        }
        setHistory(prev => [historyItem, ...prev])
      } else {
        setError('未找到生成的图片')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      setHistory([])
    }
  }

  const deleteHistoryItem = (id) => {
    setHistory(prev => prev.filter(item => item.id !== id))
  }

  const downloadImage = async (url, filename) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename || 'image.jpg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('下载失败:', err)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <div className="config-section">
          <div className="config-header" onClick={() => setConfigExpanded(!configExpanded)}>
            <h2>配置</h2>
            <span className="config-toggle">{configExpanded ? '▲' : '▼'}</span>
          </div>
          {configExpanded && (
            <div className="config-content">
              <div className="form-group">
                <label>API URL</label>
                <input
                  type="text"
                  placeholder="https://api.example.com"
                  value={config.url}
                  onChange={(e) => setConfig({...config, url: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>API Key</label>
                <input
                  type="password"
                  placeholder="your-api-key"
                  value={config.apiKey}
                  onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>模型名称</label>
                <input
                  type="text"
                  placeholder="grok-2-vision-1212"
                  value={config.model}
                  onChange={(e) => setConfig({...config, model: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={loadFromNetwork}
                    onChange={(e) => setLoadFromNetwork(e.target.checked)}
                  />
                  从网络加载未缓存的图片
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="generate-section">
          <div className="form-group">
            <label>提示词</label>
            <textarea
              rows="4"
              placeholder="描述你想要生成的图片..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <button
            className="generate-btn"
            onClick={generateImage}
            disabled={loading}
          >
            {loading ? '生成中...' : '生成图片'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {history.length > 0 && (
          <div className="history-section">
            <div className="history-header">
              <h2>生成历史</h2>
              <button className="clear-btn" onClick={clearHistory}>
                清空历史
              </button>
            </div>
            <div className="history-grid">
              {history.filter(item => item.image?.url).map((item) => (
                <div key={item.id} className="history-card">
                  <img
                    src={getCachedImageUrl(item.image.url)}
                    alt={item.prompt}
                    onClick={() => setPreviewImage(getCachedImageUrl(item.image.url))}
                  />
                  <div className="history-info">
                    <p className="history-prompt">{item.prompt}</p>
                    <div className="history-meta">
                      <span className="history-time">
                        {new Date(item.timestamp).toLocaleString('zh-CN')}
                      </span>
                      <div className="history-actions">
                        <button
                          className="use-prompt-btn"
                          onClick={() => usePrompt(item.prompt)}
                        >
                          使用提示词
                        </button>
                        <button
                          className="download-btn"
                          onClick={() => downloadImage(item.image.url, `image-${item.id}.jpg`)}
                        >
                          下载
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => deleteHistoryItem(item.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {previewImage && (
          <div className="preview-overlay" onClick={() => setPreviewImage(null)}>
            <div className="preview-content" onClick={(e) => e.stopPropagation()}>
              <button className="preview-close" onClick={() => setPreviewImage(null)}>
                ✕
              </button>
              <img src={previewImage} alt="预览" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
