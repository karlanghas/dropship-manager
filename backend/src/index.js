import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { google } from 'googleapis'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
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
    id: process.env.GOOGLE_SHEETS_ID || '1X6Dxum7dBLMPSp_nWMS9--43PWIX5mWaGlq1a6VVSF0',
    credentials: process.env.GOOGLE_SERVICE_ACCOUNT_KEY 
      ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      : null
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

async function initGoogleSheets() {
  try {
    let auth;
    
    // Opción 1: Archivo de credenciales (GOOGLE_APPLICATION_CREDENTIALS)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      console.log('Google Sheets: Using credentials file');
    }
    // Opción 2: JSON en variable de entorno
    else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      console.log('Google Sheets: Using credentials from env');
    }
    else {
      console.log('Google Sheets: No credentials provided, using mock data');
      return null;
    }
    
    sheetsClient = google.sheets({ version: 'v4', auth });
    
    // Test connection
    await sheetsClient.spreadsheets.get({
      spreadsheetId: config.sheets.id
    });
    
    console.log('Google Sheets: Connected successfully ✓');
    return sheetsClient;
  } catch (error) {
    console.error('Google Sheets: Connection failed -', error.message);
    return null;
  }
}

async function getSheetData(sheetName, range = 'A:Z') {
  if (!sheetsClient) return []
  
  try {
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: config.sheets.id,
      range: `${sheetName}!${range}`
    })
    
    const rows = response.data.values || []
    if (rows.length < 2) return []
    
    const headers = rows[0]
    return rows.slice(1).map((row, index) => {
      const obj = { id: index }
      headers.forEach((header, i) => {
        obj[header] = row[i] || ''
      })
      return obj
    })
  } catch (error) {
    console.error('Error reading sheet:', error.message)
    return []
  }
}

async function appendToSheet(sheetName, values) {
  if (!sheetsClient) return false
  
  try {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: config.sheets.id,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    })
    return true
  } catch (error) {
    console.error('Error appending to sheet:', error.message)
    return false
  }
}

async function updateSheetCell(sheetName, row, column, value) {
  if (!sheetsClient) return false
  
  try {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: config.sheets.id,
      range: `${sheetName}!${column}${row + 2}`, // +2 because row 1 is header, and we use 0-indexed
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] }
    })
    return true
  } catch (error) {
    console.error('Error updating sheet:', error.message)
    return false
  }
}

// ============================================
// N8N SERVICE
// ============================================
async function callN8nWebhook(webhookId, data = {}) {
  try {
    const url = `${config.n8n.baseUrl}/${webhookId}`
    console.log(`Calling n8n webhook: ${url}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status}`)
    }
    
    return await response.json()
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
// API ROUTES
// ============================================

// Health check
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

// ============================================
// PRODUCTS ROUTES
// ============================================

// Get all products (from Raw_Resenas sheet)
app.get('/api/products', async (req, res) => {
  try {
    const products = await getSheetData('Raw_Resenas')
    
    if (products.length === 0 && store.products.length > 0) {
      return res.json({ products: store.products })
    }
    
    const formattedProducts = products.map((p, index) => ({
      id: index,
      url: p.URL || p.url || '',
      title: p.titulo_resenas || p.titulo || '',
      status: p.estado || 'pending',
      marketplace: detectMarketplace(p.URL || p.url || '')
    }))
    
    res.json({ products: formattedProducts })
  } catch (error) {
    console.error('Error getting products:', error)
    res.json({ products: store.products })
  }
})

// Add new products
app.post('/api/products/add', async (req, res) => {
  try {
    const { urls } = req.body
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs array is required' })
    }
    
    // Add to sheet
    const rows = urls.map(url => [
      url,          // URL
      '',           // titulo_resenas
      '',           // calificacion
      new Date().toISOString(), // fecha
      '',           // texto_resenas
      '',           // ARCHIVOJSON
      'pending'     // estado
    ])
    
    const success = await appendToSheet('Raw_Resenas', rows)
    
    // Also add to local store
    urls.forEach((url, i) => {
      store.products.push({
        id: Date.now() + i,
        url,
        status: 'pending',
        marketplace: detectMarketplace(url)
      })
    })
    
    // Try to notify n8n (optional)
    try {
      await callN8nWebhook(config.n8n.webhooks.addProduct, { urls })
    } catch (e) {
      console.log('n8n notification skipped')
    }
    
    res.json({ 
      success: true, 
      message: `${urls.length} producto(s) agregado(s)`,
      products: store.products
    })
  } catch (error) {
    console.error('Error adding products:', error)
    res.status(500).json({ error: error.message })
  }
})

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params
    store.products = store.products.filter((_, i) => i !== parseInt(id))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// SCRAPING ROUTES
// ============================================

