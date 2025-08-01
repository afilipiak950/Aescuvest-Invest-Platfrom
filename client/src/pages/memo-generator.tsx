import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageHeader from '@/components/layout/page-header';
import MemoSection from '@/components/memo-generator/memo-section';
import MemoControls from '@/components/memo-generator/memo-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Brain, TrendingUp, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cleanMarkdown, formatBusinessText, formatObjectContent } from '@/utils/textFormatter';
import { FormattedContent, SectionHeader, InfoGrid } from '@/components/FormattedContent';
import { ProfessionalFormattedContent, ProfessionalInfoGrid } from '@/components/ProfessionalFormattedContent';

// Simplified memo interface that matches actual data structure
interface InvestmentMemo {
  [key: string]: any; // Flexible structure to handle various memo formats
}

export default function MemoGenerator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDeal, setSelectedDeal] = useState<string>('');
  const [currentMemo, setCurrentMemo] = useState<InvestmentMemo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisType, setAnalysisType] = useState('comprehensive');

  // Fetch deals
  const { data: deals = [] } = useQuery({
    queryKey: ['/api/deals'],
    staleTime: 5 * 60 * 1000
  });

  const selectedDealData = selectedDeal ? deals.find((d: any) => d.id.toString() === selectedDeal) : null;

  // Fetch existing memo when deal changes
  useEffect(() => {
    if (selectedDeal) {
      setCurrentMemo(null);
      fetchMemoForDeal(selectedDeal);
    }
  }, [selectedDeal]);

  const fetchMemoForDeal = async (dealId: string) => {
    try {
      console.log(`📋 Fetching memo for deal ${dealId}`);
      const response = await fetch(`/api/deals/${dealId}/memo`);
      const data = await response.json();
      
      console.log('📋 Memo fetch response:', { success: data.success, hasMemo: !!data.memo });
      
      if (data.success && data.memo) {
        setCurrentMemo(data.memo);
        console.log('🔍 Display Debug:', {
          existingMemo: !!data.memo,
          existingMemoData: !!data.memo,
          generatedMemo: false,
          currentMemo: !!data.memo,
          currentMemoKeys: data.memo ? Object.keys(data.memo) : [],
          isGenerating: false,
          selectedDeal: dealId,
          showReadyToGenerate: !data.memo,
          showGenerating: false,
          showMemoContent: !!data.memo
        });
      } else {
        setCurrentMemo(null);
        console.log('🔍 Display Debug:', {
          existingMemo: false,
          existingMemoData: false,
          generatedMemo: false,
          currentMemo: false,
          currentMemoKeys: [],
          isGenerating: false,
          selectedDeal: dealId,
          showReadyToGenerate: true,
          showGenerating: false,
          showMemoContent: false
        });
      }
    } catch (error) {
      console.error('Error fetching memo:', error);
      setCurrentMemo(null);
    }
  };

  const handleGenerateMemo = async () => {
    if (!selectedDeal) return;

    setIsGenerating(true);
    try {
      console.log(`🧠 Starting professional memo generation for deal ${selectedDeal}`);
      
      const response = await apiRequest(`/api/deals/${selectedDeal}/generate-memo`, {
        method: 'POST'
      });

      if (response.success) {
        setCurrentMemo(response.memo);
        toast({
          title: "Professional Memo Generated",
          description: "High-quality investment memo created using advanced AI analysis of all documents and data."
        });
      } else {
        throw new Error(response.error || 'Failed to generate memo');
      }
    } catch (error) {
      console.error('Error generating memo:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate memo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedDeal) return;

    try {
      const response = await fetch(`/api/deals/${selectedDeal}/export-pdf`, {
        method: 'POST'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `investment-memo-${selectedDealData?.companyName || 'deal'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "PDF Export Complete",
          description: "Professional memo exported successfully."
        });
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleExportWord = async () => {
    if (!selectedDeal) return;

    try {
      const response = await fetch(`/api/deals/${selectedDeal}/export-word`, {
        method: 'POST'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `investment-memo-${selectedDealData?.companyName || 'deal'}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Word Export Complete",
          description: "Professional memo exported successfully."
        });
      }
    } catch (error) {
      console.error('Error exporting Word:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export Word document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const renderMemoSection = (key: string, content: any) => {
    if (!content) return null;

    const sectionTitles: Record<string, string> = {
      coverPage: "Investment Memorandum",
      executiveSummary: "Executive Summary", 
      investmentHighlights: "Investment Highlights",
      marketAnalysis: "Market Analysis",
      productAnalysis: "Product & Technology Analysis",
      businessModel: "Business Model",
      teamAssessment: "Management Team Assessment",
      financialAnalysis: "Financial Analysis",
      commercialStrategy: "Commercial Strategy",
      clinicalAssessment: "Clinical Assessment",
      ipAnalysis: "Intellectual Property Analysis",
      legalAssessment: "Legal Assessment",
      riskAssessment: "Risk Assessment",
      exitStrategy: "Exit Strategy",
      recommendation: "Investment Recommendation",
      swotAnalysis: "SWOT Analysis",
      appendices: "Appendices"
    };

    const title = sectionTitles[key] || key.replace(/([A-Z])/g, ' $1').trim();
    
    return (
      <Card key={key} className="border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
            <div>
              <CardTitle className="text-xl text-white">{title}</CardTitle>
              <p className="text-slate-400 text-sm">Professional analysis and insights</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none">
            <ProfessionalFormattedContent 
              content={typeof content === 'string' ? content : JSON.stringify(content, null, 2)} 
              variant="large"
              className="text-slate-200 leading-relaxed"
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <PageHeader 
        title="Investment Memo Generator"
        subtitle="Generate comprehensive investment memorandums using AI-powered analysis"
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
                <div className="w-full sm:w-64">
                  <Select value={selectedDeal} onValueChange={setSelectedDeal}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="Select Deal" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {deals.map((deal: any) => (
                        <SelectItem key={deal.id} value={deal.id.toString()}>
                          {deal.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {currentMemo && (
                <div className="flex gap-2">
                  <Button onClick={handleExportPDF} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button onClick={handleExportWord} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Word
                  </Button>
                </div>
              )}
            </div>
          </div>

          {!selectedDeal ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">Select a Deal</h3>
              <p className="text-gray-500">Choose a deal from the dropdown to generate a comprehensive investment memo.</p>
            </div>
          ) : !currentMemo && !isGenerating ? (
            <div className="text-center py-12">
              <Brain className="h-16 w-16 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Ready to Generate</h3>
              <p className="text-gray-400 mb-6">
                Create a comprehensive investment memo using all documents, agent analyses, and market research for <span className="text-primary font-medium">{selectedDealData?.companyName}</span>.
              </p>
              {selectedDealData && ![18, 22, 33].includes(selectedDealData.id) && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ This deal has no documents or agent analyses. For best results, select Deal 33 (Neteera IM) with 100 documents and completed analyses.
                  </p>
                </div>
              )}
              <Button onClick={handleGenerateMemo} className="bg-primary hover:bg-primary/90">
                <Brain className="h-4 w-4 mr-2" />
                Generate Investment Memo
              </Button>
            </div>
          ) : isGenerating ? (
            <div className="text-center py-12">
              <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium text-white mb-2">Generating Professional Memo</h3>
              <p className="text-gray-400">
                Analyzing all documents and agent reports for {selectedDealData?.companyName}...
              </p>
            </div>
          ) : (
            <div className="space-y-8 max-h-[calc(100vh-200px)] overflow-y-auto pr-4">
              {currentMemo && Object.entries(currentMemo).map(([key, content]) => 
                renderMemoSection(key, content)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}