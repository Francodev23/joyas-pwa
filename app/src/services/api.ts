const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

interface ApiError {
  detail?: string
  message?: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private getToken(): string | null {
    return localStorage.getItem('joyas_token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (response.status === 401) {
        localStorage.removeItem('joyas_token')
        window.location.href = '/login'
        throw new Error('No autorizado')
      }

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.message || `Error ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Error de conexión')
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient(API_URL)

// Tipos para KPIs
export interface KPIs {
  total_joyas_vendidas: number
  total_ya_pagado: number
  dinero_faltante: number
}

// Funciones específicas
export const getKPIs = (): Promise<KPIs> => {
  return api.get<KPIs>('/kpis')
}

export const login = (username: string, password: string): Promise<{ access_token: string; token_type: string }> => {
  return api.post<{ access_token: string; token_type: string }>('/auth/login', { username, password })
}

