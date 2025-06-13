import { useState } from "react";
import { Automation } from "@/types";
import { Switch } from "@/components/ui/switch";
import { 
  MessageSquare, Bell, FileSearch, CalendarDays,
  MoreVertical, ChevronDown, ChevronUp
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AutomationCardProps {
  automation: Automation;
}

export default function AutomationCard({ automation }: AutomationCardProps) {
  const [isActive, setIsActive] = useState(automation.isActive);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggleActive = () => {
    setIsActive(!isActive);
    // In a real app, this would update the automation status via API
  };
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  const getAutomationIcon = (name: string) => {
    if (name.includes("Follow-up") || name.includes("Reminder")) {
      return <Bell className="h-5 w-5 text-primary" />;
    } else if (name.includes("NDA") || name.includes("Document")) {
      return <FileSearch className="h-5 w-5 text-primary" />;
    } else if (name.includes("Meeting") || name.includes("Committee")) {
      return <CalendarDays className="h-5 w-5 text-primary" />;
    } else {
      return <MessageSquare className="h-5 w-5 text-primary" />;
    }
  };
  
  return (
    <div className="bg-dark-lighter rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mr-3">
            {getAutomationIcon(automation.name)}
          </div>
          <div>
            <h4 className="font-medium">{automation.name}</h4>
            <p className="text-sm text-gray-400">{automation.description}</p>
          </div>
        </div>
        
        <div className="flex items-center">
          <span className={`text-xs px-2 py-0.5 rounded mr-2 ${isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
          <Switch 
            checked={isActive} 
            onCheckedChange={toggleActive}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
      
      <div className="mt-3 flex justify-between items-center">
        <div className="text-xs text-gray-500">
          Created: {formatDate(new Date(automation.createdAt))}
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleExpanded}
            className="text-gray-400 hover:text-white transition-colors text-sm flex items-center"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                View Details
              </>
            )}
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-dark grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Trigger</p>
            <p className="text-sm">{automation.trigger}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Action</p>
            <p className="text-sm">{automation.action}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Applied To</p>
            <p className="text-sm">{automation.scope}</p>
          </div>
        </div>
      )}
    </div>
  );
}
