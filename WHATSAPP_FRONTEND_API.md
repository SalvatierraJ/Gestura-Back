# 🔌 API Endpoints para WhatsApp Frontend

## 📋 Descripción

Estos endpoints permiten al frontend gestionar la conexión de WhatsApp y obtener códigos QR como imágenes.

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT en el header:

```
Authorization: Bearer <token>
```

## 📍 Endpoints Disponibles

### 1. **Obtener Estado de WhatsApp**

```http
GET /whatsapp-admin/status
```

**Respuesta:**

```json
{
  "state": "qr_pending|ready|connecting|disconnected|authenticated|error",
  "isReady": false,
  "message": "Descripción del estado actual",
  "timestamp": "2025-07-24T12:00:00.000Z"
}
```

**Estados posibles:**

- `disconnected`: No conectado, requiere inicialización
- `connecting`: Conectando a WhatsApp
- `qr_pending`: Esperando escaneo del código QR
- `authenticated`: Autenticado, estableciendo conexión
- `ready`: Listo para enviar mensajes
- `error`: Error, requiere reinicio

---

### 2. **Obtener Código QR como Imagen**

```http
GET /whatsapp-admin/qr
```

**Respuesta exitosa (cuando hay QR disponible):**

```json
{
  "success": true,
  "qrImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qrCode": "1@abc123xyz...",
  "message": "Código QR disponible - escanea con tu teléfono"
}
```

**Respuesta cuando ya está conectado:**

```json
{
  "success": false,
  "message": "WhatsApp ya está conectado - no se necesita QR"
}
```

**Respuesta cuando no hay QR disponible:**

```json
{
  "success": false,
  "message": "QR no disponible - inicia el servicio primero"
}
```

---

### 3. **Inicializar WhatsApp**

```http
POST /whatsapp-admin/initialize
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Inicialización de WhatsApp iniciada"
}
```

---

### 4. **Reiniciar WhatsApp**

```http
POST /whatsapp-admin/restart
```

**Respuesta:**

```json
{
  "success": true,
  "message": "WhatsApp reiniciado exitosamente"
}
```

---

### 5. **Listar Sesiones Guardadas**

```http
GET /whatsapp-admin/sessions
```

**Respuesta:**

```json
[
  {
    "id": 1,
    "session_id": "whatsapp-main",
    "created_at": "2025-07-24T10:00:00.000Z",
    "updated_at": "2025-07-24T12:00:00.000Z",
    "expires_at": null
  }
]
```

---

### 6. **Limpiar Sesiones Expiradas**

```http
DELETE /whatsapp-admin/sessions/expired
```

**Respuesta:**

```json
{
  "message": "Sesiones expiradas eliminadas exitosamente"
}
```

---

### 7. **Eliminar Sesión Específica**

```http
DELETE /whatsapp-admin/sessions/:sessionId
```

**Respuesta:**

```json
{
  "message": "Sesión whatsapp-main eliminada exitosamente"
}
```

## 🎯 Flujo Recomendado para el Frontend

### **Paso 1: Verificar Estado**

```javascript
const checkStatus = async () => {
  const response = await fetch('/whatsapp-admin/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.state;
};
```

### **Paso 2: Inicializar si es Necesario**

```javascript
if (state === 'disconnected') {
  await fetch('/whatsapp-admin/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

### **Paso 3: Obtener y Mostrar QR**

```javascript
const getQR = async () => {
  const response = await fetch('/whatsapp-admin/qr', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();

  if (data.success) {
    // Mostrar imagen QR en el frontend
    document.getElementById('qr-image').src = data.qrImage;
  }
};
```

### **Paso 4: Polling de Estado**

```javascript
const pollStatus = () => {
  setInterval(async () => {
    const state = await checkStatus();
    if (state === 'ready') {
      // WhatsApp listo, ocultar QR
      hideQRCode();
    } else if (state === 'qr_pending') {
      // Mostrar QR si no se está mostrando
      await getQR();
    }
  }, 3000); // Verificar cada 3 segundos
};
```

## 🖼️ Manejo de Imágenes QR

Las imágenes QR se devuelven como **Data URL** en formato base64:

```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
```

Puedes usarlas directamente en elementos `<img>`:

```html
<img id="qr-image" src="" alt="Código QR de WhatsApp" />
```

```javascript
document.getElementById('qr-image').src = response.qrImage;
```

## ⚡ Ejemplo Completo React/Vue

```javascript
// Estado del componente
const [whatsappState, setWhatsappState] = useState('disconnected');
const [qrImage, setQrImage] = useState(null);
const [loading, setLoading] = useState(false);

// Inicializar WhatsApp
const initializeWhatsApp = async () => {
  setLoading(true);
  try {
    await fetch('/whatsapp-admin/initialize', { method: 'POST' });
    startPolling();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLoading(false);
  }
};

// Polling de estado
const startPolling = () => {
  const interval = setInterval(async () => {
    const status = await fetch('/whatsapp-admin/status').then((r) => r.json());
    setWhatsappState(status.state);

    if (status.state === 'qr_pending') {
      const qr = await fetch('/whatsapp-admin/qr').then((r) => r.json());
      if (qr.success) setQrImage(qr.qrImage);
    } else if (status.state === 'ready') {
      setQrImage(null);
      clearInterval(interval);
    }
  }, 3000);
};
```

¡Con estos endpoints el frontend puede gestionar completamente la conexión de WhatsApp! 🎉
