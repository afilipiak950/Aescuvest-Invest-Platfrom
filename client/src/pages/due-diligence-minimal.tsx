// Minimal version to isolate the error source
import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import ErrorBoundary from '@/components/ErrorBoundary';

function MinimalDueDiligenceContent() {
  const [location] = useLocation();
  const params = useParams();
  const [selectedDeal, setSelectedDeal] = useState<string>(params.dealId || '22');

  // Fetch real deals from database
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    retry: false,
  });

  console.log('🎯 Minimal component loaded, selectedDeal:', selectedDeal);
  console.log('📄 Deals data:', { deals, isLoadingDeals });

  if (isLoadingDeals) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center mt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-200 mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Due Diligence Analysis - Minimal Version" 
        description="Testing component to isolate error source."
      />
      
      <Card className="bg-dark-light border-dark-lighter mb-6">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Selected Deal: {selectedDeal}</h3>
          <p className="text-gray-400">
            Deals loaded: {Array.isArray(deals) ? deals.length : 'No deals'}
          </p>
          {Array.isArray(deals) && deals.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Available Deals:</h4>
              <ul className="text-sm text-gray-400">
                {deals.slice(0, 3).map((deal: any) => (
                  <li key={deal.id}>
                    Deal {deal.id}: {deal.companyName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MinimalDueDiligence() {
  return (
    <ErrorBoundary>
      <MinimalDueDiligenceContent />
    </ErrorBoundary>
  );
}