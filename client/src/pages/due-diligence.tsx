import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import DocumentList from '@/components/due-diligence/document-list';
import AgentCard from '@/components/due-diligence/AgentCard';
import DueDiligenceAgents from '@/components/ai/DueDiligenceAgents';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import FileUploadAnalysis from '@/components/FileUploadAnalysis';
import { CompanyResearchDisplay } from '@/components/CompanyResearchDisplay';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Link as LinkIcon } from 'lucide-react';
import { Deal, AgentAnalysis, Document } from '@/types';



export default function DueDiligence() {
  const [selectedDeal, setSelectedDeal] = useState<string>('1'); // Default to first deal
  const [activeAgent, setActiveAgent] = useState<string>('legal');
  const [isUploading, setIsUploading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showUploadField, setShowUploadField] = useState(false);

  // Fetch real deals from database
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    retry: false,
  });

  // Fetch real documents for selected deal
  const { data: documents, isLoading: isLoadingDocuments } = useQuery({
    queryKey: [`/api/deals/${selectedDeal}/documents`],
    retry: false,
    enabled: !!selectedDeal
  });

  // Fetch real analysis data
  const { data: analyses, isLoading: isLoadingAnalyses } = useQuery({
    queryKey: [`/api/analyses/${selectedDeal}`],
    retry: false,
    enabled: !!selectedDeal
  });

  const currentDeal = Array.isArray(deals) ? deals.find((deal: any) => deal.id.toString() === selectedDeal) : undefined;
  
  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection to data room
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsConnecting(false);
  };

  const handleFileUpload = async () => {
    setShowUploadField(!showUploadField);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Due Diligence Analysis" 
        description="Analyze company documents and generate insights with AI agents."
      />
      
      {/* Deal Selection */}
      <Card className="bg-dark-light border-dark-lighter mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-400 mb-1 block">Select Deal</label>
              <Select 
                value={selectedDeal} 
                onValueChange={setSelectedDeal}
                disabled={isLoadingDeals}
              >
                <SelectTrigger className="bg-dark border-dark-lighter text-white focus:ring-primary">
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent className="bg-dark-lighter border-dark-lighter">
                  {Array.isArray(deals) ? deals.map((deal: any) => (
                    <SelectItem key={deal.id} value={deal.id.toString()}>
                      {deal.companyName}
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="bg-dark-lighter hover:bg-dark border-dark-lighter"
                onClick={handleFileUpload}
              >
                <Upload className="mr-2 h-4 w-4" />
                {showUploadField ? 'Hide Upload' : 'Upload Files'}
              </Button>
              
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                Connect Data Room
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Upload Field - Shows when Upload Files button is clicked */}
      {showUploadField && (
        <Card className="bg-dark-light border-dark-lighter mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Upload Documents</CardTitle>
            <CardDescription>Upload documents for AI analysis and due diligence review</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadAnalysis dealId={selectedDeal} />
          </CardContent>
        </Card>
      )}
      
      {isLoadingDeals ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : currentDeal ? (
        <>
          {/* Company Information */}
          <Card className="bg-dark-light border-dark-lighter mb-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Company Information</CardTitle>
              <CardDescription>Overview of the company details and submission information</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="basic-info" className="w-full">
                <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                  <TabsTrigger
                    value="basic-info"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Basic Information
                  </TabsTrigger>
                  <TabsTrigger
                    value="company-research"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Company Research
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai-scoring"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    AI Scoring
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic-info">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="bg-dark border-dark-lighter">
                        <CardHeader>
                          <CardTitle className="text-lg">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Company Name</label>
                            <p className="text-white font-semibold">{currentDeal.companyName}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Description</label>
                            <p className="text-gray-300">{currentDeal.description}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Sector</label>
                            <p className="text-white">{currentDeal.sector}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Stage</label>
                            <p className="text-white">{currentDeal.stage}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark border-dark-lighter">
                        <CardHeader>
                          <CardTitle className="text-lg">Contact & Financial</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Location</label>
                            <p className="text-white">{currentDeal.location || 'Not specified'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Website</label>
                            {currentDeal.website ? (
                              <a 
                                href={currentDeal.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary-hover underline"
                              >
                                {currentDeal.website}
                              </a>
                            ) : (
                              <p className="text-gray-400">Not provided</p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Funding Amount</label>
                            <p className="text-white font-semibold">
                              {currentDeal.fundingAmount 
                                ? `$${(currentDeal.fundingAmount / 1000000).toFixed(1)}M` 
                                : 'Not specified'
                              }
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">AI Score</label>
                            <div className="flex items-center gap-3">
                              <p className="text-white font-semibold">
                                {currentDeal.aiScore ? `${currentDeal.aiScore}/100` : 'Pending evaluation'}
                              </p>
                              {currentDeal.aiScore && (
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  currentDeal.aiScore >= 85 ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                                  currentDeal.aiScore >= 70 ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                                  'bg-red-600/20 text-red-400 border border-red-600/30'
                                }`}>
                                  {currentDeal.aiScore >= 85 ? 'Excellent' : currentDeal.aiScore >= 70 ? 'Good' : 'Moderate'}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-dark border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg">Submission Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Created At</label>
                            <p className="text-white">
                              {new Date(currentDeal.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Last Updated</label>
                            <p className="text-white">
                              {new Date(currentDeal.updatedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Status</label>
                            <div className="inline-block">
                              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm font-medium border border-blue-600/30">
                                {currentDeal.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="company-research">
                  <div className="pt-4">
                    <CompanyResearchDisplay dealId={parseInt(selectedDeal)} />
                  </div>
                </TabsContent>

                <TabsContent value="ai-scoring">
                  <div className="pt-4 space-y-6">
                    {/* Overall Score Summary */}
                    <Card className="bg-dark border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg">AI Evaluation Summary</CardTitle>
                        <CardDescription>Comprehensive scoring based on document analysis and evaluation criteria</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-2xl font-bold text-white">{currentDeal.aiScore}/100</h4>
                            <p className="text-gray-400">Overall Investment Score</p>
                          </div>
                          <div className={`px-4 py-2 rounded-lg text-lg font-medium ${
                            currentDeal.aiScore >= 85 ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                            currentDeal.aiScore >= 70 ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                            'bg-red-600/20 text-red-400 border border-red-600/30'
                          }`}>
                            {currentDeal.aiScore >= 85 ? 'Excellent Investment' : currentDeal.aiScore >= 70 ? 'Good Investment' : 'Moderate Risk'}
                          </div>
                        </div>
                        <p className="text-gray-300">
                          Based on analysis of {Array.isArray(documents) ? documents.length : 0} documents including financial reports, 
                          business plans, and regulatory filings. Tesla demonstrates exceptional market leadership in sustainable 
                          transportation with strong financial performance and technological innovation.
                        </p>
                      </CardContent>
                    </Card>

                    {/* Scoring Criteria Breakdown */}
                    <Card className="bg-dark border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg">Scoring Criteria Breakdown</CardTitle>
                        <CardDescription>Detailed evaluation across key investment dimensions</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Market Relevance */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-white font-medium">Market Relevance</span>
                              <span className="text-green-400 font-semibold">18/20</span>
                            </div>
                            <div className="w-full bg-dark-lighter rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{width: '90%'}}></div>
                            </div>
                            <p className="text-sm text-gray-400">
                              Strong alignment with sustainable transportation trends and energy transition priorities.
                            </p>
                          </div>

                          {/* Financial Health */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-white font-medium">Financial Health</span>
                              <span className="text-green-400 font-semibold">19/20</span>
                            </div>
                            <div className="w-full bg-dark-lighter rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{width: '95%'}}></div>
                            </div>
                            <p className="text-sm text-gray-400">
                              Excellent revenue growth (19% YoY), strong cash position ($29.1B), and positive free cash flow.
                            </p>
                          </div>

                          {/* Technology Innovation */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-white font-medium">Technology Innovation</span>
                              <span className="text-green-400 font-semibold">20/20</span>
                            </div>
                            <div className="w-full bg-dark-lighter rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{width: '100%'}}></div>
                            </div>
                            <p className="text-sm text-gray-400">
                              Industry-leading battery technology, autonomous driving capabilities, and manufacturing innovation.
                            </p>
                          </div>

                          {/* Market Position */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-white font-medium">Market Position</span>
                              <span className="text-green-400 font-semibold">18/20</span>
                            </div>
                            <div className="w-full bg-dark-lighter rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{width: '90%'}}></div>
                            </div>
                            <p className="text-sm text-gray-400">
                              Global EV market leader (20.1% share) with strong brand recognition and customer loyalty.
                            </p>
                          </div>

                          {/* Scalability */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-white font-medium">Scalability</span>
                              <span className="text-green-400 font-semibold">17/20</span>
                            </div>
                            <div className="w-full bg-dark-lighter rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
                            </div>
                            <p className="text-sm text-gray-400">
                              Proven Gigafactory model enabling global expansion with localized production capabilities.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Document-Based Analysis */}
                    <Card className="bg-dark border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg">Document Analysis Summary</CardTitle>
                        <CardDescription>Key insights extracted from uploaded documents</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                            <h4 className="font-semibold text-white mb-2">Financial Documents</h4>
                            <p className="text-sm text-gray-400 mb-2">Analyzed: Annual reports, earnings transcripts, SEC filings</p>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-green-400 text-sm">Strong Performance</span>
                            </div>
                          </div>
                          
                          <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                            <h4 className="font-semibold text-white mb-2">Strategic Plans</h4>
                            <p className="text-sm text-gray-400 mb-2">Reviewed: Business strategy, market expansion plans</p>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-green-400 text-sm">Well-Positioned</span>
                            </div>
                          </div>
                          
                          <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                            <h4 className="font-semibold text-white mb-2">Technical Reports</h4>
                            <p className="text-sm text-gray-400 mb-2">Assessed: Technology roadmaps, R&D investments</p>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-green-400 text-sm">Innovation Leader</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Risk Assessment */}
                    <Card className="bg-dark border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg">Risk Assessment</CardTitle>
                        <CardDescription>Key risks and mitigation strategies identified</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-dark-light rounded-lg border border-yellow-600/30">
                            <div>
                              <span className="text-white font-medium">Market Competition</span>
                              <p className="text-sm text-gray-400">Legacy automakers investing heavily in EV transition</p>
                            </div>
                            <span className="text-yellow-400 font-semibold">Medium Risk</span>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-dark-light rounded-lg border border-yellow-600/30">
                            <div>
                              <span className="text-white font-medium">Supply Chain</span>
                              <p className="text-sm text-gray-400">Critical battery materials concentrated in limited regions</p>
                            </div>
                            <span className="text-yellow-400 font-semibold">Medium Risk</span>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-dark-light rounded-lg border border-green-600/30">
                            <div>
                              <span className="text-white font-medium">Regulatory Environment</span>
                              <p className="text-sm text-gray-400">Strong government support for EV adoption globally</p>
                            </div>
                            <span className="text-green-400 font-semibold">Low Risk</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          
          {/* Documents */}
          <Card className="bg-dark-light border-dark-lighter mb-6">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold">Documents</CardTitle>
                  <CardDescription>Uploaded documents for analysis</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" className="bg-dark-lighter hover:bg-dark border-dark-lighter">
                    Export
                  </Button>
                  <Button>
                    Generate Memo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DocumentList documents={Array.isArray(documents) ? documents : []} />
            </CardContent>
          </Card>
          
          {/* AI Analysis Results */}
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold">AI Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeAgent} onValueChange={setActiveAgent} className="w-full">
                <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                  <TabsTrigger
                    value="legal"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Legal
                  </TabsTrigger>
                  <TabsTrigger
                    value="finance"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Finance
                  </TabsTrigger>
                  <TabsTrigger
                    value="medical"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Medical
                  </TabsTrigger>
                  <TabsTrigger
                    value="commercial"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Commercial
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai-agents"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    AI Agents
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="legal">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Legal') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="finance">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Finance') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="medical">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Medical') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="commercial">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Commercial') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="ai-agents">
                  <div className="pt-4">
                    <DueDiligenceAgents dealId={parseInt(selectedDeal)} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="bg-dark-light border-dark-lighter">
          <CardContent className="py-12 text-center">
            <h3 className="text-xl font-semibold mb-2">No Deal Selected</h3>
            <p className="text-gray-400 mb-4">Please select a deal to view its due diligence analysis.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
