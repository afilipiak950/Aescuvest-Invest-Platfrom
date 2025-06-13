import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, UserPlus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface UnassignedDocumentsProps {
  dealId: number;
  documents: any[];
  onAssignDocument: (docId: number, agentType: string) => void;
}

export default function UnassignedDocuments({ dealId, documents, onAssignDocument }: UnassignedDocumentsProps) {
  const [selectedAgent, setSelectedAgent] = useState<{ [key: number]: string }>({});
  const queryClient = useQueryClient();

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

  const assignDocumentMutation = useMutation({
    mutationFn: async ({ docId, agentType }: { docId: number; agentType: string }) => {
      console.log(`🔄 Manually assigning document ${docId} to ${agentType} agent`);
      return apiRequest(`/api/deals/${dealId}/documents/${docId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType })
      });
    },
    onSuccess: (data, variables) => {
      console.log(`✅ Document ${variables.docId} successfully assigned to ${variables.agentType} agent`);
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

    assignDocumentMutation.mutate({ docId, agentType });
  };

  const handleDownload = (doc: any) => {
    console.log(`Starting download for document ${doc.id}: ${doc.name}`);
    const downloadUrl = `/api/documents/${doc.id}/download`;
    console.log('Opening download URL:', window.location.origin + downloadUrl);
    window.open(downloadUrl, '_blank');
    console.log(`Successfully initiated download: ${doc.name}`);
  };

  return (
    <Card className="bg-dark-light border-dark-lighter">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-red-400" />
          Unassigned Documents ({documents.length})
        </CardTitle>
        <p className="text-gray-400">
          These documents need to be manually assigned to an agent for analysis.
        </p>
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
                className="border border-dark-lighter rounded-lg p-4 bg-dark/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <h4 className="font-medium text-white truncate">{doc.name}</h4>
                      <Badge variant="outline" className="text-red-400 border-red-400/30 bg-red-500/10">
                        Unassigned
                      </Badge>
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
    </Card>
  );
}