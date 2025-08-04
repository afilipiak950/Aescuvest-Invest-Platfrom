import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
// Using public path for logo

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const { isExpanded } = useSidebar();
  
  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };
  
  return (
    <nav className="sticky top-0 z-50 bg-dark border-b border-dark-border">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          {!isExpanded && (
            <div className="flex items-center gap-3">
              <img 
                src="/assets/aescuvest-icon.png" 
                alt="Aescuvest Logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-primary tracking-wide">AESCUVEST</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center">
          {user ? (
            <Button 
              variant="outline" 
              className="transition duration-300 rounded-full"
              onClick={handleLogout}
            >
              LOG OUT
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="transition duration-300 rounded-full"
              onClick={() => setLocation('/login')}
            >
              LOG IN
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
