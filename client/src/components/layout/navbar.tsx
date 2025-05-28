import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import aescuvestLogo from "@assets/65693c5a89e524678d52208a_Aescuvest Logo 1.png";

const navItems = [
  { label: 'DASHBOARD', href: '/' },
  { label: 'ALL DEALS', href: '/all-deals' },
  { label: 'INBOX', href: '/inbox' },
  { label: 'ANALYSIS', href: '/due-diligence' },
  { label: 'INVESTORS', href: '/investor-matching' },
  { label: 'SETTINGS', href: '#' }
];

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout, user } = useAuth();
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };
  
  return (
    <nav className="sticky top-0 z-50 bg-dark border-b border-dark-lighter">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <img 
            src={aescuvestLogo}
            alt="Aescuvest" 
            className="h-8 w-auto"
          />
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => (
            <Link 
              key={item.label} 
              href={item.href}
              className={cn(
                "flex items-center space-x-1 transition-colors",
                location === item.href ? "text-white" : "text-gray-400 hover:text-white"
              )}
            >
              {location === item.href && (
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              )}
              <span>{item.label}</span>
            </Link>
          ))}
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
          <button 
            className="md:hidden ml-4 text-gray-400 hover:text-white"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-dark-light border-b border-dark-lighter">
          <div className="container mx-auto px-4 py-2">
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <Link 
                  key={item.label} 
                  href={item.href}
                  className={cn(
                    "py-2 px-3 rounded transition-colors",
                    location === item.href 
                      ? "bg-dark-lighter text-white border-l-4 border-primary pl-2" 
                      : "text-gray-400 hover:text-white"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
