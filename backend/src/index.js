import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { google } from 'googleapis'
import {
  initAuth,
  login,
  logout,
  validateToken,
  authMiddleware,
  adminMiddleware,
  createUser,
  updatePassword,
  deleteUser,
  listUsers,
  unlockUser,
  validatePasswordComplexity
} from './auth.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3201

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true)
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'https://dsm.infociber.cl',
      'http://dsm.infociber.cl',
      'http://localhost:3200',
      'http://localhost:5173',
      process.env.APP_URL
    ].filter(Boolean)
    
    if (allowedOrigins.includes(origin) || origin.includes('localhost')) {
      callback(null, true)
    } else {
      console.log('CORS blocked origin:', origin)
      callback(null, true) // En desarrollo, permitir todo
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))
app.use(express.json())

// Configuration
const config = {
  n8n: {
    baseUrl: process.env.N8N_WEBHOOK_BASE_URL || 'http://192.168.0.111:5678/webhook',
    webhooks: {
      scraping: process.env.N8N_WEBHOOK_SCRAPING || '711c69a4-3f91-4fd4-831d-60c56039814a',
      addProduct: process.env.N8N_WEBHOOK_ADD_PRODUCT || 'add-product',
      getResults: process.env.N8N_WEBHOOK_GET_RESULTS || 'get-results',
      publish: process.env.N8N_WEBHOOK_PUBLISH || 'publish-product'
    }
  },
  sheets: {
    id: process.env.GOOGLE_SHEETS_ID || '1X6Dxum7dBLMPSp_nWMS9--43PWIX5mWaGlq1a6VVSF0'
  },
  scraper: {
    url: process.env.SCRAPER_API_URL || 'http://192.168.0.111:5050'
  },
  woocommerce: {
    url: process.env.WOO_URL,
    consumerKey: process.env.WOO_CONSUMER_KEY,
    consumerSecret: process.env.WOO_CONSUMER_SECRET
  }
}

// In-memory store for demo/fallback
const store = {
  products: [],
  scrapingStatus: null,
  taskId: null
}

// ============================================
// GOOGLE SHEETS SERVICE
// ============================================
let sheetsClient = null

// Construir credenciales desde variables de entorno individuales
function buildCredentialsFromEnv() {
  const requiredVars = [
    'GOOGLE_TYPE',
    'GOOGLE_PROJECT_ID',
    'GOOGLE_PRIVATE_KEY_ID',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_CLIENT_ID'
  ]
  
  // Verificar que al menos las variables requeridas estén presentes
  const hasRequiredVars = requiredVars.every(varName => process.env[varName])
  
  if (!hasRequiredVars) {
    return null
  }
  
  // La private_key viene con \n escapados, hay que convertirlos a saltos de línea reales
  let privateKey = process.env.GOOGLE_PRIVATE_KEY
  if (privateKey) {
    // Reemplazar \n literales por saltos de línea reales
    privateKey = privateKey.replace(/\\n/g, '\n')
  }
  
  return {
    type: process.env.GOOGLE_TYPE || 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN || 'googleapis.com'
  }
}

