import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Settings2,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { ColumnSchema } from "@/types/productList";
import { useProductListStore } from "@/stores/productListStore";
import { toast } from "sonner";

interface ColumnSettingsDrawerProps {
  listId: string;
  columnSchema: ColumnSchema[];
}

interface SortableItemProps {
  id: string;
  column: ColumnSchema;
  isVisible: boolean;
  isDisabled: boolean;
  onToggle: (key: string, visible: boolean) => void;
}

function SortableItem({ id, column, isVisible, isDisabled, onToggle }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md bg-card border border-border hover:bg-accent/50 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <Checkbox
        id={`col-${column.key}`}
        checked={isVisible}
        onCheckedChange={(checked) => onToggle(column.key, checked as boolean)}
        disabled={isDisabled}
      />
      <Label htmlFor={`col-${column.key}`} className="flex-1 cursor-pointer text-sm">
        {column.label}
        {column.isStandard && (
          <span className="text-xs text-muted-foreground ml-1">(fija)</span>
        )}
      </Label>
      {isVisible ? (
        <Eye className="w-4 h-4 text-muted-foreground" />
      ) : (
        <EyeOff className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}

export const ColumnSettingsDrawer = ({ listId, columnSchema }: ColumnSettingsDrawerProps) => {
  const {
    columnVisibility,
    columnOrder,
    savedViews,
    activeView,
    setColumnVisibility,
    setColumnOrder,
    resetColumnSettings,
    saveView,
    applyView,
    renameView,
    deleteView,
  } = useProductListStore();

  const [open, setOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentOrder = columnOrder[listId] || columnSchema.map((c) => c.key);
  const orderedColumns = currentOrder
    .map((key) => columnSchema.find((c) => c.key === key))
    .filter(Boolean) as ColumnSchema[];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      setColumnOrder(listId, newOrder);
    }
  };

  const handleToggleColumn = (key: string, visible: boolean) => {
    setColumnVisibility(listId, key, visible);
  };

  const handleShowAll = () => {
    columnSchema.forEach((col) => {
      if (!col.isStandard) {
        setColumnVisibility(listId, col.key, true);
      }
    });
    toast.success("Todas las columnas visibles");
  };

  const handleHideAll = () => {
    columnSchema.forEach((col) => {
      if (!col.isStandard) {
        setColumnVisibility(listId, col.key, false);
      }
    });
    toast.success("Columnas no esenciales ocultas");
  };

  const handleReset = () => {
    resetColumnSettings(listId);
    toast.success("Configuración restablecida");
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) {
      toast.error("Ingresa un nombre para la vista");
      return;
    }
    saveView(listId, newViewName.trim());
    setNewViewName("");
    toast.success(`Vista "${newViewName}" guardada`);
  };

  const handleApplyView = (viewId: string) => {
    applyView(listId, viewId);
    const view = savedViews[listId]?.find((v) => v.id === viewId);
    toast.success(`Vista "${view?.name}" aplicada`);
  };

  const handleRenameView = (viewId: string) => {
    if (!editingViewName.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    renameView(listId, viewId, editingViewName.trim());
    setEditingViewId(null);
    setEditingViewName("");
    toast.success("Vista renombrada");
  };

  const handleDeleteView = (viewId: string) => {
    const view = savedViews[listId]?.find((v) => v.id === viewId);
    deleteView(listId, viewId);
    toast.success(`Vista "${view?.name}" eliminada`);
  };

  const currentActiveView = activeView[listId];
  const activeViewName = savedViews[listId]?.find((v) => v.id === currentActiveView)?.name;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Columnas
          {activeViewName && (
            <span className="text-xs text-muted-foreground">({activeViewName})</span>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Configuración de Columnas</DrawerTitle>
          <DrawerDescription>
            Personaliza la visibilidad y orden de las columnas. Arrastra para reordenar.
          </DrawerDescription>
          {activeViewName && (
            <div className="text-sm text-muted-foreground mt-2">
              Vista activa: <span className="font-medium text-foreground">{activeViewName}</span>
            </div>
          )}
        </DrawerHeader>

        <ScrollArea className="h-[50vh] px-4">
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Acciones Rápidas</h4>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleShowAll}>
                  <Eye className="w-4 h-4 mr-2" />
                  Mostrar todas
                </Button>
                <Button variant="outline" size="sm" onClick={handleHideAll}>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Ocultar opcionales
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>

            <Separator />

            {/* Column List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Columnas</h4>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={currentOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {orderedColumns.map((column) => {
                      const isVisible = columnVisibility[listId]?.[column.key] !== false;
                      return (
                        <SortableItem
                          key={column.key}
                          id={column.key}
                          column={column}
                          isVisible={isVisible}
                          isDisabled={column.isStandard || false}
                          onToggle={handleToggleColumn}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <Separator />

            {/* Saved Views */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Vistas Guardadas</h4>
              
              {/* Save New View */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre de la vista"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveView()}
                />
                <Button size="sm" onClick={handleSaveView}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </Button>
              </div>

              {/* View List */}
              {savedViews[listId]?.length > 0 && (
                <div className="space-y-2 mt-4">
                  {savedViews[listId].map((view) => (
                    <div
                      key={view.id}
                      className={`flex items-center gap-2 p-2 rounded-md border ${
                        currentActiveView === view.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      {editingViewId === view.id ? (
                        <>
                          <Input
                            value={editingViewName}
                            onChange={(e) => setEditingViewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameView(view.id);
                              if (e.key === "Escape") setEditingViewId(null);
                            }}
                            className="h-8"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRenameView(view.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingViewId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{view.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApplyView(view.id)}
                            disabled={currentActiveView === view.id}
                          >
                            Aplicar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingViewId(view.id);
                              setEditingViewName(view.name);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteView(view.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
