# Sistema de Listas Dinámicas de Productos

Este sistema permite importar y gestionar múltiples listas de productos con estructuras de columnas dinámicas por proveedor.

## Características Principales

### 1. Importación Dinámica
- Soporta múltiples formatos: Excel (.xlsx, .xls), CSV, PDF, DOCX
- Detecta automáticamente las columnas del archivo
- Columnas estándar: `code`, `name/descripcion`, `price/precio`, `cantidad`
- Todas las columnas adicionales se almacenan dinámicamente

### 2. Múltiples Listas por Proveedor
- Cada importación crea una nueva lista independiente
- Las listas no se sobrescriben entre sí
- Visualización simultánea de todas las listas
- Sistema de colapso/expansión por lista

### 3. Tablas Dinámicas
- Columnas generadas automáticamente según el contenido
- Búsqueda por texto independiente por lista
- Ordenamiento por cualquier columna
- Configuración de visibilidad de columnas
- Scroll horizontal para listas con muchas columnas
- Columnas clave (code, name) fijadas a la izquierda

### 4. Persistencia de Configuración
- La visibilidad de columnas se guarda por lista
- El estado de colapso/expansión se persiste
- Configuración individual por cada lista

## Configuración del Backend Python

### Requisitos
1. Backend Python con FastAPI instalado
2. Archivos `main.py` y `processor.py` disponibles
3. Backend corriendo en una URL accesible

### Variables de Entorno
Configura la URL del backend Python:
- Variable: `PYTHON_BACKEND_URL`
- Ejemplo: `http://localhost:8000` o `https://tu-backend.com`

### Endpoint del Backend
El backend debe exponer el endpoint:
```
POST /procesar/{proveedor}
```

Acepta:
- FormData con el archivo subido
- Parámetro `proveedor` en la URL

Retorna:
```json
{
  "proveedor": "nombre_proveedor",
  "productos": [
    {
      "code": "PROD001",
      "name": "Producto 1",
      "price": 100.50,
      "extra_field_1": "valor1",
      "extra_field_2": "valor2"
    }
  ]
}
```

## Estructura de Datos

### Base de Datos

#### Tabla: `product_lists`
Almacena información de cada lista importada:
- `id`: UUID único
- `supplier_id`: Referencia al proveedor
- `name`: Nombre de la lista
- `file_name`: Nombre del archivo original
- `file_type`: Tipo de archivo (xlsx, pdf, etc.)
- `product_count`: Cantidad de productos
- `column_schema`: Esquema JSON de columnas
- `created_at`, `updated_at`: Timestamps

#### Tabla: `dynamic_products`
Almacena productos con estructura flexible:
- `id`: UUID único
- `list_id`: Referencia a la lista
- `code`: Código del producto (opcional)
- `name`: Nombre del producto (opcional)
- `price`: Precio (opcional)
- `quantity`: Cantidad (opcional)
- `data`: JSONB con campos adicionales dinámicos
- `created_at`, `updated_at`: Timestamps

### Índices
- Índice GIN en `data` para búsquedas eficientes en campos dinámicos
- Índices en `supplier_id`, `list_id` para joins rápidos

## Uso

### Importar una Nueva Lista
1. Navega a la página de Proveedores
2. Haz clic en un proveedor para ver sus listas
3. Usa el botón "Seleccionar Archivo" en la sección de importación
4. Selecciona un archivo (Excel, CSV, PDF, DOCX)
5. El sistema procesará el archivo y creará una nueva lista

### Gestionar Listas
- **Colapsar/Expandir**: Haz clic en el encabezado de la lista
- **Configurar Columnas**: Usa el botón "Columnas" para mostrar/ocultar columnas
- **Buscar Productos**: Usa la barra de búsqueda en cada lista
- **Ordenar**: Haz clic en los encabezados de columna
- **Eliminar Lista**: Botón de eliminar en el encabezado de cada lista

### Advertencias
El sistema muestra una advertencia si:
- Se importa una lista con estructura de columnas similar a una existente
- Esto ayuda a evitar duplicados accidentales

## Tecnologías Utilizadas

### Frontend
- **React + TypeScript**: Framework principal
- **TanStack Table**: Tablas dinámicas con sorting y filtrado
- **Zustand**: State management con persistencia
- **Shadcn UI**: Componentes de UI
- **Tailwind CSS**: Estilos

### Backend
- **Supabase**: Base de datos PostgreSQL con RLS
- **Edge Functions**: Procesamiento de archivos
- **Python FastAPI**: Backend de procesamiento de documentos

## Seguridad

- **RLS Policies**: Cada usuario solo ve sus propias listas y productos
- **Autenticación**: Todas las operaciones requieren autenticación
- **Validación**: Los archivos son validados antes de procesarse
- **Tipos seguros**: TypeScript previene errores de tipos

## Escalabilidad

El sistema está diseñado para:
- Manejar miles de productos por lista
- Múltiples listas simultáneas por proveedor
- Búsquedas eficientes con índices GIN
- Paginación futura si es necesario

## Limitaciones Actuales

- El backend Python debe estar corriendo y accesible
- Archivos muy grandes (>50MB) pueden tardar en procesarse
- El número de columnas mostradas simultáneamente está limitado por el ancho de pantalla (scroll horizontal disponible)

## Próximas Mejoras Potenciales

1. Paginación en tablas con muchos productos
2. Exportación de listas a diferentes formatos
3. Comparación de listas del mismo proveedor
4. Historial de cambios en productos
5. Fusión de listas
6. Análisis de duplicados entre listas
