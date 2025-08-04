import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
// Logo removed during deployment optimization - using text-based branding

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
              <div className="h-8 w-8 rounded-lg bg-green-600/20 flex items-center justify-center border border-green-600/30">
                <span className="text-sm font-bold text-green-500">A</span>
              </div>
              <span className="text-xl font-bold text-green-500 tracking-wide">AESCUVEST</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center">
          {user ? (
            <Button 
              variant="outline" 
              className="border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition duration-300 rounded-full"
              onClick={handleLogout}
            >
              LOG OUT
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition duration-300 rounded-full"
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
