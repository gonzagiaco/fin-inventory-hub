import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Payment } from "@/types";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remainingAmount: number;
  onSave: (payment: Omit<Payment, "id">) => void;
}

const PaymentDialog = ({ open, onOpenChange, remainingAmount, onSave }: PaymentDialogProps) => {
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toLocaleDateString("es-AR"),
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0 || amount > remainingAmount) {
      return;
    }

    onSave({
      amount,
      date: formData.date,
      notes: formData.notes || undefined,
    });

    setFormData({
      amount: "",
      date: new Date().toLocaleDateString("es-AR"),
      notes: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar Pago</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Monto restante: ${remainingAmount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount" className="text-foreground">
                Monto del Pago ($)
              </Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                max={remainingAmount}
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date" className="text-foreground">
                Fecha del Pago
              </Label>
              <Input
                id="date"
                type="text"
                placeholder="DD/MM/YYYY"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes" className="text-foreground">
                Notas (opcional)
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-muted/50 border-primary/20 text-foreground"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-primary/20 text-foreground hover:bg-primary/10"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Registrar Pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
