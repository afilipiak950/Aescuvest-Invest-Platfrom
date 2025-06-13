import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TeamMember, Financials, SWOT, 
  FundingRound
} from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Edit } from "lucide-react";

interface MemoSectionProps {
  title: string;
  content?: string;
  team?: TeamMember[];
  financials?: Financials;
  swot?: SWOT;
  editable?: boolean;
}

export default function MemoSection({
  title,
  content,
  team,
  financials,
  swot,
  editable = false
}: MemoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  const handleEdit = () => {
    setIsEditing(!isEditing);
  };
  
  const renderTextSection = () => {
    if (!content) return null;
    
    return (
      <div className="bg-dark-lighter rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{title}</h3>
          {editable && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleEdit}
              className="bg-dark px-3 py-1 h-auto text-xs"
            >
              Edit
            </Button>
          )}
        </div>
        <p className="text-sm mb-4">{content}</p>
      </div>
    );
  };
  
  const renderTeamSection = () => {
    if (!team) return null;
    
    return (
      <div className="bg-dark-lighter rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{title}</h3>
          {editable && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleEdit}
              className="bg-dark px-3 py-1 h-auto text-xs"
            >
              Edit
            </Button>
          )}
        </div>
        <div className="space-y-4">
          {team.map((member) => (
            <div key={member.id} className="flex items-start">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-semibold mr-3">
                {member.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <h4 className="font-medium">{member.name}</h4>
                <p className="text-sm text-gray-400">{member.title}</p>
                <p className="text-xs">{member.background}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderFinancialsSection = () => {
    if (!financials) return null;
    
    return (
      <div className="bg-dark-lighter rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{title}</h3>
          {editable && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleEdit}
              className="bg-dark px-3 py-1 h-auto text-xs"
            >
              Edit
            </Button>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-1">Funding History</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {financials.funding.map((round: FundingRound, index: number) => (
                <li key={index}>
                  {round.round}: {formatCurrency(round.amount)} ({round.date}) - {round.investors.join(", ")}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Key Metrics</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Current Burn Rate: {formatCurrency(financials.burnRate)}/month</li>
              <li>Runway: {financials.runway} months (without new funding)</li>
              {financials.metrics.revenue2024 && (
                <li>Projected Revenue: {formatCurrency(financials.metrics.revenue2024)} (2024), {formatCurrency(financials.metrics.revenue2025)} (2025)</li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Use of Funds</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {financials.useOfFunds && Object.entries(financials.useOfFunds).map(([key, value], index) => (
                <li key={index}>
                  {key === 'clinicalTrials' ? 'Clinical Trials' : 
                   key === 'rd' ? 'R&D/Engineering' : 
                   key === 'regulatory' ? 'Regulatory' : 
                   key === 'operations' ? 'Operations/G&A' : key}: {value}%
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };
  
  const renderSwotSection = () => {
    if (!swot) return null;
    
    return (
      <div className="bg-dark-lighter rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{title}</h3>
          {editable && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleEdit}
              className="bg-dark px-3 py-1 h-auto text-xs"
            >
              Edit
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-dark p-3 rounded">
            <h4 className="text-sm font-medium text-green-300 mb-2">Strengths</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {swot.strengths.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-dark p-3 rounded">
            <h4 className="text-sm font-medium text-red-300 mb-2">Weaknesses</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {swot.weaknesses.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-dark p-3 rounded">
            <h4 className="text-sm font-medium text-blue-300 mb-2">Opportunities</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {swot.opportunities.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-dark p-3 rounded">
            <h4 className="text-sm font-medium text-yellow-300 mb-2">Threats</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {swot.threats.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };
  
  if (content) return renderTextSection();
  if (team) return renderTeamSection();
  if (financials) return renderFinancialsSection();
  if (swot) return renderSwotSection();
  
  return null;
}
