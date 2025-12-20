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

interface ColumnPinningState {
  [listId: string]: {
    left?: string[];
    right?: string[];
  };
}

interface SavedView {
  id: string;
  name: string;
  listId: string;
  columnVisibility: { [columnKey: string]: boolean };
  columnOrder: string[];
  columnPinning: { left?: string[]; right?: string[] };
}

interface SavedViewsState {
  [listId: string]: SavedView[];
}

interface ActiveViewState {
  [listId: string]: string | null; // View ID or null
}

interface ViewModeState {
  [listId: string]: "table" | "cards";
}

interface CardPreviewFieldsState {
  [listId: string]: string[];
}

interface SearchableColumnsState {
  [listId: string]: string[];
}

interface QuantityColumnState {
  [listId: string]: string;
}

interface PriceColumnState {
  [listId: string]: string;
}

interface ProductListStore {
  columnVisibility: ColumnVisibilityState;
  columnOrder: ColumnOrderState;
  columnPinning: ColumnPinningState;
  savedViews: SavedViewsState;
  activeView: ActiveViewState;
  collapsedLists: Set<string>;
  viewMode: ViewModeState;
  cardPreviewFields: CardPreviewFieldsState;
  searchableColumns: SearchableColumnsState;
  quantityColumn: QuantityColumnState;
  priceColumn: PriceColumnState;
  
  setColumnVisibility: (listId: string, columnKey: string, visible: boolean) => void;
  setColumnOrder: (listId: string, order: string[]) => void;
  setColumnPinning: (listId: string, pinning: { left?: string[]; right?: string[] }) => void;
  toggleListCollapse: (listId: string) => void;
  initializeCollapsedState: (listIds: string[]) => void;
  resetColumnSettings: (listId: string) => void;
  setViewMode: (listId: string, mode: "table" | "cards") => void;
  setCardPreviewFields: (listId: string, fields: string[]) => void;
  setSearchableColumns: (listId: string, columns: string[]) => void;
  initializeSearchableColumns: (listId: string, columnSchema: ColumnSchema[]) => void;
  setQuantityColumn: (listId: string, columnKey: string) => void;
  setPriceColumn: (listId: string, columnKey: string) => void;
  
  // Saved views
  saveView: (listId: string, name: string) => void;
  applyView: (listId: string, viewId: string) => void;
  renameView: (listId: string, viewId: string, newName: string) => void;
  deleteView: (listId: string, viewId: string) => void;
  setActiveView: (listId: string, viewId: string | null) => void;
  updateColumnLabel: (listId: string, columnKey: string, newLabel: string) => void;
}

export const useProductListStore = create<ProductListStore>()(
  persist(
    (set, get) => ({
      columnVisibility: {},
      columnOrder: {},
      columnPinning: {},
      savedViews: {},
      activeView: {},
      collapsedLists: new Set(),
      viewMode: {},
      cardPreviewFields: {},
      searchableColumns: {},
      quantityColumn: {},
      priceColumn: {},
      
      // Helper to initialize collapsed state for new lists
      initializeCollapsedState: (listIds: string[]) =>
        set((state) => {
          const newCollapsed = new Set(state.collapsedLists);
          listIds.forEach(id => {
            // Si la lista no tiene estado guardado, agregarla como colapsada
            if (!state.collapsedLists.has(id)) {
              newCollapsed.add(id);
            }
          });
          return { collapsedLists: newCollapsed };
        }),

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

      setColumnPinning: (listId, pinning) =>
        set((state) => ({
          columnPinning: {
            ...state.columnPinning,
            [listId]: pinning,
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
          const { [listId]: ___, ...restPinning } = state.columnPinning;
          return {
            columnVisibility: restVisibility,
            columnOrder: restOrder,
            columnPinning: restPinning,
          };
        }),

      saveView: (listId, name) =>
        set((state) => {
          const newView: SavedView = {
            id: `view_${Date.now()}`,
            name,
            listId,
            columnVisibility: state.columnVisibility[listId] || {},
            columnOrder: state.columnOrder[listId] || [],
            columnPinning: state.columnPinning[listId] || {},
          };
          return {
            savedViews: {
              ...state.savedViews,
              [listId]: [...(state.savedViews[listId] || []), newView],
            },
            activeView: {
              ...state.activeView,
              [listId]: newView.id,
            },
          };
        }),

      applyView: (listId, viewId) =>
        set((state) => {
          const view = state.savedViews[listId]?.find((v) => v.id === viewId);
          if (!view) return state;

          return {
            columnVisibility: {
              ...state.columnVisibility,
              [listId]: view.columnVisibility,
            },
            columnOrder: {
              ...state.columnOrder,
              [listId]: view.columnOrder,
            },
            columnPinning: {
              ...state.columnPinning,
              [listId]: view.columnPinning,
            },
            activeView: {
              ...state.activeView,
              [listId]: viewId,
            },
          };
        }),

      renameView: (listId, viewId, newName) =>
        set((state) => ({
          savedViews: {
            ...state.savedViews,
            [listId]: state.savedViews[listId]?.map((view) =>
              view.id === viewId ? { ...view, name: newName } : view
            ) || [],
          },
        })),

      deleteView: (listId, viewId) =>
        set((state) => ({
          savedViews: {
            ...state.savedViews,
            [listId]: state.savedViews[listId]?.filter((v) => v.id !== viewId) || [],
          },
          activeView: {
            ...state.activeView,
            [listId]: state.activeView[listId] === viewId ? null : state.activeView[listId],
          },
        })),

      setActiveView: (listId, viewId) =>
        set((state) => ({
          activeView: {
            ...state.activeView,
            [listId]: viewId,
          },
        })),

      updateColumnLabel: (listId, columnKey, newLabel) => {
        // This is a local-only update for immediate UI feedback
        // The actual persistence happens through the hook mutation
        console.log('Store: updating column label', { listId, columnKey, newLabel });
      },

      setViewMode: (listId, mode) =>
        set((state) => ({
          viewMode: {
            ...state.viewMode,
            [listId]: mode,
          },
        })),

      setCardPreviewFields: (listId, fields) =>
        set((state) => ({
          cardPreviewFields: {
            ...state.cardPreviewFields,
            [listId]: fields,
          },
        })),

      setSearchableColumns: (listId, columns) =>
        set((state) => ({
          searchableColumns: {
            ...state.searchableColumns,
            [listId]: columns,
          },
        })),

      initializeSearchableColumns: (listId, columnSchema) =>
        set((state) => {
          if (state.searchableColumns[listId]) return state;

          const defaultSearchable = columnSchema
            .filter(col => ['code', 'name'].includes(col.key) || columnSchema.indexOf(col) < 3)
            .map(col => col.key);

          return {
            searchableColumns: {
              ...state.searchableColumns,
              [listId]: defaultSearchable,
            },
          };
        }),

      setQuantityColumn: (listId, columnKey) =>
        set((state) => ({
          quantityColumn: {
            ...state.quantityColumn,
            [listId]: columnKey,
          },
        })),

      setPriceColumn: (listId, columnKey) =>
        set((state) => ({
          priceColumn: {
            ...state.priceColumn,
            [listId]: columnKey,
          },
        })),

    }),
    {
      name: 'product-list-settings',
      partialize: (state) => ({
        columnVisibility: state.columnVisibility,
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        savedViews: state.savedViews,
        activeView: state.activeView,
        viewMode: state.viewMode,
        cardPreviewFields: state.cardPreviewFields,
        searchableColumns: state.searchableColumns,
        quantityColumn: state.quantityColumn,
        priceColumn: state.priceColumn,
      }),
    }
  )
);
