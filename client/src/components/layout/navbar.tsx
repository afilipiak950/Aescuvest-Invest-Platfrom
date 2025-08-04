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
              <div className="h-8 w-8 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 36 36" className="text-primary">
                  <path 
                    fill="currentColor" 
                    d="M18 2l14 8v16l-14 8-14-8V10l14-8zm0 8l-8 4.5v9l8 4.5 8-4.5v-9L18 10zm-2 6h4l2 4h-2l-0.5-1h-3l-0.5 1h-2l2-4zm2 1.5l-0.8 1.5h1.6l-0.8-1.5z" 
                  />
                </svg>
              </div>
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
