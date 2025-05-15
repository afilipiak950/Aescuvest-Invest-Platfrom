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
      // In a real app, you would upload files and form data to an API
      // const formDataToSend = new FormData();
      // Object.entries(formData).forEach(([key, value]) => {
      //   formDataToSend.append(key, value as string);
      // });
      
      // files.forEach(file => {
      //   formDataToSend.append('files', file);
      // });
      
      // const response = await fetch('/api/deals', {
      //   method: 'POST',
      //   body: formDataToSend
      // });
      
      // if (!response.ok) throw new Error('Failed to submit deal');
      
      // Simulating API request
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Success!",
        description: "Deal has been submitted for AI analysis.",
        variant: "default",
      });
      
      // Clear form and files in a real application
      // You might also redirect to a new page or show results
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
