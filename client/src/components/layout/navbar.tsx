import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
// Logo file missing - using placeholder for now
// import aescuvestLogoFull from "@assets/65693c5a89e524678d52208a_Aescuvest Logo 1 (1).png";

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
            <img 
              src="/aescuvest-full-logo.png"
              alt="Aescuvest" 
              className="h-8 w-auto"
            />
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
