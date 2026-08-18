import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatDateEs(dateStr: string, pattern = "d MMM yyyy"): string {
  try {
    return format(parseISO(dateStr), pattern, { locale: es });
  } catch {
    return dateStr;
  }
}

export function formatDateShortEs(dateStr: string): string {
  return formatDateEs(dateStr, "d MMM");
}
