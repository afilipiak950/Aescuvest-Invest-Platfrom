import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

export default function AIAssistant() {
  return (
    <Card className="bg-dark-light border-dark-lighter sticky top-24">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
        <div className="bg-dark-lighter rounded-lg p-4 mb-4">
          <p className="text-gray-300 text-sm">
            Fill in the form and upload your documents to get an AI-powered 
            analysis of your potential investment.
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">AI Evaluates:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Check className="h-4 w-4 text-primary mr-2" />
                <span>Healthcare sector compliance (25%)</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-primary mr-2" />
                <span>Biotech exclusion criteria (20%)</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-primary mr-2" />
                <span>EU/Israel headquarters (15%)</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-primary mr-2" />
                <span>Series A-C stage fit (20%)</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-primary mr-2" />
                <span>Ownership feasibility (10%)</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-primary mr-2" />
                <span>Platform business model (10%)</span>
              </li>
            </ul>
          </div>
          
          <div className="pt-4 border-t border-dark-lighter">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Expected Output:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                <span>Investment score (0-100)</span>
              </li>
              <li className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                <span>Screening document</span>
              </li>
              <li className="flex items-center">
                <div className="w-4 h-4 bg-yellow-500 rounded-full mr-2"></div>
                <span>Initial recommendation</span>
              </li>
              <li className="flex items-center">
                <div className="w-4 h-4 bg-purple-500 rounded-full mr-2"></div>
                <span>Suggested next steps</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6">
          <p className="text-xs text-gray-400">Analysis time: ~2-3 minutes after submission</p>
        </div>
      </CardContent>
    </Card>
  );
}
