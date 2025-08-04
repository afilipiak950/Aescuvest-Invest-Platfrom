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
    <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: '#090921', borderColor: '#1e1e40' }}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          {!isExpanded && (
            <div className="text-xl font-bold" style={{ color: '#ffffff' }}>
              AESCUVEST
            </div>
          )}
        </div>
        
        <div className="flex items-center">
          {user ? (
            <Button 
              variant="outline" 
              className="transition duration-300 rounded-full"
              style={{ 
                borderColor: '#38D39F', 
                color: '#38D39F',
                backgroundColor: 'transparent'
              }}
              onClick={handleLogout}
            >
              LOG OUT
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="transition duration-300 rounded-full"
              style={{ 
                borderColor: '#38D39F', 
                color: '#38D39F',
                backgroundColor: 'transparent'
              }}
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
