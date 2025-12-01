# DropShip Manager 🚀

Sistema completo para gestión de productos dropshipping con análisis de reseñas e insights de marketing generados por IA.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Docker](https://img.shields.io/badge/docker-ready-green)
![Raspberry Pi](https://img.shields.io/badge/raspberry%20pi-compatible-red)

## 📋 Características

- ✅ **Ingreso de productos**: Agrega URLs de productos desde cualquier marketplace
- ✅ **Scraping automático**: Extrae reseñas de MercadoLibre, Amazon y más
- ✅ **Análisis con IA**: Genera insights, pain points y hooks publicitarios
- ✅ **Aprobación de productos**: Revisa y aprueba productos antes de publicar
- ✅ **Publicación en WooCommerce**: Crea productos directamente en tu tienda
- ✅ **Interfaz responsive**: Funciona en desktop y móvil
- ✅ **Modo oscuro/claro**: Para tu comodidad visual

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│                    Puerto 3000 - Nginx                           │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js/Express)                     │
│                         Puerto 3001                              │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │   n8n    │  │  Google  │  │   Woo    │
              │ Webhooks │  │  Sheets  │  │ Commerce │
              └──────────┘  └──────────┘  └──────────┘
```

## 🚀 Instalación Rápida (Docker)

### Prerrequisitos

- Docker y Docker Compose instalados
- n8n funcionando (con tu flujo de scraping)
- Cuenta de Google Cloud (para Sheets API)
- Tienda WooCommerce (opcional)

### Pasos

1. **Clona o descarga el proyecto**
   ```bash
   # Si tienes git
   git clone <tu-repo>
   cd dropship-manager
   
   # O descomprime el ZIP
   unzip dropship-manager.zip
   cd dropship-manager
   ```

2. **Configura las variables de entorno**
   ```bash
   cp .env.example .env
   nano .env  # Edita con tus valores
   ```

3. **Construye y ejecuta con Docker**
   ```bash
   docker-compose up -d --build
   ```

4. **Accede a la aplicación**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api/health

## ⚙️ Configuración

### Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `N8N_WEBHOOK_BASE_URL` | URL base de webhooks n8n | `http://192.168.0.111:5678/webhook` |
| `N8N_WEBHOOK_SCRAPING` | ID del webhook de scraping | `711c69a4-3f91-4fd4-...` |
| `GOOGLE_SHEETS_ID` | ID de tu planilla | `1X6Dxum7dBLMPSp_nWMS9--43PWIX5mWaGlq1a6VVSF0` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON de credenciales | `{"type":"service_account",...}` |
| `WOO_URL` | URL de tu tienda | `https://mitienda.com` |
| `WOO_CONSUMER_KEY` | Consumer Key de WooCommerce | `ck_xxxxx` |
| `WOO_CONSUMER_SECRET` | Consumer Secret | `cs_xxxxx` |

### Google Sheets

Tu planilla debe tener las siguientes hojas:

#### Hoja: `Raw_Resenas`
| Columna | Descripción |
|---------|-------------|
| URL | Link del producto |
| titulo_resenas | Título extraído |
| calificacion | Rating del producto |
| fecha | Fecha de ingreso |
| texto_resenas | Contenido de reseñas |
| ARCHIVOJSON | Datos adicionales |
| estado | pending/processing/completed |

#### Hoja: `Marketing_Analisis`
| Columna | Descripción |
|---------|-------------|
| Producto | Nombre del producto |
| Puntos de Dolor | Pain points identificados |
| Insights | Insights de marketing |
| Gancho (Hook) | Frase publicitaria |
| Fecha | Fecha de análisis |
| estado_aprobacion | pendiente/aprobado/rechazado |
| publicado | si/no |
| woo_product_id | ID en WooCommerce |

### n8n Workflows

Importa los workflows desde la carpeta `n8n-workflows/`:

1. **add-product.json**: Webhook para agregar productos
2. **publish-woocommerce.json**: Webhook para publicar en WooCommerce

### WooCommerce API

Para habilitar la API de WooCommerce:

1. Ve a **WooCommerce > Ajustes > Avanzado > REST API**
2. Crea una nueva clave con permisos de **Lectura/Escritura**
3. Copia el Consumer Key y Consumer Secret

## 📱 Uso

### 1. Agregar Productos

1. Abre la app en tu navegador
2. En la pestaña "Productos", pega las URLs (una por línea)
3. Haz clic en "Agregar Productos"

### 2. Ejecutar Análisis

1. Con productos en la lista, haz clic en "Analizar Todos"
2. Espera mientras el sistema:
   - Hace scraping de reseñas
   - Analiza con IA
   - Genera insights y hooks

### 3. Revisar Resultados

1. Ve a la pestaña "Resultados"
2. Expande cada producto para ver:
   - Puntos de dolor
   - Insights
   - Hook publicitario
3. Aprueba o rechaza cada producto

### 4. Publicar

1. Para productos aprobados, haz clic en "Publicar en WooCommerce"
2. El producto se creará como borrador en tu tienda
3. Desde WooCommerce, puedes vincularlo con Dropi

## 🐳 Deploy en Raspberry Pi 5

### Con Portainer

1. Accede a Portainer
2. Ve a **Stacks > Add Stack**
3. Pega el contenido de `docker-compose.yml`
4. Agrega las variables de entorno
5. Deploy

### Manualmente

```bash
# En tu Raspberry Pi
cd /opt
git clone <tu-repo> dropship-manager
cd dropship-manager

# Configura
cp .env.example .env
nano .env

# Ejecuta
docker-compose up -d

# Ver logs
docker-compose logs -f
```

## 🔧 Desarrollo Local

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## 📊 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/products` | Lista de productos |
| POST | `/api/products/add` | Agregar productos |
| DELETE | `/api/products/:id` | Eliminar producto |
| POST | `/api/scraping/start` | Iniciar scraping |
| GET | `/api/scraping/status` | Estado del scraping |
| GET | `/api/marketing/results` | Resultados de marketing |
| PUT | `/api/marketing/:id/status` | Aprobar/rechazar |
| POST | `/api/products/:id/publish` | Publicar en WooCommerce |

## 🐛 Solución de Problemas

### El scraping no inicia
- Verifica que n8n esté funcionando
- Revisa que el webhook ID sea correcto
- Comprueba la conectividad de red

### No se conecta a Google Sheets
- Verifica las credenciales del Service Account
- Asegúrate de compartir la planilla con el email del Service Account

### Error al publicar en WooCommerce
- Verifica las credenciales de la API
- Asegúrate de tener permisos de escritura
- Revisa que la URL de la tienda sea correcta

## 📝 Licencia

MIT License - Usa este proyecto como quieras.

## 🤝 Soporte

¿Problemas o sugerencias? Abre un issue o contacta al desarrollador.

---

Desarrollado con ❤️ para optimizar tu negocio de dropshipping
