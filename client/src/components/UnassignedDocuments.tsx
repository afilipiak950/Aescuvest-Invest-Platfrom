import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Download, UserPlus, Bot, MessageSquare, Sparkles, Zap, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { DocumentSummaryDialog } from './DocumentSummaryDialog';

interface UnassignedDocumentsProps {
  dealId: number;
  documents: any[];
  onAssignDocument: (docId: number, agentType: string) => void;
}

export default function UnassignedDocuments({ dealId, documents, onAssignDocument }: UnassignedDocumentsProps) {
  const [selectedAgent, setSelectedAgent] = useState<{ [key: number]: string }>({});
  const [assignmentComment, setAssignmentComment] = useState<{ [key: number]: string }>({});
  const [showCommentDialog, setShowCommentDialog] = useState<number | null>(null);
  const [isAIAssigning, setIsAIAssigning] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Debug log to see what documents are being passed
  console.log('🔍 UnassignedDocuments received:', documents.length, 'documents');

  const agentTypes = [
    { value: 'clinical', label: 'Clinical', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { value: 'legal', label: 'Legal', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { value: 'commercial', label: 'Commercial', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { value: 'hr', label: 'HR', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { value: 'financial', label: 'Financial', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { value: 'ip', label: 'IP', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
    { value: 'research', label: 'Research', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' }
  ];

  // AI-powered bulk assignment mutation
  const aiAssignmentMutation = useMutation({
    mutationFn: async () => {
      console.log(`🤖 Starting AI-powered batch assignment for deal ${dealId}`);
      return apiRequest(`/api/deals/${dealId}/ai-assign-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      console.log(`✅ AI batch assignment completed:`, data);
      toast({
        title: "AI Assignment Complete",
        description: `Successfully assigned ${data.successfulAssignments} documents to agents based on AI analysis`,
      });
      // Refresh all document-related queries
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${dealId}`] });
      setIsAIAssigning(false);
    },
    onError: (error) => {
      console.error('AI assignment failed:', error);
      toast({
        title: "AI Assignment Failed",
        description: "Failed to auto-assign documents. Please try manual assignment.",
        variant: "destructive"
      });
      setIsAIAssigning(false);
    }
  });

  // Enhanced manual assignment with comment support
  const assignDocumentMutation = useMutation({
    mutationFn: async ({ docId, agentType, comment }: { docId: number; agentType: string; comment?: string }) => {
      console.log(`🔄 Manually assigning document ${docId} to ${agentType} agent with comment: ${comment || 'none'}`);
      return apiRequest(`/api/deals/${dealId}/documents/${docId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agentType,
          comment: comment || '',
          assignmentType: 'manual'
        })
      });
    },
    onSuccess: (data, variables) => {
      console.log(`✅ Document ${variables.docId} successfully assigned to ${variables.agentType} agent`);
      toast({
        title: "Document Assigned",
        description: `Document assigned to ${variables.agentType} agent${variables.comment ? ' with your feedback' : ''}`,
      });
      // Clear form state
      setSelectedAgent(prev => ({ ...prev, [variables.docId]: '' }));
      setAssignmentComment(prev => ({ ...prev, [variables.docId]: '' }));
      setShowCommentDialog(null);
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/${variables.agentType.toLowerCase()}/results`] });
      onAssignDocument(variables.docId, variables.agentType);
    },
    onError: (error, variables) => {
      console.error(`❌ Failed to assign document ${variables.docId} to ${variables.agentType}:`, error);
    }
  });

  const handleAssignDocument = (docId: number) => {
    const agentType = selectedAgent[docId];
    if (!agentType) return;

    const comment = assignmentComment[docId];
    assignDocumentMutation.mutate({ docId, agentType, comment });
  };

  const handleAIAssignment = () => {
    setIsAIAssigning(true);
    aiAssignmentMutation.mutate();
  };

  const handleAssignWithComment = (docId: number) => {
    const agentType = selectedAgent[docId];
    if (!agentType) return;

    const comment = assignmentComment[docId];
    assignDocumentMutation.mutate({ docId, agentType, comment });
  };

  // Handle document click to show AI summary
  const handleDocumentClick = (document: any) => {
    setSelectedDocument(document);
    setShowDocumentDialog(true);
  };

  const handleDownload = async (doc: any) => {
    try {
      console.log(`📥 Starting download for document ${doc.id}: ${doc.name}`);
      
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get the filename from the Content-Disposition header or use the document name
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = doc.name;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Downloaded ${filename}`,
      });

      console.log(`✅ Successfully downloaded: ${filename}`);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : 'Failed to download document',
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-dark-light border-dark-lighter">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-400" />
              Unassigned Documents ({documents.length})
            </CardTitle>
            <p className="text-gray-400">
              Use AI to automatically assign documents based on their content, or assign manually.
            </p>
          </div>
          
          {documents.length > 0 && (
            <Button
              onClick={handleAIAssignment}
              disabled={isAIAssigning || aiAssignmentMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium"
            >
              {isAIAssigning || aiAssignmentMutation.isPending ? (
                <>
                  <Bot className="h-4 w-4 mr-2 animate-spin" />
                  AI Assigning...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Auto-Assign All
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">All Documents Assigned!</h3>
            <p className="text-gray-400">
              Every document has been successfully assigned to an agent for analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="border border-dark-lighter rounded-lg p-4 bg-dark/50 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div 
                    className="flex-1 min-w-0 cursor-pointer hover:bg-dark-lighter/50 rounded-lg p-2 -m-2 transition-colors"
                    onClick={() => handleDocumentClick(doc)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <h4 className="font-medium text-white truncate hover:text-primary transition-colors">
                        {doc.name}
                      </h4>
                      <Badge variant="outline" className="text-red-400 border-red-400/30 bg-red-500/10">
                        Unassigned
                      </Badge>
                      <Eye className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {doc.description && (
                      <p className="text-sm text-gray-400 mb-3">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Size: {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : 'Unknown'}</span>
                      <span>
                        Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select
                      value={selectedAgent[doc.id] || ''}
                      onValueChange={(value) => 
                        setSelectedAgent(prev => ({ ...prev, [doc.id]: value }))
                      }
                    >
                      <SelectTrigger className="w-32 bg-dark border-dark-lighter text-white focus:ring-primary">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-lighter border-dark-lighter">
                        {agentTypes.map((agent) => (
                          <SelectItem key={agent.value} value={agent.value}>
                            {agent.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button
                      onClick={() => handleAssignDocument(doc.id)}
                      disabled={!selectedAgent[doc.id] || assignDocumentMutation.isPending}
                      size="sm"
                      className="bg-primary hover:bg-primary-hover"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assign
                    </Button>

                    <Dialog open={showCommentDialog === doc.id} onOpenChange={(open) => setShowCommentDialog(open ? doc.id : null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-dark-lighter text-gray-300 hover:text-white hover:bg-dark-lighter"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Add Comment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-dark-light border-dark-lighter">
                        <DialogHeader>
                          <DialogTitle className="text-white">Add Assignment Comment</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="comment" className="text-gray-300">
                              Why are you assigning this document to {selectedAgent[doc.id] ? agentTypes.find(a => a.value === selectedAgent[doc.id])?.label : 'this agent'}?
                            </Label>
                            <Textarea
                              id="comment"
                              placeholder="Your feedback helps improve future AI assignments..."
                              value={assignmentComment[doc.id] || ''}
                              onChange={(e) => setAssignmentComment(prev => ({ ...prev, [doc.id]: e.target.value }))}
                              className="mt-2 bg-dark border-dark-lighter text-white"
                              rows={3}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setShowCommentDialog(null)}
                              className="border-dark-lighter text-gray-300 hover:text-white"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleAssignWithComment(doc.id)}
                              disabled={!selectedAgent[doc.id] || assignDocumentMutation.isPending}
                              className="bg-primary hover:bg-primary-hover"
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign with Comment
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="bg-dark-lighter hover:bg-dark border-dark-lighter"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* Document Summary Dialog */}
      <DocumentSummaryDialog
        document={selectedDocument}
        open={showDocumentDialog}
        onOpenChange={setShowDocumentDialog}
      />
    </Card>
  );
}