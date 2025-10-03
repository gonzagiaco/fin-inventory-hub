import { useState } from "react";
import Header from "@/components/Header";
import { Upload, QrCode, Edit, Trash2, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { toast } from "sonner";

const Stock = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const stockItems = [
    { code: "A123", name: "Organic Apples", quantity: 150, category: "Fruits" },
    { code: "B456", name: "Whole Wheat Bread", quantity: 80, category: "Bakery" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpdateStock = () => {
    if (!selectedFile) {
      toast.error("Por favor, selecciona un archivo primero");
      return;
    }

    setIsUploading(true);
    
    setTimeout(() => {
      setIsUploading(false);
      toast.success("El stock se ha actualizado correctamente");
      setSelectedFile(null);
    }, 3000);
  };

  return (
    <div className="flex-1 p-6 lg:p-10">
      <Header title="Stock" showSearch />

      <main>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            {/* Filtros */}
            <div className="glassmorphism rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4 text-foreground">Filtros</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Categoría
                  </label>
                  <select className="w-full rounded-lg border-transparent bg-muted/50 backdrop-blur-sm py-3 px-4 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 shadow-sm appearance-none">
                    <option>Todas</option>
                    <option>Fruits</option>
                    <option>Bakery</option>
                    <option>Dairy</option>
                    <option>Produce</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Cantidad
                  </label>
                  <select className="w-full rounded-lg border-transparent bg-muted/50 backdrop-blur-sm py-3 px-4 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 shadow-sm appearance-none">
                    <option>Cualquiera</option>
                    <option>&lt; 100</option>
                    <option>100 - 200</option>
                    <option>&gt; 200</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center justify-center">
                    <Filter className="mr-2 h-5 w-5" />
                    <span>Aplicar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla de Stock */}
            <div className="glassmorphism rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Código</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Nombre</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Cantidad</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground">Categoría</th>
                      <th className="p-4 font-semibold text-sm text-muted-foreground text-center">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {stockItems.map((item) => (
                      <tr
                        key={item.code}
                        className="hover:bg-primary/10 transition-colors duration-300"
                      >
                        <td className="p-4 text-sm font-medium text-foreground">{item.code}</td>
                        <td className="p-4 text-sm font-medium text-foreground">{item.name}</td>
                        <td className="p-4 text-sm font-medium text-foreground">{item.quantity}</td>
                        <td className="p-4 text-sm">
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-semibold">
                          <div className="flex justify-center items-center space-x-2">
                            <button className="p-2 rounded-full hover:bg-primary/20 transition-colors duration-300 text-primary">
                              <Edit className="h-5 w-5" />
                            </button>
                            <button className="p-2 rounded-full hover:bg-red-500/20 transition-colors duration-300 text-red-500">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 flex items-center justify-between border-t border-white/10">
                <span className="text-sm text-muted-foreground">
                  Mostrando 1-2 de 2 resultados
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    className="p-2 rounded-md hover:bg-primary/10 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button className="p-2 px-4 rounded-md bg-primary/20 text-primary font-bold">
                    1
                  </button>
                  <button className="p-2 rounded-md hover:bg-primary/10 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Importar desde Excel */}
            <div className="glassmorphism rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground">Importar desde Excel</h2>
              <div className="space-y-4">
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer w-full flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-primary/50 hover:bg-primary/10 transition-colors duration-300"
                >
                  <Upload className="h-10 w-10 text-primary" />
                  <span className="mt-2 text-sm text-center text-muted-foreground">
                    {selectedFile ? selectedFile.name : "Cargar Archivo Excel"}
                  </span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {isUploading && (
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin h-9 w-9 border-4 border-primary/20 border-t-primary rounded-full" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Cargando archivo...
                    </span>
                  </div>
                )}
                <button
                  onClick={handleUpdateStock}
                  disabled={isUploading}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center justify-center"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  <span>Actualizar Stock</span>
                </button>
              </div>
            </div>

            {/* Escanear Código */}
            <div className="glassmorphism rounded-xl shadow-lg p-6 text-center">
              <h2 className="text-xl font-bold mb-4 text-foreground">Escanear Código</h2>
              <button className="w-full bg-transparent border-2 border-primary text-primary font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center justify-center hover:bg-primary/10">
                <QrCode className="mr-2 h-6 w-6" />
                <span>Escanear</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Stock;
