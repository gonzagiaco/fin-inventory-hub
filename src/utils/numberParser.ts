export function parseNumber(input: string): number {
    if (input == null) return NaN;
    let str = String(input).trim();
    // Eliminar símbolos no numéricos salvo coma y punto
    str = str.replace(/[^0-9.,-]/g, "");
    if (!str) return NaN;

    // Manejar signos negativos (ej: -1.234,56)
    const isNegative = str.startsWith("-");
    if (isNegative) str = str.slice(1);

    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");

    if (lastComma !== -1 && lastDot !== -1) {
        // Tiene coma y punto: decidir cuál es decimal según la posición
        if (lastComma > lastDot) {
        // formato "1.234,56" => quitar puntos (miles), cambiar coma por punto (decimal)
        str = str.replace(/\./g, "");
        str = str.replace(/,/g, ".");
        } else {
        // formato "1,234.56" => quitar comas (miles)
        str = str.replace(/,/g, "");
        }
    } else if (lastComma !== -1) {
        // Solo coma presente -> asumir coma decimal
        str = str.replace(/,/g, ".");
    } else {
        // Solo punto o ninguno -> parseFloat lo manejará
    }

    const num = parseFloat(str);
    // Redondear a 2 decimales
    const rounded = Math.round(num * 100) / 100;
    return isNaN(rounded) ? NaN : (isNegative ? -rounded : rounded);
}
