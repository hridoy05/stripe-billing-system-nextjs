export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  lockedContent: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "prod_starter_pack",
    slug: "starter-pack",
    name: "Starter Pack",
    description: "The essentials: templates, checklists, and a quickstart guide.",
    priceCents: 900,
    currency: "usd",
    lockedContent:
      "Welcome to the Starter Pack! Your assets: 1) Payment-flow checklist, 2) Webhook testing templates, 3) The 10-minute quickstart guide.",
  },
  {
    id: "prod_pro_toolkit",
    slug: "pro-toolkit",
    name: "Pro Toolkit",
    description: "Advanced playbooks and production-ready payment patterns.",
    priceCents: 4900,
    currency: "usd",
    lockedContent:
      "Welcome to the Pro Toolkit! Your assets: production payment patterns, reconciliation playbooks, and a set of idempotency recipes.",
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}
