import Header from "@/components/Header";

const Proveedores = () => {
  return (
    <div className="flex-1 p-6 lg:p-10">
      <Header
        title="Proveedores"
        subtitle="Gestiona tus proveedores y sus productos."
        showSearch
      />
      <div className="glassmorphism rounded-xl shadow-lg p-12 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Próximamente</h2>
        <p className="text-muted-foreground">
          Esta sección está en desarrollo. Pronto podrás gestionar tus proveedores aquí.
        </p>
      </div>
    </div>
  );
};

export default Proveedores;