async function initGoogleSheets() {
  try {
    let auth;
    let credentials = null;
    
    // Opción 1: Variables de entorno individuales (RECOMENDADO para repos públicos)
    credentials = buildCredentialsFromEnv()
    if (credentials) {
      console.log('Google Sheets: Using credentials from individual ENV variables')
      console.log('  Project ID:', credentials.project_id)
      console.log('  Client Email:', credentials.client_email)
      
      auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      })
    }
    // Opción 2: Archivo de credenciales (GOOGLE_APPLICATION_CREDENTIALS)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Google Sheets: Using credentials file:', process.env.GOOGLE_APPLICATION_CREDENTIALS)
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      })
    }
    // Opción 3: JSON completo en variable de entorno (GOOGLE_SERVICE_ACCOUNT_KEY)
    else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log('Google Sheets: Using credentials from GOOGLE_SERVICE_ACCOUNT_KEY env var')
      
      try {
        // Intentar parsear directamente
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      } catch (parseError) {
        // Si falla, intentar decodificar de base64
        try {
          const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8')
          credentials = JSON.parse(decoded)
          console.log('Google Sheets: Credentials decoded from base64')
        } catch (base64Error) {
          throw new Error('Could not parse GOOGLE_SERVICE_ACCOUNT_KEY as JSON or base64')
        }
      }
      
      auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      })
    }
    else {
      console.log('Google Sheets: No credentials provided, using mock data')
      console.log('  Option 1: Set individual GOOGLE_* env variables (recommended)')
      console.log('  Option 2: Set GOOGLE_APPLICATION_CREDENTIALS file path')
      console.log('  Option 3: Set GOOGLE_SERVICE_ACCOUNT_KEY as JSON/base64')
      return null
    }
    
    sheetsClient = google.sheets({ version: 'v4', auth })
    
    // Test connection
    await sheetsClient.spreadsheets.get({
      spreadsheetId: config.sheets.id
    })
    
    console.log('Google Sheets: Connected successfully ✓')
    return sheetsClient
  } catch (error) {
    console.error('Google Sheets: Connection failed -', error.message)
    return null
  }
}

