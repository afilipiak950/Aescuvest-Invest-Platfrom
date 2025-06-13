import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileUp, Search, FileText, Users, GitBranch, Settings, User, Mail, Briefcase, List, Kanban, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/SidebarContext';
import aescuvestLogo from "@assets/65693c5a89e524678d52208a_Aescuvest Logo 1.png";
import aescuvestLogoFull from "@assets/65693c5a89e524678d52208a_Aescuvest Logo 1 (1).png";

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
    <div className={cn(
      "hidden lg:flex flex-col bg-sidebar bg-dark-light border-r border-dark-lighter transition-all duration-300 ease-in-out",
      isExpanded ? "w-64" : "w-16"
    )}>
      {/* Header with logo and toggle */}
      <div className="p-3 border-b border-dark-lighter">
        <div className="flex items-center justify-between">
          {isExpanded ? (
            <div className="flex items-center gap-3">
              <img 
                src={aescuvestLogoFull} 
                alt="Aescuvest" 
                className="h-8 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden">
              <img 
                src={aescuvestLogo} 
                alt="Aescuvest" 
                className="h-8 w-8 object-contain"
              />
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
              location === item.href 
                ? "text-primary bg-primary/10"
                : "text-gray-400 hover:text-white hover:bg-dark-lighter",
              !isExpanded && "justify-center w-10 h-10 mx-auto"
            )}
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
            location === "/settings" 
              ? "text-primary bg-primary/10"
              : "text-gray-400 hover:text-white hover:bg-dark-lighter",
            !isExpanded && "justify-center w-10 h-10 mx-auto"
          )}
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
            "text-gray-400 hover:text-white hover:bg-dark-lighter",
            !isExpanded && "justify-center w-10 h-10 mx-auto"
          )}
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
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
            "bg-gradient-to-br from-primary/80 to-primary text-dark font-medium hover:scale-105",
            location === "/profile" && "ring-2 ring-primary ring-offset-2 ring-offset-dark",
            !isExpanded && "justify-center w-10 h-10 mx-auto"
          )}
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
