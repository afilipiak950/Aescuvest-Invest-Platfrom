import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAgentConfig, isValidAgentType, type AgentType } from '@shared/agents';
import { UnifiedAgentIcon } from './UnifiedAgentIcon';

interface UnifiedQuestionsSectionProps {
  agentType: string;
  dealId: number;
  analysisData?: any;
  className?: string;
}

export function UnifiedQuestionsSection({ 
  agentType, 
  dealId, 
  analysisData, 
  className = '' 
}: UnifiedQuestionsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Validate agent type
  if (!isValidAgentType(agentType)) {
    return (
      <Card className={`bg-gray-900 border-gray-700 ${className}`}>
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <HelpCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Invalid agent type: {agentType}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = getAgentConfig(agentType as AgentType);
  const questions = config.questions;
  
  // Fixed color mapping to prevent Tailwind purging
  const colorMap = {
    blue: { border: 'border-blue-500', bg: 'bg-blue-500/10' },
    green: { border: 'border-green-500', bg: 'bg-green-500/10' }, 
    purple: { border: 'border-purple-500', bg: 'bg-purple-500/10' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-500/10' },
    red: { border: 'border-red-500', bg: 'bg-red-500/10' },
    cyan: { border: 'border-cyan-500', bg: 'bg-cyan-500/10' },
    yellow: { border: 'border-yellow-500', bg: 'bg-yellow-500/10' }
  };
  
  const colors = colorMap[config.color as keyof typeof colorMap] || { border: 'border-gray-500', bg: 'bg-gray-500/10' };
  const colorClass = colors.border;
  const bgColorClass = colors.bg;

  // Get answers from analysis data
  const getAnswerForQuestion = (questionIndex: number) => {
    if (!analysisData?.findings) return null;
    
    // Try to match question with findings
    const question = questions[questionIndex];
    const matchingFinding = analysisData.findings.find((finding: any) => 
      finding.content?.toLowerCase().includes(question.toLowerCase().slice(0, 20)) ||
      finding.title?.toLowerCase().includes(question.toLowerCase().slice(0, 20))
    );
    
    return matchingFinding?.content || matchingFinding?.description || null;
  };

  const answeredCount = questions.filter((_, index) => getAnswerForQuestion(index)).length;
  const completionPercentage = Math.round((answeredCount / questions.length) * 100);

  return (
    <Card className={`bg-gray-900 border-gray-700 ${colorClass} ${className}`} data-testid={`questions-section-${agentType}`}>
      <CardHeader className={`${bgColorClass} border-b border-gray-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UnifiedAgentIcon agentType={agentType} size={24} />
            <CardTitle className="text-lg text-white capitalize">
              {agentType} Due Diligence Questions
            </CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-gray-800 text-gray-300">
              {answeredCount}/{questions.length} answered ({completionPercentage}%)
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-white"
              data-testid={`toggle-questions-${agentType}`}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-6">
          <div className="space-y-4">
            {questions.map((question, index) => {
              const answer = getAnswerForQuestion(index);
              const hasAnswer = !!answer;
              
              return (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border ${hasAnswer ? 'border-green-500/30 bg-green-500/5' : 'border-gray-600 bg-gray-800/50'}`}
                  data-testid={`question-${agentType}-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <Badge 
                      variant="outline" 
                      className={`mt-1 ${hasAnswer ? 'border-green-500 text-green-400' : 'border-gray-500 text-gray-400'}`}
                    >
                      Q{index + 1}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-2">{question}</h4>
                      {hasAnswer ? (
                        <div className="text-gray-300 text-sm leading-relaxed">
                          {answer}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm italic">
                          Analysis pending...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-4 bg-gray-800/30 rounded-lg border border-gray-600">
            <h5 className="text-white font-medium mb-2">Focus Areas</h5>
            <div className="flex flex-wrap gap-2">
              {config.focusAreas.map((area, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="bg-gray-700 text-gray-300"
                  data-testid={`focus-area-${agentType}-${index}`}
                >
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}