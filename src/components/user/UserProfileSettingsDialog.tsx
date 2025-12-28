import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Upload } from "lucide-react";
import { uploadProfileLogo } from "@/services/userProfileService";
import { toast } from "sonner";

type UserProfileSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

export function UserProfileSettingsDialog({ open, onOpenChange }: UserProfileSettingsDialogProps) {
  const { userId, companyName, companyLogoUrl, userName, update } = useUserProfile();
  const [draftCompanyName, setDraftCompanyName] = useState("");
  const [draftUserName, setDraftUserName] = useState("");
  const [draftLogoPreview, setDraftLogoPreview] = useState<string | undefined>(undefined);
  const [draftLogoFile, setDraftLogoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftCompanyName(companyName || "");
    setDraftUserName(userName || "");
    setDraftLogoPreview(companyLogoUrl);
    setDraftLogoFile(null);
  }, [open, companyName, companyLogoUrl, userName]);

  const initials = useMemo(() => {
    const base = (draftCompanyName || draftUserName || "U").trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "U";
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [draftCompanyName, draftUserName]);

  const canSave = Boolean(userId);

  const onPickLogo = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setDraftLogoPreview(dataUrl);
    setDraftLogoFile(file);
  };

  const onSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      let nextLogoUrl = companyLogoUrl;
      if (draftLogoFile) {
        nextLogoUrl = await uploadProfileLogo(userId, draftLogoFile);
      }

      await update({
        companyName: draftCompanyName,
        userName: draftUserName || undefined,
        companyLogoUrl: nextLogoUrl,
      });

      onOpenChange(false);
      toast.success("Perfil actualizado");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Error al guardar el perfil");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Configuración de usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage className="object-cover" src={draftLogoPreview} alt={draftCompanyName || draftUserName || "Logo"} />
              <AvatarFallback className="rounded-full bg-primary/15 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="companyLogo">Logo / Foto de perfil</Label>
              <div className="mt-1">
                <FilePickerButton
                  label="Seleccionar archivo"
                  onFile={(file) => void onPickLogo(file)}
                  disabled={!canSave || isSaving}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Se verá dentro de la app y en el PDF de remitos.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Nombre de la empresa</Label>
            <Input
              id="companyName"
              placeholder="Ej: Distribuidora ACME"
              value={draftCompanyName}
              onChange={(e) => setDraftCompanyName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userName">Nombre de usuario</Label>
            <Input
              id="userName"
              placeholder="Ej: Juan Pérez"
              value={draftUserName}
              onChange={(e) => setDraftUserName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se verá dentro de la app y en el PDF de remitos.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSave()} disabled={!canSave || isSaving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilePickerButton({
  label,
  onFile,
  disabled,
}: {
  label: string;
  onFile: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <Input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onFile(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="gap-2 hover:bg-primary/10"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}
