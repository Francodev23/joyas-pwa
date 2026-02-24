import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-bg-dark to-bg-darker">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light text-gold-light mb-2 tracking-wider">
            Joyas
          </h1>
          <p className="text-gold-main text-sm tracking-widest uppercase">
            Control de Ventas
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                style={{ fontSize: '16px' }}
                placeholder="Tu nombre de usuario"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                style={{ fontSize: '16px' }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Iniciando sesión...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-gold-deep text-xs mt-8 italic">
          Hecho con amor para organizar tus brillos ✨
        </p>
      </div>
    </div>
  )
}

