import Header from "@/components/Header";
import { FileSpreadsheet, Info, Database, Search, FileDown, Settings, FileText, Wifi, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";

const Ayuda = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex-1 p-4 lg:px-4 lg:py-10">
      <Header
        title="Ayuda"
        subtitle="¿Necesitas asistencia?"
        showSearch={false}
      />

      <div className="space-y-6">
        {/* Configuración de Proveedores */}
        <div className="glassmorphism rounded-xl shadow-lg p-6 space-y-4 w-full">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6" />
            Configuración de Proveedores
          </h2>
          <p className="text-muted-foreground text-sm">
            Aprende a gestionar tus proveedores y listas de productos de forma
            eficiente.
          </p>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de columnas en listas
            </h3>
            <p className="text-muted-foreground text-sm">
              Configura cómo se interpretan las columnas de tus archivos Excel,
              CSV, PDF y Word:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Ve a <strong>Proveedores</strong> y selecciona un proveedor
              </li>
              <li>Haz clic en la lista de productos que quieres configurar</li>
              <li>
                Presiona el botón <strong>"Configurar lista"</strong>
              </li>
              <li>Selecciona las columnas para código, nombre y precio</li>
              <li>
                Guarda los cambios - el sistema actualizará el índice
                automáticamente
              </li>
            </ol>
          </div>
        </div>

        {/* Archivos con Múltiples Tablas */}
        <div className="glassmorphism rounded-xl shadow-lg p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Archivos con Múltiples Tablas
          </h2>
          <p className="text-muted-foreground text-sm">
            Si tu archivo Excel contiene múltiples tablas con diferentes nombres
            de columnas (por ejemplo, "Descripcion" en una tabla y "Medida
            descripcion" en otra), puedes configurar todas las variantes
            posibles.
          </p>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">
              Cómo configurar múltiples variantes:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                En <strong>Stock</strong>, abre la lista del proveedor
              </li>
              <li>
                Haz clic en <strong>"Configurar lista"</strong>
              </li>
              <li>
                En <strong>"Campos de Código"</strong> y{" "}
                <strong>"Campos de Nombre/Descripción"</strong>, selecciona
                todas las variantes de columnas que existan:
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>Marca cada checkbox para incluir esa columna</li>
                  <li>Puedes seleccionar múltiples columnas simultáneamente</li>
                  <li>
                    El sistema buscará en el orden que aparecen en tu lista
                  </li>
                </ul>
              </li>
              <li>
                El sistema automáticamente usará{" "}
                <strong>la primera columna que encuentre con datos</strong> en
                cada producto
              </li>
              <li>
                Ejemplo: Si seleccionas "Descripcion" y "Medida descripcion":
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>El sistema buscará primero en "Descripcion"</li>
                  <li>Si está vacío, buscará en "Medida descripcion"</li>
                  <li>Usará la primera que tenga un valor válido</li>
                </ul>
              </li>
            </ol>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Recomendación</AlertTitle>
            <AlertDescription>
              Configura todas las variantes de columnas al subir un archivo
              nuevo. Esto asegura que todos los productos tengan datos completos
              incluso si vienen de diferentes tablas dentro del mismo Excel.
            </AlertDescription>
          </Alert>
        </div>

        {/* Búsqueda */}
        <div className="glassmorphism rounded-xl shadow-lg p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Search className="h-6 w-6" />
            Búsqueda de Productos
          </h2>
          <p className="text-muted-foreground text-sm">
            El sistema de búsqueda funciona tanto online como offline:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>Online:</strong> Búsqueda rápida en la base de datos
              usando el índice optimizado
            </li>
            <li>
              <strong>Offline:</strong> Búsqueda local en los datos
              sincronizados
            </li>
            <li>
              Busca por código, nombre o cualquier campo configurado en el mapeo
            </li>
            <li>
              Los resultados respetan las configuraciones de múltiples variantes
            </li>
          </ul>
        </div>

        {/* Exportación */}
        <div className="glassmorphism rounded-xl shadow-lg p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileDown className="h-6 w-6" />
            Exportación de Pedidos
          </h2>
          <p className="text-muted-foreground text-sm">
            Exporta tus pedidos agrupados por proveedor:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Agrega productos al carrito de pedidos desde Stock</li>
            <li>Revisa las cantidades en el carrito</li>
            <li>
              Haz clic en <strong>"Exportar pedidos"</strong>
            </li>
            <li>Se generarán archivos Excel separados por proveedor</li>
            <li>Cada archivo contendrá solo los productos de ese proveedor</li>
          </ol>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Aclaración</AlertTitle>
            <AlertDescription>
              El precio que se agrega al subtotal y total se evalúa según la
              columna seleccionada en{" "}
              <strong>"Columna de precio para carrito de pedidos"</strong>{" "}
              dentro de la Configuración de lista. En caso de no seleccionar una
              columna, se utilizará la <strong>"Clave de PRECIO"</strong> por
              defecto.
            </AlertDescription>
          </Alert>
        </div>

        {/* Remitos */}
        <div className="glassmorphism rounded-xl shadow-lg p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Gestión de Remitos
          </h2>
          <p className="text-muted-foreground text-sm">
            Los remitos te permiten registrar entregas y gestionar el stock
            automáticamente:
          </p>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Crear un Remito</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Ve a <strong>Remitos</strong> y haz clic en{" "}
                <strong>"Nuevo Remito"</strong>
              </li>
              <li>
                Completa los datos del cliente (nombre, dirección, teléfono)
              </li>
              <li>Busca y agrega productos con el buscador integrado</li>
              <li>Ajusta las cantidades según la entrega</li>
              <li>El sistema valida automáticamente el stock disponible</li>
              <li>Indica el monto pagado (opcional) y agrega notas</li>
              <li>Al crear el remito, el stock se descuenta automáticamente</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Funciones Principales</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                <strong>Control de Stock:</strong> No permite agregar más
                unidades de las disponibles
              </li>
              <li>
                <strong>Gestión de Pagos:</strong> Marca remitos como pagados o
                controla saldos pendientes
              </li>
              <li>
                <strong>Editar/Eliminar:</strong> Modifica remitos existentes o
                elimínalos (revierte el stock automáticamente)
              </li>
              <li>
                <strong>Exportar PDF:</strong> Genera PDFs profesionales
              </li>
              <li>
                <strong>Whatsapp:</strong> Envia el remito por whatsapp a tu cliente
              </li>
              <li>
                <strong>Búsqueda y Filtros:</strong> Filtra por estado
                (pendiente/pagado) y busca por cliente
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-600" />
              <WifiOff className="h-5 w-5 text-orange-600" />
              Modo Online y Offline
            </h3>
            <p className="text-muted-foreground text-sm">
              Los remitos funcionan completamente offline con sincronización
              automática:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                <strong>Online:</strong> Todas las operaciones se sincronizan
                inmediatamente con la nube
              </li>
              <li>
                <strong>Offline:</strong> Crea, edita y elimina remitos sin
                conexión
              </li>
              <li>
                <strong>Stock Local:</strong> El stock se actualiza localmente
                aunque estés offline
              </li>
              <li>
                <strong>Sincronización Automática:</strong> Al recuperar
                conexión, todos los cambios se sincronizan automáticamente
              </li>
              <li>
                <strong>Operaciones Pendientes:</strong> El sistema mantiene una
                cola de operaciones que se procesa al volver online
              </li>
            </ul>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Importante</AlertTitle>
            <AlertDescription>
              Cuando editas un remito, el sistema primero revierte el stock de
              los productos originales y luego descuenta los nuevos. Si eliminas
              un remito, el stock se revierte automáticamente. Todas estas
              operaciones funcionan tanto online como offline.
            </AlertDescription>
          </Alert>
        </div>

        {/* Contacto */}
        <div className="glassmorphism rounded-xl shadow-lg p-6 text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">
            ¿Necesitas más ayuda?
          </h2>
          <p className="text-muted-foreground text-sm">
            Si tienes alguna pregunta adicional o necesitas soporte técnico,
            contáctanos.
          </p>
        </div>

        <a
          href="https://www.inspirawebstudio.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col md:flex-row items-center gap-1"
        >
          <img src="LogoTransparente.png" width={35} alt="" />
          <p className="text-xs md:text-lg">
            Inspira Web Studio | Todos los derechos reservados.
          </p>
        </a>
      </div>
    </div>
  );
};

export default Ayuda;
