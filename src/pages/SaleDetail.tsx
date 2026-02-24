import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { format } from 'date-fns'
import { formatPYG, parsePYG } from '../utils/money'

// Tipo para items editables
interface EditableItem {
  id?: number
  jewel_type: string
  quantity: number | string
  unit_price: string | number
  product_code: string
  photo_url: string
}

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
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingItems, setEditingItems] = useState<EditableItem[]>([])
  const [editingDeliveryAddress, setEditingDeliveryAddress] = useState('')
  const [editingNotes, setEditingNotes] = useState('')
  const [editingPaymentDueDate, setEditingPaymentDueDate] = useState('')
  const [editingDeliveryDate, setEditingDeliveryDate] = useState('')
  const [itemErrors, setItemErrors] = useState<Record<number, { quantity?: string; unit_price?: string }>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  const startEditing = () => {
    // Cargar datos actuales en formulario de edición
    setEditingDeliveryAddress(statement.delivery_address || '')
    setEditingNotes(sale.notes || '')
    setEditingPaymentDueDate(statement.payment_due_date ? format(new Date(statement.payment_due_date), 'yyyy-MM-dd') : '')
    setEditingDeliveryDate(statement.delivery_date ? format(new Date(statement.delivery_date), 'yyyy-MM-dd') : '')
    setEditingItems(items.map(item => ({
      id: item.id,
      jewel_type: item.jewel_type,
      quantity: item.quantity,
      unit_price: formatPYG(parseFloat(item.unit_price)),
      product_code: item.product_code || '',
      photo_url: item.photo_url || ''
    })))
    setIsEditing(true)
    setSubmitError(null)
    setItemErrors({})
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setSubmitError(null)
    setItemErrors({})
  }

  // Validar cantidad
  const validateQuantity = (value: string | number): { valid: boolean; error?: string; normalized?: number } => {
    if (value === '' || value === null || value === undefined) {
      return { valid: false, error: 'Cantidad es requerida' }
    }
    const strValue = typeof value === 'number' ? value.toString() : String(value).trim()
    if (!/^\d+$/.test(strValue)) {
      return { valid: false, error: 'Cantidad debe contener solo números enteros' }
    }
    const numValue = parseInt(strValue, 10)
    if (isNaN(numValue) || numValue <= 0 || !Number.isInteger(numValue)) {
      return { valid: false, error: 'La cantidad debe ser un número entero mayor a 0' }
    }
    return { valid: true, normalized: numValue }
  }

  // Validar precio unitario
  const validateUnitPrice = (value: string | number): { valid: boolean; error?: string; normalized?: number } => {
    const strValue = typeof value === 'number' ? value.toString() : String(value).trim()
    if (!strValue || strValue === '') {
      return { valid: false, error: 'Precio unitario es requerido' }
    }
    const numericPattern = /^[\d.,]+$/
    const cleaned = strValue.replace(/\s/g, '')
    if (!numericPattern.test(cleaned)) {
      return { valid: false, error: 'Precio unitario debe contener solo números' }
    }
    const parsed = parsePYG(cleaned)
    if (isNaN(parsed) || parsed <= 0) {
      return { valid: false, error: 'El precio unitario debe ser un número mayor a 0' }
    }
    return { valid: true, normalized: parsed }
  }

  // Extraer mensaje de error
  const extractErrorMessage = (error: any): string => {
    if (error?.response?.data) {
      const detail = error.response.data.detail
      if (typeof detail === 'string') {
        return detail
      }
      if (Array.isArray(detail)) {
        return detail
          .map((err: any) => {
            if (typeof err === 'string') return err
            if (err?.msg) return err.msg
            if (err?.loc && err?.msg) {
              const field = err.loc[err.loc.length - 1]
              return `${field}: ${err.msg}`
            }
            return JSON.stringify(err)
          })
          .join('. ')
      }
      if (typeof detail === 'object') {
        return detail.message || JSON.stringify(detail)
      }
    }
    if (error?.message) {
      return error.message
    }
    return 'No se pudo actualizar la venta. Verifica los datos.'
  }

  const handleSaveEdit = async () => {
    setSubmitError(null)
    setItemErrors({})

    // Validar items
    const errors: Record<number, { quantity?: string; unit_price?: string }> = {}
    let hasErrors = false

    editingItems.forEach((item, index) => {
      const itemError: { quantity?: string; unit_price?: string } = {}
      if (!item.jewel_type || item.jewel_type.trim() === '') {
        hasErrors = true
      }
      const qtyValidation = validateQuantity(item.quantity)
      if (!qtyValidation.valid) {
        itemError.quantity = qtyValidation.error
        hasErrors = true
      }
      const priceValidation = validateUnitPrice(item.unit_price)
      if (!priceValidation.valid) {
        itemError.unit_price = priceValidation.error
        hasErrors = true
      }
      if (Object.keys(itemError).length > 0) {
        errors[index] = itemError
      }
    })

    if (hasErrors) {
      setItemErrors(errors)
      setSubmitError('Por favor, corrige los errores en los items antes de guardar')
      return
    }

    setSaving(true)
    try {
      const updateData: any = {
        delivery_address: editingDeliveryAddress,
        notes: editingNotes || null,
        payment_due_date: editingPaymentDueDate || null,
        delivery_date: editingDeliveryDate || null,
        items: editingItems.map(item => {
          const qtyValidation = validateQuantity(item.quantity)
          const priceValidation = validateUnitPrice(item.unit_price)
          return {
            jewel_type: item.jewel_type,
            quantity: qtyValidation.normalized!,
            unit_price: priceValidation.normalized!,
            product_code: item.product_code || null,
            photo_url: item.photo_url || null,
          }
        })
      }

      await api.updateSale(parseInt(id!), updateData)
      setIsEditing(false)
      loadSaleData()
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error)
      setSubmitError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteSale(parseInt(id!))
      navigate('/sales')
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error)
      setSubmitError(errorMessage)
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const updateEditingItem = (index: number, field: keyof EditableItem, value: string | number) => {
    const newItems = [...editingItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setEditingItems(newItems)
    // Limpiar error al editar
    if (itemErrors[index]?.[field as 'quantity' | 'unit_price']) {
      const newErrors = { ...itemErrors }
      delete newErrors[index]?.[field as 'quantity' | 'unit_price']
      if (Object.keys(newErrors[index] || {}).length === 0) {
        delete newErrors[index]
      }
      setItemErrors(newErrors)
    }
    if (submitError) {
      setSubmitError(null)
    }
  }

  const addEditingItem = () => {
    setEditingItems([...editingItems, { jewel_type: '', quantity: 1, unit_price: '', product_code: '', photo_url: '' }])
  }

  const removeEditingItem = (index: number) => {
    setEditingItems(editingItems.filter((_, i) => i !== index))
    const newErrors = { ...itemErrors }
    delete newErrors[index]
    const reindexedErrors: Record<number, { quantity?: string; unit_price?: string }> = {}
    Object.keys(newErrors).forEach(key => {
      const oldIndex = parseInt(key)
      if (oldIndex > index) {
        reindexedErrors[oldIndex - 1] = newErrors[oldIndex]
      } else if (oldIndex < index) {
        reindexedErrors[oldIndex] = newErrors[oldIndex]
      }
    })
    setItemErrors(reindexedErrors)
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parsePYG(paymentAmount)
    if (!paymentAmount || amount <= 0) {
      setSubmitError('Ingresa un monto válido')
      return
    }

    setProcessingPayment(true)
    setSubmitError(null)
    try {
      await api.createPayment({
        sale_id: parseInt(id!),
        amount: amount
      })
      setPaymentAmount('')
      setShowPaymentForm(false)
      loadSaleData()
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error)
      setSubmitError(errorMessage)
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
    <div className="min-h-screen pb-6 max-w-full overflow-x-hidden">
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/sales')}
            className="text-white/60"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold text-gold-light">Venta #{sale.id}</h1>
          {!isEditing && (
            <div className="flex gap-2">
              <button
                onClick={startEditing}
                className="text-gold-main text-sm font-semibold"
              >
                Editar
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-400 text-sm font-semibold"
              >
                Eliminar
              </button>
            </div>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={cancelEditing}
                className="text-white/60 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-gold-main text-black px-3 py-1 rounded-lg text-sm font-semibold"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-bg-dark rounded-2xl p-6 max-w-md w-full mx-4 border border-gold-main/20" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-gold-light mb-4">¿Eliminar venta?</h2>
            <p className="text-white/80 mb-6">
              Esta acción eliminará la venta y sus pagos/items asociados de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-500 text-white px-4 py-2 rounded-xl font-semibold flex-1 hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de error */}
      {submitError && (
        <div className="mx-4 mt-4 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
          {submitError}
        </div>
      )}

      <div className="px-4 py-6 space-y-6 max-w-full overflow-x-hidden">
        {!isEditing ? (
          <>
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
          </>
        ) : (
          <>
            {/* Formulario de edición */}
            <div className="card">
              <h2 className="text-gold-main text-xs uppercase tracking-wider mb-4">Editar Venta</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Dirección de Entrega *</label>
                  <textarea
                    value={editingDeliveryAddress}
                    onChange={(e) => setEditingDeliveryAddress(e.target.value)}
                    className="input-field min-h-[100px] resize-none"
                    style={{ fontSize: '16px' }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-xs mb-1">Fecha de Vencimiento (opcional)</label>
                  <input
                    type="date"
                    value={editingPaymentDueDate}
                    onChange={(e) => setEditingPaymentDueDate(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-xs mb-1">Fecha de Entrega (opcional)</label>
                  <input
                    type="date"
                    value={editingDeliveryDate}
                    onChange={(e) => setEditingDeliveryDate(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-xs mb-1">Notas (opcional)</label>
                  <textarea
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    className="input-field min-h-[80px] resize-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-gold-main text-xs uppercase tracking-wider">Items</label>
                    <button
                      type="button"
                      onClick={addEditingItem}
                      className="text-gold-main text-sm font-semibold"
                    >
                      + Agregar Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {editingItems.map((item, index) => (
                      <div key={index} className="p-4 bg-white/5 rounded-xl border border-gold-main/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-gold-main text-sm font-semibold">Item {index + 1}</span>
                          {editingItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEditingItem(index)}
                              className="text-red-400 text-sm"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-white/60 text-xs mb-1">Tipo de Joya *</label>
                            <input
                              type="text"
                              value={item.jewel_type}
                              onChange={(e) => updateEditingItem(index, 'jewel_type', e.target.value)}
                              className="input-field"
                              style={{ fontSize: '16px' }}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 min-w-0">
                            <div className="min-w-0 flex-shrink">
                              <label className="block text-white/60 text-xs mb-1">Cantidad *</label>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={item.quantity === '' ? '' : item.quantity}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value === '') {
                                    updateEditingItem(index, 'quantity', '')
                                    return
                                  }
                                  const numValue = parseInt(value, 10)
                                  if (!isNaN(numValue) && numValue > 0 && Number.isInteger(numValue)) {
                                    updateEditingItem(index, 'quantity', numValue)
                                  }
                                }}
                                onBlur={(e) => {
                                  const value = e.target.value
                                  const validation = validateQuantity(value)
                                  if (!validation.valid) {
                                    setItemErrors(prev => ({
                                      ...prev,
                                      [index]: { ...prev[index], quantity: validation.error }
                                    }))
                                    if (value === '') {
                                      updateEditingItem(index, 'quantity', 1)
                                    }
                                  } else {
                                    const newErrors = { ...itemErrors }
                                    if (newErrors[index]?.quantity) {
                                      delete newErrors[index].quantity
                                      if (Object.keys(newErrors[index] || {}).length === 0) {
                                        delete newErrors[index]
                                      }
                                    }
                                    setItemErrors(newErrors)
                                    if (validation.normalized !== undefined) {
                                      updateEditingItem(index, 'quantity', validation.normalized)
                                    }
                                  }
                                }}
                                className={`input-field ${itemErrors[index]?.quantity ? 'border-red-400' : ''}`}
                                style={{ fontSize: '16px' }}
                                min="1"
                                step="1"
                                required
                              />
                              {itemErrors[index]?.quantity && (
                                <p className="text-red-400 text-xs mt-1">{itemErrors[index].quantity}</p>
                              )}
                            </div>
                            <div className="min-w-0 flex-shrink">
                              <label className="block text-white/60 text-xs mb-1">Precio Unitario *</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.unit_price}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (itemErrors[index]?.unit_price) {
                                    const newErrors = { ...itemErrors }
                                    delete newErrors[index]?.unit_price
                                    if (Object.keys(newErrors[index] || {}).length === 0) {
                                      delete newErrors[index]
                                    }
                                    setItemErrors(newErrors)
                                  }
                                  const cleaned = value.replace(/[^\d.,]/g, '')
                                  const parts = cleaned.split(/[.,]/)
                                  if (parts.length > 2) {
                                    const firstPart = parts[0]
                                    const secondPart = parts.slice(1).join('')
                                    updateEditingItem(index, 'unit_price', firstPart + (secondPart ? '.' + secondPart : ''))
                                  } else {
                                    updateEditingItem(index, 'unit_price', cleaned)
                                  }
                                }}
                                onBlur={(e) => {
                                  const value = e.target.value
                                  const validation = validateUnitPrice(value)
                                  if (!validation.valid) {
                                    setItemErrors(prev => ({
                                      ...prev,
                                      [index]: { ...prev[index], unit_price: validation.error }
                                    }))
                                    if (value.trim() === '') {
                                      return
                                    }
                                    const parsed = parsePYG(value)
                                    if (parsed >= 0) {
                                      updateEditingItem(index, 'unit_price', formatPYG(parsed))
                                    }
                                  } else {
                                    const newErrors = { ...itemErrors }
                                    if (newErrors[index]?.unit_price) {
                                      delete newErrors[index].unit_price
                                      if (Object.keys(newErrors[index] || {}).length === 0) {
                                        delete newErrors[index]
                                      }
                                    }
                                    setItemErrors(newErrors)
                                    if (validation.normalized !== undefined && validation.normalized >= 0) {
                                      updateEditingItem(index, 'unit_price', formatPYG(validation.normalized))
                                    }
                                  }
                                }}
                                className={`input-field ${itemErrors[index]?.unit_price ? 'border-red-400' : ''}`}
                                style={{ fontSize: '16px' }}
                                placeholder="0"
                                required
                              />
                              {itemErrors[index]?.unit_price && (
                                <p className="text-red-400 text-xs mt-1">{itemErrors[index].unit_price}</p>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-white/60 text-xs mb-1">Código de Producto (opcional)</label>
                            <input
                              type="text"
                              value={item.product_code}
                              onChange={(e) => updateEditingItem(index, 'product_code', e.target.value)}
                              className="input-field"
                              style={{ fontSize: '16px' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Pagos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gold-main text-xs uppercase tracking-wider">Pagos</h2>
            {statement.remaining > 0 && !isEditing && (
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="text-gold-main text-sm font-semibold"
              >
                + Registrar Pago
              </button>
            )}
          </div>

          {showPaymentForm && !isEditing && (
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
                  className="input-field"
                  style={{ fontSize: '16px' }}
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
