import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api'
import { format } from 'date-fns'
import { formatPYG, parsePYG } from '../utils/money'

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sale, setSale] = useState<any>(null)
  const [statement, setStatement] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)

  useEffect(() => {
    if (id) {
      loadSaleData()
    }
  }, [id])

  const loadSaleData = async () => {
    try {
      const [saleData, statementData, itemsData, paymentsData] = await Promise.all([
        api.getSale(parseInt(id!)),
        api.getSaleStatement(parseInt(id!)),
        api.getSaleItems(parseInt(id!)),
        api.getPayments(1, 100, parseInt(id!))
      ])
      setSale(saleData)
      setStatement(statementData)
      setItems(itemsData)
      setPayments(paymentsData.items)
    } catch (error) {
      console.error('Error loading sale:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parsePYG(paymentAmount)
    if (!paymentAmount || amount <= 0) {
      alert('Ingresa un monto válido')
      return
    }

    setProcessingPayment(true)
    try {
      await api.createPayment({
        sale_id: parseInt(id!),
        amount: amount
      })
      setPaymentAmount('')
      setShowPaymentForm(false)
      loadSaleData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error al registrar el pago')
    } finally {
      setProcessingPayment(false)
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

  if (!sale || !statement) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Venta no encontrada</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-6">
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/sales')}
            className="text-white/60"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold text-gold-light">Venta #{sale.id}</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Estado */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gold-main text-xs uppercase tracking-wider">Estado</span>
            <span className={getStatusClass(statement.account_status)}>
              {statement.account_status}
            </span>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex justify-between">
              <span className="text-white/60">Total de Venta</span>
              <span className="text-xl font-bold text-white">
                {formatPYG(statement.sale_total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Total Pagado</span>
              <span className="text-lg font-semibold text-green-300">
                {formatPYG(statement.paid_total)}
              </span>
            </div>
            {statement.remaining > 0 && (
              <div className="flex justify-between pt-3 border-t border-white/10">
                <span className="text-white/60">Pendiente</span>
                <span className="text-lg font-bold text-red-300">
                  {formatPYG(statement.remaining)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Información */}
        <div className="card">
          <h2 className="text-gold-main text-xs uppercase tracking-wider mb-4">Información</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-white/60">Fecha de Compra:</span>
              <div className="text-white mt-1">
                {format(new Date(statement.purchase_date), "d 'de' MMMM, yyyy")}
              </div>
            </div>
            {statement.payment_due_date && (
              <div>
                <span className="text-white/60">Fecha de Vencimiento:</span>
                <div className="text-white mt-1">
                  {format(new Date(statement.payment_due_date), "d 'de' MMMM, yyyy")}
                </div>
              </div>
            )}
            {sale.customer?.phone && (
              <div>
                <span className="text-white/60">Teléfono:</span>
                <div className="text-white mt-1">{sale.customer.phone}</div>
              </div>
            )}
            <div>
              <span className="text-white/60">Dirección de Entrega:</span>
              <div className="text-white mt-1">{statement.delivery_address}</div>
            </div>
            {sale.notes && (
              <div>
                <span className="text-white/60">Notas:</span>
                <div className="text-white mt-1">{sale.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="card">
          <h2 className="text-gold-main text-xs uppercase tracking-wider mb-4">Items</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="pb-3 border-b border-white/10 last:border-0">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <div className="font-semibold text-white">{item.jewel_type}</div>
                    {item.product_code && (
                      <div className="text-xs text-white/60">Código: {item.product_code}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      {formatPYG(item.unit_price)}
                    </div>
                    <div className="text-xs text-white/60">x{item.quantity}</div>
                  </div>
                </div>
                <div className="text-sm text-white/60 mt-2">
                  Subtotal: {formatPYG(parseFloat(item.unit_price) * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gold-main text-xs uppercase tracking-wider">Pagos</h2>
            {statement.remaining > 0 && (
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="text-gold-main text-sm font-semibold"
              >
                + Registrar Pago
              </button>
            )}
          </div>

          {showPaymentForm && (
            <form onSubmit={handlePayment} className="mb-4 p-4 bg-white/5 rounded-xl border border-gold-main/20">
              <div className="mb-3">
                <label className="block text-white/60 text-xs mb-1">Monto</label>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  onBlur={(e) => {
                    const parsed = parsePYG(e.target.value)
                    if (parsed > 0) {
                      setPaymentAmount(formatPYG(parsed))
                    }
                  }}
                  className="input-field text-sm"
                  placeholder="0"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={processingPayment}
                  className="btn-primary flex-1 text-sm py-2"
                >
                  {processingPayment ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentForm(false)
                    setPaymentAmount('')
                  }}
                  className="btn-secondary flex-1 text-sm py-2"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {payments.length === 0 ? (
            <div className="text-white/60 text-sm text-center py-4">
              No hay pagos registrados
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex justify-between items-center pb-3 border-b border-white/10 last:border-0">
                  <div>
                    <div className="text-white font-semibold">
                      {formatPYG(payment.amount)}
                    </div>
                    <div className="text-xs text-white/60">
                      {format(new Date(payment.paid_at), "d 'de' MMMM, yyyy 'a las' HH:mm")}
                    </div>
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

