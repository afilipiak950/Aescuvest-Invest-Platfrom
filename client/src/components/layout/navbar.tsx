import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const { isExpanded } = useSidebar();
  
  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };
  
  return (
    <nav className="sticky top-0 z-50 bg-dark border-b border-dark-lighter">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          {!isExpanded && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-dark font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-primary">AESCUVEST</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center">
          {user ? (
            <Button 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary hover:text-dark transition duration-300 rounded-full"
              onClick={handleLogout}
            >
              LOG OUT
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary hover:text-dark transition duration-300 rounded-full"
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
