import Header from "@/components/Header";

const Ayuda = () => {
  return (
    <div className="flex-1 p-6 lg:p-10">
      <Header title="Ayuda" subtitle="¿Necesitas asistencia?" showSearch={false} />
      <div className="glassmorphism rounded-xl shadow-lg p-12 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Centro de Ayuda</h2>
        <p className="text-muted-foreground">
          Si tienes alguna pregunta o necesitas soporte, contáctanos.
        </p>
      </div>
    </div>
  );
};

export default Ayuda;
