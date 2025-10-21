import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ColumnSchema } from '@/types/productList';

interface ColumnVisibilityState {
  [listId: string]: {
    [columnKey: string]: boolean;
  };
}

interface ColumnOrderState {
  [listId: string]: string[]; // Array of column keys in order
}

interface ProductListStore {
  columnVisibility: ColumnVisibilityState;
  columnOrder: ColumnOrderState;
  collapsedLists: Set<string>;
  
  setColumnVisibility: (listId: string, columnKey: string, visible: boolean) => void;
  setColumnOrder: (listId: string, order: string[]) => void;
  toggleListCollapse: (listId: string) => void;
  resetColumnSettings: (listId: string) => void;
}

export const useProductListStore = create<ProductListStore>()(
  persist(
    (set) => ({
      columnVisibility: {},
      columnOrder: {},
      collapsedLists: new Set(),

      setColumnVisibility: (listId, columnKey, visible) =>
        set((state) => ({
          columnVisibility: {
            ...state.columnVisibility,
            [listId]: {
              ...state.columnVisibility[listId],
              [columnKey]: visible,
            },
          },
        })),

      setColumnOrder: (listId, order) =>
        set((state) => ({
          columnOrder: {
            ...state.columnOrder,
            [listId]: order,
          },
        })),

      toggleListCollapse: (listId) =>
        set((state) => {
          const newCollapsed = new Set(state.collapsedLists);
          if (newCollapsed.has(listId)) {
            newCollapsed.delete(listId);
          } else {
            newCollapsed.add(listId);
          }
          return { collapsedLists: newCollapsed };
        }),

      resetColumnSettings: (listId) =>
        set((state) => {
          const { [listId]: _, ...restVisibility } = state.columnVisibility;
          const { [listId]: __, ...restOrder } = state.columnOrder;
          return {
            columnVisibility: restVisibility,
            columnOrder: restOrder,
          };
        }),
    }),
    {
      name: 'product-list-settings',
      partialize: (state) => ({
        columnVisibility: state.columnVisibility,
        columnOrder: state.columnOrder,
      }),
    }
  )
);
