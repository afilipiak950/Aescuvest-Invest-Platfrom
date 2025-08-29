import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit3, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SectionEditorProps {
  dealId: string;
  sectionKey: string;
  sectionTitle: string;
  currentContent: string;
  onUpdate: (newContent: string) => void;
}

export function SectionEditor({ dealId, sectionKey, sectionTitle, currentContent, onUpdate }: SectionEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const regenerateSectionMutation = useMutation({
    mutationFn: async ({ prompt }: { prompt: string }) => {
      const response = await apiRequest(`/api/deals/${dealId}/memo/regenerate-section`, {
        method: 'POST',
        body: JSON.stringify({
          sectionKey,
          customPrompt: prompt,
        }),
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to regenerate section');
      }
      
      return response.content;
    },
    onSuccess: (newContent: string) => {
      onUpdate(newContent);
      setIsOpen(false);
      setCustomPrompt('');
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'memo'] });
      toast({
        title: "Section Updated",
        description: `${sectionTitle} has been regenerated with your custom prompt.`,
      });
    },
    onError: (error: any) => {
      console.error('Section regeneration failed:', error);
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate section. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRegenerate = () => {
    if (!customPrompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a custom prompt to regenerate this section.",
        variant: "destructive",
      });
      return;
    }
    
    setIsRegenerating(true);
    regenerateSectionMutation.mutate({ prompt: customPrompt.trim() });
  };

  const defaultPrompts = {
    executiveSummary: "Focus more on the investment opportunity and key value drivers",
    marketAnalysis: "Provide deeper competitive analysis and market sizing details", 
    teamAssessment: "Emphasize leadership experience and track record",
    financialAnalysis: "Include more detailed financial projections and metrics",
    riskAssessment: "Expand on regulatory and technical risks",
    productAnalysis: "Highlight unique technology advantages and IP position",
    commercialAnalysis: "Focus on go-to-market strategy and customer validation",
    clinicalAssessment: "Detail regulatory pathway and clinical development timeline"
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="opacity-70 hover:opacity-100 text-slate-400 hover:text-white transition-all"
        >
          <Edit3 className="w-4 h-4 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            Regenerate {sectionTitle}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Customize this section with AI enhancement. The system will automatically extract all relevant data from 
            OCR documents, AI summaries, and agent analyses to create improved content based on your prompt.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-200 mb-2 block">
              Custom Enhancement Prompt
            </label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={defaultPrompts[sectionKey] || "Describe how you want to enhance this section..."}
              className="min-h-[120px] bg-slate-800 border-slate-600 text-white resize-none"
              disabled={regenerateSectionMutation.isPending}
            />
          </div>
          
          <div className="text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <p className="font-medium mb-1">💡 Enhancement will automatically include:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All relevant OCR text from uploaded documents</li>
              <li>AI summaries from document processing</li>
              <li>Agent analyses (Clinical, Legal, Commercial, HR, Financial, IP, Research)</li>
              <li>External research data and company intelligence</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={regenerateSectionMutation.isPending}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleRegenerate}
            disabled={regenerateSectionMutation.isPending || !customPrompt.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {regenerateSectionMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate Section
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}