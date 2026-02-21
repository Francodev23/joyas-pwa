import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { offlineQueue } from '../services/offlineQueue'
import { parsePYG, formatPYG } from '../utils/money'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function NewSale() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [items, setItems] = useState([
    { jewel_type: '', quantity: 1, unit_price: '', product_code: '', photo_url: '' }
  ])
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
    setItems([...items, { jewel_type: '', quantity: 1, unit_price: '', product_code: '', photo_url: '' }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
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
  }

  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCustomerId) {
      alert('Selecciona un cliente')
      return
    }

    if (items.some(item => !item.jewel_type || !item.unit_price)) {
      alert('Completa todos los campos de los items')
      return
    }

    setLoading(true)

    const saleData = {
      customer_id: selectedCustomerId,
      delivery_address: deliveryAddress,
      delivery_date: deliveryDate || null,
      notes: notes || null,
      payment_due_date: paymentDueDate || null,
      items: items.map(item => ({
        jewel_type: item.jewel_type,
        quantity: parseInt(item.quantity.toString()),
        unit_price: parsePYG(item.unit_price.toString()),
        product_code: item.product_code || null,
        photo_url: item.photo_url || null,
      }))
    }

    try {
      if (isOnline) {
        await api.createSale(saleData)
      } else {
        await offlineQueue.addOperation('create_sale', saleData)
        alert('Venta guardada en cola offline. Se sincronizará cuando vuelva la conexión.')
      }
      navigate('/sales')
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error al crear la venta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-6">
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

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
        {/* Cliente */}
        <div>
          <label className="block text-gold-main text-xs uppercase tracking-wider mb-2 ml-1">
            Cliente *
          </label>
          <button
            type="button"
            onClick={() => setShowCustomerModal(true)}
            className={`input-field text-left ${selectedCustomerId ? 'text-white' : 'text-white/40'}`}
          >
            {selectedCustomerName || 'Selecciona un cliente'}
          </button>
          {!selectedCustomerId && (
            <p className="text-red-400 text-xs mt-1 ml-1">Campo requerido</p>
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
                  className="input-field text-sm"
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
                      className="input-field text-sm"
                      placeholder="Ej: Anillo, Collar, Pulsera..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/60 text-xs mb-1">Cantidad</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="input-field text-sm"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-xs mb-1">Precio Unitario *</label>
                      <input
                        type="text"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                        onBlur={(e) => {
                          const parsed = parsePYG(e.target.value)
                          if (parsed > 0) {
                            updateItem(index, 'unit_price', formatPYG(parsed))
                          }
                        }}
                        className="input-field text-sm"
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs mb-1">Código de Producto (opcional)</label>
                    <input
                      type="text"
                      value={item.product_code}
                      onChange={(e) => updateItem(index, 'product_code', e.target.value)}
                      className="input-field text-sm"
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
            placeholder="Notas adicionales..."
          />
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

