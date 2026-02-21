# Backend FastAPI - Joyas API

## Instalación (Windows PowerShell)

1. Crea un entorno virtual:
```powershell
cd api
py -m venv venv
```

2. Activa el entorno virtual:
```powershell
.\venv\Scripts\Activate.ps1
```

3. Actualiza pip e instala dependencias:
```powershell
py -m pip install -U pip
py -m pip install -r requirements.txt
```

4. Crea el archivo `.env` en la carpeta `api/`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/joyas_db
JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

5. Ejecuta el servidor:
```powershell
py -m uvicorn main:app --reload
```

La API estará disponible en `http://localhost:8000`

La API estará disponible en `http://localhost:8000`

## Documentación

Una vez iniciado el servidor, visita:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints Principales

- `POST /auth/login` - Iniciar sesión
- `POST /auth/register` - Registrar usuario
- `GET /customers` - Listar clientes
- `POST /customers` - Crear cliente
- `GET /sales` - Listar ventas
- `POST /sales` - Crear venta
- `GET /sales/{id}/statement` - Estado de cuenta
- `POST /payments` - Registrar pago
- `GET /dashboard/kpis` - KPIs globales
- `POST /upload/image` - Subir imagen (jpg/png/webp, máx 5MB)

## Subida de Imágenes

### Endpoint: `POST /upload/image`

Sube una imagen y devuelve la URL para usar en `sale_item.photo_url`.

**Requisitos:**
- Autenticación JWT requerida
- Content-Type: `image/jpeg`, `image/png`, o `image/webp`
- Tamaño máximo: 5MB
- Formato: `multipart/form-data`

**Ejemplo con curl:**
```bash
curl -X POST "http://127.0.0.1:8000/upload/image" \
  -H "Authorization: Bearer <tu_token>" \
  -F "file=@/ruta/a/imagen.jpg"
```

**Respuesta:**
```json
{
  "url": "/uploads/images/550e8400-e29b-41d4-a716-446655440000.jpg"
}
```

**Ejemplo con fetch (JavaScript):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://127.0.0.1:8000/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
console.log(data.url); // "/uploads/images/uuid.jpg"
```

**Uso en creación de venta:**
Al crear un `sale_item`, incluye `photo_url` con la URL devuelta:
```json
{
  "customer_id": 1,
  "delivery_address": "Calle 123",
  "items": [
    {
      "jewel_type": "Anillo",
      "quantity": 1,
      "unit_price": 5000.00,
      "photo_url": "/uploads/images/550e8400-e29b-41d4-a716-446655440000.jpg"
    }
  ]
}
```

Las imágenes se guardan en `/api/uploads/images/` y se sirven estáticamente en `/uploads/images/<filename>`.

## ⚠️ Nota sobre Producción y Uploads

**Importante:** En hosting gratuito con filesystem efímero (como Railway, Render, Heroku), las imágenes subidas pueden perderse tras reinicio o redeploy del servidor. El directorio `uploads/images/` se crea localmente y no persiste entre reinicios.

**Recomendaciones para producción:**
- Usar storage externo (AWS S3, Cloudinary, etc.) para imágenes
- O usar un servicio de hosting con filesystem persistente
- Las imágenes actuales se guardan localmente y se pierden al reiniciar el servidor

## Producción

Para ejecutar en producción (sin auto-reload):

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

**No usar `--reload` en producción.**

### Variables de Entorno

Copia `.env.example` a `.env` y configura:

- `DATABASE_URL`: URL de conexión a PostgreSQL
- `JWT_SECRET`: Secret key para JWT (generar con: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- `CORS_ORIGINS`: Orígenes permitidos separados por comas (ej: `https://tudominio.com`)

### Healthcheck

El endpoint `GET /health` devuelve `{"status": "ok"}` para monitoreo.

