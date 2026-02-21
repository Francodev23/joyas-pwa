# Joyas PWA - Control de Ventas

PWA mobile-first para registrar ventas de joyas y controlar deudas. Construida con FastAPI (backend) y React + TypeScript (frontend).

## 🚀 Características

- ✅ Autenticación JWT
- ✅ Registro de ventas y clientes
- ✅ Control de pagos parciales
- ✅ Dashboard con KPIs
- ✅ PWA installable (offline-first)
- ✅ Cola de operaciones offline con IndexedDB
- ✅ UI 100% mobile-first
- ✅ Paginación y búsquedas optimizadas

## 📋 Requisitos Previos

- Python 3.13+ (Windows con PowerShell)
- Node.js 18+
- PostgreSQL 12+

## 🛠️ Instalación

### 1. Base de Datos

Ejecuta el script SQL en `bda.txt` para crear las tablas y vistas:

```powershell
psql -U postgres -d tu_base_de_datos -f bda.txt
```

### 2. Backend (FastAPI) - Windows PowerShell

```powershell
cd api
py -m venv venv
.\venv\Scripts\Activate.ps1
py -m pip install -U pip
py -m pip install -r requirements.txt
```

Crea un archivo `.env` en la carpeta `api/`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/joyas_db
JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

Inicia el servidor:

```powershell
py -m uvicorn main:app --reload
```

### 3. Frontend (React)

```bash
npm install
npm run dev
```

La app estará disponible en `http://localhost:3000`

## 📱 Uso

1. **Primer uso**: Registra un usuario en `/auth/register` (o usa el endpoint directamente)
2. **Login**: Inicia sesión con tus credenciales
3. **Dashboard**: Ve KPIs y ventas recientes
4. **Nueva Venta**: Crea clientes y registra ventas con múltiples items
5. **Pagos**: Registra pagos parciales desde el detalle de venta
6. **Offline**: La app funciona offline y sincroniza automáticamente al reconectar

## 🏗️ Estructura del Proyecto

```
yess/
├── api/                 # Backend FastAPI
│   ├── main.py         # Endpoints principales
│   ├── auth.py         # Autenticación JWT
│   ├── models.py       # Modelos SQLAlchemy
│   ├── schemas.py      # Schemas Pydantic
│   ├── database.py     # Configuración DB
│   └── config.py       # Configuración desde .env
├── src/
│   ├── pages/          # Páginas React
│   ├── services/       # API client y offline queue
│   ├── contexts/       # Context providers
│   └── App.tsx         # Router principal
├── bda.txt            # Script SQL de la base de datos
└── package.json       # Dependencias frontend
```

## 🔧 Endpoints API

- `POST /auth/login` - Login
- `POST /auth/register` - Registro
- `GET /customers` - Listar clientes (paginado, búsqueda)
- `POST /customers` - Crear cliente
- `GET /sales` - Listar ventas (filtros por estado)
- `POST /sales` - Crear venta
- `GET /sales/{id}/statement` - Estado de cuenta de venta
- `POST /payments` - Registrar pago
- `GET /dashboard/kpis` - KPIs globales
- `GET /dashboard/sales-statements` - Ventas con estados

## 📦 Build para Producción

### Frontend:
```bash
npm run build
```

### Backend:
```powershell
cd api
py -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🔒 Seguridad

- Cambia `JWT_SECRET` en producción
- Configura CORS apropiadamente en `main.py`
- Usa HTTPS en producción

## 📝 Notas

- La app está diseñada para un solo usuario (no multi-tenant)
- No hay inventario, solo registro de lo vendido
- Las vistas `v_sale_statement` y `v_kpis` se usan para el dashboard
- IndexedDB guarda operaciones offline que se sincronizan automáticamente

