import React, { useState, useEffect, createContext, useContext } from 'react'
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
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Target,
  Zap,
  RefreshCw,
  Trash2,
  Eye,
  ShoppingCart,
  LogIn,
  LogOut,
  User,
  Users,
  Lock,
  Unlock,
  Key,
  Shield,
  EyeOff,
  Settings,
  X
} from 'lucide-react'

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.0.111:3201/api'

// ============================================
// AUTH CONTEXT
// ============================================
const AuthContext = createContext(null)

function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      verifyToken()
    } else {
      setLoading(false)
    }
  }, [])

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      }
    } catch (error) {
      console.error('Token verification failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    
    const data = await response.json()
    
    if (data.success) {
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setUser(data.user)
      return { success: true }
    }
    
    return data
  }

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
    
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================
// API HOOK
// ============================================
function useApi() {
  const { token, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const request = async (endpoint, options = {}) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...options.headers,
        },
        ...options,
      })
      
      if (response.status === 401) {
        logout()
        throw new Error('Sesión expirada')
      }
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error: ${response.status}`)
      }
      
      return await response.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { request, loading, error }
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================
function useNotifications() {
  const [notifications, setNotifications] = useState([])

  const addNotification = (notification) => {
    const id = Date.now()
    setNotifications(prev => [...prev, { ...notification, id }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  return { notifications, addNotification }
}

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

// ============================================
// LOGIN SCREEN
// ============================================
function LoginScreen({ onLogin, addNotification }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await onLogin(username, password)
      
      if (!result.success) {
        setError(result.error || 'Error de autenticación')
        if (result.remainingAttempts !== null && result.remainingAttempts !== undefined) {
          setError(`${result.error}. Intentos restantes: ${result.remainingAttempts}`)
        }
        if (result.locked) {
          addNotification({ type: 'error', message: 'Cuenta bloqueada' })
        }
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-900 dark:to-surface-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display font-bold text-3xl text-surface-900 dark:text-white">DropShip Manager</h1>
          <p className="text-surface-500 dark:text-surface-400 mt-2">Inicia sesión para continuar</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="card p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Usuario
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-12"
                  placeholder="Tu nombre de usuario"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-12 pr-12"
                  placeholder="Tu contraseña"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
          DropShip Manager v1.1
        </p>
      </div>
    </div>
  )
}

// ============================================
// USER MANAGEMENT MODAL
// ============================================
function UserManagementModal({ isOpen, onClose, addNotification }) {
  const api = useApi()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [passwordErrors, setPasswordErrors] = useState([])

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await api.request('/users')
      setUsers(data.users || [])
    } catch (error) {
      addNotification({ type: 'error', message: 'Error cargando usuarios' })
    } finally {
      setLoading(false)
    }
  }

  const validatePassword = async (password) => {
    try {
      const response = await fetch(`${API_URL}/auth/validate-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await response.json()
      setPasswordErrors(data.errors || [])
      return data.valid
    } catch {
      return false
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    
    const isValid = await validatePassword(newUser.password)
    if (!isValid) {
      addNotification({ type: 'error', message: 'La contraseña no cumple los requisitos' })
      return
    }

    try {
      await api.request('/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      })
      addNotification({ type: 'success', message: 'Usuario creado correctamente' })
      setNewUser({ username: '', password: '', role: 'user' })
      setShowCreateForm(false)
      loadUsers()
    } catch (error) {
      addNotification({ type: 'error', message: error.message })
    }
  }

  const handleDeleteUser = async (username) => {
    if (!confirm(`¿Estás seguro de eliminar a ${username}?`)) return

    try {
      await api.request(`/users/${username}`, { method: 'DELETE' })
      addNotification({ type: 'success', message: 'Usuario eliminado' })
      loadUsers()
    } catch (error) {
      addNotification({ type: 'error', message: error.message })
    }
  }

  const handleUnlockUser = async (username) => {
    try {
      await api.request(`/users/${username}/unlock`, { method: 'POST' })
      addNotification({ type: 'success', message: 'Usuario desbloqueado' })
      loadUsers()
    } catch (error) {
      addNotification({ type: 'error', message: error.message })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-xl">Gestión de Usuarios</h2>
              <p className="text-sm text-surface-500">{users.length} usuario(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Create User Button */}
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary w-full"
            >
              <Plus className="w-4 h-4" />
              Crear Usuario
            </button>
          )}

          {/* Create User Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800 space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Usuario
              </h3>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="input"
                  required
                  minLength={3}
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="input"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              
              <input
                type="password"
                placeholder="Contraseña"
                value={newUser.password}
                onChange={(e) => {
                  setNewUser({ ...newUser, password: e.target.value })
                  validatePassword(e.target.value)
                }}
                className="input"
                required
              />
              
              {passwordErrors.length > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  {passwordErrors.map((err, i) => (
                    <p key={i} className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      {err}
                    </p>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Users List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.username}
                  className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      user.role === 'admin' 
                        ? 'bg-accent-100 dark:bg-accent-900/30' 
                        : 'bg-surface-200 dark:bg-surface-700'
                    }`}>
                      {user.role === 'admin' 
                        ? <Shield className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                        : <User className="w-5 h-5 text-surface-500" />
                      }
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {user.username}
                        {user.role === 'admin' && (
                          <span className="badge badge-info">Admin</span>
                        )}
                        {user.isLocked && (
                          <span className="badge badge-error">Bloqueado</span>
                        )}
                      </p>
                      <p className="text-sm text-surface-500">
                        {user.lastLogin 
                          ? `Último acceso: ${new Date(user.lastLogin).toLocaleString()}`
                          : 'Sin accesos'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.isLocked && (
                      <button
                        onClick={() => handleUnlockUser(user.username)}
                        className="btn-ghost p-2 rounded-lg text-green-600"
                        title="Desbloquear"
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    )}
                    {user.username !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(user.username)}
                        className="btn-ghost p-2 rounded-lg text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// CHANGE PASSWORD MODAL
// ============================================
function ChangePasswordModal({ isOpen, onClose, addNotification }) {
  const { token } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState([])

  const validatePassword = async (password) => {
    try {
      const response = await fetch(`${API_URL}/auth/validate-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await response.json()
      setPasswordErrors(data.errors || [])
      return data.valid
    } catch {
      return false
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      addNotification({ type: 'error', message: 'Las contraseñas no coinciden' })
      return
    }

    const isValid = await validatePassword(newPassword)
    if (!isValid) {
      addNotification({ type: 'error', message: 'La contraseña no cumple los requisitos' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const data = await response.json()

      if (response.ok) {
        addNotification({ type: 'success', message: 'Contraseña actualizada correctamente' })
        onClose()
      } else {
        addNotification({ type: 'error', message: data.error || 'Error al cambiar contraseña' })
      }
    } catch (error) {
      addNotification({ type: 'error', message: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-fade-in">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-primary-600" />
            <h2 className="font-display font-semibold text-xl">Cambiar Contraseña</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Contraseña actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                validatePassword(e.target.value)
              }}
              className="input"
              required
            />
            {passwordErrors.length > 0 && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400 space-y-1">
                {passwordErrors.map((err, i) => (
                  <p key={i} className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`input ${confirmPassword && newPassword !== confirmPassword ? 'input-error' : ''}`}
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// HEADER
// ============================================
function Header({ darkMode, setDarkMode, activeTab, setActiveTab }) {
  const { user, logout, isAdmin } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const { notifications, addNotification } = useNotifications()

  const tabs = [
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'results', label: 'Resultados', icon: TrendingUp },
  ]

  return (
    <>
      <Notifications notifications={notifications} />
      <UserManagementModal
        isOpen={showUserManagement}
        onClose={() => setShowUserManagement(false)}
        addNotification={addNotification}
      />
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        addNotification={addNotification}
      />

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

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    {isAdmin ? (
                      <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    ) : (
                      <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">{user?.username}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 card p-2 shadow-lg animate-fade-in">
                    <div className="px-3 py-2 border-b mb-2">
                      <p className="font-medium">{user?.username}</p>
                      <p className="text-xs text-surface-500">{isAdmin ? 'Administrador' : 'Usuario'}</p>
                    </div>
                    
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          setShowUserManagement(true)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Gestión de Usuarios</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        setShowChangePassword(true)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                      <Key className="w-4 h-4" />
                      <span className="text-sm">Cambiar Contraseña</span>
                    </button>
                    
                    <hr className="my-2" />
                    
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        logout()
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
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
    </>
  )
}

// ============================================
// PRODUCT FORM
// ============================================
function ProductForm({ onAddProduct, loading }) {
  const [urls, setUrls] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const urlList = urls
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      setError('Ingresa al menos una URL')
      return
    }

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
            placeholder="Pega las URLs de los productos (una por línea)"
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

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Agregando...</>
          ) : (
            <><Plus className="w-4 h-4" /> Agregar Productos</>
          )}
        </button>
      </div>
    </form>
  )
}

// ============================================
// PRODUCT LIST
// ============================================
function ProductList({ products, onRunScraping, onRemoveProduct, scrapingStatus, loading }) {
  if (products.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
          <Package className="w-8 h-8 text-surface-400" />
        </div>
        <h3 className="font-display font-semibold text-lg mb-2">Sin productos</h3>
        <p className="text-surface-500 dark:text-surface-400">
          Agrega URLs de productos para comenzar
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
            <p className="text-sm text-surface-500">{products.length} producto(s)</p>
          </div>
        </div>

        <button
          onClick={onRunScraping}
          disabled={loading || scrapingStatus === 'processing'}
          className="btn-accent"
        >
          {scrapingStatus === 'processing' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
          ) : (
            <><Play className="w-4 h-4" /> Analizar Todos</>
          )}
        </button>
      </div>

      {scrapingStatus === 'processing' && (
        <div className="p-4 bg-accent-50 dark:bg-accent-900/20 border-b">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-accent-600" />
            <div>
              <p className="font-medium text-accent-700 dark:text-accent-300">Analizando productos...</p>
              <p className="text-sm text-accent-600">Esto puede tomar unos minutos</p>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y max-h-96 overflow-y-auto scrollbar-thin">
        {products.map((product, index) => (
          <div key={product.id || index} className="p-4 flex items-center gap-4 hover:bg-surface-50 dark:hover:bg-surface-800/50">
            <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <span className="font-mono text-sm">{index + 1}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm truncate">{product.url}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge ${
                  product.status === 'pending' ? 'badge-warning' :
                  product.status === 'completed' ? 'badge-success' : 'badge-error'
                }`}>
                  {product.status}
                </span>
                {product.marketplace && <span className="badge badge-neutral">{product.marketplace}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a href={product.url} target="_blank" className="btn-ghost p-2 rounded-lg">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => onRemoveProduct(product.id || index)} className="btn-ghost p-2 rounded-lg text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// MARKETING RESULTS
// ============================================
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
        <p className="text-surface-500">Los resultados aparecerán aquí</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Todos', count: results.length },
          { id: 'pending', label: 'Pendientes', count: results.filter(r => r.estado_aprobacion === 'pendiente').length },
          { id: 'approved', label: 'Aprobados', count: results.filter(r => r.estado_aprobacion === 'aprobado').length },
          { id: 'rejected', label: 'Rechazados', count: results.filter(r => r.estado_aprobacion === 'rechazado').length },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.id 
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600'
            }`}
          >
            {f.label}
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-surface-900 text-xs">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="grid gap-4">
        {filteredResults.map((result, index) => (
          <div key={result.id || index} className="card-hover overflow-hidden">
            <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === index ? null : index)}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-display font-semibold text-lg">{result.Producto || 'Producto'}</h4>
                    <span className={`badge ${
                      result.estado_aprobacion === 'pendiente' ? 'badge-warning' :
                      result.estado_aprobacion === 'aprobado' ? 'badge-success' : 'badge-error'
                    }`}>
                      {result.estado_aprobacion || 'pendiente'}
                    </span>
                    {result.publicado === 'si' && <span className="badge badge-info">Publicado</span>}
                  </div>
                  
                  {result['Gancho (Hook)'] && (
                    <p className="mt-2 text-sm text-surface-600 dark:text-surface-300 line-clamp-2">
                      <span className="font-medium text-accent-600">Hook:</span> {result['Gancho (Hook)']}
                    </p>
                  )}
                </div>

                <Eye className={`w-5 h-5 transition-transform ${expandedId === index ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {expandedId === index && (
              <div className="px-4 pb-4 space-y-4 animate-fade-in">
                <hr />
                
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-red-600" />
                    <h5 className="font-medium text-red-700 dark:text-red-300">Puntos de Dolor</h5>
                  </div>
                  <p className="text-sm text-red-600">{result['Puntos de Dolor'] || 'Sin datos'}</p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <h5 className="font-medium text-blue-700 dark:text-blue-300">Insights</h5>
                  </div>
                  <p className="text-sm text-blue-600">{result['Insights'] || 'Sin datos'}</p>
                </div>

                <div className="p-4 rounded-xl bg-accent-50 dark:bg-accent-900/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-accent-600" />
                    <h5 className="font-medium text-accent-700 dark:text-accent-300">Gancho Publicitario</h5>
                  </div>
                  <p className="text-sm text-accent-600 font-medium">"{result['Gancho (Hook)'] || 'Sin datos'}"</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {result.estado_aprobacion !== 'aprobado' && (
                    <button onClick={() => onApprove(result.id || index)} disabled={loading} className="btn-primary flex-1 sm:flex-none">
                      <CheckCircle className="w-4 h-4" /> Aprobar
                    </button>
                  )}
                  
                  {result.estado_aprobacion !== 'rechazado' && (
                    <button onClick={() => onReject(result.id || index)} disabled={loading} className="btn-danger flex-1 sm:flex-none">
                      <XCircle className="w-4 h-4" /> Rechazar
                    </button>
                  )}

                  {result.estado_aprobacion === 'aprobado' && result.publicado !== 'si' && (
                    <button onClick={() => onPublish(result.id || index)} disabled={loading} className="btn-accent flex-1 sm:flex-none">
                      <Upload className="w-4 h-4" /> Publicar en WooCommerce
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

// ============================================
// MAIN APP CONTENT
// ============================================
function AppContent() {
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [activeTab, setActiveTab] = useState('products')
  const [products, setProducts] = useState([])
  const [marketingResults, setMarketingResults] = useState([])
  const [scrapingStatus, setScrapingStatus] = useState(null)
  
  const { notifications, addNotification } = useNotifications()
  const api = useApi()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    loadProducts()
    loadMarketingResults()
  }, [])

  const loadProducts = async () => {
    try {
      const data = await api.request('/products')
      setProducts(data.products || [])
    } catch (err) {
      console.error('Error loading products:', err)
    }
  }

  const loadMarketingResults = async () => {
    try {
      const data = await api.request('/marketing/results')
      setMarketingResults(data.results || [])
    } catch (err) {
      console.error('Error loading results:', err)
    }
  }

  const handleAddProduct = async (urls) => {
    try {
      await api.request('/products/add', {
        method: 'POST',
        body: JSON.stringify({ urls }),
      })
      addNotification({ type: 'success', message: `${urls.length} producto(s) agregado(s)` })
      loadProducts()
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Error al agregar productos' })
    }
  }

  const handleRemoveProduct = async (productId) => {
    try {
      await api.request(`/products/${productId}`, { method: 'DELETE' })
      addNotification({ type: 'info', message: 'Producto eliminado' })
      loadProducts()
    } catch (err) {
      addNotification({ type: 'error', message: err.message })
    }
  }

  const handleRunScraping = async () => {
    try {
      setScrapingStatus('processing')
      await api.request('/scraping/start', { method: 'POST' })
      addNotification({ type: 'info', message: 'Análisis iniciado' })
      
      setTimeout(() => {
        setScrapingStatus('completed')
        addNotification({ type: 'success', message: 'Análisis completado' })
        loadMarketingResults()
        setActiveTab('results')
      }, 10000)
    } catch (err) {
      addNotification({ type: 'error', message: 'Error al iniciar análisis' })
      setScrapingStatus('error')
    }
  }

  const handleApprove = async (resultId) => {
    try {
      await api.request(`/marketing/${resultId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'aprobado' }),
      })
      addNotification({ type: 'success', message: 'Producto aprobado' })
      loadMarketingResults()
    } catch (err) {
      addNotification({ type: 'error', message: err.message })
    }
  }

  const handleReject = async (resultId) => {
    try {
      await api.request(`/marketing/${resultId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rechazado' }),
      })
      addNotification({ type: 'info', message: 'Producto rechazado' })
      loadMarketingResults()
    } catch (err) {
      addNotification({ type: 'error', message: err.message })
    }
  }

  const handlePublish = async (resultId) => {
    try {
      addNotification({ type: 'info', message: 'Publicando en WooCommerce...' })
      await api.request(`/products/${resultId}/publish`, { method: 'POST' })
      addNotification({ type: 'success', message: 'Producto publicado' })
      loadMarketingResults()
    } catch (err) {
      addNotification({ type: 'error', message: err.message })
    }
  }

  return (
    <div className="min-h-screen">
      <Notifications notifications={notifications} />
      
      <Header 
        darkMode={darkMode} 
        setDarkMode={setDarkMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'products' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <ProductForm onAddProduct={handleAddProduct} loading={api.loading} />
            <ProductList 
              products={products}
              onRunScraping={handleRunScraping}
              onRemoveProduct={handleRemoveProduct}
              scrapingStatus={scrapingStatus}
              loading={api.loading}
            />
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-2xl">Resultados de Marketing</h2>
                <p className="text-surface-500">Insights y hooks generados por IA</p>
              </div>
              <button onClick={loadMarketingResults} className="btn-secondary">
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            </div>
            
            <MarketingResults 
              results={marketingResults}
              onApprove={handleApprove}
              onReject={handleReject}
              onPublish={handlePublish}
              loading={api.loading}
            />
          </div>
        )}
      </main>

      <footer className="border-t py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-surface-500">
          DropShip Manager v1.1 • Con autenticación
        </div>
      </footer>
    </div>
  )
}

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const { notifications, addNotification } = useNotifications()

  return (
    <AuthProvider>
      <AuthConsumer addNotification={addNotification} notifications={notifications} />
    </AuthProvider>
  )
}

function AuthConsumer({ addNotification, notifications }) {
  const { user, loading, login } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-100 dark:bg-surface-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <Notifications notifications={notifications} />
        <LoginScreen onLogin={login} addNotification={addNotification} />
      </>
    )
  }

  return <AppContent />
}
