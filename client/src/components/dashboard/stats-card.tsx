import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { FileText, Search, FileTextIcon, Users, LucideIcon } from "lucide-react";

type IconType = "FileText" | "Search" | "Users";

interface StatsCardProps {
  title: string;
  value: number;
  icon: IconType;
  change?: string;
  changeText?: string;
  isLoading?: boolean;
  href?: string;
}

const iconMap: Record<IconType, LucideIcon> = {
  FileText: FileTextIcon,
  Search: Search,
  Users: Users,
};

export default function StatsCard({
  title,
  value,
  icon,
  change,
  changeText,
  isLoading = false,
  href,
}: StatsCardProps) {
  const Icon = iconMap[icon];

  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (href) {
      return (
        <Link href={href}>
          <Card className="bg-dark-light border-dark-lighter hover:bg-dark-lighter/70 transition-all cursor-pointer transform hover:scale-105">
            {children}
          </Card>
        </Link>
      );
    }
    return (
      <Card className="bg-dark-light border-dark-lighter">
        {children}
      </Card>
    );
  };

  return (
    <CardWrapper>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-300">{title}</h3>
          <div className="bg-primary/20 p-2 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 bg-dark-lighter mb-1" />
            <Skeleton className="h-4 w-24 bg-dark-lighter" />
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-white mb-1">{value}</p>
            {change && (
              <div className="flex items-center text-sm">
                <span className="text-primary mr-1">{change}</span>
                {changeText && <span className="text-gray-400">{changeText}</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </CardWrapper>
  );
}
