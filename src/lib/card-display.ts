export function cardBrandLabel(brand: string | null): string {
  if (!brand) return "Card";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function formatCardExpiry(
  expMonth: number | null,
  expYear: number | null
): string | null {
  if (!expMonth || !expYear) return null;
  return `${String(expMonth).padStart(2, "0")}/${expYear}`;
}
