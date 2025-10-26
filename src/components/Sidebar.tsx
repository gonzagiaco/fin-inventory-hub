import { Link, useLocation } from "react-router-dom";
import { Package2, Users, Warehouse, HelpCircle, Menu, X, LogOut, FileText } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Sidebar = () => {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(" ");
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  const navigation = [
    { name: "Stock", href: "/", icon: Package2 },
    { name: "Proveedores", href: "/proveedores", icon: Warehouse },
    { name: "Remitos", href: "/remitos", icon: FileText },
    { name: "Clientes Deudores", href: "/clientes-deudores", icon: Users },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-6 left-6 z-50 p-2 rounded-lg glassmorphism"
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 h-screen w-64 bg-background/70 backdrop-blur-xl border-r border-primary/20 
          flex flex-col p-6 z-30 transition-transform duration-300
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 text-primary">
            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Financia</h1>
        </div>

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
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                  ${
                    active
                      ? "glassmorphism shadow-lg text-foreground"
                      : "hover:bg-primary/10 text-foreground"
                  }
                `}
              >
                <div
                  className={`p-2 rounded-lg backdrop-blur-sm ${
                    active ? "bg-primary/30" : "bg-primary/20"
                  }`}
                >
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium text-lg">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          {/* <Link
            to="/ayuda"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground hover:bg-primary/10 transition-colors"
          >
            <div className="p-2 rounded-lg bg-primary/20 backdrop-blur-sm">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <span className="font-medium text-lg">Ayuda</span>
          </Link> */}

          <div className="glassmorphism p-4 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <Avatar>
                <AvatarFallback className="bg-primary/20 text-primary">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.user_metadata?.full_name || user?.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
