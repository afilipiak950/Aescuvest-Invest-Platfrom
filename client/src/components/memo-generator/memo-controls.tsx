import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Deal } from "@/types";
import { Shield, FileText, FileOutput, Share2, Loader2 } from "lucide-react";

interface MemoControlsProps {
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
  currentDeal?: Deal;
}

const sections = [
  { id: "exec-sum", label: "Executive Summary", defaultChecked: true },
  { id: "product", label: "Product & Market", defaultChecked: true },
  { id: "team", label: "Team Analysis", defaultChecked: true },
  { id: "financials", label: "Financial Overview", defaultChecked: true },
  { id: "swot", label: "SWOT Analysis", defaultChecked: true },
  { id: "deal-terms", label: "Deal Terms", defaultChecked: false },
  { id: "dd-summary", label: "Due Diligence Summary", defaultChecked: false },
  { id: "recommendation", label: "Investment Recommendation", defaultChecked: false },
];

export default function MemoControls({ 
  onGenerate, 
  isGenerating,
  currentDeal
}: MemoControlsProps) {
  const [selectedSections, setSelectedSections] = useState<string[]>(
    sections.filter(s => s.defaultChecked).map(s => s.id)
  );
  const [notes, setNotes] = useState("");
  
  const handleSectionToggle = (sectionId: string) => {
    setSelectedSections(prev => {
      if (prev.includes(sectionId)) {
        return prev.filter(id => id !== sectionId);
      } else {
        return [...prev, sectionId];
      }
    });
  };
  
  const handleGenerate = () => {
    onGenerate();
  };
  
  return (
    <Card className="bg-dark-light border-dark-lighter mb-6 sticky top-24">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Generate Investment Memo</h3>
        
        <div className="space-y-6">
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Sections to Include
            </Label>
            <div className="space-y-2">
              {sections.map((section) => (
                <div className="flex items-center" key={section.id}>
                  <Checkbox 
                    id={section.id} 
                    checked={selectedSections.includes(section.id)}
                    onCheckedChange={() => handleSectionToggle(section.id)}
                    className="mr-2 h-4 w-4 data-[state=checked]:bg-primary"
                  />
                  <Label htmlFor={section.id} className="text-sm">
                    {section.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Additional Notes
            </Label>
            <Textarea 
              className="w-full bg-dark-lighter border-dark-lighter focus-visible:ring-primary h-24 resize-none"
              placeholder="Add any specific points to emphasize or include..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          
          <div className="pt-4 border-t border-dark-lighter">
            <Button 
              onClick={handleGenerate}
              disabled={isGenerating || !currentDeal}
              className="w-full bg-primary hover:bg-primary-hover text-dark font-medium flex items-center justify-center"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-5 w-5" />
                  Generate Memo
                </>
              )}
            </Button>
          </div>
          
          <div className="pt-4 border-t border-dark-lighter">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Export Options</h4>
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                className="flex-1 bg-dark-lighter hover:bg-dark border-dark flex items-center justify-center"
                disabled={isGenerating}
              >
                <FileText className="h-4 w-4 mr-1" />
                <span>PDF</span>
              </Button>
              <Button 
                variant="outline"
                className="flex-1 bg-dark-lighter hover:bg-dark border-dark flex items-center justify-center"
                disabled={isGenerating}
              >
                <FileOutput className="h-4 w-4 mr-1" />
                <span>Word</span>
              </Button>
              <Button 
                variant="outline"
                className="flex-1 bg-dark-lighter hover:bg-dark border-dark flex items-center justify-center"
                disabled={isGenerating}
              >
                <Share2 className="h-4 w-4 mr-1" />
                <span>Share</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
