/**
 * Utilidades para formatear y parsear montos en PYG (guaraní)
 * Formato: sin decimales, separador de miles con punto
 * Ejemplo: 167500 -> "167.500"
 */

/**
 * Formatea un número como PYG (sin decimales, separador de miles con punto)
 * @param value - Número o string numérico
 * @returns String formateado (ej: "167.500")
 */
export function formatPYG(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  
  // Redondear a entero y formatear con separador de miles
  const integer = Math.round(num)
  return integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Parsea un string de PYG a número entero
 * Acepta formatos: "167.500", "167500", "167,500", etc.
 * @param input - String con el monto
 * @returns Número entero
 */
export function parsePYG(input: string): number {
  if (!input || input.trim() === '') return 0
  
  // Remover puntos y comas (separadores de miles)
  const cleaned = input.replace(/[.,]/g, '')
  const num = parseFloat(cleaned)
  
  return isNaN(num) ? 0 : Math.round(num)
}