// ============================================
// N8N SERVICE
// ============================================
async function callN8nWebhook(webhookId, data = {}) {
  try {
    const url = `${config.n8n.baseUrl}/${webhookId}`
    console.log(`Calling n8n webhook: ${url}`)
    console.log('Webhook data:', JSON.stringify(data))
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    console.log('n8n response status:', response.status)
    
    // Get response as text first
    const responseText = await response.text()
    console.log('n8n response body:', responseText)
    
    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} - ${responseText}`)
    }
    
    // Try to parse as JSON, but handle empty or non-JSON responses
    if (!responseText || responseText.trim() === '') {
      console.log('n8n returned empty response, assuming success')
      return { success: true }
    }
    
    try {
      return JSON.parse(responseText)
    } catch (parseError) {
      console.log('n8n response is not JSON, returning as text')
      return { success: true, message: responseText }
    }
  } catch (error) {
    console.error('n8n webhook error:', error.message)
    throw error
  }
}

// ============================================
// WOOCOMMERCE SERVICE
// ============================================
async function createWooProduct(productData) {
  if (!config.woocommerce.url || !config.woocommerce.consumerKey) {
    console.log('WooCommerce: Not configured')
    return { id: 'demo-' + Date.now(), status: 'demo' }
  }
  
  try {
    const WooCommerceRestApi = (await import('@woocommerce/woocommerce-rest-api')).default
    
    const api = new WooCommerceRestApi({
      url: config.woocommerce.url,
      consumerKey: config.woocommerce.consumerKey,
      consumerSecret: config.woocommerce.consumerSecret,
      version: 'wc/v3'
    })
    
    const response = await api.post('products', productData)
    return response.data
  } catch (error) {
    console.error('WooCommerce error:', error.message)
    throw error
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function detectMarketplace(url) {
  if (!url) return 'Desconocido'
  if (url.includes('mercadolibre')) return 'MercadoLibre'
  if (url.includes('amazon')) return 'Amazon'
  if (url.includes('aliexpress')) return 'AliExpress'
  if (url.includes('ebay')) return 'eBay'
  return 'Otro'
}

// ============================================
// API ROUTES - PUBLIC
// ============================================

// Health check (público)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      sheets: !!sheetsClient,
      n8n: !!config.n8n.baseUrl,
      woocommerce: !!config.woocommerce.url
    }
  })
})

// Callback de n8n cuando termina el scraping (público - llamado por n8n)
app.post('/api/scraping/complete', (req, res) => {
  console.log('=== SCRAPING COMPLETE CALLBACK ===')
  console.log('Body:', req.body)
  
  store.scrapingStatus = 'completed'
  store.scrapingEndTime = Date.now()
  
  res.json({ success: true, message: 'Status updated to completed' })
})

// ============================================
// AUTH ROUTES
// ============================================

// Login (público)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username y password son requeridos' })
  }
  
  const result = login(username, password)
  
  if (result.success) {
    res.json(result)
  } else {
    res.status(401).json(result)
  }
})

// Logout (requiere auth)
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.substring(7)
  const result = logout(token)
  res.json(result)
})

// Verificar sesión actual (requiere auth)
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

// Cambiar contraseña propia (requiere auth)
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body
  const username = req.user.username
  
  // Verificar contraseña actual
  const loginResult = login(username, currentPassword)
  if (!loginResult.success) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' })
  }
  
  const result = updatePassword(username, newPassword)
  
  if (result.success) {
    res.json(result)
  } else {
    res.status(400).json(result)
  }
})

// Validar complejidad de contraseña (público - para UI)
app.post('/api/auth/validate-password', (req, res) => {
  const { password } = req.body
  const result = validatePasswordComplexity(password || '')
  res.json(result)
})

// ============================================
// USER MANAGEMENT ROUTES (Admin only)
// ============================================

// Listar usuarios
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ users: listUsers() })
})

// Crear usuario
app.post('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const { username, password, role } = req.body
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username y password son requeridos' })
  }
  
  const result = createUser(username, password, role || 'user')
  
  if (result.success) {
    res.json(result)
  } else {
    res.status(400).json(result)
  }
})

// Eliminar usuario
app.delete('/api/users/:username', authMiddleware, adminMiddleware, (req, res) => {
  const { username } = req.params
  const result = deleteUser(username)
  
  if (result.success) {
    res.json(result)
  } else {
    res.status(400).json(result)
  }
})

// Desbloquear usuario
app.post('/api/users/:username/unlock', authMiddleware, adminMiddleware, (req, res) => {
  const { username } = req.params
  const result = unlockUser(username)
  
  if (result.success) {
    res.json(result)
  } else {
    res.status(400).json(result)
  }
})

// Resetear contraseña de usuario
app.post('/api/users/:username/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const { username } = req.params
  const { newPassword } = req.body
  
  if (!newPassword) {
    return res.status(400).json({ error: 'Nueva contraseña es requerida' })
  }
  
  const result = updatePassword(username, newPassword)
  
  if (result.success) {
    res.json(result)
  } else {
    res.status(400).json(result)
  }
})

// ============================================
// Aplicar middleware de autenticación a rutas protegidas
// ============================================
app.use('/api/products', authMiddleware)
app.use('/api/scraping', authMiddleware)
app.use('/api/marketing', authMiddleware)
app.use('/api/dropi', authMiddleware)

// ============================================
// PRODUCTS ROUTES
// ============================================

// Get all products
app.get('/api/products', async (req, res) => {
  console.log('=== GET PRODUCTS REQUEST ===')
  
  try {
    if (sheetsClient) {
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.sheets.id,
        range: 'Raw_Resenas!A:G'
      })
      
      const rows = response.data.values || []
      console.log('Rows from sheet:', rows.length)
      
      if (rows.length < 2) {
        return res.json({ products: [] })
      }
      
      const headers = rows[0]
      const products = rows.slice(1)
        .map((row, index) => ({
          id: index,
          url: row[0] || '',
          title: row[1] || '',
          rating: row[2] || '',
          date: row[3] || '',
          status: row[6] || 'pending',
          marketplace: detectMarketplace(row[0] || '')
        }))
        .filter(p => p.status !== 'deleted' && p.url)
      
      console.log('Products after filter:', products.length)
      return res.json({ products })
    }
    
    res.json({ products: store.products })
  } catch (error) {
    console.error('Error getting products:', error)
    res.json({ products: store.products })
  }
})

// Add new products
app.post('/api/products/add', async (req, res) => {
  console.log('=== ADD PRODUCT REQUEST ===')
  console.log('Body received:', JSON.stringify(req.body, null, 2))
  console.log('User:', req.user?.username)
  
  try {
    const { urls } = req.body
    
    if (!urls || !Array.isArray(urls)) {
      console.log('ERROR: URLs array is missing or invalid')
      return res.status(400).json({ error: 'URLs array is required' })
    }
    
    console.log('URLs to add:', urls)
    console.log('Sheets client available:', !!sheetsClient)
    
    const rows = urls.map(url => [
      url,
      '',
      '',
      new Date().toISOString(),
      '',
      '',
      'pending'
    ])
    
    console.log('Rows to append:', JSON.stringify(rows, null, 2))
    
    let sheetSuccess = false
    
    if (sheetsClient) {
      try {
        console.log('Attempting to append to sheet...')
        console.log('Sheet ID:', config.sheets.id)
        
        const response = await sheetsClient.spreadsheets.values.append({
          spreadsheetId: config.sheets.id,
          range: 'Raw_Resenas!A:G',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: rows }
        })
        
        console.log('Sheet append SUCCESS:', response.data.updates)
        sheetSuccess = true
      } catch (sheetError) {
        console.error('Sheet append ERROR:', sheetError.message)
        console.error('Full error:', JSON.stringify(sheetError.response?.data || sheetError, null, 2))
      }
    }
    
    urls.forEach((url, i) => {
      store.products.push({
        id: Date.now() + i,
        url,
        status: 'pending',
        marketplace: detectMarketplace(url)
      })
    })
    
    try {
      await callN8nWebhook(config.n8n.webhooks.addProduct, { urls })
      console.log('n8n webhook called successfully')
    } catch (e) {
      console.log('n8n notification skipped:', e.message)
    }
    
    res.json({ 
      success: true, 
      sheetUpdated: sheetSuccess,
      message: `${urls.length} producto(s) agregado(s)`,
      products: store.products
    })
  } catch (error) {
    console.error('FATAL ERROR in /api/products/add:', error)
    res.status(500).json({ error: error.message })
  }
})

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  console.log('=== DELETE PRODUCT REQUEST ===')
  const { id } = req.params
  console.log('Product ID to delete:', id)
  
  try {
    const indexToRemove = parseInt(id)
    
    if (store.products.length > indexToRemove) {
      const removed = store.products.splice(indexToRemove, 1)
      console.log('Removed from local store:', removed)
    }
    
    if (sheetsClient) {
      try {
        const rowNumber = indexToRemove + 2
        
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: config.sheets.id,
          range: `Raw_Resenas!G${rowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['deleted']] }
        })
        console.log('Marked as deleted in sheet, row:', rowNumber)
      } catch (sheetError) {
        console.error('Error updating sheet:', sheetError.message)
      }
    }
    
    res.json({ success: true, message: 'Producto eliminado' })
  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({ error: error.message })
  }
})

