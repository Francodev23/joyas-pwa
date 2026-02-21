import { useState, useEffect } from 'react'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('joyas_token')
    setIsAuthenticated(!!token)
    setLoading(false)
  }, [])

  const login = (token: string) => {
    localStorage.setItem('joyas_token', token)
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem('joyas_token')
    setIsAuthenticated(false)
  }

  return { isAuthenticated, loading, login, logout }
}

