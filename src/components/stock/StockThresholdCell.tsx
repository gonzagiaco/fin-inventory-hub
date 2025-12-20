import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { updateStockThreshold } from "@/hooks/useMyStockProducts";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface StockThresholdCellProps {
  productId: string;
  listId: string;
  value: number;
  onOptimisticUpdate?: (newThreshold: number) => void;
}

export function StockThresholdCell({
  productId,
  listId,
  value,
  onOptimisticUpdate,
}: StockThresholdCellProps) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [localValue, setLocalValue] = useState<string>(String(value ?? 0));
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(value ?? 0));
    }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Parse and validate
    const parsed = parseInt(newValue, 10);
    if (isNaN(parsed) || parsed < 0) return;

    // Debounce the update
    debounceRef.current = setTimeout(() => {
      saveThreshold(parsed);
    }, 500);
  };

  const saveThreshold = async (threshold: number) => {
    const validThreshold = Math.max(0, Math.floor(threshold));
    
    // Optimistic update
    onOptimisticUpdate?.(validThreshold);

    try {
      await updateStockThreshold(productId, validThreshold, isOnline);
      queryClient.invalidateQueries({ queryKey: ["my-stock"] });
    } catch (error) {
      console.error("Error updating stock threshold:", error);
      toast.error("Error al actualizar el umbral de stock");
      // Revert on error
      setLocalValue(String(value ?? 0));
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    
    // Clear any pending debounce and save immediately
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const parsed = parseInt(localValue, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
      saveThreshold(parsed);
    } else if (isNaN(parsed) || parsed < 0) {
      setLocalValue(String(value ?? 0));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setLocalValue(String(value ?? 0));
      setIsEditing(false);
    }
  };

  return (
    <Input
      ref={inputRef}
      type="number"
      min={0}
      step={1}
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsEditing(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-20 h-8 text-center text-sm"
      placeholder="0"
    />
  );
}