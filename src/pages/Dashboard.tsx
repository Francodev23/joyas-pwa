import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { format } from 'date-fns'
import { formatPYG } from '../utils/money'

interface KPIs {
  total_joyas_vendidas: number
  total_ya_pagado: number
  dinero_faltante: number
  total_vendido: number
  dinero_a_entregar: number
  ganancia_40: number
}

export default function Dashboard() {
  const { logout } = useAuth()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    loadData()
  }, [page])

  const loadData = async () => {
    try {
      const [kpisData, salesData] = await Promise.all([
        api.getKPIs(),
        api.getSalesStatements(page, 10)
      ])
      setKpis(kpisData)
      setSales(salesData.items)
      setHasMore(salesData.page < salesData.total_pages)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'PAGADO': return 'status-badge status-pagado'
      case 'PARCIAL': return 'status-badge status-parcial'
      case 'PENDIENTE': return 'status-badge status-pendiente'
      default: return 'status-badge'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gold-main">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gold-light">Dashboard</h1>
          <button
            onClick={logout}
            className="text-gold-main text-sm px-4 py-2 rounded-xl border border-gold-main/30"
          >
            Salir
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 py-6 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="card">
            <div className="text-gold-main text-xs uppercase tracking-wider mb-1">
              Joyas Vendidas
            </div>
            <div className="text-3xl font-bold text-white">
              {kpis?.total_joyas_vendidas || 0}
            </div>
          </div>

          <div className="card">
            <div className="text-gold-main text-xs uppercase tracking-wider mb-1">
              Total Vendido
            </div>
            <div className="text-3xl font-bold text-white">
              {formatPYG(kpis?.total_vendido || 0)}
            </div>
          </div>

          <div className="card">
            <div className="text-gold-main text-xs uppercase tracking-wider mb-1">
              Total Pagado
            </div>
            <div className="text-3xl font-bold text-green-300">
              {formatPYG(kpis?.total_ya_pagado || 0)}
            </div>
          </div>

          <div className="card">
            <div className="text-gold-main text-xs uppercase tracking-wider mb-1">
              Dinero Faltante
            </div>
            <div className="text-3xl font-bold text-red-300">
              {formatPYG(kpis?.dinero_faltante || 0)}
            </div>
          </div>

          <div className="card">
            <div className="text-gold-main text-xs uppercase tracking-wider mb-1">
              Dinero a Entregar
            </div>
            <div className="text-3xl font-bold text-blue-300">
              {formatPYG(kpis?.dinero_a_entregar || 0)}
            </div>
          </div>

          <div className="card">
            <div className="text-gold-main text-xs uppercase tracking-wider mb-1">
              Ganancia 40%
            </div>
            <div className="text-3xl font-bold text-yellow-300">
              {formatPYG(kpis?.ganancia_40 || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-6 space-y-3">
        <Link to="/sales/new" className="btn-primary block text-center">
          Nueva Venta
        </Link>
        <Link to="/customers" className="btn-secondary block text-center">
          Clientes
        </Link>
        <Link to="/history" className="btn-secondary block text-center">
          Historial
        </Link>
      </div>

      {/* Recent Sales */}
      <div className="px-4">
        <h2 className="text-lg font-semibold text-gold-light mb-4">Ventas Recientes</h2>
        <div className="space-y-3">
          {sales.map((sale: any) => (
            <Link
              key={sale.sale_id}
              to={`/sales/${sale.sale_id}`}
              className="card block"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-white mb-1">
                    {sale.customer_name || 'Sin nombre'}
                  </div>
                  <div className="text-sm text-white/60">
                    {format(new Date(sale.purchase_date), "d 'de' MMMM, yyyy")}
                  </div>
                </div>
                <span className={getStatusClass(sale.account_status)}>
                  {sale.account_status}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                <div className="text-sm text-white/60">Total</div>
                <div className="text-lg font-bold text-white">
                  {formatPYG(sale.sale_total)}
                </div>
              </div>
              {sale.remaining > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-red-300">Pendiente</div>
                  <div className="text-sm font-semibold text-red-300">
                    {formatPYG(sale.remaining)}
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>

        {hasMore && (
          <button
            onClick={() => setPage(p => p + 1)}
            className="btn-secondary mt-4"
          >
            Cargar más
          </button>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/5 backdrop-blur-lg border-t border-gold-main/20">
        <div className="grid grid-cols-3 gap-2 p-2">
          <Link
            to="/"
            className="py-3 text-center text-gold-main font-semibold rounded-xl bg-gold-main/10"
          >
            Dashboard
          </Link>
          <Link
            to="/sales"
            className="py-3 text-center text-white/60 rounded-xl hover:bg-white/5"
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

