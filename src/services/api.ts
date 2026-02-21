import axios, { AxiosInstance } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.setToken(null)
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  setToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete this.client.defaults.headers.common['Authorization']
    }
  }

  async login(username: string, password: string) {
    const { data } = await this.client.post('/auth/login', { username, password })
    return data
  }

  async register(username: string, password: string) {
    const { data } = await this.client.post('/auth/register', { username, password })
    return data
  }

  // Customers
  async getCustomers(page = 1, pageSize = 20, search?: string) {
    const { data } = await this.client.get('/customers', {
      params: { page, page_size: pageSize, search },
    })
    return data
  }

  async createCustomer(customer: { full_name: string; phone?: string }) {
    const { data } = await this.client.post('/customers', customer)
    return data
  }

  async getCustomer(id: number) {
    const { data } = await this.client.get(`/customers/${id}`)
    return data
  }

  // Sales
  async getSales(page = 1, pageSize = 20, statusFilter?: string, customerId?: number) {
    const { data } = await this.client.get('/sales', {
      params: { page, page_size: pageSize, status_filter: statusFilter, customer_id: customerId },
    })
    return data
  }

  async createSale(sale: any) {
    const { data } = await this.client.post('/sales', sale)
    return data
  }

  async getSale(id: number) {
    const { data } = await this.client.get(`/sales/${id}`)
    return data
  }

  async getSaleStatement(id: number) {
    const { data } = await this.client.get(`/sales/${id}/statement`)
    return data
  }

  async getSaleItems(id: number) {
    const { data } = await this.client.get(`/sales/${id}/items`)
    return data
  }

  // Payments
  async getPayments(page = 1, pageSize = 20, saleId?: number) {
    const { data } = await this.client.get('/payments', {
      params: { page, page_size: pageSize, sale_id: saleId },
    })
    return data
  }

  async createPayment(payment: { sale_id: number; amount: number }) {
    const { data } = await this.client.post('/payments', payment)
    return data
  }

  // Dashboard
  async getKPIs() {
    const { data } = await this.client.get('/dashboard/kpis')
    return data
  }

  async getSalesStatements(page = 1, pageSize = 20, statusFilter?: string, search?: string) {
    const { data } = await this.client.get('/dashboard/sales-statements', {
      params: { page, page_size: pageSize, status_filter: statusFilter, search },
    })
    return data
  }

  async getHistoryMonthly(year?: number, month?: number) {
    const { data } = await this.client.get('/history/monthly', {
      params: { year, month },
    })
    return data
  }

  // Upload
  async uploadImage(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    
    const { data } = await this.client.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return data
  }
}

export const api = new ApiService()