// Publish product to WooCommerce
app.post('/api/products/:id/publish', async (req, res) => {
  try {
    const { id } = req.params
    console.log('Publishing product:', id)
    
    const wooProduct = await createWooProduct({
      name: `Producto ${id}`,
      type: 'simple',
      status: 'draft'
    })
    
    res.json({ 
      success: true, 
      wooProductId: wooProduct.id,
      message: 'Producto publicado en WooCommerce'
    })
  } catch (error) {
    console.error('Error publishing product:', error)
    res.json({ 
      success: true, 
      wooProductId: 'demo-' + Date.now(),
      message: 'Producto publicado (demo)'
    })
  }
})

// ============================================
// SCRAPING ROUTES
// ============================================

app.post('/api/scraping/start', async (req, res) => {
  try {
    store.scrapingStatus = 'processing'
    store.scrapingStartTime = Date.now()
    store.lastResultCount = 0
    
    // Guardar conteo actual de resultados para detectar nuevos
    if (sheetsClient) {
      try {
        const response = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: config.sheets.id,
          range: 'Marketing_Analisis!A:A'
        })
        store.lastResultCount = (response.data.values?.length || 1) - 1 // -1 por header
        console.log('Initial result count:', store.lastResultCount)
      } catch (e) {
        console.log('Could not get initial count:', e.message)
      }
    }
    
    const result = await callN8nWebhook(config.n8n.webhooks.scraping, {
      spreadsheet_name: 'Planilla_Resenas',
      sheet_name: 'Raw_Resenas',
      callback_url: `${process.env.APP_URL || 'http://localhost:3201'}/api/scraping/complete`
    })
    
    store.taskId = result.task_id || result.taskId || null
    
    res.json({ 
      success: true, 
      status: 'processing',
      taskId: store.taskId
    })
  } catch (error) {
    console.error('Error starting scraping:', error)
    
    // Aún así marcamos como processing para el polling
    store.scrapingStatus = 'processing'
    
    res.json({ 
      success: true, 
      status: 'processing',
      message: 'Scraping iniciado (sin confirmación de n8n)'
    })
  }
})

