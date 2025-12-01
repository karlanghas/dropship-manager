import React, { useState, useEffect } from 'react'
import { 
  Package, 
  Plus, 
  Play, 
  CheckCircle, 
  XCircle, 
  Upload, 
  Loader2,
  Moon,
  Sun,
  Search,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Target,
  Zap,
  RefreshCw,
  Trash2,
  Eye,
  ShoppingCart
} from 'lucide-react'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Custom hook for API calls
function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const request = async (endpoint, options = {}) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }
      
      const data = await response.json()
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { request, loading, error }
}

// Store simple con Zustand pattern (sin la librería para simplicidad)
const useStore = () => {
  const [state, setState] = useState({
    products: [],
    marketingResults: [],
    scrapingStatus: null,
    notifications: [],
  })

  const setProducts = (products) => setState(prev => ({ ...prev, products }))
  const setMarketingResults = (results) => setState(prev => ({ ...prev, marketingResults: results }))
  const setScrapingStatus = (status) => setState(prev => ({ ...prev, scrapingStatus: status }))
  const addNotification = (notification) => {
    const id = Date.now()
    setState(prev => ({ 
      ...prev, 
      notifications: [...prev.notifications, { ...notification, id }] 
    }))
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== id)
      }))
    }, 5000)
  }

  return { ...state, setProducts, setMarketingResults, setScrapingStatus, addNotification }
}

