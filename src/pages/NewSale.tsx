import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { offlineQueue } from '../services/offlineQueue'
import { parsePYG, formatPYG } from '../utils/money'

const API_URL = import.meta.env.VITE_API_URL || '/api'

// Tipo explícito para items de venta
interface SaleItem {
  jewel_type: string
  quantity: number | string  // Permite string temporalmente durante edición
  unit_price: string | number  // Permite string temporalmente durante edición
  product_code: string
  photo_url: string
}

export default function NewSale() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [items, setItems] = useState<SaleItem[]>([
    { jewel_type: '', quantity: 1, unit_price: '', product_code: '', photo_url: '' }
  ])
  const [itemErrors, setItemErrors] = useState<Record<number, { quantity?: string; unit_price?: string }>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [customerError, setCustomerError] = useState<string | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    loadCustomers()
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadCustomers = async () => {
    try {
      const data = await api.getCustomers(1, 100)
      setCustomers(data.items)
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const addItem = () => {
    setItems([...items, { jewel_type: '', quantity: 1, unit_price: '', product_code: '', photo_url: '' } as SaleItem])
    // Limpiar errores del nuevo item (no hay errores aún)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
    // Limpiar errores del item eliminado
    const newErrors = { ...itemErrors }
    delete newErrors[index]
    // Reindexar errores si es necesario
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

  const updateItem = (index: number, field: keyof SaleItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  // Validar cantidad: debe ser entero positivo > 0
  const validateQuantity = (value: string | number): { valid: boolean; error?: string; normalized?: number } => {
    if (value === '' || value === null || value === undefined) {
      return { valid: false, error: 'Cantidad es requerida' }
    }
    // Convertir a string para validar formato
    const strValue = typeof value === 'number' ? value.toString() : String(value).trim()
    // Rechazar si contiene letras o caracteres no numéricos
    if (!/^\d+$/.test(strValue)) {
      return { valid: false, error: 'Cantidad debe contener solo números enteros' }
    }
    const numValue = parseInt(strValue, 10)
    if (isNaN(numValue) || numValue <= 0 || !Number.isInteger(numValue)) {
      return { valid: false, error: 'La cantidad debe ser un número entero mayor a 0' }
    }
    return { valid: true, normalized: numValue }
  }

  // Validar precio unitario: debe ser número válido > 0
  const validateUnitPrice = (value: string | number): { valid: boolean; error?: string; normalized?: number } => {
    // Convertir a string si es número
    const strValue = typeof value === 'number' ? value.toString() : String(value).trim()
    if (!strValue || strValue === '') {
      return { valid: false, error: 'Precio unitario es requerido' }
    }
    // Validar que solo contenga dígitos, punto o coma (separadores numéricos)
    // Rechazar letras y símbolos raros
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

  // Calcular subtotal de un item (cantidad * precio unitario)
  const getItemSubtotal = (item: SaleItem): number => {
    // Parsear cantidad de forma segura
    const qty = typeof item.quantity === 'number' 
      ? (isNaN(item.quantity) || item.quantity < 1 ? 1 : Math.floor(item.quantity))
      : (typeof item.quantity === 'string' && item.quantity !== '' 
          ? (() => {
              const parsed = parseInt(item.quantity)
              return isNaN(parsed) || parsed < 1 ? 1 : parsed
            })()
          : 1)
    // Parsear precio de forma segura
    const priceStr = typeof item.unit_price === 'string' 
      ? item.unit_price 
      : (typeof item.unit_price === 'number' 
          ? item.unit_price.toString() 
          : '0')
    const price = parsePYG(priceStr)
    // Asegurar que ambos sean números válidos antes de multiplicar
    const finalQty = isNaN(qty) || qty < 1 ? 1 : qty
    const finalPrice = isNaN(price) || price < 0 ? 0 : price
    return finalQty * finalPrice
  }

  // Calcular total general (suma de todos los subtotales)
  const getTotal = (): number => {
    return items.reduce((sum, item) => sum + getItemSubtotal(item), 0)
  }

  const handleImageUpload = async (index: number, file: File) => {
    try {
      const result = await api.uploadImage(file)
      updateItem(index, 'photo_url', result.url)
    } catch (error: any) {
      alert(error.message || 'Error al subir la imagen')
    }
  }

  const selectCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id)
    setSelectedCustomerName(customer.full_name)
    setShowCustomerModal(false)
    setCustomerSearch('')
    setCustomerError(null) // Limpiar error al seleccionar cliente
  }

  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  // Función para extraer mensaje de error de forma segura
  const extractErrorMessage = (error: any): string => {
    // Si es un error de axios con response
    if (error?.response?.data) {
      const detail = error.response.data.detail
      
      // Si detail es un string, usarlo directamente
      if (typeof detail === 'string') {
        return detail
      }
      
      // Si detail es un array (errores de FastAPI/Pydantic)
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
      
      // Si detail es un objeto, intentar extraer mensaje
      if (typeof detail === 'object') {
        return detail.message || JSON.stringify(detail)
      }
    }
    
    // Si tiene mensaje directo
    if (error?.message) {
      return error.message
    }
    
    // Fallback
    return 'No se pudo registrar la venta. Verifica los datos.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Limpiar errores previos
    setSubmitError(null)
    setCustomerError(null)
    
    if (!selectedCustomerId) {
      setCustomerError('Selecciona un cliente')
      return
    }

    // Validar todos los items antes de guardar
    const errors: Record<number, { quantity?: string; unit_price?: string }> = {}
    let hasErrors = false

    items.forEach((item, index) => {
      const itemError: { quantity?: string; unit_price?: string } = {}

      // Validar tipo de joya
      if (!item.jewel_type || item.jewel_type.trim() === '') {
        hasErrors = true
        // jewel_type no tiene input específico, se maneja con required
      }

      // Validar cantidad
      const qtyValidation = validateQuantity(item.quantity)
      if (!qtyValidation.valid) {
        itemError.quantity = qtyValidation.error
        hasErrors = true
      }

      // Validar precio unitario
      const unitPriceValue = typeof item.unit_price === 'string' 
        ? item.unit_price 
        : (typeof item.unit_price === 'number' 
            ? item.unit_price.toString() 
            : '')
      const priceValidation = validateUnitPrice(unitPriceValue)
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

    // Limpiar errores si todo está válido
    setItemErrors({})
    setSubmitError(null)

    setLoading(true)

    const saleData = {
      customer_id: selectedCustomerId,
      delivery_address: deliveryAddress,
      delivery_date: deliveryDate || null,
      notes: notes || null,
      payment_due_date: paymentDueDate || null,
      items: items.map(item => {
        // Normalizar quantity: asegurar que sea entero > 0
        // Ya validado arriba, pero normalizar de forma segura
        const qtyValidation = validateQuantity(item.quantity)
        if (!qtyValidation.valid || !qtyValidation.normalized) {
          // Esto no debería pasar porque ya validamos arriba, pero defensa adicional
          throw new Error(`Item con cantidad inválida: ${item.quantity}`)
        }
        const qty = qtyValidation.normalized
        
        // Normalizar unit_price: convertir a string y parsear de forma segura
        const unitPriceStr = typeof item.unit_price === 'string' 
          ? item.unit_price 
          : (typeof item.unit_price === 'number' 
              ? item.unit_price.toString() 
              : '0')
        const priceValidation = validateUnitPrice(unitPriceStr)
        if (!priceValidation.valid || priceValidation.normalized === undefined) {
          // Esto no debería pasar porque ya validamos arriba, pero defensa adicional
          throw new Error(`Item con precio unitario inválido: ${item.unit_price}`)
        }
        const unitPrice = priceValidation.normalized
        
        return {
          jewel_type: item.jewel_type,
          quantity: qty,
          unit_price: unitPrice,
          product_code: item.product_code || null,
          photo_url: item.photo_url || null,
        }
      })
    }

    try {
      if (isOnline) {
        await api.createSale(saleData)
      } else {
        await offlineQueue.addOperation('create_sale', saleData)
        // Mensaje informativo para modo offline (no es error)
        setSubmitError(null)
      }
      navigate('/sales')
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error)
      setSubmitError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-6 max-w-full overflow-x-hidden">
      <div className="bg-white/5 backdrop-blur-lg border-b border-gold-main/20 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gold-light">Nueva Venta</h1>
          <button
            onClick={() => navigate('/sales')}
            className="text-white/60 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="mx-4 mt-4 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-4 py-3 rounded-xl text-sm">
          Modo offline: La venta se guardará localmente y se sincronizará cuando vuelva la conexión.
        </div>
      )}

      {/* Mensaje de error del submit */}
      {submitError && (
        <div className="mx-4 mt-4 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6 max-w-full overflow-x-hidden">
        {/* Cliente */}
        <div>
          <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
            Cliente *
          </label>
          <button
            type="button"
            onClick={() => {
              setShowCustomerModal(true)
              setCustomerError(null) // Limpiar error al abrir modal
            }}
            className={`input-field text-left ${selectedCustomerId ? 'text-white' : 'text-white/40'} ${customerError ? 'border-red-400' : ''}`}
          >
            {selectedCustomerName || 'Selecciona un cliente'}
          </button>
          {(customerError || (!selectedCustomerId && submitError)) && (
            <p className="text-red-400 text-xs mt-1 ml-1">{customerError || 'Campo requerido'}</p>
          )}
        </div>

        {/* Modal de Clientes */}
        {showCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setShowCustomerModal(false)}>
            <div className="w-full bg-bg-dark rounded-t-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gold-main/20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gold-light">Seleccionar Cliente</h2>
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(false)}
                    className="text-white/60 text-xl"
                  >
                    ×
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '16px' }}
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center text-white/60 py-8">
                    {customerSearch ? 'No se encontraron clientes' : 'No hay clientes'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="w-full text-left p-4 bg-white/5 rounded-xl border border-gold-main/20 hover:bg-white/10 transition-colors"
                      >
                        <div className="font-semibold text-white">{customer.full_name}</div>
                        {customer.phone && (
                          <div className="text-sm text-white/60 mt-1">{customer.phone}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dirección de entrega */}
        <div>
          <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
            Dirección de Entrega *
          </label>
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            className="input-field min-h-[100px] resize-none"
            style={{ fontSize: '16px' }}
            placeholder="Dirección completa..."
            required
          />
        </div>

        {/* Fecha de entrega */}
        <div>
          <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
            Fecha de Entrega (opcional)
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="input-field"
            style={{ fontSize: '16px' }}
          />
        </div>

        {/* Fecha de vencimiento */}
        <div>
          <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
            Fecha de Vencimiento (opcional)
          </label>
          <input
            type="date"
            value={paymentDueDate}
            onChange={(e) => setPaymentDueDate(e.target.value)}
            className="input-field"
            style={{ fontSize: '16px' }}
          />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-gold-main text-xs uppercase tracking-wider ml-1">
              Items de la Venta
            </label>
            <button
              type="button"
              onClick={addItem}
              className="text-gold-main text-sm font-semibold"
            >
              + Agregar Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gold-main text-sm font-semibold">Item {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
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
                      onChange={(e) => updateItem(index, 'jewel_type', e.target.value)}
                      className="input-field"
                      style={{ fontSize: '16px' }}
                      placeholder="Ej: Anillo, Collar, Pulsera..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="block text-white/60 text-xs mb-1">Cantidad *</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={item.quantity === '' ? '' : item.quantity}
                        onChange={(e) => {
                          const value = e.target.value
                          // Limpiar errores al empezar a escribir
                          if (itemErrors[index]?.quantity) {
                            const newErrors = { ...itemErrors }
                            delete newErrors[index]?.quantity
                            if (Object.keys(newErrors[index] || {}).length === 0) {
                              delete newErrors[index]
                            }
                            setItemErrors(newErrors)
                          }
                          // Limpiar error de submit si el usuario corrige
                          if (submitError) {
                            setSubmitError(null)
                          }
                          // Permitir campo vacío temporalmente mientras se escribe
                          if (value === '') {
                            updateItem(index, 'quantity', '')
                            return
                          }
                          // Solo aceptar dígitos (rechazar letras, símbolos, decimales)
                          if (/^\d*$/.test(value)) {
                            const numValue = parseInt(value, 10)
                            if (!isNaN(numValue) && numValue > 0 && Number.isInteger(numValue)) {
                              updateItem(index, 'quantity', numValue)
                            } else if (value === '') {
                              // Permitir campo vacío temporalmente
                              updateItem(index, 'quantity', '')
                            }
                          }
                          // Si contiene caracteres inválidos, no actualizar el estado
                        }}
                        onBlur={(e) => {
                          // Al perder foco, validar y normalizar
                          const value = e.target.value
                          const validation = validateQuantity(value)
                          if (!validation.valid) {
                            // Mostrar error pero no normalizar automáticamente
                            setItemErrors(prev => ({
                              ...prev,
                              [index]: { ...prev[index], quantity: validation.error }
                            }))
                            // Normalizar a 1 solo si está completamente vacío
                            if (value === '' || value === null || value === undefined) {
                              updateItem(index, 'quantity', 1)
                            }
                          } else {
                            // Limpiar error y normalizar valor
                            const newErrors = { ...itemErrors }
                            if (newErrors[index]?.quantity) {
                              delete newErrors[index].quantity
                              if (Object.keys(newErrors[index] || {}).length === 0) {
                                delete newErrors[index]
                              }
                            }
                            setItemErrors(newErrors)
                            if (validation.normalized !== undefined) {
                              updateItem(index, 'quantity', validation.normalized)
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
                          // Limpiar error al empezar a escribir
                          if (itemErrors[index]?.unit_price) {
                            const newErrors = { ...itemErrors }
                            delete newErrors[index]?.unit_price
                            if (Object.keys(newErrors[index] || {}).length === 0) {
                              delete newErrors[index]
                            }
                            setItemErrors(newErrors)
                          }
                          // Limpiar error de submit si el usuario corrige
                          if (submitError) {
                            setSubmitError(null)
                          }
                          // Permitir solo caracteres válidos para números (dígitos, punto, coma)
                          // Rechazar letras y símbolos raros
                          const cleaned = value.replace(/[^\d.,]/g, '')
                          // Validar que no tenga múltiples puntos o comas inválidos
                          const parts = cleaned.split(/[.,]/)
                          if (parts.length > 2) {
                            // Múltiples separadores, mantener solo el primero
                            const firstPart = parts[0]
                            const secondPart = parts.slice(1).join('')
                            updateItem(index, 'unit_price', firstPart + (secondPart ? '.' + secondPart : ''))
                          } else {
                            updateItem(index, 'unit_price', cleaned)
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value
                          const validation = validateUnitPrice(value)
                          if (!validation.valid) {
                            // Mostrar error
                            setItemErrors(prev => ({
                              ...prev,
                              [index]: { ...prev[index], unit_price: validation.error }
                            }))
                            // Si está vacío, dejar vacío (no normalizar a 0)
                            if (value.trim() === '') {
                              return
                            }
                            // Si tiene valor pero es inválido, intentar parsear y formatear
                            const parsed = parsePYG(value)
                            if (parsed >= 0) {
                              updateItem(index, 'unit_price', formatPYG(parsed))
                            }
                          } else {
                            // Limpiar error y formatear
                            const newErrors = { ...itemErrors }
                            if (newErrors[index]?.unit_price) {
                              delete newErrors[index].unit_price
                              if (Object.keys(newErrors[index] || {}).length === 0) {
                                delete newErrors[index]
                              }
                            }
                            setItemErrors(newErrors)
                            if (validation.normalized !== undefined && validation.normalized >= 0) {
                              updateItem(index, 'unit_price', formatPYG(validation.normalized))
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

                  {/* Mostrar subtotal del item */}
                  {item.unit_price && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-xs">Subtotal:</span>
                        <span className="text-gold-main font-semibold">
                          {formatPYG(getItemSubtotal(item))}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-white/60 text-xs mb-1">Código de Producto (opcional)</label>
                    <input
                      type="text"
                      value={item.product_code}
                      onChange={(e) => updateItem(index, 'product_code', e.target.value)}
                      className="input-field"
                      style={{ fontSize: '16px' }}
                      placeholder="Código interno..."
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs mb-1">Foto (opcional)</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('El archivo no debe exceder 5MB')
                            return
                          }
                          handleImageUpload(index, file)
                        }
                      }}
                      className="input-field text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gold-main file:text-black hover:file:bg-gold-light"
                    />
                    {item.photo_url && (
                      <div className="mt-2">
                        <img
                          src={`${API_URL}${item.photo_url}`}
                          alt="Preview"
                          className="w-full max-w-xs h-32 object-cover rounded-xl border border-gold-main/20"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(index, 'photo_url', '')}
                          className="text-red-400 text-xs mt-1"
                        >
                          Eliminar imagen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field min-h-[80px] resize-none"
            style={{ fontSize: '16px' }}
            placeholder="Notas adicionales..."
          />
        </div>

        {/* Total General */}
        <div className="card bg-gold-main/10 border-gold-main/30">
          <div className="flex justify-between items-center">
            <span className="text-gold-main text-sm font-semibold uppercase tracking-wider">
              Total General
            </span>
            <span className="text-2xl font-bold text-gold-light">
              {formatPYG(getTotal())}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Guardando...' : 'Crear Venta'}
        </button>
      </form>
    </div>
  )
}

