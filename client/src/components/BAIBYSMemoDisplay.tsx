import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CoverPageData {
  company: string;
  headquarters: string;
  management: string[];
  incorporation: string;
  shareholding: string[];
  proposal: string;
  keyInvestmentTerms: string[];
  investmentHighlights: string[];
}

interface SWOTData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface MarketAnalysisData {
  marketContext: string;
  tamSamSom: {
    tam: string;
    sam: string;
    som: string;
  };
  whyNow: string;
  painPoints: string;
  marketOpportunity: string;
}

interface ProductAnalysisData {
  productOverview: string;
  technicalSpecs: string;
  uniqueSellingPoints: string[];
  competitiveAdvantages: string;
}

interface BAIBYSMemoData {
  coverPage: CoverPageData;
  executiveSummary: string;
  swotAnalysis: SWOTData;
  marketAnalysis: MarketAnalysisData;
  productAnalysis: ProductAnalysisData;
  businessModel: string;
  teamAssessment: string;
  financialAnalysis: string;
  commercialStrategy: string;
  clinicalAssessment: string;
  ipAnalysis: string;
  riskAssessment: string;
  legalAssessment: string;
  investmentTerms: string;
  exitStrategy: string;
  recommendation: string;
  appendices: string;
}

interface BAIBYSMemoDisplayProps {
  memo: BAIBYSMemoData;
}

export default function BAIBYSMemoDisplay({ memo }: BAIBYSMemoDisplayProps) {
  return (
    <div className="space-y-8">
      {/* Cover Page */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-3xl font-bold text-white mb-2">
            Investment Memorandum
          </CardTitle>
          <p className="text-lg text-slate-300">{memo.coverPage.company}</p>
          <p className="text-sm text-slate-400">Generated on {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">The Company</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <p><strong>Headquarters:</strong> {memo.coverPage.headquarters}</p>
                <div>
                  <strong>Management:</strong>
                  <ul className="mt-1 ml-4 list-disc space-y-1">
                    {memo.coverPage.management.map((member, idx) => (
                      <li key={idx}>{member}</li>
                    ))}
                  </ul>
                </div>
                <p><strong>Incorporation:</strong> {memo.coverPage.incorporation}</p>
                <div>
                  <strong>Shareholding:</strong>
                  <ul className="mt-1 ml-4 list-disc space-y-1">
                    {memo.coverPage.shareholding.map((holding, idx) => (
                      <li key={idx}>{holding}</li>
                    ))}
                  </ul>
                </div>
                <p><strong>Proposal:</strong> {memo.coverPage.proposal}</p>
                <div>
                  <strong>Key Investment Terms:</strong>
                  <ul className="mt-1 ml-4 list-disc space-y-1">
                    {memo.coverPage.keyInvestmentTerms.map((term, idx) => (
                      <li key={idx}>{term}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Investment Highlights</h3>
            <div className="space-y-3">
              {memo.coverPage.investmentHighlights.map((highlight, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-slate-300">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl text-white">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none">
            <div className="text-slate-200 leading-relaxed whitespace-pre-wrap">
              {memo.executiveSummary}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SWOT Analysis */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl text-white">SWOT Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-green-400 mb-3">Strengths</h4>
              <ul className="space-y-2">
                {memo.swotAnalysis.strengths.map((strength, idx) => (
                  <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                    <Badge variant="outline" className="text-green-400 border-green-400">+</Badge>
                    {strength}
                  </li>
                ))}
              </ul>
              
              <h4 className="text-lg font-semibold text-blue-400 mb-3 mt-6">Opportunities</h4>
              <ul className="space-y-2">
                {memo.swotAnalysis.opportunities.map((opportunity, idx) => (
                  <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                    <Badge variant="outline" className="text-blue-400 border-blue-400">↗</Badge>
                    {opportunity}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-yellow-400 mb-3">Weaknesses</h4>
              <ul className="space-y-2">
                {memo.swotAnalysis.weaknesses.map((weakness, idx) => (
                  <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                    <Badge variant="outline" className="text-yellow-400 border-yellow-400">−</Badge>
                    {weakness}
                  </li>
                ))}
              </ul>
              
              <h4 className="text-lg font-semibold text-red-400 mb-3 mt-6">Threats</h4>
              <ul className="space-y-2">
                {memo.swotAnalysis.threats.map((threat, idx) => (
                  <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                    <Badge variant="outline" className="text-red-400 border-red-400">⚠</Badge>
                    {threat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Analysis */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl text-white">Market Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Market Context</h4>
            <div className="text-slate-300 text-sm whitespace-pre-wrap">
              {memo.marketAnalysis.marketContext}
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">TAM / SAM / SOM</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg">
                <h5 className="font-semibold text-blue-400 mb-2">TAM</h5>
                <p className="text-slate-300 text-sm">{memo.marketAnalysis.tamSamSom.tam}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h5 className="font-semibold text-green-400 mb-2">SAM</h5>
                <p className="text-slate-300 text-sm">{memo.marketAnalysis.tamSamSom.sam}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h5 className="font-semibold text-purple-400 mb-2">SOM</h5>
                <p className="text-slate-300 text-sm">{memo.marketAnalysis.tamSamSom.som}</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Why Now?</h4>
            <div className="text-slate-300 text-sm whitespace-pre-wrap">
              {memo.marketAnalysis.whyNow}
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Pain Points</h4>
            <div className="text-slate-300 text-sm whitespace-pre-wrap">
              {memo.marketAnalysis.painPoints}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Analysis */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl text-white">Product Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Product Overview</h4>
            <div className="text-slate-300 text-sm whitespace-pre-wrap">
              {memo.productAnalysis.productOverview}
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Technical Specifications</h4>
            <div className="text-slate-300 text-sm whitespace-pre-wrap">
              {memo.productAnalysis.technicalSpecs}
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Unique Selling Points</h4>
            <ul className="space-y-2">
              {memo.productAnalysis.uniqueSellingPoints.map((point, idx) => (
                <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Competitive Advantages</h4>
            <div className="text-slate-300 text-sm whitespace-pre-wrap">
              {memo.productAnalysis.competitiveAdvantages}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remaining Sections */}
      {[
        { title: 'Business Model', content: memo.businessModel },
        { title: 'Team Assessment', content: memo.teamAssessment },
        { title: 'Financial Analysis', content: memo.financialAnalysis },
        { title: 'Commercial Strategy', content: memo.commercialStrategy },
        { title: 'Clinical Assessment', content: memo.clinicalAssessment },
        { title: 'IP Analysis', content: memo.ipAnalysis },
        { title: 'Risk Assessment', content: memo.riskAssessment },
        { title: 'Legal Assessment', content: memo.legalAssessment },
        { title: 'Investment Terms', content: memo.investmentTerms },
        { title: 'Exit Strategy', content: memo.exitStrategy },
        { title: 'Recommendation', content: memo.recommendation },
        { title: 'Appendices', content: memo.appendices }
      ].map((section, idx) => (
        <Card key={idx} className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl text-white">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert max-w-none">
              <div className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                {section.content}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}