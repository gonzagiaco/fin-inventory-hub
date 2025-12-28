import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Upload } from "lucide-react";
import { uploadProfileLogo } from "@/services/userProfileService";
import { toast } from "sonner";
import { ImagePreviewDialog } from "@/components/user/ImagePreviewDialog";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

export function UserProfileOnboardingDialog() {
  const { user } = useAuth();
  const { userId, companyLogoUrl, userName, companyName, profileOnboardingDone, isLoading, update } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [draftLogoPreview, setDraftLogoPreview] = useState<string | undefined>(undefined);
  const [draftLogoFile, setDraftLogoFile] = useState<File | null>(null);
  const [draftUserName, setDraftUserName] = useState("");
  const [draftCompanyName, setDraftCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLogoPreviewOpen, setIsLogoPreviewOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (isLoading) return;
    if (profileOnboardingDone) return;
    setOpen(true);
  }, [isLoading, profileOnboardingDone, userId]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDraftLogoPreview(companyLogoUrl);
    setDraftLogoFile(null);
    setDraftUserName(userName || user?.user_metadata?.full_name || "");
    setDraftCompanyName(companyName || "");
  }, [open, companyLogoUrl, companyName, userName, user?.user_metadata?.full_name]);

  const initials = useMemo(() => {
    const base = (draftUserName || "U").trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "U";
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [draftUserName]);

  const onPickLogo = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setDraftLogoPreview(dataUrl);
    setDraftLogoFile(file);
  };

  const next = () => setStep((s) => (s === 0 ? 1 : 2));
  const back = () => setStep((s) => (s === 2 ? 1 : 0));

  const finish = () => {
    void (async () => {
      if (!userId) return;
      setIsSubmitting(true);
      try {
        let nextLogoUrl = companyLogoUrl;
        if (draftLogoFile) {
          nextLogoUrl = await uploadProfileLogo(userId, draftLogoFile);
        }

        await update({
          companyLogoUrl: nextLogoUrl,
          userName: draftUserName || undefined,
          companyName: draftCompanyName,
          profileOnboardingDone: true,
        });

        setOpen(false);
        toast.success("Perfil configurado");
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Error al configurar el perfil");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  if (!userId) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          void update({ profileOnboardingDone: true });
        }
      }}
    >
      <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden">
        <div className="bg-emerald-600 text-white px-5 py-4">
          <p className="text-sm/5 opacity-90">Configuración rápida</p>
          <h2 className="text-lg font-semibold">Tu perfil</h2>
        </div>

        <div className="p-6 pb-7">
          <div className="relative overflow-hidden">
            <div
              className="flex w-[300%] transition-transform duration-500 ease-out"
              style={{ transform: step === 0 ? "translateX(0%)" : step === 1 ? "translateX(-33.3333%)" : "translateX(-66.6666%)" }}
            >
              {/* Step 1 */}
              <div className="w-1/3 pr-6 flex flex-col min-h-[420px]">
                <div>
                  <h3 className="text-lg font-semibold">Añade tu foto de perfil</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta foto la verás dentro de la app y a la hora de crear los documentos de remitos en formato PDF.
                  </p>

                  <div className="mt-6 flex flex-col items-center">
                    <button
                      type="button"
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => {
                        if (draftLogoPreview) setIsLogoPreviewOpen(true);
                      }}
                      aria-label="Ver foto de perfil en grande"
                    >
                      <Avatar className="h-24 w-24">
                        <AvatarImage className="object-cover" src={draftLogoPreview} alt="Foto de perfil" />
                        <AvatarFallback className="rounded-full bg-primary/15 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                    </button>

                    <div className="mt-4 w-full flex justify-center">
                      <FilePickerButton
                        label="Seleccionar archivo"
                        onFile={(file) => void onPickLogo(file)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-end">
                  <Button className="px-6" onClick={next}>
                    Siguiente paso
                  </Button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="w-1/3 px-3 flex flex-col min-h-[420px]">
                <div>
                  <h3 className="text-lg font-semibold">Agrega tu nombre de usuario</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tu nombre figurará dentro de la app y al enviar remitos por Whatsapp y al crear los documentos de remitos en formato PDF.
                  </p>

                  <div className="mt-6 space-y-2">
                    <Input
                      placeholder="Ej: Juan Pérez"
                      value={draftUserName}
                      onChange={(e) => setDraftUserName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-end gap-2">
                  <Button variant="outline" className="px-5" onClick={back}>
                    Atrás
                  </Button>
                  <Button className="px-6" onClick={next} disabled={!draftUserName.trim()}>
                    Siguiente paso
                  </Button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="w-1/3 pl-6 flex flex-col min-h-[420px]">
                <div>
                  <h3 className="text-lg font-semibold">Agrega el nombre de tu empresa</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Este nombre se mostrará en el PDF de remitos y al enviar el remito por Whatsapp.
                  </p>

                  <div className="mt-6 space-y-2">
                    <Input
                      placeholder="Ej: Distribuidora ACME"
                      value={draftCompanyName}
                      onChange={(e) => setDraftCompanyName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-end gap-2">
                  <Button variant="outline" className="px-5" onClick={back}>
                    Atrás
                  </Button>
                  <Button className="px-6" onClick={finish} disabled={!draftCompanyName.trim() || isSubmitting}>
                    Finalizar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Podrás cambiar esto luego desde “Configuración de usuario”.
          </p>
        </div>
      </DialogContent>
      <ImagePreviewDialog
        open={isLogoPreviewOpen}
        onOpenChange={setIsLogoPreviewOpen}
        src={draftLogoPreview}
        title="Foto de perfil / Logo"
      />
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
