import { 
  Scale, 
  Heart, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Shield, 
  Beaker as Research,
  Bot
} from 'lucide-react';
import { getAgentConfig, isValidAgentType, type AgentType } from '@shared/agents';

interface UnifiedAgentIconProps {
  agentType: string;
  className?: string;
  size?: number;
}

// Icon mapping based on agent type - unified approach
const AGENT_ICONS: Record<AgentType, React.ComponentType<any>> = {
  legal: Scale,
  clinical: Heart,
  commercial: TrendingUp,
  hr: Users,
  financial: DollarSign,
  ip: Shield,
  research: Research
};

export function UnifiedAgentIcon({ agentType, className = '', size = 20 }: UnifiedAgentIconProps) {
  // Validate agent type
  if (!isValidAgentType(agentType)) {
    return <Bot className={className} size={size} data-testid={`icon-fallback-${agentType}`} />;
  }

  const IconComponent = AGENT_ICONS[agentType];
  const config = getAgentConfig(agentType);
  
  // Apply unified color based on agent config - use fixed mapping to avoid Tailwind purging
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500', 
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    red: 'text-red-500',
    cyan: 'text-cyan-500',
    yellow: 'text-yellow-500'
  };
  const colorClass = colorMap[config.color] || 'text-gray-500';
  const combinedClassName = `${colorClass} ${className}`.trim();

  return (
    <IconComponent 
      className={combinedClassName} 
      size={size} 
      data-testid={`icon-${agentType}`}
    />
  );
}

// Helper function to get agent icon component
export function getUnifiedAgentIcon(agentType: string) {
  if (!isValidAgentType(agentType)) {
    return Bot;
  }
  return AGENT_ICONS[agentType];
}

// Helper function to get agent color class
export function getUnifiedAgentColor(agentType: string): string {
  if (!isValidAgentType(agentType)) {
    return 'text-gray-500';
  }
  const config = getAgentConfig(agentType);
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500', 
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    red: 'text-red-500',
    cyan: 'text-cyan-500',
    yellow: 'text-yellow-500'
  };
  return colorMap[config.color] || 'text-gray-500';
}