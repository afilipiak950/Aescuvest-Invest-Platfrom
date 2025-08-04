import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileUp, Search, FileText, Users, GitBranch, Settings, User, Mail, Briefcase, List, Kanban, Menu, X, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/SidebarContext';
// Logos removed during deployment optimization - using text-based branding

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: List, label: 'All Deals', href: '/all-deals' },
  { icon: Kanban, label: 'Pipeline', href: '/pipeline' },
  { icon: Mail, label: 'Inbox', href: '/inbox' },
  { icon: FileUp, label: 'Deal Intake', href: '/deal-intake' },
  { icon: Search, label: 'Due Diligence', href: '/due-diligence' },
  { icon: FileText, label: 'Memo Generator', href: '/memo-generator' },
  { icon: Users, label: 'Investor Matching', href: '/investor-matching' },
  { icon: GitBranch, label: 'Workflow', href: '/workflow' },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { isExpanded, toggleSidebar } = useSidebar();

  return (
    <div 
      className={cn(
        "hidden lg:flex flex-col border-r transition-all duration-300 ease-in-out",
        isExpanded ? "w-64" : "w-16"
      )}
      style={{ backgroundColor: '#050533', borderColor: '#1e1e40' }}
    >
      {/* Header with logo and toggle */}
      <div className="p-3 border-b" style={{ borderColor: '#1e1e40' }}>
        <div className="flex items-center justify-between">
          {isExpanded ? (
            <div className="flex items-center gap-3">
              <div 
                className="h-8 w-8 rounded flex items-center justify-center"
                style={{ backgroundColor: 'rgba(56, 211, 159, 0.2)' }}
              >
                <span className="text-sm font-bold" style={{ color: '#38D39F' }}>A</span>
              </div>
              <span className="text-xl font-bold" style={{ color: '#38D39F' }}>Aescuvest</span>
            </div>
          ) : (
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(56, 211, 159, 0.2)' }}
            >
              <span className="text-lg font-bold" style={{ color: '#38D39F' }}>A</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <nav className={cn(
        "flex-1 py-6 flex flex-col gap-2",
        isExpanded ? "px-3" : "items-center"
      )}>
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
              !isExpanded && "justify-center w-10 h-10 mx-auto"
            )}
            style={{
              color: location === item.href ? '#38D39F' : '#94a3b8',
              backgroundColor: location === item.href ? 'rgba(56, 211, 159, 0.1)' : 'transparent'
            }}
            title={!isExpanded ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {isExpanded && (
              <span className="text-sm font-medium truncate">{item.label}</span>
            )}
          </Link>
        ))}
      </nav>
      
      {/* Bottom section */}
      <div className={cn(
        "py-6 flex flex-col gap-2",
        isExpanded ? "px-3" : "items-center"
      )}>
        <Link 
          href="/settings" 
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
            !isExpanded && "justify-center w-10 h-10 mx-auto"
          )}
          style={{
            color: location === "/settings" ? '#38D39F' : '#94a3b8',
            backgroundColor: location === "/settings" ? 'rgba(56, 211, 159, 0.1)' : 'transparent'
          }}
          title={!isExpanded ? "Settings" : undefined}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {isExpanded && (
            <span className="text-sm font-medium">Settings</span>
          )}
        </Link>
        
        {/* Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
            !isExpanded && "justify-center w-10 h-10 mx-auto"
          )}
          style={{ color: '#94a3b8', backgroundColor: 'transparent' }}
          title={!isExpanded ? (isExpanded ? "Einklappen" : "Ausklappen") : undefined}
        >
          {isExpanded ? <ChevronLeft className="h-5 w-5 flex-shrink-0" /> : <ChevronRight className="h-5 w-5 flex-shrink-0" />}
          {isExpanded && (
            <span className="text-sm font-medium">Einklappen</span>
          )}
        </Button>
        
        <Link 
          href="/profile"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 font-medium hover:scale-105",
            !isExpanded && "justify-center w-10 h-10 mx-auto"
          )}
          style={{
            background: 'linear-gradient(to bottom right, rgba(56, 211, 159, 0.8), #38D39F)',
            color: '#090921',
            ...(location === "/profile" && {
              boxShadow: '0 0 0 2px #38D39F, 0 0 0 4px #090921'
            })
          }}
          title={!isExpanded ? "Profile" : undefined}
        >
          <User className="h-4 w-4 flex-shrink-0" />
          {isExpanded && (
            <span className="text-sm font-medium">Profile</span>
          )}
        </Link>
      </div>
    </div>
  );
}
