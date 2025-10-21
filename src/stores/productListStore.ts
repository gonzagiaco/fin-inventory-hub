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

interface ProductListStore {
  columnVisibility: ColumnVisibilityState;
  columnOrder: ColumnOrderState;
  columnPinning: ColumnPinningState;
  savedViews: SavedViewsState;
  activeView: ActiveViewState;
  collapsedLists: Set<string>;
  
  setColumnVisibility: (listId: string, columnKey: string, visible: boolean) => void;
  setColumnOrder: (listId: string, order: string[]) => void;
  setColumnPinning: (listId: string, pinning: { left?: string[]; right?: string[] }) => void;
  toggleListCollapse: (listId: string) => void;
  resetColumnSettings: (listId: string) => void;
  
  // Saved views
  saveView: (listId: string, name: string) => void;
  applyView: (listId: string, viewId: string) => void;
  renameView: (listId: string, viewId: string, newName: string) => void;
  deleteView: (listId: string, viewId: string) => void;
  setActiveView: (listId: string, viewId: string | null) => void;
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
    }),
    {
      name: 'product-list-settings',
      partialize: (state) => ({
        columnVisibility: state.columnVisibility,
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        savedViews: state.savedViews,
        activeView: state.activeView,
      }),
    }
  )
);
