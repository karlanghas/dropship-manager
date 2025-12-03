// ============================================
// AUTH SERVICE - Autenticación Local
// ============================================
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Archivo para persistir usuarios (en producción usar una BD)
const USERS_FILE = process.env.USERS_FILE || '/app/data/users.json'

// Configuración
const AUTH_CONFIG = {
  maxFailedAttempts: 6,
  lockoutDuration: 30 * 60 * 1000, // 30 minutos en ms
  tokenExpiry: 24 * 60 * 60 * 1000, // 24 horas en ms
  passwordMinLength: 8,
  passwordRequirements: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  }
}

// Store de usuarios en memoria (se sincroniza con archivo)
let users = {}
let sessions = {}

// ============================================
// INICIALIZACIÓN
// ============================================
export function initAuth() {
  loadUsers()
  
  // Crear usuario admin por defecto si no existe
  if (!users['admin']) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123456'
    console.log('Creating default admin user...')
    
    // Validar que la contraseña por defecto sea compleja
    if (!validatePasswordComplexity(defaultPassword).valid) {
      console.error('Default admin password does not meet complexity requirements!')
      console.log('Using fallback password: Admin@123456')
      createUser('admin', 'Admin@123456', 'admin')
    } else {
      createUser('admin', defaultPassword, 'admin')
    }
    
    console.log('Default admin created. Username: admin')
    console.log('⚠️  IMPORTANTE: Cambia la contraseña del admin inmediatamente!')
  }
  
  console.log(`Auth initialized. Users loaded: ${Object.keys(users).length}`)
}

// ============================================
// GESTIÓN DE ARCHIVOS
// ============================================
function loadUsers() {
  try {
    // Asegurar que existe el directorio
    const dir = path.dirname(USERS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8')
      users = JSON.parse(data)
      console.log('Users loaded from file')
    } else {
      users = {}
      saveUsers()
    }
  } catch (error) {
    console.error('Error loading users:', error.message)
    users = {}
  }
}

function saveUsers() {
  try {
    const dir = path.dirname(USERS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // No guardar información sensible de sesiones en el archivo
    const usersToSave = {}
    for (const [username, user] of Object.entries(users)) {
      usersToSave[username] = {
        ...user,
        // Limpiar intentos fallidos antiguos al guardar
        failedAttempts: user.lockedUntil && user.lockedUntil > Date.now() ? user.failedAttempts : 0
      }
    }
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersToSave, null, 2))
  } catch (error) {
    console.error('Error saving users:', error.message)
  }
}

// ============================================
// UTILIDADES DE CONTRASEÑA
// ============================================
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return { hash, salt }
}

function verifyPassword(password, hash, salt) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return hash === verifyHash
}

