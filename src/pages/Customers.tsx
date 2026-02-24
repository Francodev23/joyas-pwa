import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { format } from 'date-fns'

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ full_name: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [page, search])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const data = await api.getCustomers(page, 20, search || undefined)
      setCustomers(data.items)
      setTotalPages(data.total_pages)
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.createCustomer({
        full_name: formData.full_name,
        phone: formData.phone || undefined
      })
      setFormData({ full_name: '', phone: '' })
      setShowForm(false)
      loadCustomers()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error al crear el cliente')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pb-6 max-w-full overflow-x-hidden">
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className="text-white/60 text-sm"
            >
              ← Volver
            </button>
            <h1 className="text-xl font-semibold text-gold-light flex-1 text-center">Clientes</h1>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-gold-main text-black px-4 py-2 rounded-xl font-semibold text-sm"
            >
              + Nuevo
            </button>
          </div>

          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="input-field"
            style={{ fontSize: '16px' }}
          />
        </div>
      </div>

      {showForm && (
        <div className="px-4 pt-6">
          <div className="card">
            <h2 className="text-gold-main text-xs uppercase tracking-wider mb-4">Nuevo Cliente</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/60 text-xs mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input-field"
                  style={{ fontSize: '16px' }}
                  required
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">Teléfono (opcional)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 text-sm py-2"
                >
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ full_name: '', phone: '' })
                  }}
                  className="btn-secondary flex-1 text-sm py-2"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="px-4 py-6">
        {loading ? (
          <div className="text-center text-gold-main py-8">Cargando...</div>
        ) : customers.length === 0 ? (
          <div className="text-center text-white/60 py-8">
            No hay clientes registrados
          </div>
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <div key={customer.id} className="card">
                <div className="font-semibold text-white mb-1">{customer.full_name}</div>
                {customer.phone && (
                  <div className="text-sm text-white/60 mb-2">{customer.phone}</div>
                )}
                <div className="text-xs text-white/40">
                  Registrado: {format(new Date(customer.created_at), "d 'de' MMMM, yyyy")}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-white/60 px-4">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