// Notification Component
function Notifications({ notifications }) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            animate-slide-up p-4 rounded-xl shadow-lg max-w-sm
            ${notification.type === 'success' ? 'bg-green-600 text-white' : ''}
            ${notification.type === 'error' ? 'bg-red-600 text-white' : ''}
            ${notification.type === 'info' ? 'bg-blue-600 text-white' : ''}
            ${notification.type === 'warning' ? 'bg-amber-600 text-white' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {notification.type === 'info' && <Sparkles className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Header Component
function Header({ darkMode, setDarkMode, activeTab, setActiveTab }) {
  const tabs = [
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'results', label: 'Resultados', icon: TrendingUp },
  ]

  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">DropShip Manager</h1>
              <p className="text-xs text-surface-500 dark:text-surface-400">Análisis & Marketing</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${activeTab === tab.id 
                    ? 'bg-white dark:bg-surface-900 text-primary-600 dark:text-primary-400 shadow-sm' 
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="btn-ghost p-2.5 rounded-xl"
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                ${activeTab === tab.id 
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                  : 'text-surface-600 dark:text-surface-400'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

// Product Input Form
function ProductForm({ onAddProduct, loading }) {
  const [urls, setUrls] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Parse URLs (one per line or comma separated)
    const urlList = urls
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      setError('Ingresa al menos una URL')
      return
    }

    // Validate URLs
    const invalidUrls = urlList.filter(url => {
      try {
        new URL(url)
        return false
      } catch {
        return true
      }
    })

    if (invalidUrls.length > 0) {
      setError(`URLs inválidas: ${invalidUrls.join(', ')}`)
      return
    }

    setError('')
    onAddProduct(urlList)
    setUrls('')
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Plus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-lg">Agregar Productos</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400">URLs de productos para analizar</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="Pega las URLs de los productos (una por línea)&#10;Ejemplo:&#10;https://articulo.mercadolibre.cl/MLC-123456789&#10;https://www.amazon.com/dp/B08XYZ123"
            rows={5}
            className={`input resize-none font-mono text-sm ${error ? 'input-error' : ''}`}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Agregando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Agregar Productos
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// Product List Component
function ProductList({ products, onRunScraping, onRemoveProduct, scrapingStatus, loading }) {
  if (products.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
          <Package className="w-8 h-8 text-surface-400" />
        </div>
        <h3 className="font-display font-semibold text-lg mb-2">Sin productos</h3>
        <p className="text-surface-500 dark:text-surface-400">
          Agrega URLs de productos para comenzar el análisis
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
            <Package className="w-5 h-5 text-accent-600 dark:text-accent-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Productos Pendientes</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">{products.length} producto(s)</p>
          </div>
        </div>

        <button
          onClick={onRunScraping}
          disabled={loading || scrapingStatus === 'processing'}
          className="btn-accent"
        >
          {scrapingStatus === 'processing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Analizar Todos
            </>
          )}
        </button>
      </div>

      {scrapingStatus === 'processing' && (
        <div className="p-4 bg-accent-50 dark:bg-accent-900/20 border-b">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-accent-200 dark:border-accent-800"></div>
              <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-accent-600 border-t-transparent animate-spin"></div>
            </div>
            <div>
              <p className="font-medium text-accent-700 dark:text-accent-300">Analizando productos...</p>
              <p className="text-sm text-accent-600 dark:text-accent-400">Esto puede tomar unos minutos</p>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-surface-100 dark:divide-surface-800 max-h-96 overflow-y-auto scrollbar-thin">
        {products.map((product, index) => (
          <div 
            key={product.id || index}
            className="p-4 flex items-center gap-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center flex-shrink-0">
              <span className="font-mono text-sm font-medium text-surface-500">{index + 1}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm truncate">{product.url}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge ${
                  product.status === 'pending' ? 'badge-warning' :
                  product.status === 'processing' ? 'badge-info' :
                  product.status === 'completed' ? 'badge-success' :
                  'badge-error'
                }`}>
                  {product.status === 'pending' && 'Pendiente'}
                  {product.status === 'processing' && 'Procesando'}
                  {product.status === 'completed' && 'Completado'}
                  {product.status === 'error' && 'Error'}
                </span>
                {product.marketplace && (
                  <span className="badge badge-neutral">{product.marketplace}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost p-2 rounded-lg"
                title="Ver producto"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => onRemoveProduct(product.id || index)}
                className="btn-ghost p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Marketing Results Component
function MarketingResults({ results, onApprove, onReject, onPublish, loading }) {
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const filteredResults = results.filter(result => {
    if (filter === 'all') return true
    if (filter === 'pending') return result.estado_aprobacion === 'pendiente'
    if (filter === 'approved') return result.estado_aprobacion === 'aprobado'
    if (filter === 'rejected') return result.estado_aprobacion === 'rechazado'
    return true
  })

  if (results.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-surface-400" />
        </div>
        <h3 className="font-display font-semibold text-lg mb-2">Sin resultados</h3>
        <p className="text-surface-500 dark:text-surface-400">
          Los resultados del análisis aparecerán aquí
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2">
        {[
          { id: 'all', label: 'Todos', count: results.length },
          { id: 'pending', label: 'Pendientes', count: results.filter(r => r.estado_aprobacion === 'pendiente').length },
          { id: 'approved', label: 'Aprobados', count: results.filter(r => r.estado_aprobacion === 'aprobado').length },
          { id: 'rejected', label: 'Rechazados', count: results.filter(r => r.estado_aprobacion === 'rechazado').length },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
              ${filter === f.id 
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }
            `}
          >
            {f.label}
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-surface-900 text-xs">
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Results Cards */}
      <div className="grid gap-4">
        {filteredResults.map((result, index) => (
          <div 
            key={result.id || index}
            className="card-hover overflow-hidden"
          >
            {/* Header */}
            <div 
              className="p-4 cursor-pointer"
              onClick={() => setExpandedId(expandedId === index ? null : index)}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-display font-semibold text-lg">{result.Producto || 'Producto'}</h4>
                    <span className={`badge ${
                      result.estado_aprobacion === 'pendiente' ? 'badge-warning' :
                      result.estado_aprobacion === 'aprobado' ? 'badge-success' :
                      'badge-error'
                    }`}>
                      {result.estado_aprobacion || 'pendiente'}
                    </span>
                    {result.publicado === 'si' && (
                      <span className="badge badge-info">Publicado</span>
                    )}
                  </div>
                  
                  {/* Hook Preview */}
                  {result['Gancho (Hook)'] && (
                    <p className="mt-2 text-sm text-surface-600 dark:text-surface-300 line-clamp-2">
                      <span className="font-medium text-accent-600 dark:text-accent-400">Hook:</span> {result['Gancho (Hook)']}
                    </p>
                  )}
                </div>

                <button className="btn-ghost p-2 rounded-lg">
                  <Eye className={`w-5 h-5 transition-transform ${expandedId === index ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === index && (
              <div className="px-4 pb-4 space-y-4 animate-fade-in">
                <div className="h-px bg-surface-200 dark:bg-surface-700" />
                
                {/* Pain Points */}
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <h5 className="font-medium text-red-700 dark:text-red-300">Puntos de Dolor</h5>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400">{result['Puntos de Dolor'] || 'Sin datos'}</p>
                </div>

                {/* Insights */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h5 className="font-medium text-blue-700 dark:text-blue-300">Insights</h5>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{result['Insights'] || 'Sin datos'}</p>
                </div>

                {/* Hook */}
                <div className="p-4 rounded-xl bg-accent-50 dark:bg-accent-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-accent-600 dark:text-accent-400" />
                    <h5 className="font-medium text-accent-700 dark:text-accent-300">Gancho Publicitario</h5>
                  </div>
                  <p className="text-sm text-accent-600 dark:text-accent-400 font-medium">
                    "{result['Gancho (Hook)'] || 'Sin datos'}"
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {result.estado_aprobacion !== 'aprobado' && (
                    <button
                      onClick={() => onApprove(result.id || index)}
                      disabled={loading}
                      className="btn-primary flex-1 sm:flex-none"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aprobar
                    </button>
                  )}
                  
                  {result.estado_aprobacion !== 'rechazado' && (
                    <button
                      onClick={() => onReject(result.id || index)}
                      disabled={loading}
                      className="btn-danger flex-1 sm:flex-none"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </button>
                  )}

                  {result.estado_aprobacion === 'aprobado' && result.publicado !== 'si' && (
                    <button
                      onClick={() => onPublish(result.id || index)}
                      disabled={loading}
                      className="btn-accent flex-1 sm:flex-none"
                    >
                      <Upload className="w-4 h-4" />
                      Publicar en WooCommerce
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Main App Component
export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })
  const [activeTab, setActiveTab] = useState('products')
  
  const store = useStore()
  const api = useApi()

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Load initial data
  useEffect(() => {
    loadProducts()
    loadMarketingResults()
  }, [])

  const loadProducts = async () => {
    try {
      const data = await api.request('/products')
      store.setProducts(data.products || [])
    } catch (err) {
      console.error('Error loading products:', err)
      // Use mock data for demo
      store.setProducts([])
    }
  }

  const loadMarketingResults = async () => {
    try {
      const data = await api.request('/marketing/results')
      store.setMarketingResults(data.results || [])
    } catch (err) {
      console.error('Error loading results:', err)
      // Use mock data for demo
      store.setMarketingResults([])
    }
  }

  const handleAddProduct = async (urls) => {
    try {
      await api.request('/products/add', {
        method: 'POST',
        body: JSON.stringify({ urls }),
      })
      store.addNotification({ type: 'success', message: `${urls.length} producto(s) agregado(s)` })
      loadProducts()
    } catch (err) {
      store.addNotification({ type: 'error', message: 'Error al agregar productos' })
      
      // Demo: Add locally
      const newProducts = urls.map((url, i) => ({
        id: Date.now() + i,
        url,
        status: 'pending',
        marketplace: url.includes('mercadolibre') ? 'MercadoLibre' : 
                     url.includes('amazon') ? 'Amazon' : 'Otro'
      }))
      store.setProducts([...store.products, ...newProducts])
    }
  }

  const handleRemoveProduct = async (productId) => {
    try {
      await api.request(`/products/${productId}`, { method: 'DELETE' })
      store.addNotification({ type: 'info', message: 'Producto eliminado' })
      loadProducts()
    } catch (err) {
      // Demo: Remove locally
      store.setProducts(store.products.filter((_, i) => i !== productId))
    }
  }

  const handleRunScraping = async () => {
    try {
      store.setScrapingStatus('processing')
      await api.request('/scraping/start', { method: 'POST' })
      store.addNotification({ type: 'info', message: 'Análisis iniciado' })
      
      // Poll for status
      const pollStatus = setInterval(async () => {
        try {
          const data = await api.request('/scraping/status')
          if (data.status === 'completed') {
            clearInterval(pollStatus)
            store.setScrapingStatus('completed')
            store.addNotification({ type: 'success', message: 'Análisis completado' })
            loadMarketingResults()
            setActiveTab('results')
          } else if (data.status === 'error') {
            clearInterval(pollStatus)
            store.setScrapingStatus('error')
            store.addNotification({ type: 'error', message: 'Error en el análisis' })
          }
        } catch (err) {
          clearInterval(pollStatus)
          store.setScrapingStatus('error')
        }
      }, 5000)
      
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollStatus)
        if (store.scrapingStatus === 'processing') {
          store.setScrapingStatus('completed')
          store.addNotification({ type: 'success', message: 'Análisis completado (demo)' })
          // Demo results
          loadMarketingResults()
          setActiveTab('results')
        }
      }, 10000)
      
    } catch (err) {
      store.addNotification({ type: 'error', message: 'Error al iniciar análisis' })
      store.setScrapingStatus('error')
    }
  }

  const handleApprove = async (resultId) => {
    try {
      await api.request(`/marketing/${resultId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'aprobado' }),
      })
      store.addNotification({ type: 'success', message: 'Producto aprobado' })
      loadMarketingResults()
    } catch (err) {
      // Demo: Update locally
      const updated = store.marketingResults.map((r, i) => 
        i === resultId ? { ...r, estado_aprobacion: 'aprobado' } : r
      )
      store.setMarketingResults(updated)
      store.addNotification({ type: 'success', message: 'Producto aprobado (demo)' })
    }
  }

  const handleReject = async (resultId) => {
    try {
      await api.request(`/marketing/${resultId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rechazado' }),
      })
      store.addNotification({ type: 'info', message: 'Producto rechazado' })
      loadMarketingResults()
    } catch (err) {
      // Demo: Update locally
      const updated = store.marketingResults.map((r, i) => 
        i === resultId ? { ...r, estado_aprobacion: 'rechazado' } : r
      )
      store.setMarketingResults(updated)
      store.addNotification({ type: 'info', message: 'Producto rechazado (demo)' })
    }
  }

  const handlePublish = async (resultId) => {
    try {
      store.addNotification({ type: 'info', message: 'Publicando en WooCommerce...' })
      await api.request(`/products/${resultId}/publish`, { method: 'POST' })
      store.addNotification({ type: 'success', message: 'Producto publicado en WooCommerce' })
      loadMarketingResults()
    } catch (err) {
      // Demo: Update locally
      const updated = store.marketingResults.map((r, i) => 
        i === resultId ? { ...r, publicado: 'si' } : r
      )
      store.setMarketingResults(updated)
      store.addNotification({ type: 'success', message: 'Producto publicado (demo)' })
    }
  }

  return (
    <div className="min-h-screen">
      <Notifications notifications={store.notifications} />
      
      <Header 
        darkMode={darkMode} 
        setDarkMode={setDarkMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'products' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <ProductForm 
              onAddProduct={handleAddProduct}
              loading={api.loading}
            />
            <ProductList 
              products={store.products}
              onRunScraping={handleRunScraping}
              onRemoveProduct={handleRemoveProduct}
              scrapingStatus={store.scrapingStatus}
              loading={api.loading}
            />
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-2xl">Resultados de Marketing</h2>
                <p className="text-surface-500 dark:text-surface-400">
                  Insights y hooks generados por IA
                </p>
              </div>
              <button
                onClick={loadMarketingResults}
                className="btn-secondary"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
            </div>
            
            <MarketingResults 
              results={store.marketingResults}
              onApprove={handleApprove}
              onReject={handleReject}
              onPublish={handlePublish}
              loading={api.loading}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-surface-500 dark:text-surface-400">
          <p>DropShip Manager v1.0 • Desarrollado para optimizar tu negocio de dropshipping</p>
        </div>
      </footer>
    </div>
  )
}
