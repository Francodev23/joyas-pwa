import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { format } from 'date-fns'
import { formatPYG } from '../utils/money'

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadPayments()
  }, [page])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const data = await api.getPayments(page, 20)
      setPayments(data.items)
      setTotalPages(data.total_pages)
    } catch (error) {
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-gold-light">Pagos</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        {loading ? (
          <div className="text-center text-gold-main py-8">Cargando...</div>
        ) : payments.length === 0 ? (
          <div className="text-center text-white/60 py-8">
            No hay pagos registrados
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-2xl font-bold text-green-300 mb-1">
                      {formatPYG(payment.amount)}
                    </div>
                    <div className="text-sm text-white/60">
                      Venta #{payment.sale_id}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-white/40 pt-3 border-t border-white/10">
                  {format(new Date(payment.paid_at), "d 'de' MMMM, yyyy 'a las' HH:mm")}
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
            className="py-3 text-center text-white/60 rounded-xl hover:bg-white/5"
          >
            Ventas
          </Link>
          <div className="py-3 text-center text-gold-main font-semibold rounded-xl bg-gold-main/10">
            Pagos
          </div>
        </div>
      </div>
    </div>
  )
}

