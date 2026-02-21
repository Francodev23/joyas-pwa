import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getKPIs, KPIs } from '../services/api'
import { useAuth } from '../hooks/useAuth'

function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className="text-xs text-white/60">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

function KPICard({ label, value, isLoading }: { label: string; value: string | number; isLoading: boolean }) {
  return (
    <div className="card">
      <div className="text-gold-main text-xs uppercase tracking-wider mb-2">
        {label}
      </div>
      {isLoading ? (
        <div className="skeleton h-10 w-24" />
      ) : (
        <div className="text-3xl font-bold text-white">
          {value}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadKPIs()
  }, [])

  const loadKPIs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getKPIs()
      setKpis(data)
    } catch (err: any) {
      setError(err.message || 'Error al cargar KPIs')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gold-light">Joyas</h1>
          <div className="flex items-center gap-4">
            <OnlineStatus />
            <button
              onClick={logout}
              className="text-gold-main text-sm px-4 py-2 rounded-xl border border-gold-main/30"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 py-6">
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
            {error}
            <button
              onClick={loadKPIs}
              className="ml-2 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KPICard
            label="Joyas Vendidas"
            value={kpis?.total_joyas_vendidas || 0}
            isLoading={loading}
          />
          <KPICard
            label="Total Pagado"
            value={kpis ? formatCurrency(Number(kpis.total_ya_pagado)) : '$0.00'}
            isLoading={loading}
          />
          <KPICard
            label="Dinero Faltante"
            value={kpis ? formatCurrency(Number(kpis.dinero_faltante)) : '$0.00'}
            isLoading={loading}
          />
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="px-4 space-y-3">
        <button
          onClick={() => navigate('/sales/new')}
          className="btn-primary"
        >
          Nueva Venta
        </button>
        <button
          onClick={() => navigate('/customers')}
          className="btn-secondary"
        >
          Clientes
        </button>
        <button
          onClick={() => navigate('/debtors')}
          className="btn-secondary"
        >
          Deudores
        </button>
      </div>
    </div>
  )
}

