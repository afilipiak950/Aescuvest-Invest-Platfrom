import { AgentAnalysis, Finding } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle, AlertTriangle, XCircle, Info, Zap,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentCardProps {
  analysis?: AgentAnalysis;
  isLoading?: boolean;
}

export default function AgentCard({ analysis, isLoading = false }: AgentCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 bg-dark-lighter" />
          <Skeleton className="h-4 w-full bg-dark-lighter" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-20 w-full bg-dark-lighter rounded-lg" />
          <Skeleton className="h-20 w-full bg-dark-lighter rounded-lg" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 bg-dark-lighter" />
          <Skeleton className="h-14 w-full bg-dark-lighter rounded-lg" />
          <Skeleton className="h-14 w-full bg-dark-lighter rounded-lg" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">No analysis data available for this agent.</p>
      </div>
    );
  }

  const getFindingIcon = (type: string) => {
    switch (type) {
      case 'Positive':
        return <CheckCircle className="min-w-[24px] h-5 w-5 text-green-500" />;
      case 'Negative':
        return <XCircle className="min-w-[24px] h-5 w-5 text-red-500" />;
      case 'Warning':
        return <AlertTriangle className="min-w-[24px] h-5 w-5 text-yellow-500" />;
      case 'Info':
      default:
        return <Info className="min-w-[24px] h-5 w-5 text-blue-500" />;
    }
  };

  // If the analysis is waiting
  if (analysis.status === 'Waiting') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 mb-3">
          <Info className="h-12 w-12" />
        </div>
        <h4 className="text-lg font-medium mb-2">Analysis Pending</h4>
        <p className="text-gray-400 mb-6 text-center max-w-md">
          Waiting for previous analyses to complete before starting the {analysis.agentType.toLowerCase()} evaluation.
        </p>
        <Button variant="outline" className="bg-dark-lighter border-dark-lighter">
          Start Manually
        </Button>
      </div>
    );
  }

  // If the analysis is in progress
  if (analysis.status === 'In Progress') {
    return (
      <div>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-lg font-medium">Analysis Progress</h4>
            <span className="text-xs text-gray-400">{analysis.progress}%</span>
          </div>
          <div className="bg-dark rounded-full h-1.5 w-full">
            <div 
              className="bg-primary rounded-full h-1.5 transition-all duration-500" 
              style={{ width: `${analysis.progress}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {analysis.findings && Array.isArray(analysis.findings) && analysis.findings.map((finding, index) => (
            <div key={index} className="flex items-start">
              <div className="min-w-[24px] h-6 flex items-center justify-center mt-0.5">
                {getFindingIcon(finding.type)}
              </div>
              <div className="ml-2">
                <p className="text-sm text-white">{finding.content}</p>
              </div>
            </div>
          ))}
          
          <div className="flex items-start">
            <div className="min-w-[24px] h-6 flex items-center justify-center mt-0.5">
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            </div>
            <div className="ml-2">
              <p className="text-sm text-gray-400">Analyzing remaining documents...</p>
            </div>
          </div>
        </div>

        <div>
          <Button 
            variant="link" 
            className="text-primary hover:text-primary-hover p-0"
          >
            View Current Findings
          </Button>
        </div>
      </div>
    );
  }

  // Complete analysis
  return (
    <div>
      {analysis.findings && Array.isArray(analysis.findings) && analysis.findings.length > 0 && (
        <div>
          <h4 className="text-lg font-medium mb-3">Key Findings</h4>
          <div className="space-y-4 mb-6">
            {analysis.agentType === 'Legal' && (
              <>
                <div className="mb-6">
                  <h4 className="text-lg font-medium mb-3">Corporate Structure</h4>
                  <div className="bg-dark-lighter p-4 rounded-lg">
                    <p className="text-sm mb-3">The company is incorporated in Delaware (USA) and has subsidiary entities in Germany and Switzerland. The corporate structure appears sound with proper documentation for all entities.</p>
                    <p className="text-sm mb-3">Key observations:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>All shareholder agreements properly executed</li>
                      <li>Previous investment rounds documented with clean cap table</li>
                      <li>Board structure follows standard governance practices</li>
                    </ul>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h4 className="text-lg font-medium mb-3">Intellectual Property</h4>
                  <div className="bg-dark-lighter p-4 rounded-lg">
                    <p className="text-sm mb-3">IP portfolio includes 8 patent applications, with 3 granted patents related to neural interface technology.</p>
                    <p className="text-sm mb-3">Patent portfolio:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>US Patent #10,872,091 - "Neural Interface System" (Granted 2019)</li>
                      <li>US Patent #11,023,345 - "Method for Neural Data Processing" (Granted 2020)</li>
                      <li>EU Patent #EP3782291 - "Brain-Computer Interface Device" (Granted 2021)</li>
                      <li>5 pending applications in US, EU, and Asia (filed 2021-2022)</li>
                    </ul>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <h4 className="text-lg font-medium">Regulatory Risk</h4>
                    <span className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded-full">Medium Risk</span>
                  </div>
                  <div className="bg-dark-lighter p-4 rounded-lg">
                    <p className="text-sm mb-3">The company's technology will require FDA Class II medical device clearance and CE Mark for EU markets. Current status:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Pre-submission meeting with FDA completed Q4 2022</li>
                      <li>510(k) submission planned for Q3 2023</li>
                      <li>EU MDR compliance strategy in place</li>
                      <li><span className="text-yellow-300 font-medium">⚠️ Risk:</span> Timeline for regulatory approval may be extended based on recent similar submissions</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
            
            {analysis.agentType === 'Finance' && (
              <>
                <div className="mb-6">
                  <h4 className="text-lg font-medium mb-3">Key Metrics</h4>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-dark rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Burn Rate</div>
                      <div className="text-white font-semibold">$185K/mo</div>
                    </div>
                    
                    <div className="bg-dark rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Runway</div>
                      <div className="text-white font-semibold">14 months</div>
                    </div>
                    
                    <div className="bg-dark rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Valuation Cap</div>
                      <div className="text-white font-semibold">$28M</div>
                    </div>
                  </div>
                  
                  <div className="bg-dark-lighter p-4 rounded-lg">
                    <p className="text-sm mb-3">Financial analysis of fundraising history and projections</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Previous rounds: $2.5M seed (2021), $1.2M grant (2022)</li>
                      <li>Seeking $8.5M Series A at $35M pre-money valuation</li>
                      <li>Use of funds: Clinical trials (40%), R&D (30%), Regulatory (15%), Operations (15%)</li>
                      <li>Projected revenue: $1.8M (2024), $7.5M (2025)</li>
                    </ul>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h4 className="text-lg font-medium mb-3">Financial Health Assessment</h4>
                  <div className="bg-dark-lighter p-4 rounded-lg">
                    <div className="space-y-3">
                      {analysis.findings && Array.isArray(analysis.findings) && analysis.findings.map((finding, index) => (
                        <div key={index} className="flex items-start">
                          <div className="min-w-[24px] h-6 flex items-center justify-center mt-0.5">
                            {getFindingIcon(finding.type)}
                          </div>
                          <div className="ml-2">
                            <p className="text-sm text-white">{finding.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {(analysis.agentType === 'Medical' || analysis.agentType === 'Commercial') && (
              <div className="bg-dark-lighter p-4 rounded-lg">
                <div className="space-y-3">
                  {analysis.findings && Array.isArray(analysis.findings) && analysis.findings.map((finding, index) => (
                    <div key={index} className="flex items-start">
                      <div className="min-w-[24px] h-6 flex items-center justify-center mt-0.5">
                        {getFindingIcon(finding.type)}
                      </div>
                      <div className="ml-2">
                        <p className="text-sm text-white">{finding.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {analysis.recommendations && Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0 && (
        <div className="border-t border-dark-lighter pt-6">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mr-3">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h4 className="text-lg font-medium">AI Recommendations</h4>
          </div>
          
          <div className="space-y-3">
            {analysis.recommendations && Array.isArray(analysis.recommendations) && analysis.recommendations.map((recommendation, index) => (
              <div 
                key={index} 
                className="bg-dark-lighter p-3 rounded-lg border-l-4 border-green-500"
              >
                <p className="text-sm">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-6">
        <Button 
          variant="link" 
          className="text-primary hover:text-primary-hover p-0"
        >
          View Full Analysis
        </Button>
      </div>
    </div>
  );
}
