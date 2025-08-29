import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Investor } from "@/types";
import { User, Users, ChevronDown, ChevronUp } from "lucide-react";

interface InvestorCardProps {
  investor: Investor;
}

export default function InvestorCard({ investor }: InvestorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  const getMatchScoreClass = (score: number) => {
    if (score >= 90) return "bg-green-900 text-green-300";
    if (score >= 80) return "bg-green-900/70 text-green-300";
    if (score >= 70) return "bg-yellow-900 text-yellow-300";
    return "bg-red-900 text-red-300";
  };
  
  const getInitials = (name: string) => {
    const nameParts = name.split(" ");
    if (nameParts.length === 1) return nameParts[0].charAt(0);
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };
  
  return (
    <div className="bg-dark-lighter rounded-lg p-4">
      <div className="flex flex-col md:flex-row md:items-center">
        <div className="flex-shrink-0 flex items-center mb-4 md:mb-0 md:mr-6">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center font-semibold text-dark text-lg mr-4">
            {getInitials(investor.name)}
          </div>
          <div>
            <h4 className="font-medium">{investor.name}</h4>
            <p className="text-sm text-gray-400">{investor.location}</p>
          </div>
        </div>
        
        <div className="md:flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 md:mb-0">
          <div>
            <p className="text-xs text-gray-400">Focus</p>
            <p className="text-sm">{investor.focus.join(", ")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Stage</p>
            <p className="text-sm">{investor.stages.join(", ")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Check Size</p>
            <p className="text-sm">{investor.checkSize}</p>
          </div>
        </div>
        
        <div className="md:ml-4 flex items-center">
          <div className={`px-2 py-1 rounded text-sm font-medium mr-4 ${getMatchScoreClass(investor.matchScore)}`}>
            {investor.matchScore}% Match
          </div>
          <Button
            className="bg-primary hover:bg-primary-hover text-dark font-medium"
            size="sm"
          >
            Contact
          </Button>
        </div>
      </div>
      
      <div className="mt-3 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          className="text-gray-400 hover:text-white"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Less Details
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              More Details
            </>
          )}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-dark grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="text-sm font-medium mb-2">Match Insights</h5>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {investor.matchInsights.map((insight, index) => (
                <li key={index}>
                  <span className="text-green-300">✓</span> {insight}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="text-sm font-medium mb-2">Portfolio Highlights</h5>
            <div className="flex flex-wrap gap-2">
              {investor.portfolio.map((company, index) => (
                <span key={index} className="bg-dark px-2 py-1 rounded-full text-xs">
                  {company}
                </span>
              ))}
              {investor.portfolio.length > 4 && (
                <span className="bg-dark px-2 py-1 rounded-full text-xs">
                  +{investor.portfolio.length - 4} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