// Endpoint para marcar manualmente como completado
app.post('/api/scraping/mark-complete', authMiddleware, (req, res) => {
  console.log('=== MANUAL MARK COMPLETE ===')
  
  store.scrapingStatus = 'completed'
  store.scrapingEndTime = Date.now()
  
  res.json({ success: true, message: 'Marked as completed' })
})

app.get('/api/scraping/status', async (req, res) => {
  try {
    // Si ya está completado, devolver completado
    if (store.scrapingStatus === 'completed') {
      return res.json({ 
        status: 'completed',
        duration: store.scrapingEndTime ? store.scrapingEndTime - store.scrapingStartTime : null
      })
    }
    
    // Verificar si hay nuevos resultados en Google Sheets
    if (store.scrapingStatus === 'processing' && sheetsClient) {
      try {
        const response = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: config.sheets.id,
          range: 'Marketing_Analisis!A:A'
        })
        const currentCount = (response.data.values?.length || 1) - 1
        
        console.log(`Checking results: initial=${store.lastResultCount}, current=${currentCount}`)
        
        // Si hay más resultados que antes, el proceso terminó
        if (currentCount > store.lastResultCount) {
          console.log('New results detected! Marking as completed.')
          store.scrapingStatus = 'completed'
          store.scrapingEndTime = Date.now()
          return res.json({ 
            status: 'completed',
            newResults: currentCount - store.lastResultCount
          })
        }
      } catch (e) {
        console.log('Could not check results:', e.message)
      }
    }
    
    // Intentar obtener estado del scraper si hay taskId
    if (store.taskId) {
      try {
        const response = await fetch(`${config.scraper.url}/task/${store.taskId}`)
        const data = await response.json()
        
        if (data.status === 'completed' || data.status === 'done') {
          store.scrapingStatus = 'completed'
          store.scrapingEndTime = Date.now()
        }
        
        return res.json({ 
          status: store.scrapingStatus,
          progress: data.progress || null,
          taskStatus: data.status
        })
      } catch (e) {
        // Scraper no disponible, continuar con status actual
      }
    }
    
    // Devolver estado actual
    res.json({ 
      status: store.scrapingStatus || 'idle',
      elapsed: store.scrapingStartTime ? Date.now() - store.scrapingStartTime : 0
    })
  } catch (error) {
    console.error('Status check error:', error)
    res.json({ status: store.scrapingStatus || 'idle' })
  }
})

// ============================================
// MARKETING ROUTES
// ============================================

