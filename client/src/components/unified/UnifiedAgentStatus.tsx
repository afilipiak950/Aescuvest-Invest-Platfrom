import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { getAgentConfig, isValidAgentType, type AgentType } from '@shared/agents';
import { UnifiedAgentIcon } from './UnifiedAgentIcon';

interface UnifiedAgentStatusProps {
  agentType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  progress?: number;
  className?: string;
  showIcon?: boolean;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function UnifiedAgentStatus({ 
  agentType, 
  status, 
  progress = 0,
  className = '',
  showIcon = true,
  showProgress = true,
  size = 'md'
}: UnifiedAgentStatusProps) {
  // Validate agent type
  if (!isValidAgentType(agentType)) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="destructive" data-testid={`status-invalid-${agentType}`}>
          Invalid Agent: {agentType}
        </Badge>
      </div>
    );
  }

  const config = getAgentConfig(agentType as AgentType);
  
  // Status mapping
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          label: 'Completed'
        };
      case 'processing':
      case 'running':
        const processingColors = colorMap[config.color as keyof typeof colorMap] || {
          text: 'text-gray-500',
          bg: 'bg-gray-500/10', 
          border: 'border-gray-500/30'
        };
        return {
          variant: 'secondary' as const,
          icon: Loader2,
          color: processingColors.text,
          bgColor: processingColors.bg,
          borderColor: processingColors.border,
          label: 'Processing'
        };
      case 'failed':
      case 'error':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: 'Failed'
        };
      case 'pending':
        return {
          variant: 'outline' as const,
          icon: Clock,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          label: 'Pending'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: AlertCircle,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          label: status
        };
    }
  };

  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;
  
  // Fixed color mapping to prevent Tailwind purging
  const colorMap = {
    blue: { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    green: { text: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' }, 
    purple: { text: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    orange: { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    red: { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    cyan: { text: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    yellow: { text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' }
  };
  
  // Size configurations
  const sizeConfig = {
    sm: {
      iconSize: 12,
      badgeClass: 'text-xs px-2 py-1',
      progressHeight: 'h-1'
    },
    md: {
      iconSize: 16,
      badgeClass: 'text-sm px-3 py-1',
      progressHeight: 'h-2'
    },
    lg: {
      iconSize: 20,
      badgeClass: 'text-base px-4 py-2',
      progressHeight: 'h-3'
    }
  };

  const { iconSize, badgeClass, progressHeight } = sizeConfig[size];

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-testid={`unified-status-${agentType}`}>
      <div className="flex items-center gap-2">
        {showIcon && (
          <UnifiedAgentIcon 
            agentType={agentType} 
            size={iconSize}
            className="flex-shrink-0"
          />
        )}
        
        <Badge 
          variant={statusConfig.variant}
          className={`flex items-center gap-1 ${badgeClass} ${statusConfig.bgColor} ${statusConfig.borderColor}`}
          data-testid={`status-badge-${agentType}-${status}`}
        >
          <StatusIcon 
            className={`${statusConfig.color} ${status === 'processing' ? 'animate-spin' : ''}`}
            size={iconSize}
          />
          <span className="capitalize">
            {agentType} {statusConfig.label}
          </span>
          {progress > 0 && progress < 100 && (
            <span className="text-xs opacity-75">({progress}%)</span>
          )}
        </Badge>
      </div>

      {showProgress && status === 'processing' && (
        <div className="w-full">
          <Progress 
            value={progress} 
            className={`w-full ${progressHeight} bg-gray-800`}
            data-testid={`progress-${agentType}`}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get unified status color
export function getUnifiedStatusColor(status: string, agentType: string): string {
  if (!isValidAgentType(agentType)) return 'text-gray-500';
  
  const config = getAgentConfig(agentType as AgentType);
  
  switch (status.toLowerCase()) {
    case 'completed':
      return 'text-green-500';
    case 'failed':
    case 'error':
      return 'text-red-500';
    case 'processing':
    case 'running':
      return `text-${config.color}-500`;
    default:
      return 'text-gray-400';
  }
}

// Helper function to normalize status text
export function normalizeStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'completed';
    case 'processing':
    case 'running':
      return 'processing';
    case 'failed':
    case 'error':
      return 'failed';
    case 'pending':
      return 'pending';
    default:
      return status.toLowerCase();
  }
}