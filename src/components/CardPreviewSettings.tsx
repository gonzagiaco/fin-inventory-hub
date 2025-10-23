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
import { ColumnSchema } from "@/types/productList";
import { useProductListStore } from "@/stores/productListStore";
import { toast } from "sonner";

interface CardPreviewSettingsProps {
  listId: string;
  columnSchema: ColumnSchema[];
}

interface SortablePreviewItemProps {
  id: string;
  column: ColumnSchema;
  isSelected: boolean;
  onToggle: (key: string, selected: boolean) => void;
}

function SortablePreviewItem({ id, column, isSelected, onToggle }: SortablePreviewItemProps) {
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
        id={`preview-${column.key}`}
        checked={isSelected}
        onCheckedChange={(checked) => onToggle(column.key, checked as boolean)}
      />
      <Label htmlFor={`preview-${column.key}`} className="flex-1 cursor-pointer text-sm">
        {column.label}
      </Label>
      {isSelected && <Eye className="w-4 h-4 text-primary" />}
    </div>
  );
}

export function CardPreviewSettings({ listId, columnSchema }: CardPreviewSettingsProps) {
  const { cardPreviewFields, setCardPreviewFields } = useProductListStore();
  const [open, setOpen] = useState(false);
  
  const currentPreviewFields = cardPreviewFields[listId] || 
    columnSchema.slice(0, 4).map(c => c.key);
  
  const [localPreviewFields, setLocalPreviewFields] = useState<string[]>(currentPreviewFields);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedColumns = localPreviewFields
    .map((key) => columnSchema.find((c) => c.key === key))
    .filter(Boolean) as ColumnSchema[];

  // Add remaining columns that are not in preview
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
    if (selected) {
      if (localPreviewFields.length >= 6) {
        toast.error("Máximo 6 campos en vista previa");
        return;
      }
      setLocalPreviewFields([...localPreviewFields, key]);
    } else {
      setLocalPreviewFields(localPreviewFields.filter(k => k !== key));
    }
  };

  const handleSave = () => {
    setCardPreviewFields(listId, localPreviewFields);
    toast.success("Configuración de tarjeta guardada");
    setOpen(false);
  };

  const handleReset = () => {
    const defaultFields = columnSchema.slice(0, 4).map(c => c.key);
    setLocalPreviewFields(defaultFields);
    toast.success("Configuración restablecida");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Vista Tarjeta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Vista de Tarjetas</DialogTitle>
          <DialogDescription>
            Selecciona hasta 6 campos para mostrar en la vista previa de las tarjetas.
            Arrastra para reordenar.
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
                    return (
                      <SortablePreviewItem
                        key={column.key}
                        id={column.key}
                        column={column}
                        isSelected={isSelected}
                        onToggle={handleToggle}
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
