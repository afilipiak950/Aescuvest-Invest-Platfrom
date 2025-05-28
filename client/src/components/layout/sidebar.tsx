import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileUp, Search, FileText, Users, GitBranch, Settings, User, Mail, Briefcase, List } from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: List, label: 'All Deals', href: '/all-deals' },
  { icon: Mail, label: 'Inbox', href: '/inbox' },
  { icon: FileUp, label: 'Deal Intake', href: '/deal-intake' },
  { icon: Search, label: 'Due Diligence', href: '/due-diligence' },
  { icon: FileText, label: 'Memo Generator', href: '/memo-generator' },
  { icon: Users, label: 'Investor Matching', href: '/investor-matching' },
  { icon: GitBranch, label: 'Workflow', href: '/workflow' },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="hidden lg:flex flex-col w-16 bg-sidebar bg-dark-light border-r border-dark-lighter">
      <div className="p-3 border-b border-dark-lighter">
        <div className="h-10 w-10 bg-primary text-dark rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
      </div>
      
      <nav className="flex-1 py-6 flex flex-col items-center gap-6">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "text-2xl transition-colors",
              location === item.href 
                ? "text-primary"
                : "text-gray-400 hover:text-white"
            )}
            title={item.label}
          >
            <item.icon className="h-6 w-6" />
          </Link>
        ))}
      </nav>
      
      <div className="py-6 flex flex-col items-center gap-6">
        <Link 
          href="#settings" 
          className="text-gray-400 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings className="h-6 w-6" />
        </Link>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-dark font-medium">
          <User className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
