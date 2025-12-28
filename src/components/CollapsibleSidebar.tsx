import { Link, useLocation } from "react-router-dom";
import {
  NotebookText,
  Warehouse,
  Menu,
  X,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CircleHelp,
  Package,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserProfileSettingsDialog } from "@/components/user/UserProfileSettingsDialog";
import { useUserProfile } from "@/hooks/useUserProfile";

const CollapsibleSidebar = () => {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { companyLogoUrl, companyName, userName } = useUserProfile();

  const getUserInitials = () => {
    const baseName = companyName || userName || user?.user_metadata?.full_name || user?.email || "U";
    const parts = baseName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "U";
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const navigation = [
    { name: "Mi Stock", href: "/", icon: Package },
    { name: "Listas", href: "/listas", icon: NotebookText },
    { name: "Proveedores", href: "/proveedores", icon: Warehouse },
    { name: "Remitos", href: "/remitos", icon: Receipt },
    { name: "Ayuda", href: "/ayuda", icon: CircleHelp },
  ];

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!isCollapsed) setIsSettingsOpen(false);
  }, [isCollapsed]);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed z-50 p-2 rounded-lg glassmorphism"
        style={{
          top: "max(env(safe-area-inset-top), 1rem)",
          right: "1rem",
        }}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <style>{`
        @media (min-width: 320px) and (max-width: 375px) {
          .compact-on-xs nav a {
            padding: 6px 8px !important;
            gap: 0.5rem !important;
            border-radius: 0.75rem !important;
          }
          .compact-on-xs nav a span {
            font-size: 14px !important;
          }
          .compact-on-xs nav a > div {
            padding: 6px !important;
          }
          .compact-on-xs nav a svg {
            width: 16px !important;
            height: 16px !important;
          }
        }
      `}</style>

      <aside
        className={`
          fixed lg:sticky top-0 lg:safe-top-fixed right-0 lg:left-0 lg:right-auto min-h-[100dvh] lg:h-screen bg-background/70 backdrop-blur-xl border-l lg:border-r border-primary/20
          flex flex-col p-6 z-40 transition-all duration-300
          ${isMobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-32" : "w-64"}
          compact-on-xs
        `}
        style={{
          paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
          paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
        }}
      >
        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-8 p-1.5 rounded-full glassmorphism hover:bg-primary/20 transition-colors z-40"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4 text-primary" /> : <ChevronLeft className="h-4 w-4 text-primary" />}
        </button>

        {/* Logo */}
        <div className={`flex items-center mt-10 mb-5 from-1024:mt-0 ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-14 h-14 text-primary flex-shrink-0">
            <img src="LogoTransparente.png" alt="" />
          </div>
          {!isCollapsed && <h1 className="text-xl font-bold text-foreground whitespace-nowrap">InspiraStock</h1>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center rounded-xl transition-all duration-300
                  ${isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"}
                  ${active ? "glassmorphism shadow-lg text-foreground" : "hover:bg-primary/10 text-foreground"}
                `}
                title={isCollapsed ? item.name : undefined}
              >
                <div className={`p-2 rounded-lg backdrop-blur-sm ${active ? "bg-primary/30" : "bg-primary/20"}`}>
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                {!isCollapsed && <span className="font-medium text-lg">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className={`mt-auto ${isCollapsed ? "space-y-2" : "space-y-4"}`}>
          <div className={`glassmorphism rounded-xl ${isCollapsed ? "p-2" : "p-4"}`}>
            {isCollapsed ? (
              <div className="flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="rounded-full focus:outline-none">
                      <Avatar className="w-12 h-12 cursor-pointer">
                        <AvatarImage className="object-cover" src={companyLogoUrl} alt={companyName || userName || "Logo"} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">{getUserInitials()}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="center" className="min-w-[200px]">
                    <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configuración de usuario
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage className="object-cover" src={companyLogoUrl} alt={companyName || userName || "Logo"} />
                  <AvatarFallback className="bg-primary/20 text-primary">{getUserInitials()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-foreground truncate">{companyName || "Tu empresa"}</p>
                  <p className="text-xs text-muted-foreground truncate">{userName || user?.email}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-primary/10 transition-colors"
                      aria-label="Menú de usuario"
                    >
                      <Settings className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" className="min-w-[220px]">
                    <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configuración de usuario
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        <UserProfileSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      </aside>
    </>
  );
};

export default CollapsibleSidebar;
