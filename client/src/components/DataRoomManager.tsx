import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FolderOpen, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText,
  Unlink,
  Loader2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface DataRoomManagerProps {
  dealId: number;
  onUploadComplete?: () => void;
}

interface DataRoomConnection {
  id: number;
  dealId: number;
  connectionType: string;
  folderName: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  createdAt: string;
  lastSyncAt?: string;
}

export default function DataRoomManager({ dealId, onUploadComplete }: DataRoomManagerProps) {
  const [folderName, setFolderName] = useState('Data Room Documents');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch data room connection status
  const { data: connectionData, isLoading: isLoadingStatus } = useQuery({
    queryKey: [`/api/deals/${dealId}/data-room/status`],
    retry: false
  });

  const connection: DataRoomConnection | null = connectionData?.connection || null;

  // ZIP upload mutation
  const uploadZipMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest(`/api/deals/${dealId}/data-room/upload-zip`, {
        method: 'POST',
        body: formData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/data-room/status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Call the callback to hide the data room after successful upload
      if (onUploadComplete) {
        onUploadComplete();
      }
    }
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/deals/${dealId}/data-room/disconnect`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/data-room/status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
    }
  });

  // Chunked upload function
  const uploadChunked = async (file: File) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (safe under Cloud Run limits)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    console.log(`🚀 Starting CHUNKED upload: ${file.name} (${totalChunks} chunks)`);
    
    try {
      // Step 1: Initialize upload session
      const initResponse = await fetch(`/api/deals/${dealId}/chunked-upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          totalChunks,
          fileSize: file.size
        })
      });
      
      if (!initResponse.ok) {
        throw new Error(`Init failed: ${initResponse.status}`);
      }
      
      const { sessionId } = await initResponse.json();
      console.log(`✅ Session created: ${sessionId}`);
      
      // Step 2: Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const chunkResponse = await fetch(`/api/deals/${dealId}/chunked-upload/chunk`, {
          method: 'POST',
          headers: {
            'X-Session-Id': sessionId,
            'X-Chunk-Index': i.toString()
          },
          body: chunk
        });
        
        if (!chunkResponse.ok) {
          throw new Error(`Chunk ${i} failed: ${chunkResponse.status}`);
        }
        
        const progress = ((i + 1) / totalChunks) * 100;
        setUploadProgress(Math.round(progress));
        console.log(`📦 Uploaded chunk ${i + 1}/${totalChunks} (${Math.round(progress)}%)`);
      }
      
      // Step 3: Complete upload
      const completeResponse = await fetch(`/api/deals/${dealId}/chunked-upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!completeResponse.ok) {
        throw new Error(`Complete failed: ${completeResponse.status}`);
      }
      
      console.log('🎉 Chunked upload complete!');
      return await completeResponse.json();
      
    } catch (error) {
      console.error('❌ Chunked upload failed:', error);
      throw error;
    } finally {
      setUploadProgress(0);
    }
  };

  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Please select a ZIP file');
      return;
    }

    console.log(`Uploading ZIP file: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);

    // 🚨 ALWAYS USE CHUNKED UPLOAD FOR FILES > 10MB
    const USE_CHUNKED = file.size > 10 * 1024 * 1024; // 10MB threshold
    
    if (USE_CHUNKED) {
      console.log('🚀 Using CHUNKED upload for large file');
      
      try {
        const result = await uploadChunked(file);
        console.log('✅ Upload successful:', result);
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/data-room/status`] });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      } catch (error) {
        alert(`Upload failed: ${error.message || 'Unknown error'}`);
      }
    } else {
      // Regular upload for small files
      const formData = new FormData();
      formData.append('zipFile', file);
      formData.append('folderName', folderName);

      try {
        await uploadZipMutation.mutateAsync(formData);
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`Upload failed: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'syncing': return 'text-blue-600';
      case 'processing': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'syncing': return <Clock className="h-5 w-5 text-blue-600" />;
      case 'processing': return <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      default: return <FolderOpen className="h-5 w-5 text-gray-600" />;
    }
  };

  if (isLoadingStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Data Room
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading data room status...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Data Room Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {connection ? (
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(connection.status)}
                <div>
                  <div className="font-medium">{connection.folderName}</div>
                  <div className={`text-sm ${getStatusColor(connection.status)}`}>
                    {connection.status.charAt(0).toUpperCase() + connection.status.slice(1)}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            </div>

            {/* Processing Progress */}
            {(connection.status === 'processing' || connection.status === 'syncing') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing documents...</span>
                  <span>{connection.processedFiles} / {connection.totalFiles}</span>
                </div>
                <Progress 
                  value={(connection.processedFiles / connection.totalFiles) * 100} 
                  className="w-full" 
                />
              </div>
            )}

            {/* Connection Stats */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Total Files</div>
                <div className="font-medium">{connection.totalFiles}</div>
              </div>
              <div>
                <div className="text-gray-600">Processed</div>
                <div className="font-medium">{connection.processedFiles}</div>
              </div>
            </div>

            {connection.lastSyncAt && (
              <div className="text-xs text-gray-500">
                Last synced: {new Date(connection.lastSyncAt).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload New ZIP */}
            <div className="space-y-3">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="zipFile">Upload ZIP File</Label>
              <div className="flex items-center gap-3">
                <Input
                  ref={fileInputRef}
                  id="zipFile"
                  type="file"
                  accept=".zip"
                  onChange={handleZipUpload}
                  disabled={uploadZipMutation.isPending}
                  className="cursor-pointer"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadZipMutation.isPending}
                  variant="outline"
                >
                  {uploadZipMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Upload a ZIP file containing your deal documents. Files larger than 10MB will be 
                automatically chunked for reliable upload. All files will be processed using 
                AI-powered OCR for document intelligence and insights.
              </AlertDescription>
            </Alert>
            
            {/* Upload Progress Bar */}
            {uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {uploadZipMutation.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload failed: {uploadZipMutation.error.message}
            </AlertDescription>
          </Alert>
        )}

        {disconnectMutation.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Disconnect failed: {disconnectMutation.error.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}