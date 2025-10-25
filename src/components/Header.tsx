import { Search } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
}

const Header = ({ title, subtitle, showSearch = true }: HeaderProps) => {
  return (
    <header className="mb-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        
        {showSearch && (
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              className="w-full rounded-lg border-transparent bg-muted/50 backdrop-blur-sm py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 shadow-sm"
              placeholder="Buscar por código, nombre..."
              type="text"
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
