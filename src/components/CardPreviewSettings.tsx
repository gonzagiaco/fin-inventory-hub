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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, GripVertical, Eye } from "lucide-react";
import { Edit2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProductLists } from "@/hooks/useProductLists";
import { ColumnSchema } from "@/types/productList";
import { useProductListStore } from "@/stores/productListStore";
import { toast } from "sonner";

interface CardPreviewSettingsProps {
  listId: string;
  columnSchema: ColumnSchema[];
  fixedKeys?: string[];
}

interface SortablePreviewItemProps {
  id: string;
  column: ColumnSchema;
  isSelected: boolean;
  onToggle: (key: string, selected: boolean) => void;
  disableToggle?: boolean;
  onLabelChange: (key: string, newLabel: string) => void;
  currentLabel: string;
}

function SortablePreviewItem({ 
  id, 
  column, 
  isSelected, 
  onToggle, 
  disableToggle, 
  onLabelChange,
  currentLabel 
}: SortablePreviewItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(currentLabel);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveLabel = () => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== currentLabel) {
      onLabelChange(column.key, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditLabel(currentLabel);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md bg-card border border-border hover:bg-accent/50 transition-colors ${!isEditing ? "select-none" : ""}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing select-none">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <Checkbox
        id={`preview-${column.key}`}
        checked={isSelected}
        disabled={disableToggle}
        onCheckedChange={(checked) => onToggle(column.key, checked as boolean)}
      />

      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveLabel();
              if (e.key === "Escape") handleCancelEdit();
            }}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveLabel}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Label htmlFor={`preview-${column.key}`} className="flex-1 cursor-pointer text-sm truncate select-none">
          {currentLabel}
        </Label>
      )}

      {!isEditing && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      )}

      {isSelected && <Eye className="w-4 h-4 text-primary" />}
    </div>
  );
}

export function CardPreviewSettings({
  listId,
  columnSchema,
  fixedKeys = ["quantity"],
}: CardPreviewSettingsProps) {
  const { cardPreviewFields, setCardPreviewFields, updateColumnLabel } = useProductListStore();
  const { updateColumnSchema } = useProductLists();
  const [open, setOpen] = useState(false);
  
  const ensureIncludes = (arr: string[], key: string) =>
    arr.includes(key) ? arr : [key, ...arr];

  const ensureFixedKeys = (arr: string[]) =>
    fixedKeys.reduce((result, key) => ensureIncludes(result, key), arr);

  const defaultFields = ensureFixedKeys(
    columnSchema.slice(0, 4).map(c => c.key),
  );

  const stored = cardPreviewFields[listId];
  const currentPreviewFields =
    stored && stored.length ? ensureFixedKeys(stored) : defaultFields;
  
  const [localPreviewFields, setLocalPreviewFields] = useState<string[]>(currentPreviewFields);
  const [localLabelEdits, setLocalLabelEdits] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedColumns = localPreviewFields
    .map((key) => columnSchema.find((c) => c.key === key))
    .filter(Boolean) as ColumnSchema[];

  const remainingColumns = columnSchema.filter(
    col => !localPreviewFields.includes(col.key)
  );

  const allOrderedColumns = [...orderedColumns, ...remainingColumns];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localPreviewFields.indexOf(active.id as string);
      const newIndex = localPreviewFields.indexOf(over.id as string);
      const newOrder = arrayMove(localPreviewFields, oldIndex, newIndex);
      setLocalPreviewFields(newOrder);
    }
  };

  const handleToggle = (key: string, selected: boolean) => {
    if (fixedKeys.includes(key) && !selected) {
      return;
    }
    if (selected) {
      if (localPreviewFields.length >= 6) {
        toast.error("Máximo 6 campos en vista previa");
        return;
      }
      if (!localPreviewFields.includes(key)) {
        setLocalPreviewFields([...localPreviewFields, key]);
      }
    } else {
      setLocalPreviewFields(localPreviewFields.filter(k => k !== key));
    }
  };

  const handleLocalLabelChange = (columnKey: string, newLabel: string) => {
    setLocalLabelEdits(prev => ({
      ...prev,
      [columnKey]: newLabel
    }));
  };

  const handleSave = async () => {
    try {
      if (Object.keys(localLabelEdits).length > 0) {
        const updatedSchema = columnSchema.map(col => {
          const newLabel = localLabelEdits[col.key];
          return newLabel ? { ...col, label: newLabel } : col;
        });

        await updateColumnSchema({ listId, columnSchema: updatedSchema });
        
        Object.entries(localLabelEdits).forEach(([key, label]) => {
          updateColumnLabel(listId, key, label);
        });
      }

      setCardPreviewFields(listId, localPreviewFields);
      
      toast.success("Configuración guardada correctamente");
      setOpen(false);
      
      setLocalLabelEdits({});
    } catch (e) {
      console.error("Error al guardar configuración:", e);
      toast.error("Error al guardar la configuración");
    }
  };

  const handleReset = () => {
    const resetFields = ensureFixedKeys(columnSchema.slice(0, 4).map(c => c.key));
    setLocalPreviewFields(resetFields);
    setLocalLabelEdits({});
    toast.success("Configuración restablecida");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setLocalLabelEdits({});
      setLocalPreviewFields(currentPreviewFields);
    }
    setOpen(newOpen);
  };

  const getCurrentLabel = (column: ColumnSchema) => {
    return localLabelEdits[column.key] || column.label;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Vista Tarjeta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md select-none">
        <DialogHeader>
          <DialogTitle>Configurar Vista de Tarjetas</DialogTitle>
          <DialogDescription>
            Selecciona hasta 6 campos para mostrar en la vista previa de las tarjetas.
            Arrastra para reordenar. Los cambios se guardarán al presionar "Guardar".
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground mb-2">
              Campos seleccionados: {localPreviewFields.length}/6
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={localPreviewFields} 
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {allOrderedColumns.map((column) => {
                    const isSelected = localPreviewFields.includes(column.key);
                    const disableToggle = fixedKeys.includes(column.key);
                    return (
                      <SortablePreviewItem
                        key={column.key}
                        id={column.key}
                        column={column}
                        isSelected={isSelected}
                        disableToggle={disableToggle}
                        onToggle={handleToggle}
                        onLabelChange={handleLocalLabelChange}
                        currentLabel={getCurrentLabel(column)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Restablecer
          </Button>
          <Button onClick={handleSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
