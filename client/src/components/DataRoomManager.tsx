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

  // GCS direct upload function (same approach as DataRoomExplorer)
  const uploadDirectToGCS = async (file: File) => {
    console.log(`🚀 Starting GCS DIRECT upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    
    try {
      // Step 1: Request signed URL from server
      console.log('📍 STEP 1: Requesting signed URL from server...');
      const requestUrl = `/api/gcs/signed-url/${dealId}`;
      const requestPayload = {
        fileName: file.name,
        fileSize: file.size
      };

      const signedResponse = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!signedResponse.ok) {
        throw new Error(`Signed URL request failed: ${signedResponse.status}`);
      }

      const signedData = await signedResponse.json();
      const { signedUrl, gcsFileName, uploadId } = signedData;
      
      console.log('✅ STEP 1 COMPLETE: Got signed URL');
      console.log(`📝 Upload ID: ${uploadId}`);
      console.log(`📝 GCS filename: ${gcsFileName}`);

      // Step 2: Upload directly to GCS using XMLHttpRequest for progress
      console.log('📍 STEP 2: Uploading directly to Google Cloud Storage...');
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
            console.log(`☁️ GCS direct upload progress: ${percentComplete}%`);
          }
        });

        // Handle completion
        xhr.addEventListener('load', async () => {
          console.log('🔍 GCS DIRECT UPLOAD COMPLETE - Status:', xhr.status);
          
          if (xhr.status === 200 || xhr.status === 201 || xhr.status === 204) {
            console.log('✅ STEP 2 COMPLETE: File uploaded directly to GCS!');
            
            try {
              // Step 3: Notify server that upload is complete
              console.log('📍 STEP 3: Notifying server of completed upload...');
              
              const completeResponse = await fetch(`/api/gcs/upload-complete/${dealId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  gcsFileName,
                  uploadId,
                  fileName: file.name
                })
              });

              if (!completeResponse.ok) {
                const errorData = await completeResponse.json().catch(() => ({}));
                throw new Error(errorData.message || `Server processing failed: ${completeResponse.statusText}`);
              }

              const result = await completeResponse.json();
              console.log('✅ STEP 3 COMPLETE: Server processing done', result);
              
              setUploadProgress(100);
              
              // Schedule delayed success cleanup and refresh (same as DataRoomExplorer)
              setTimeout(() => {
                setUploadProgress(0);
                // Trigger cache invalidation to refresh documents
                queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
                queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/data-room/status`] });
              }, 2000);
              
              resolve(result);
              
            } catch (notifyError: any) {
              console.error('❌ Failed to notify server:', notifyError);
              reject(notifyError);
            }
          } else {
            reject(new Error(`GCS upload failed with status: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        // Configure and send request
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', 'application/zip');
        xhr.setRequestHeader('Content-Length', file.size.toString());
        xhr.send(file);
      });
      
    } catch (error) {
      console.error('❌ GCS direct upload failed:', error);
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

    // 🚨 ALWAYS USE GCS DIRECT UPLOAD FOR ALL FILES (correct approach)
    console.log('🚀 Using GCS DIRECT upload for ALL files (production-ready approach)');
    
    try {
      const result = await uploadDirectToGCS(file);
      console.log('✅ GCS Upload successful:', result);
      
      // Note: Cache invalidation is handled by uploadDirectToGCS with proper timing
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('GCS Upload failed:', error);
      alert(`Upload failed: ${error.message || 'Unknown error'}`);
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