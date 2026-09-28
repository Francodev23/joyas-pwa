import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { api } from '../services/api'
import { formatPYG } from '../utils/money'

interface ClosingSummary {
  period_start: string
  period_end: string
  sales_count: number
  total_sales: number
  total_paid: number
  total_remaining: number
  total_items: number
  money_to_deliver: number
  profit_40: number
}

interface ClosingPreview {
  summary: ClosingSummary
  sales: Array<{
    sale_id: number
    customer_name: string | null
    purchase_date: string
    sale_total: number
    total_items: number
  }>
}

interface Closing extends ClosingSummary {
  id: number
  closed_at: string
  notes: string | null
}

const todayKey = format(new Date(), 'yyyy-MM-dd')
const defaultStartKey = format(subMonths(new Date(), 2), 'yyyy-MM-dd')

export default function Closings() {
  const [closings, setClosings] = useState<Closing[]>([])
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [periodStart, setPeriodStart] = useState(defaultStartKey)
  const [periodEnd, setPeriodEnd] = useState(todayKey)
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<ClosingPreview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadClosings()
  }, [page])

  const loadClosings = async () => {
    setLoading(true)
    try {
      const data = await api.getClosings(page, 10)
      setClosings(data.items)
      setTotalPages(data.total_pages || 1)
    } catch (error) {
      console.error('Error loading closings:', error)
      setMessage('No se pudieron cargar los cierres')
    } finally {
      setLoading(false)
    }
  }

  const loadPreview = async () => {
    setMessage(null)
    setPreviewLoading(true)
    try {
      const data = await api.previewClosing(periodStart, periodEnd)
      setPreview(data)
      if (data.summary.sales_count === 0) {
        setMessage('No hay ventas pagadas sin cerrar en ese rango')
      }
    } catch (error: any) {
      setPreview(null)
      setMessage(error?.response?.data?.detail || 'No se pudo preparar el cierre')
    } finally {
      setPreviewLoading(false)
    }
  }

  const createClosing = async () => {
    if (!preview || preview.summary.sales_count === 0) return
    setSaving(true)
    setMessage(null)
    try {
      await api.createClosing({
        period_start: periodStart,
        period_end: periodEnd,
        notes: notes.trim() || null,
      })
      setNotes('')
      setPreview(null)
      setMessage('Cierre creado correctamente')
      setPage(1)
      if (page === 1) {
        await loadClosings()
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.detail || 'No se pudo crear el cierre')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (value: string) => {
    return format(new Date(value), "d 'de' MMM yyyy", { locale: es })
  }

  return (
    <div className="min-h-screen pb-28 max-w-full overflow-x-hidden">
      <div className="page-header">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-gold-light">Cierres</h1>
        </div>
      </div>

      <main className="px-4 py-5 space-y-5">
        <section className="space-y-4">
          <div>
            <div className="text-gold-main text-xs uppercase tracking-wider mb-2">
              Nuevo cierre
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="min-w-0">
                <span className="block text-white/60 text-xs mb-1">Desde</span>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                  className="input-field"
                />
              </label>
              <label className="min-w-0">
                <span className="block text-white/60 text-xs mb-1">Hasta</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                  className="input-field"
                />
              </label>
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="input-field min-h-[84px] resize-none"
            placeholder="Nota opcional"
          />

          <button
            type="button"
            onClick={loadPreview}
            disabled={previewLoading || !periodStart || !periodEnd}
            className="btn-secondary"
          >
            {previewLoading ? 'Calculando...' : 'Previsualizar cierre'}
          </button>
        </section>

        {message && (
          <div className="rounded-2xl border border-gold-main/25 bg-white/5 px-4 py-3 text-sm text-white/80">
            {message}
          </div>
        )}

        {preview && (
          <section className="space-y-4">
            <div className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-gold-main text-xs uppercase tracking-wider">
                    Vista previa
                  </div>
                  <div className="text-white/70 text-sm mt-1">
                    {formatDate(preview.summary.period_start)} - {formatDate(preview.summary.period_end)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{preview.summary.sales_count}</div>
                  <div className="text-xs text-white/50">ventas</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div>
                  <div className="text-xs text-white/50">Total vendido</div>
                  <div className="text-lg font-bold text-white">{formatPYG(preview.summary.total_sales)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Joyas</div>
                  <div className="text-lg font-bold text-white">{preview.summary.total_items}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">A entregar</div>
                  <div className="text-lg font-bold text-blue-300">{formatPYG(preview.summary.money_to_deliver)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Ganancia</div>
                  <div className="text-lg font-bold text-yellow-300">{formatPYG(preview.summary.profit_40)}</div>
                </div>
              </div>
            </div>

            {preview.sales.length > 0 && (
              <div className="space-y-2">
                {preview.sales.slice(0, 6).map((sale) => (
                  <Link
                    key={sale.sale_id}
                    to={`/sales/${sale.sale_id}`}
                    className="block rounded-2xl border border-gold-main/15 bg-white/[0.04] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">
                          {sale.customer_name || `Venta #${sale.sale_id}`}
                        </div>
                        <div className="text-xs text-white/50">
                          {formatDate(sale.purchase_date)} - {sale.total_items} joyas
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-bold text-white">
                        {formatPYG(sale.sale_total)}
                      </div>
                    </div>
                  </Link>
                ))}
                {preview.sales.length > 6 && (
                  <div className="text-center text-sm text-white/50">
                    +{preview.sales.length - 6} ventas mas
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={createClosing}
              disabled={saving || preview.summary.sales_count === 0}
              className="btn-primary"
            >
              {saving ? 'Creando cierre...' : 'Confirmar cierre'}
            </button>
          </section>
        )}

        <section>
          <div className="text-gold-main text-xs uppercase tracking-wider mb-3">
            Historial de cierres
          </div>

          {loading ? (
            <div className="text-center text-gold-main py-8">Cargando...</div>
          ) : closings.length === 0 ? (
            <div className="text-center text-white/60 py-8">Sin cierres creados</div>
          ) : (
            <div className="space-y-3">
              {closings.map((closing) => (
                <div key={closing.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">Cierre #{closing.id}</div>
                      <div className="text-sm text-white/60 mt-1">
                        {formatDate(closing.period_start)} - {formatDate(closing.period_end)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{formatPYG(closing.total_sales)}</div>
                      <div className="text-xs text-white/50">{closing.sales_count} ventas</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
                    <div>
                      <div className="text-xs text-white/50">A entregar</div>
                      <div className="font-bold text-blue-300">{formatPYG(closing.money_to_deliver)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50">Ganancia</div>
                      <div className="font-bold text-yellow-300">{formatPYG(closing.profit_40)}</div>
                    </div>
                  </div>
                  {closing.notes && (
                    <div className="mt-3 text-sm text-white/60">{closing.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1 || loading}
                className="btn-secondary disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-white/60 px-4">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page === totalPages || loading}
                className="btn-secondary disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/5 backdrop-blur-lg border-t border-gold-main/20">
        <div className="grid grid-cols-4 gap-1 p-2">
          <Link to="/" className="py-3 text-center text-white/60 rounded-xl hover:bg-white/5 text-sm">
            Inicio
          </Link>
          <Link to="/sales" className="py-3 text-center text-white/60 rounded-xl hover:bg-white/5 text-sm">
            Ventas
          </Link>
          <Link to="/payments" className="py-3 text-center text-white/60 rounded-xl hover:bg-white/5 text-sm">
            Pagos
          </Link>
          <div className="py-3 text-center text-gold-main font-semibold rounded-xl bg-gold-main/10 text-sm">
            Cierres
          </div>
        </div>
      </div>
    </div>
  )
}
