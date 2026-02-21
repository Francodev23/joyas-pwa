# Joyas App - Frontend PWA

Frontend PWA mobile-first para control de ventas de joyas.

## 🚀 Instalación

```powershell
cd app
npm install
```

## 📝 Configuración

Crea un archivo `.env` en la carpeta `app/`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## 🎨 Iconos PWA

Para que la PWA sea installable, necesitas crear los iconos:

1. Crea dos imágenes PNG:
   - `pwa-192x192.png` (192x192 píxeles)
   - `pwa-512x512.png` (512x512 píxeles)

2. Colócalas en la carpeta `public/`

3. Puedes usar cualquier herramienta de diseño o generador online de iconos PWA

## 🏃 Desarrollo

```powershell
npm run dev
```

La app estará disponible en `http://localhost:5000`

## 📦 Build

```powershell
npm run build
```

## ✨ Características

- ✅ PWA installable
- ✅ Offline-first con cache del app shell
- ✅ UI mobile-first (sin scroll horizontal)
- ✅ Skeleton loading
- ✅ Indicador de estado Online/Offline
- ✅ Autenticación JWT
- ✅ Wrapper API con manejo de errores

