import { useState, useEffect } from 'react'
import './App.css'
import { getImage } from './imageCache'

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
        ...history.map(item => item.image.url)
      ]

      for (const url of urls) {
        if (!cachedImages[url]) {
          const cachedUrl = await getImage(url)
          setCachedImages(prev => ({ ...prev, [url]: cachedUrl }))
        }
      }
    }

    loadCachedImages()
  }, [images, history])

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
      const imageMap = new Map()
      let finalImage = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'))

        for (const line of lines) {
          const data = line.replace(/^data:\s*/, '')
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)

            if (json.type === 'image_generation.partial_image') {
              const key = `${json.image_id}-${json.stage}`
              imageMap.set(key, {
                url: json.url,
                stage: json.stage,
                index: json.index,
                created_at: json.created_at
              })

              setImages(Array.from(imageMap.values()).sort((a, b) => a.index - b.index))
            } else if (json.type === 'image_generation.completed') {
              finalImage = {
                url: json.url,
                stage: json.stage,
                index: json.index,
                created_at: json.created_at
              }
            }
          } catch (e) {
            console.error('解析响应失败:', e)
          }
        }
      }

      if (finalImage) {
        const historyItem = {
          id: Date.now(),
          prompt: prompt,
          image: finalImage,
          timestamp: new Date().toISOString()
        }
        setHistory(prev => [historyItem, ...prev])
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
              {history.map((item) => (
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
