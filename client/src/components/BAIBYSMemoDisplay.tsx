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
  coverPage: CoverPageData | string;
  executiveSummary: string;
  swotAnalysis: SWOTData | string;
  marketAnalysis: MarketAnalysisData | string;
  productAnalysis: ProductAnalysisData | string;
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
  // Handle both string and object formats for backwards compatibility
  const coverPageData = typeof memo.coverPage === 'string' ? null : memo.coverPage;
  const swotData = typeof memo.swotAnalysis === 'string' ? null : memo.swotAnalysis;
  const marketData = typeof memo.marketAnalysis === 'string' ? null : memo.marketAnalysis;
  const productData = typeof memo.productAnalysis === 'string' ? null : memo.productAnalysis;

  return (
    <div className="space-y-8">
      {/* Cover Page - String format fallback */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Investment Memorandum</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-300 whitespace-pre-wrap text-sm font-mono">
            {typeof memo.coverPage === 'string' ? memo.coverPage : 'Cover page content not available'}
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-300 whitespace-pre-wrap">
            {memo.executiveSummary || 'Executive summary not available'}
          </div>
        </CardContent>
      </Card>

      {/* SWOT Analysis - String format fallback */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">SWOT Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-300 whitespace-pre-wrap">
            {typeof memo.swotAnalysis === 'string' ? memo.swotAnalysis : 'SWOT analysis not available'}
          </div>
        </CardContent>
      </Card>

      {/* Market Analysis - String format fallback */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Market Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-300 whitespace-pre-wrap">
            {typeof memo.marketAnalysis === 'string' ? memo.marketAnalysis : 'Market analysis not available'}
          </div>
        </CardContent>
      </Card>

      {/* Product Analysis - String format fallback */}
      {memo.productAnalysis && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Product Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {typeof memo.productAnalysis === 'string' ? memo.productAnalysis : 'Product analysis not available'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Model */}
      {memo.businessModel && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Business Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.businessModel}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Assessment */}
      {memo.teamAssessment && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Team Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.teamAssessment}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Analysis */}
      {memo.financialAnalysis && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Financial Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.financialAnalysis}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commercial Strategy */}
      {memo.commercialStrategy && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Commercial Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.commercialStrategy}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clinical Assessment */}
      {memo.clinicalAssessment && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Clinical Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.clinicalAssessment}
            </div>
          </CardContent>
        </Card>
      )}

      {/* IP Analysis */}
      {memo.ipAnalysis && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Intellectual Property Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.ipAnalysis}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Assessment */}
      {memo.riskAssessment && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.riskAssessment}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Assessment */}
      {memo.legalAssessment && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Legal Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.legalAssessment}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investment Terms */}
      {memo.investmentTerms && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Investment Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.investmentTerms}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exit Strategy */}
      {memo.exitStrategy && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Exit Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.exitStrategy}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investment Recommendation */}
      {memo.recommendation && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Investment Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.recommendation}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appendices */}
      {memo.appendices && (
        <Card className="border-slate-700 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Appendices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-300 whitespace-pre-wrap">
              {memo.appendices}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}