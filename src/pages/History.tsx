import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { formatPYG } from '../utils/money'
import { format, parseISO, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'

interface HistoryItem {
  month: string
  customer_id: number
  customer_name: string | null
  sales_count: number
  total_vendido: string
  ganancia_40: string
}

type CacheKey = string // "all" | "YYYY-MM"

export default function History() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [showMonthModal, setShowMonthModal] = useState(false)
  
  // Cache en memoria: { "all": [...], "2024-01": [...], ... }
  const [cache, setCache] = useState<Record<CacheKey, HistoryItem[]>>({})

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  // Generar opciones de meses (últimos 12 meses)
  const getMonthOptions = () => {
    const options = []
    const today = new Date()
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(today, i)
      const monthKey = format(monthDate, 'yyyy-MM')
      const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es })
      options.push({ value: monthKey, label: monthLabel })
    }
    return options
  }

  const loadHistory = useCallback(async (monthKey: string) => {
    // Verificar cache
    const cacheKey: CacheKey = monthKey || 'all'
    if (cache[cacheKey]) {
      setHistory(cache[cacheKey])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let data: HistoryItem[] = []
      
      if (monthKey) {
        const [year, month] = monthKey.split('-').map(Number)
        data = await api.getHistoryMonthly(year, month)
      } else {
        data = await api.getHistoryMonthly()
      }
      
      // Guardar en cache
      setCache(prev => ({ ...prev, [cacheKey]: data }))
      setHistory(data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }, [cache])

  useEffect(() => {
    loadHistory(selectedMonth)
  }, [selectedMonth, loadHistory])

  const handleMonthSelect = (monthKey: string) => {
    setSelectedMonth(monthKey)
    setShowMonthModal(false)
  }

  // Agrupar por mes
  const groupedByMonth = history.reduce((acc, item) => {
    const monthKey = item.month
    if (!acc[monthKey]) {
      acc[monthKey] = []
    }
    acc[monthKey].push(item)
    return acc
  }, {} as Record<string, HistoryItem[]>)

  // Calcular totales por mes
  const getMonthTotals = (items: HistoryItem[]) => {
    const totalVendido = items.reduce((sum, item) => sum + parseFloat(item.total_vendido), 0)
    const totalGanancia = items.reduce((sum, item) => sum + parseFloat(item.ganancia_40), 0)
    return { totalVendido, totalGanancia }
  }

  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a))

  const selectedMonthLabel = selectedMonth
    ? getMonthOptions().find(opt => opt.value === selectedMonth)?.label || selectedMonth
    : 'Todos los meses (últimos 12)'

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="text-gold-main text-lg font-semibold"
            >
              ← Volver
            </button>
            <h1 className="text-xl font-semibold text-gold-light">Historial</h1>
          </div>
        </div>
      </div>

      {/* Filtro de Mes - Botón que abre modal */}
      <div className="px-4 py-4">
        <button
          onClick={() => setShowMonthModal(true)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-gold-main/30 text-white text-left flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <span>Mes: {selectedMonthLabel}</span>
          <span className="text-gold-main">▼</span>
        </button>
      </div>

      {/* Modal/Bottom Sheet para selección de mes */}
      {showMonthModal && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowMonthModal(false)}
          />
          {/* Modal */}
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gold-main/30 rounded-t-3xl z-50 max-h-[70vh] flex flex-col">
            <div className="px-4 py-4 border-b border-gold-main/20 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gold-light">Seleccionar Mes</h2>
              <button
                onClick={() => setShowMonthModal(false)}
                className="text-gold-main text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <button
                onClick={() => handleMonthSelect('')}
                className={`w-full px-4 py-4 text-left border-b border-white/10 hover:bg-white/5 transition-colors ${
                  selectedMonth === '' ? 'bg-gold-main/20 text-gold-main' : 'text-white'
                }`}
              >
                Todos los meses (últimos 12)
              </button>
              {getMonthOptions().map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleMonthSelect(option.value)}
                  className={`w-full px-4 py-4 text-left border-b border-white/10 hover:bg-white/5 transition-colors ${
                    selectedMonth === option.value ? 'bg-gold-main/20 text-gold-main' : 'text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="px-4 py-8 text-center">
          <div className="text-gold-main">Cargando...</div>
        </div>
      ) : history.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-white/60">Sin historial</div>
        </div>
      ) : (
        <div className="px-4 pb-6 space-y-6">
          {sortedMonths.map((monthKey) => {
            const monthItems = groupedByMonth[monthKey]
            const monthDate = parseISO(monthKey)
            const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es })
            const totals = getMonthTotals(monthItems)

            return (
              <div key={monthKey} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gold-main uppercase tracking-wider">
                    {monthLabel}
                  </h2>
                </div>
                
                {/* Resumen del mes */}
                <div className="card bg-gold-main/10 border border-gold-main/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gold-main uppercase tracking-wider">Total del Mes</div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gold-main/20">
                    <div className="text-sm text-white/60">Total Vendido</div>
                    <div className="text-lg font-bold text-white">
                      {formatPYG(totals.totalVendido)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-sm text-white/60">Ganancia 40%</div>
                    <div className="text-lg font-bold text-yellow-300">
                      {formatPYG(totals.totalGanancia)}
                    </div>
                  </div>
                </div>

                {/* Clientes del mes */}
                {monthItems.map((item) => (
                  <div key={`${item.month}-${item.customer_id}`} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-white mb-1">
                          {item.customer_name || 'Sin nombre'}
                        </div>
                        <div className="text-sm text-white/60">
                          {item.sales_count} {item.sales_count === 1 ? 'venta' : 'ventas'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                      <div className="text-sm text-white/60">Total Vendido</div>
                      <div className="text-lg font-bold text-white">
                        {formatPYG(parseFloat(item.total_vendido))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-sm text-white/60">Ganancia 40%</div>
                      <div className="text-lg font-bold text-yellow-300">
                        {formatPYG(parseFloat(item.ganancia_40))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