export function validatePasswordComplexity(password) {
  const requirements = AUTH_CONFIG.passwordRequirements
  const errors = []
  
  if (password.length < requirements.minLength) {
    errors.push(`Mínimo ${requirements.minLength} caracteres`)
  }
  
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una mayúscula')
  }
  
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una minúscula')
  }
  
  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Debe contener al menos un número')
  }
  
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Debe contener al menos un carácter especial (!@#$%^&*...)')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

// ============================================
// GESTIÓN DE USUARIOS
// ============================================
export function createUser(username, password, role = 'user') {
  // Validar username
  if (!username || username.length < 3) {
    return { success: false, error: 'Username debe tener al menos 3 caracteres' }
  }
  
  if (users[username]) {
    return { success: false, error: 'El usuario ya existe' }
  }
  
  // Validar complejidad de contraseña
  const passwordValidation = validatePasswordComplexity(password)
  if (!passwordValidation.valid) {
    return { success: false, error: 'Contraseña no cumple requisitos', details: passwordValidation.errors }
  }
  
  const { hash, salt } = hashPassword(password)
  
  users[username] = {
    username,
    passwordHash: hash,
    salt,
    role, // 'admin' o 'user'
    createdAt: Date.now(),
    failedAttempts: 0,
    lockedUntil: null,
    lastLogin: null
  }
  
  saveUsers()
  console.log(`User created: ${username} (role: ${role})`)
  
  return { success: true, message: 'Usuario creado correctamente' }
}

export function updatePassword(username, newPassword) {
  if (!users[username]) {
    return { success: false, error: 'Usuario no encontrado' }
  }
  
  const passwordValidation = validatePasswordComplexity(newPassword)
  if (!passwordValidation.valid) {
    return { success: false, error: 'Contraseña no cumple requisitos', details: passwordValidation.errors }
  }
  
  const { hash, salt } = hashPassword(newPassword)
  users[username].passwordHash = hash
  users[username].salt = salt
  
  saveUsers()
  console.log(`Password updated for user: ${username}`)
  
  return { success: true, message: 'Contraseña actualizada' }
}

export function deleteUser(username) {
  if (username === 'admin') {
    return { success: false, error: 'No se puede eliminar el usuario admin' }
  }
  
  if (!users[username]) {
    return { success: false, error: 'Usuario no encontrado' }
  }
  
  delete users[username]
  
  // Eliminar sesiones del usuario
  for (const [token, session] of Object.entries(sessions)) {
    if (session.username === username) {
      delete sessions[token]
    }
  }
  
  saveUsers()
  console.log(`User deleted: ${username}`)
  
  return { success: true, message: 'Usuario eliminado' }
}

export function listUsers() {
  return Object.values(users).map(user => ({
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    isLocked: user.lockedUntil && user.lockedUntil > Date.now(),
    failedAttempts: user.failedAttempts
  }))
}

export function unlockUser(username) {
  if (!users[username]) {
    return { success: false, error: 'Usuario no encontrado' }
  }
  
  users[username].failedAttempts = 0
  users[username].lockedUntil = null
  
  saveUsers()
  console.log(`User unlocked: ${username}`)
  
  return { success: true, message: 'Usuario desbloqueado' }
}

// ============================================
// AUTENTICACIÓN
// ============================================
export function login(username, password) {
  console.log(`Login attempt for user: ${username}`)
  
  const user = users[username]
  
  if (!user) {
    console.log(`Login failed: User not found - ${username}`)
    return { success: false, error: 'Credenciales inválidas' }
  }
  
  // Verificar si está bloqueado (excepto admin)
  if (user.role !== 'admin' && user.lockedUntil && user.lockedUntil > Date.now()) {
    const remainingTime = Math.ceil((user.lockedUntil - Date.now()) / 60000)
    console.log(`Login failed: User locked - ${username}`)
    return { 
      success: false, 
      error: `Cuenta bloqueada. Intenta de nuevo en ${remainingTime} minutos`,
      locked: true
    }
  }
  
  // Verificar contraseña
  if (!verifyPassword(password, user.passwordHash, user.salt)) {
    // Incrementar intentos fallidos (excepto admin)
    if (user.role !== 'admin') {
      user.failedAttempts = (user.failedAttempts || 0) + 1
      console.log(`Failed attempt ${user.failedAttempts}/${AUTH_CONFIG.maxFailedAttempts} for user: ${username}`)
      
      if (user.failedAttempts >= AUTH_CONFIG.maxFailedAttempts) {
        user.lockedUntil = Date.now() + AUTH_CONFIG.lockoutDuration
        console.log(`User locked due to too many failed attempts: ${username}`)
        saveUsers()
        return { 
          success: false, 
          error: 'Cuenta bloqueada por demasiados intentos fallidos',
          locked: true
        }
      }
      
      saveUsers()
    }
    
    console.log(`Login failed: Invalid password - ${username}`)
    return { 
      success: false, 
      error: 'Credenciales inválidas',
      remainingAttempts: user.role !== 'admin' ? AUTH_CONFIG.maxFailedAttempts - user.failedAttempts : null
    }
  }
  
  // Login exitoso - resetear intentos fallidos
  user.failedAttempts = 0
  user.lockedUntil = null
  user.lastLogin = Date.now()
  saveUsers()
  
  // Generar token de sesión
  const token = generateToken()
  sessions[token] = {
    username,
    role: user.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + AUTH_CONFIG.tokenExpiry
  }
  
  console.log(`Login successful: ${username}`)
  
  return {
    success: true,
    token,
    user: {
      username: user.username,
      role: user.role
    }
  }
}

export function logout(token) {
  if (sessions[token]) {
    const username = sessions[token].username
    delete sessions[token]
    console.log(`Logout: ${username}`)
    return { success: true }
  }
  return { success: false, error: 'Sesión no encontrada' }
}

export function validateToken(token) {
  const session = sessions[token]
  
  if (!session) {
    return { valid: false, error: 'Token inválido' }
  }
  
  if (session.expiresAt < Date.now()) {
    delete sessions[token]
    return { valid: false, error: 'Token expirado' }
  }
  
  return {
    valid: true,
    user: {
      username: session.username,
      role: session.role
    }
  }
}

// ============================================
// MIDDLEWARE EXPRESS
// ============================================
export function authMiddleware(req, res, next) {
  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/api/auth/login', '/api/health']
  
  if (publicPaths.includes(req.path)) {
    return next()
  }
  
  // Obtener token del header
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }
  
  const token = authHeader.substring(7)
  const validation = validateToken(token)
  
  if (!validation.valid) {
    return res.status(401).json({ error: validation.error })
  }
  
  // Agregar información del usuario al request
  req.user = validation.user
  next()
}

// Middleware para verificar rol de admin
export function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Se requieren permisos de administrador' })
  }
  next()
}

// ============================================
// LIMPIEZA DE SESIONES EXPIRADAS
// ============================================
export function cleanExpiredSessions() {
  const now = Date.now()
  let cleaned = 0
  
  for (const [token, session] of Object.entries(sessions)) {
    if (session.expiresAt < now) {
      delete sessions[token]
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} expired sessions`)
  }
}

// Limpiar sesiones cada hora
setInterval(cleanExpiredSessions, 60 * 60 * 1000)
