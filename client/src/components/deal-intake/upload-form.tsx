import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, File, X, Loader2 } from 'lucide-react';

const formSchema = z.object({
  companyName: z.string().min(2, { message: 'Company name is required' }),
  sector: z.string().min(1, { message: 'Please select a sector' }),
  stage: z.string().min(1, { message: 'Please select a funding stage' }),
  fundingAmount: z.string().optional(),
  website: z.string().url({ message: 'Please enter a valid URL' }).optional().or(z.literal('')),
  location: z.string().optional(),
  description: z.string().min(10, { message: 'Please provide a brief description (min 10 characters)' })
});

type FormValues = z.infer<typeof formSchema>;

interface UploadFormProps {
  onSubmit: (data: FormValues, files: File[]) => void;
  onFileUpload: (files: File[]) => void;
  onFileRemove: (fileName: string) => void;
  uploadedFiles: File[];
  isSubmitting: boolean;
}

export default function UploadForm({ 
  onSubmit, 
  onFileUpload, 
  onFileRemove, 
  uploadedFiles, 
  isSubmitting 
}: UploadFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingLocation, setIsGeneratingLocation] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      sector: '',
      stage: '',
      fundingAmount: '',
      website: '',
      location: '',
      description: ''
    }
  });
  
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFileUpload(files);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFileUpload(files);
    }
  };
  
  const generateCompanyDescription = async (website: string) => {
    if (!website || !website.trim()) return;
    
    setIsGeneratingDescription(true);
    try {
      const response = await fetch('/api/ai/generate-company-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website })
      });
      
      if (response.ok) {
        const data = await response.json();
        form.setValue('description', data.description);
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const generateCompanyLocation = async (website: string) => {
    if (!website || !website.trim()) return;
    
    setIsGeneratingLocation(true);
    try {
      const response = await fetch('/api/ai/generate-company-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website })
      });
      
      if (response.ok) {
        const data = await response.json();
        form.setValue('location', data.location);
      }
    } catch (error) {
      console.error('Failed to generate location:', error);
    } finally {
      setIsGeneratingLocation(false);
    }
  };

  const handleWebsiteBlur = () => {
    const website = form.getValues('website');
    const currentDescription = form.getValues('description');
    const currentLocation = form.getValues('location');
    
    // Auto-generate description if empty and website is provided
    if (website && !currentDescription) {
      generateCompanyDescription(website);
    }
    
    // Auto-generate location if empty and website is provided
    if (website && !currentLocation) {
      generateCompanyLocation(website);
    }
  };

  const handleSubmit = (data: FormValues) => {
    onSubmit(data, uploadedFiles);
  };
  
  return (
    <>
      <Card className="bg-dark-light border-dark-lighter mb-6">
        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold mb-4">New Deal Submission</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Company Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter company name" 
                          {...field} 
                          className="bg-dark-lighter border-dark-lighter focus:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Website</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://company.com" 
                          {...field} 
                          onBlur={handleWebsiteBlur}
                          className="bg-dark-lighter border-dark-lighter focus:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Sector</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-dark-lighter border-dark-lighter focus:ring-primary">
                            <SelectValue placeholder="Select sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-dark-lighter border-dark-lighter">
                          <SelectItem value="HealthTech">HealthTech</SelectItem>
                          <SelectItem value="MedTech">MedTech</SelectItem>
                          <SelectItem value="BioTech">BioTech</SelectItem>
                          <SelectItem value="Digital Health">Digital Health</SelectItem>
                          <SelectItem value="Diagnostics">Diagnostics</SelectItem>
                          <SelectItem value="Therapeutics">Therapeutics</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Funding Stage</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-dark-lighter border-dark-lighter focus:ring-primary">
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-dark-lighter border-dark-lighter">
                          <SelectItem value="Pre-Seed">Pre-Seed</SelectItem>
                          <SelectItem value="Seed">Seed</SelectItem>
                          <SelectItem value="Series A">Series A</SelectItem>
                          <SelectItem value="Series B">Series B</SelectItem>
                          <SelectItem value="Series C+">Series C+</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fundingAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Funding Amount</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="€5,000,000" 
                          {...field} 
                          className="bg-dark-lighter border-dark-lighter focus:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 flex items-center gap-2">
                        Location
                        {isGeneratingLocation && (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Detecting location...
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={isGeneratingLocation ? "Analyzing company location..." : "City, Country"}
                          {...field} 
                          disabled={isGeneratingLocation}
                          className="bg-dark-lighter border-dark-lighter focus:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300 flex items-center gap-2">
                      Company Description
                      {isGeneratingDescription && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating from website...
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={isGeneratingDescription ? "Analyzing website content..." : "Brief description of the company and its product..."}
                        {...field} 
                        disabled={isGeneratingDescription}
                        className="bg-dark-lighter border-dark-lighter focus:ring-primary h-24 resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Upload controls will be in the next Card */}
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card className="bg-dark-light border-dark-lighter">
        <CardContent className="pt-6">
          <h3 className="text-xl font-semibold mb-4">Upload Documents</h3>
          
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed ${isDragging ? 'border-primary bg-primary/10' : 'border-dark-lighter'} rounded-xl p-8 text-center transition-colors duration-200`}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="mt-2 text-gray-300">
              Drag & drop your pitch deck, one-pager, or other documents
            </p>
            <p className="text-sm text-gray-400 mt-1">
              PDF, PPT, DOCX (max 25MB)
            </p>
            <div className="mt-4">
              <input
                type="file"
                id="file-upload"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <label
                htmlFor="file-upload"
                className="bg-dark-lighter hover:bg-dark px-4 py-2 rounded-lg transition cursor-pointer inline-block"
              >
                Browse Files
              </label>
            </div>
          </div>
          
          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Uploaded Files</h4>
              <div className="space-y-3">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="bg-dark-lighter rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <File className="h-5 w-5 text-primary mr-2" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => onFileRemove(file.name)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-8 flex justify-end">
            <Button 
              type="submit" 
              onClick={form.handleSubmit(handleSubmit)}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover text-dark font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Submit for AI Analysis</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
