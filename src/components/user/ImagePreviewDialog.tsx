import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ImagePreviewDialog({
  open,
  onOpenChange,
  src,
  title = "Vista previa",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null | undefined;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {src ? (
          <div className="flex items-center justify-center">
            <img
              src={src}
              alt={title}
              className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain bg-muted"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay imagen para previsualizar.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

