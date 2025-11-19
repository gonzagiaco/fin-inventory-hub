export function normalizeRawPrice(input: any): number | null {
    if (input === null || input === undefined) return null;
    if (typeof input === "number") return isFinite(input) ? Number(input.toFixed(2)) : null;
    let str = String(input).trim();
    if (!str) return null;
    str = str.replace(/[^0-9.,()\-]/g, "");
    if (!str) return null;
    const isNegative = /^-/.test(str) || (str.startsWith("(") && str.endsWith(")"));
    str = str.replace(/^-/,'');
    if (str.startsWith("(") && str.endsWith(")")) str = str.slice(1,-1);
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    let decimalSep = "";
    if (lastComma !== -1 || lastDot !== -1) {
        decimalSep = lastComma > lastDot ? "," : ".";
    }
    if (decimalSep) {
        const parts = str.split(decimalSep);
        const intPart = parts[0].replace(/[.,]/g, "");
        const fracPart = parts.slice(1).join("").replace(/[^0-9]/g, "");
        // Heurística: si sólo hay un separador y la parte "decimal" tiene 3 dígitos,
        // es muy probable que sea un separador de miles (ej: "2.500" => 2500)
        const sepCount = (str.match(/[.,]/g) || []).length;
        if (parts.length === 2 && fracPart.length === 3 && sepCount === 1) {
            str = intPart + fracPart; // tratar como miles
        } else {
            str = intPart + "." + fracPart;
        }
    } else {
        str = str.replace(/[.,]/g, "");
    }
    const num = parseFloat(str);
    if (!isFinite(num)) return null;
    const rounded = Number(num.toFixed(2));
    return isNegative ? -rounded : rounded;
}

export function formatARS(value: number | null | undefined): string {
    if (value === null || value === undefined || !isFinite(value)) return "-";
    try {
        // Intentar con Intl primero
        const formattedIntl = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
        return `$ ${formattedIntl}`;
    } catch {
        // Fallback manual si Intl falla o ambiente no soporta locale
        const abs = Math.abs(Number(value));
        const fixed = abs.toFixed(2); // 344505.41
        const [intPartRaw, decPart] = fixed.split(".");
        const intPart = intPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const sign = value < 0 ? "-" : "";
        return `${sign}$ ${intPart},${decPart}`;
    }
}

export function formatForTable(value: number | null | undefined): string {
    if (value === null || value === undefined || !isFinite(value)) return "-";
    // Formato de tabla: sin separadores de miles, decimal con punto (ej: 344505.41)
    return Number(value).toFixed(2);
}

export function parseNumber(input: any): number {
    const v = normalizeRawPrice(input);
    return v === null ? NaN : v;
}