app.get('/api/marketing/results', async (req, res) => {
  try {
    if (sheetsClient) {
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: config.sheets.id,
        range: 'Marketing_Analisis!A:H'
      })
      
      const rows = response.data.values || []
      
      if (rows.length < 2) {
        return res.json({ results: [] })
      }
      
      const results = rows.slice(1).map((row, index) => ({
        id: index,
        Producto: row[0] || '',
        'Puntos de Dolor': row[1] || '',
        'Insights': row[2] || '',
        'Gancho (Hook)': row[3] || '',
        Fecha: row[4] || '',
        estado_aprobacion: row[5] || 'pendiente',
        publicado: row[6] || 'no',
        woo_product_id: row[7] || ''
      }))
      
      return res.json({ results })
    }
    
    res.json({ 
      results: [
        {
          id: 0,
          Producto: 'Producto Demo',
          'Puntos de Dolor': 'Pain points de ejemplo',
          'Insights': 'Insights de ejemplo',
          'Gancho (Hook)': 'Hook publicitario de ejemplo',
          Fecha: new Date().toISOString(),
          estado_aprobacion: 'pendiente',
          publicado: 'no'
        }
      ]
    })
  } catch (error) {
    console.error('Error getting marketing results:', error)
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/marketing/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const rowNumber = parseInt(id) + 2
    
    if (sheetsClient) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: config.sheets.id,
        range: `Marketing_Analisis!F${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[status]] }
      })
    }
    
    res.json({ success: true, status })
  } catch (error) {
    console.error('Error updating status:', error)
    res.json({ success: true, status: req.body.status })
  }
})

// ============================================
// DROPI ROUTES
// ============================================

// Buscar productos en el catálogo de Dropi
app.get('/api/dropi/search', async (req, res) => {
  console.log('=== DROPI SEARCH ===')
  const { query } = req.query
  console.log('Search query:', query)
  
  try {
    // Si hay API de Dropi configurada, usarla
    if (process.env.DROPI_API_URL && process.env.DROPI_API_KEY) {
      const response = await fetch(`${process.env.DROPI_API_URL}/products/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${process.env.DROPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        return res.json({ products: data.products || data })
      }
    }
    
    // Si no hay API configurada, devolver datos demo
    console.log('Dropi API not configured, returning demo data')
    const demoProducts = [
      {
        id: 'dropi-1',
        name: query || 'Producto Similar 1',
        image: null,
        price: 15990,
        suggestedPrice: 29990,
        sku: 'DRP-001',
        stock: 50,
        description: 'Producto de alta calidad'
      },
      {
        id: 'dropi-2',
        name: `${query || 'Producto'} Premium`,
        image: null,
        price: 19990,
        suggestedPrice: 39990,
        sku: 'DRP-002',
        stock: 30,
        description: 'Versión premium con características mejoradas'
      },
      {
        id: 'dropi-3',
        name: `${query || 'Producto'} Básico`,
        image: null,
        price: 9990,
        suggestedPrice: 19990,
        sku: 'DRP-003',
        stock: 100,
        description: 'Opción económica'
      }
    ]
    
    res.json({ products: demoProducts })
  } catch (error) {
    console.error('Dropi search error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Publicar producto de Dropi en la tienda
app.post('/api/dropi/publish', async (req, res) => {
  console.log('=== DROPI PUBLISH ===')
  const { dropiProductId, price, name } = req.body
  console.log('Publishing:', { dropiProductId, price, name })
  
  try {
    // Si hay API de Dropi configurada, usarla
    if (process.env.DROPI_API_URL && process.env.DROPI_API_KEY) {
      // Primero importar el producto de Dropi a WooCommerce
      const response = await fetch(`${process.env.DROPI_API_URL}/products/${dropiProductId}/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DROPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          price: price,
          store_url: config.woocommerce.url
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        return res.json({ 
          success: true, 
          productId: data.product_id,
          message: 'Producto importado correctamente'
        })
      }
    }
    
    // Si hay WooCommerce configurado, crear producto directamente
    if (config.woocommerce.url && config.woocommerce.consumerKey) {
      const wooProduct = await createWooProduct({
        name: name,
        type: 'simple',
        regular_price: String(price),
        status: 'publish',
        meta_data: [
          { key: '_dropi_product_id', value: dropiProductId }
        ]
      })
      
      return res.json({
        success: true,
        productId: wooProduct.id,
        message: 'Producto creado en WooCommerce'
      })
    }
    
    // Demo mode
    console.log('No Dropi/WooCommerce API configured, demo mode')
    res.json({
      success: true,
      productId: 'demo-' + Date.now(),
      message: 'Producto importado (modo demo)'
    })
  } catch (error) {
    console.error('Dropi publish error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// START SERVER
// ============================================

async function start() {
  // Initialize Auth
  initAuth()
  
  // Initialize Google Sheets
  await initGoogleSheets()
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           DropShip Manager Backend v1.1                    ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                               ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(20)}            ║
║  Auth: Enabled                                             ║
╠════════════════════════════════════════════════════════════╣
║  Default admin: admin                                      ║
║  ⚠️  Change password on first login!                        ║
╚════════════════════════════════════════════════════════════╝
    `)
  })
}

start()
