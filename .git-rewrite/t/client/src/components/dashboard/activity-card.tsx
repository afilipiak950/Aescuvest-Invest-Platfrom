import { Activity, Reminder } from "@/types";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, FileTextIcon, Check, BellRing, UserCheck, 
  Phone, Search, Bot, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityCardProps {
  activities: Activity[] | Reminder[];
  type: "activities" | "reminders";
  isLoading?: boolean;
}

export default function ActivityCard({ 
  activities, 
  type, 
  isLoading = false 
}: ActivityCardProps) {
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-dark-lighter rounded-lg p-4">
            <div className="flex items-start">
              <Skeleton className="h-8 w-8 rounded mr-4 bg-dark" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4 bg-dark" />
                <Skeleton className="h-4 w-5/6 bg-dark" />
                <Skeleton className="h-4 w-1/2 bg-dark" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="bg-dark-lighter rounded-lg p-6 text-center">
        <p className="text-gray-400">
          {type === "activities" 
            ? "No recent AI activity found." 
            : "No upcoming reminders found."}
        </p>
      </div>
    );
  }

  const getIconForType = (activityType: string) => {
    switch (activityType) {
      case "Legal Agent":
        return <FileTextIcon className="h-4 w-4 text-primary" />;
      case "Finance Agent":
        return <Bot className="h-4 w-4 text-primary" />;
      case "Medical Agent":
        return <Bot className="h-4 w-4 text-primary" />;
      case "Commercial Agent":
        return <Bot className="h-4 w-4 text-primary" />;
      case "memo":
        return <FileTextIcon className="h-4 w-4 text-primary" />;
      case "call":
        return <Phone className="h-4 w-4 text-yellow-400" />;
      case "due-diligence":
        return <Search className="h-4 w-4 text-gray-400" />;
      default:
        return <BellRing className="h-4 w-4 text-primary" />;
    }
  };

  const getFormattedTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return formatDate(date);
  };

  const getDeadlineText = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return formatDate(deadlineDate);
  };

  if (type === "activities") {
    return (
      <div className="space-y-4">
        {(activities as Activity[]).map((activity) => (
          <div key={activity.id} className="p-4 border-b border-dark-lighter last:border-b-0">
            <div className="flex items-start">
              <div className="p-2 bg-primary bg-opacity-10 rounded-full mr-4">
                {getIconForType(activity.agentType)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-white">{activity.agentType}</h4>
                  <span className="text-xs text-gray-400">
                    {getFormattedTime(activity.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{activity.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Reminders
  return (
    <div className="space-y-4">
      {(activities as Reminder[]).map((reminder) => (
        <div key={reminder.id} className="p-4 border-b border-dark-lighter last:border-b-0">
          <div className="flex items-start">
            <div className="p-2 bg-primary bg-opacity-10 rounded mr-4">
              {getIconForType(reminder.type)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-medium text-white">{reminder.title}</h4>
                <span className="text-xs text-yellow-400">
                  {getDeadlineText(reminder.deadline)}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-3">{reminder.description}</p>
              <div className="flex items-center gap-2">
                {reminder.actions.map((action, index) => (
                  <Button 
                    key={index} 
                    variant={index === 0 ? "default" : "ghost"}
                    size="sm"
                    className={index === 0 ? "text-xs text-dark bg-primary hover:bg-primary-hover" : "text-xs text-gray-400 hover:text-white px-2 py-1"}
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
