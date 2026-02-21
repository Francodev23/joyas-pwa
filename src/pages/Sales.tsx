import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { format } from 'date-fns'

export default function Sales() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadSales()
  }, [page, statusFilter])

  const loadSales = async () => {
    setLoading(true)
    try {
      const data = await api.getSales(page, 20, statusFilter || undefined)
      setSales(data.items)
      setTotalPages(data.total_pages)
    } catch (error) {
      console.error('Error loading sales:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gold-light">Ventas</h1>
            <Link
              to="/sales/new"
              className="bg-gold-main text-black px-4 py-2 rounded-xl font-semibold text-sm"
            >
              + Nueva
            </Link>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field text-sm"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setStatusFilter('')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
                  statusFilter === '' ? 'bg-gold-main text-black' : 'bg-white/10 text-white'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setStatusFilter('PENDIENTE')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
                  statusFilter === 'PENDIENTE' ? 'bg-gold-main text-black' : 'bg-white/10 text-white'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setStatusFilter('PARCIAL')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
                  statusFilter === 'PARCIAL' ? 'bg-gold-main text-black' : 'bg-white/10 text-white'
                }`}
              >
                Parciales
              </button>
              <button
                onClick={() => setStatusFilter('PAGADO')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
                  statusFilter === 'PAGADO' ? 'bg-gold-main text-black' : 'bg-white/10 text-white'
                }`}
              >
                Pagadas
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {loading ? (
          <div className="text-center text-gold-main py-8">Cargando...</div>
        ) : sales.length === 0 ? (
          <div className="text-center text-white/60 py-8">
            No hay ventas registradas
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale: any) => (
              <Link
                key={sale.id}
                to={`/sales/${sale.id}`}
                className="card block"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-white mb-1">
                      Venta #{sale.id}
                    </div>
                    <div className="text-sm text-white/60">
                      {format(new Date(sale.purchase_date), "d 'de' MMMM, yyyy")}
                    </div>
                  </div>
                </div>
              </Link>
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/5 backdrop-blur-lg border-t border-gold-main/20">
        <div className="grid grid-cols-3 gap-2 p-2">
          <Link
            to="/"
            className="py-3 text-center text-white/60 rounded-xl hover:bg-white/5"
          >
            Dashboard
          </Link>
          <Link
            to="/sales"
            className="py-3 text-center text-gold-main font-semibold rounded-xl bg-gold-main/10"
          >
            Ventas
          </Link>
          <Link
            to="/payments"
            className="py-3 text-center text-white/60 rounded-xl hover:bg-white/5"
          >
            Pagos
          </Link>
        </div>
      </div>
    </div>
  )
}

