import { Link, useLocation } from "react-router-dom";
import {
  Package2,
  Users,
  Warehouse,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  CircleHelp,
  Package,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const CollapsibleSidebar = () => {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const { user, signOut } = useAuth();

  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(" ");
      return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : names[0][0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  const navigation = [
    { name: "Listas", href: "/", icon: Package2 },
    { name: "Mi Stock", href: "/mi-stock", icon: Package },
    { name: "Proveedores", href: "/proveedores", icon: Warehouse },
    { name: "Remitos", href: "/remitos", icon: FileText },
    { name: "Ayuda", href: "/ayuda", icon: CircleHelp },
  ];

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    // Si se expande el sidebar, cerramos el panel de logout flotante
    if (!isCollapsed) {
      setShowLogout(false);
    }
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
      <aside
        className={`
          fixed lg:sticky top-0 lg:safe-top-fixed right-0 lg:left-0 lg:right-auto min-h-[100dvh] lg:h-screen bg-background/70 backdrop-blur-xl border-l lg:border-r border-primary/20 
          flex flex-col p-6 z-40 transition-all duration-300
          ${isMobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-32" : "w-64"}
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
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-primary" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-primary" />
          )}
        </button>

        {/* Logo */}
        <div className={`flex items-center my-10 from-1024:mt-0 ${isCollapsed ? "justify-center" : "gap-3"}`}>
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
              <div className="relative">
                {/* Avatar centrado y clickeable */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowLogout((prev) => !prev)}
                    className="rounded-full focus:outline-none"
                  >
                    <Avatar className="w-12 h-12 cursor-pointer">
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </div>

                {/* Panel flotante de logout arriba del Avatar */}
                {showLogout && (
                  <div className="absolute inset-x-16 -top-3 translate-y-[-100%] flex justify-center">
                    <button
                      type="button"
                      onClick={signOut}
                      className="glassmorphism rounded-xl px-4 py-4 flex items-center gap-2 text-xs shadow-lg min-w-[150px] justify-center"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/20 text-primary">{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user?.user_metadata?.full_name || user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default CollapsibleSidebar;
