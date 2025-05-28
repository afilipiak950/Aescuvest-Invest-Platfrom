import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import * as LucideIcons from 'lucide-react';

interface Action {
  label: string;
  icon?: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: Action[];
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  const renderIcon = (iconName: string) => {
    // Access the icon component from the imported icons
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as React.FC<{ className?: string }>;
    
    return Icon ? <Icon className="h-5 w-5 mr-2" /> : null;
  };
  
  return (
    <section className="mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{title}</h1>
          {description && (
            <p className="text-gray-400">{description}</p>
          )}
        </div>
        
        {actions && actions.length > 0 && (
          <div className="mt-4 md:mt-0 flex items-center space-x-3">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                className={action.variant === 'outline' ? 'bg-dark-lighter hover:bg-dark-light' : ''}
                onClick={action.onClick}
                asChild={!!action.href}
              >
                {action.href ? (
                  <Link href={action.href}>
                    {action.icon && renderIcon(action.icon)}
                    <span>{action.label}</span>
                  </Link>
                ) : (
                  <>
                    {action.icon && renderIcon(action.icon)}
                    <span>{action.label}</span>
                  </>
                )}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
