import { useState } from 'react';
import PageHeader from '@/components/layout/page-header';
import UploadForm from '@/components/deal-intake/upload-form';
import AIAssistant from '@/components/deal-intake/ai-assistant';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

export default function DealIntake() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const handleFormSubmit = async (formData: any, files: File[]) => {
    setIsSubmitting(true);
    
    try {
      const dealPayload = {
        companyName: formData.companyName,
        sector: formData.sector,
        stage: formData.stage,
        fundingAmount: formData.fundingAmount ? parseInt(formData.fundingAmount, 10) : null,
        website: formData.website || null,
        location: formData.location || null,
        description: formData.description,
        status: 'Under Review'
      };
      

      
      // Create the deal first
      const dealResponse = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dealPayload)
      });
      
      if (!dealResponse.ok) {
        const errorData = await dealResponse.json();
        console.error('Deal creation failed:', errorData);
        throw new Error(`Failed to create deal: ${JSON.stringify(errorData)}`);
      }
      
      const newDeal = await dealResponse.json();
      
      // Upload documents if any files were provided
      if (files.length > 0) {
        const formDataToSend = new FormData();
        formDataToSend.append('dealId', newDeal.id.toString());
        
        files.forEach(file => {
          formDataToSend.append('files', file);
        });
        
        const uploadResponse = await fetch('/api/documents', {
          method: 'POST',
          body: formDataToSend
        });
        
        if (!uploadResponse.ok) {
          console.warn('Deal created but document upload failed');
        }
      }
      
      toast({
        title: "Success!",
        description: `Deal "${formData.companyName}" has been created and submitted for AI analysis.`,
        variant: "default",
      });
      
      // Clear form and files
      setUploadedFiles([]);
      // You might also redirect to the new deal page
      window.location.href = '/deals';
    } catch (error) {
      console.error('Error submitting deal:', error);
      toast({
        title: "Error",
        description: "Failed to submit deal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };
  
  const handleFileRemove = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(file => file.name !== fileName));
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Deal Intake & Screening" 
        description="Upload and analyze new investment opportunities."
      />
      
      <Tabs defaultValue="dealIntake" className="mt-6">
        <TabsList className="border-b border-dark-lighter bg-transparent mb-6">
          <TabsTrigger 
            value="dealIntake" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent py-3 px-1"
          >
            Deal Intake
          </TabsTrigger>
          <TabsTrigger 
            value="dueDiligence" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent py-3 px-1"
          >
            Due Diligence
          </TabsTrigger>
          <TabsTrigger 
            value="memoGenerator" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent py-3 px-1"
          >
            Memo Generator
          </TabsTrigger>
          <TabsTrigger 
            value="investorMatching" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent py-3 px-1"
          >
            Investor Matching
          </TabsTrigger>
          <TabsTrigger 
            value="workflowAutomation" 
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent py-3 px-1"
          >
            Workflow
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dealIntake" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Form */}
            <div className="lg:col-span-2">
              <UploadForm 
                onSubmit={handleFormSubmit}
                onFileUpload={handleFileUpload}
                onFileRemove={handleFileRemove}
                uploadedFiles={uploadedFiles}
                isSubmitting={isSubmitting}
              />
            </div>
            
            {/* Right Column - AI Assistant */}
            <div>
              <AIAssistant />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="dueDiligence">
          <Card className="bg-dark-light border-dark-lighter">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-xl font-semibold mb-2">Due Diligence Module</h3>
                <p className="text-gray-400 mb-4">Please navigate to the Due Diligence page to access this functionality.</p>
                <a href="/due-diligence" className="bg-primary hover:bg-primary-hover text-dark font-medium rounded-lg px-4 py-2 transition duration-300">
                  Go to Due Diligence
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="memoGenerator">
          <Card className="bg-dark-light border-dark-lighter">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-xl font-semibold mb-2">Memo Generator Module</h3>
                <p className="text-gray-400 mb-4">Please navigate to the Memo Generator page to access this functionality.</p>
                <a href="/memo-generator" className="bg-primary hover:bg-primary-hover text-dark font-medium rounded-lg px-4 py-2 transition duration-300">
                  Go to Memo Generator
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="investorMatching">
          <Card className="bg-dark-light border-dark-lighter">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-xl font-semibold mb-2">Investor Matching Module</h3>
                <p className="text-gray-400 mb-4">Please navigate to the Investor Matching page to access this functionality.</p>
                <a href="/investor-matching" className="bg-primary hover:bg-primary-hover text-dark font-medium rounded-lg px-4 py-2 transition duration-300">
                  Go to Investor Matching
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="workflowAutomation">
          <Card className="bg-dark-light border-dark-lighter">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-xl font-semibold mb-2">Workflow Automation Module</h3>
                <p className="text-gray-400 mb-4">Please navigate to the Workflow page to access this functionality.</p>
                <a href="/workflow" className="bg-primary hover:bg-primary-hover text-dark font-medium rounded-lg px-4 py-2 transition duration-300">
                  Go to Workflow
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
