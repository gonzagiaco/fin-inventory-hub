import { create } from "zustand";
import { fetchAllListsAndProducts } from "@/services/productsLoader";
import type { EnrichedProduct } from "@/hooks/useAllDynamicProducts";

interface ProductGlobalStore {
  productsByList: Map<string, EnrichedProduct[]>;
  listDetails: Map<string, any>;
  suppliers: Array<{ id: string; name: string; logo?: string | null }>;
  isLoaded: boolean;
  setData: (
    pbl: Map<string, EnrichedProduct[]>,
    ld: Map<string, any>,
    s: Array<{ id: string; name: string; logo?: string | null }>
  ) => void;
  ensureLoaded: () => Promise<void>;
}

export const useProductGlobalStore = create<ProductGlobalStore>((set, get) => ({
  productsByList: new Map(),
  listDetails: new Map(),
  suppliers: [],
  isLoaded: false,
  setData: (pbl, ld, s) => set({ productsByList: pbl, listDetails: ld, suppliers: s, isLoaded: true }),
  ensureLoaded: async () => {
    if (get().isLoaded) return;
    const { productsByList, listDetails, suppliers } = await fetchAllListsAndProducts();
    set({ productsByList, listDetails, suppliers, isLoaded: true });
  },
}));