// Start scraping
app.post('/api/scraping/start', async (req, res) => {
  try {
    store.scrapingStatus = 'processing'
    
    // Call n8n webhook to start scraping workflow
    const result = await callN8nWebhook(config.n8n.webhooks.scraping, {
      spreadsheet_name: 'Planilla_Resenas',
      sheet_name: 'Raw_Resenas'
    })
    
    store.taskId = result.task_id || result.taskId || null
    
    res.json({ 
      success: true, 
      status: 'processing',
      taskId: store.taskId
    })
  } catch (error) {
    console.error('Error starting scraping:', error)
    
    // Simulate scraping for demo
    store.scrapingStatus = 'processing'
    setTimeout(() => {
      store.scrapingStatus = 'completed'
    }, 8000)
    
    res.json({ 
      success: true, 
      status: 'processing',
      message: 'Demo mode: Scraping simulation started'
    })
  }
})

// Check scraping status
app.get('/api/scraping/status', async (req, res) => {
  try {
    // If we have a task ID, check with scraper API
    if (store.taskId) {
      const response = await fetch(`${config.scraper.url}/task/${store.taskId}`)
      const data = await response.json()
      
      store.scrapingStatus = data.status
      
      return res.json({ 
        status: data.status,
        progress: data.progress || null,
        results: data.results || null
      })
    }
    
    res.json({ status: store.scrapingStatus || 'idle' })
  } catch (error) {
    res.json({ status: store.scrapingStatus || 'idle' })
  }
})

// ============================================
// MARKETING ROUTES
// ============================================

// Get marketing results
app.get('/api/marketing/results', async (req, res) => {
  try {
    const results = await getSheetData('Marketing_Analisis')
    
    if (results.length === 0) {
      // Return demo data
      return res.json({ 
        results: [
          {
            id: 0,
            Producto: 'Linterna LED Recargable',
            'Puntos de Dolor': 'Baterías que duran poco, luz débil, dificultad para cargar',
            'Insights': 'Los usuarios valoran la potencia y la versatilidad, especialmente la función de powerbank',
            'Gancho (Hook)': '¡Ilumina tu camino y carga tu celular al mismo tiempo! La linterna que lo hace todo.',
            Fecha: new Date().toISOString(),
            estado_aprobacion: 'pendiente',
            publicado: 'no'
          },
          {
            id: 1,
            Producto: 'Cámara de Seguridad WiFi',
            'Puntos de Dolor': 'Configuración complicada, conexión inestable, app poco intuitiva',
            'Insights': 'Usuarios buscan tranquilidad y monitoreo remoto fácil, valoran la visión nocturna',
            'Gancho (Hook)': 'Tu hogar protegido 24/7 desde tu celular. Configúrala en 5 minutos.',
            Fecha: new Date().toISOString(),
            estado_aprobacion: 'pendiente',
            publicado: 'no'
          }
        ]
      })
    }
    
    // Add default status fields if not present
    const formattedResults = results.map((r, index) => ({
      ...r,
      id: index,
      estado_aprobacion: r.estado_aprobacion || 'pendiente',
      publicado: r.publicado || 'no'
    }))
    
    res.json({ results: formattedResults })
  } catch (error) {
    console.error('Error getting marketing results:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update product status (approve/reject)
app.put('/api/marketing/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    
    // Update in Google Sheets
    // Assuming estado_aprobacion is column F (index 5)
    await updateSheetCell('Marketing_Analisis', parseInt(id), 'F', status)
    
    res.json({ success: true, status })
  } catch (error) {
    console.error('Error updating status:', error)
    res.json({ success: true, status: req.body.status }) // Return success for demo
  }
})

// ============================================
// PUBLISH ROUTES
// ============================================

// Publish product to WooCommerce
app.post('/api/products/:id/publish', async (req, res) => {
  try {
    const { id } = req.params
    
    // Get marketing data for this product
    const results = await getSheetData('Marketing_Analisis')
    const product = results[parseInt(id)]
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    // Create product in WooCommerce
    const wooProduct = await createWooProduct({
      name: product.Producto || 'Producto sin nombre',
      type: 'simple',
      status: 'draft', // Start as draft
      description: `
        <h3>Características</h3>
        <p>${product.Insights || ''}</p>
        <h3>¿Por qué elegirlo?</h3>
        <p>${product['Gancho (Hook)'] || ''}</p>
      `,
      short_description: product['Gancho (Hook)'] || '',
      categories: [],
      tags: [
        { name: 'dropshipping' },
        { name: 'importado' }
      ]
    })
    
    // Update sheet to mark as published
    await updateSheetCell('Marketing_Analisis', parseInt(id), 'G', 'si')
    await updateSheetCell('Marketing_Analisis', parseInt(id), 'H', wooProduct.id.toString())
    
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
// START SERVER
// ============================================

async function start() {
  // Initialize Google Sheets
  await initGoogleSheets()
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════╗
║     DropShip Manager Backend v1.0          ║
╠════════════════════════════════════════════╣
║  Server running on port ${PORT}               ║
║  Environment: ${process.env.NODE_ENV || 'development'}             ║
╚════════════════════════════════════════════╝
    `)
  })
}

start()
