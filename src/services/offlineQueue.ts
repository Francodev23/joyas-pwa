import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { api } from './api'

interface OfflineQueueDB extends DBSchema {
  operations: {
    key: number
    value: {
      id: number
      type: 'create_sale' | 'create_payment'
      data: any
      timestamp: number
    }
    indexes: { 'by-timestamp': number }
  }
}

let db: IDBPDatabase<OfflineQueueDB> | null = null

async function getDB() {
  if (!db) {
    db = await openDB<OfflineQueueDB>('joyas-offline-queue', 1, {
      upgrade(db) {
        const store = db.createObjectStore('operations', {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('by-timestamp', 'timestamp')
      },
    })
  }
  return db
}

export const offlineQueue = {
  async addOperation(type: 'create_sale' | 'create_payment', data: any) {
    const database = await getDB()
    await database.add('operations', {
      type,
      data,
      timestamp: Date.now(),
    } as any)
  },

  async getOperations() {
    const database = await getDB()
    return database.getAll('operations')
  },

  async removeOperation(id: number) {
    const database = await getDB()
    await database.delete('operations', id)
  },

  async clear() {
    const database = await getDB()
    await database.clear('operations')
  },

  async sync() {
    if (!navigator.onLine) return

    const operations = await this.getOperations()
    
    for (const op of operations) {
      try {
        if (op.type === 'create_sale') {
          await api.createSale(op.data)
        } else if (op.type === 'create_payment') {
          await api.createPayment(op.data)
        }
        await this.removeOperation(op.id as number)
      } catch (error) {
        console.error('Error syncing operation:', error)
        // Si falla, mantener en la cola para reintentar después
      }
    }
  },
}

// Sincronizar automáticamente cuando vuelve la conexión
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    offlineQueue.sync()
  })
  
  // Intentar sincronizar al cargar la app
  if (navigator.onLine) {
    offlineQueue.sync()
  }
}

