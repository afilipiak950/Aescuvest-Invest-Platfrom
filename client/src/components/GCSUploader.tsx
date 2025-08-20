// 🚀 GOOGLE CLOUD STORAGE DIRECT UPLOAD COMPONENT
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { UploadIcon, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface GCSUploaderProps {
  dealId: number;
  onUploadComplete?: () => void;
}

export function GCSUploader({ dealId, onUploadComplete }: GCSUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const queryClient = useQueryClient();

  // Direct upload to Google Cloud Storage
  const uploadToGCS = async (file: File) => {
    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage('');
    
    console.log(`🚀 Starting GCS direct upload for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    try {
      // Step 1: Get signed URL from server
      console.log('🔑 Requesting signed URL...');
      const urlResponse = await fetch(`/api/deals/${dealId}/gcs-upload/generate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size
        })
      });
      
      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }
      
      const { uploadUrl, objectName, expiresAt } = await urlResponse.json();
      console.log(`✅ Got signed URL, expires at: ${expiresAt}`);
      
      // Step 2: Upload directly to GCS
      console.log('📤 Uploading directly to Google Cloud Storage...');
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
          console.log(`📊 Upload progress: ${progress}% (${(e.loaded / 1024 / 1024).toFixed(2)} MB / ${(e.total / 1024 / 1024).toFixed(2)} MB)`);
        }
      });
      
      // Handle upload completion
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 204) {
            console.log('✅ File uploaded successfully to GCS');
            resolve();
          } else {
            console.error(`❌ Upload failed with status: ${xhr.status}`);
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          console.error('❌ Network error during upload');
          reject(new Error('Network error during upload'));
        });
        
        xhr.addEventListener('abort', () => {
          console.error('❌ Upload aborted');
          reject(new Error('Upload aborted'));
        });
      });
      
      // Start upload
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
      
      await uploadPromise;
      
      // Step 3: Confirm upload with server
      console.log('✅ Confirming upload with server...');
      const confirmResponse = await fetch(`/api/deals/${dealId}/gcs-upload/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectName,
          fileName: file.name,
          fileSize: file.size
        })
      });
      
      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.error || 'Failed to confirm upload');
      }
      
      const confirmResult = await confirmResponse.json();
      console.log(`🎉 Upload complete! Document ID: ${confirmResult.documentId}`);
      
      setUploadStatus('success');
      setUploadProgress(100);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      
      // Call completion callback
      if (onUploadComplete) {
        onUploadComplete();
      }
      
      // Reset after 3 seconds
      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ GCS upload failed:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || 'Upload failed');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('idle');
      setErrorMessage('');
      console.log(`📁 File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadToGCS(selectedFile);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-dark-lighter rounded-lg border border-green-600">
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-xl flex items-center justify-center">
          <UploadIcon className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Direct Cloud Upload</h3>
          <p className="text-sm text-gray-400">Upload files up to 50GB directly to cloud storage</p>
        </div>
      </div>
      
      {/* File Selection */}
      <div className="space-y-3">
        <input
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          disabled={uploadStatus === 'uploading'}
          className="block w-full text-sm text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-green-900 file:text-green-200
            hover:file:bg-green-800
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {selectedFile && uploadStatus === 'idle' && (
          <div className="flex items-center justify-between p-3 bg-dark rounded-lg">
            <div>
              <p className="text-white font-medium">{selectedFile.name}</p>
              <p className="text-sm text-gray-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              onClick={handleUpload}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              Upload to Cloud
            </Button>
          </div>
        )}
      </div>
      
      {/* Upload Progress */}
      {uploadStatus === 'uploading' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm text-white">Uploading directly to cloud...</span>
            </div>
            <span className="text-sm text-gray-400">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-gray-400">
            This bypasses all server limits - your file goes directly to Google Cloud Storage
          </p>
        </div>
      )}
      
      {/* Success Message */}
      {uploadStatus === 'success' && (
        <Alert className="border-green-600 bg-green-900/20">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <AlertDescription className="text-green-300">
            Upload successful! Your file has been uploaded directly to cloud storage.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Error Message */}
      {uploadStatus === 'error' && (
        <Alert className="border-red-600 bg-red-900/20">
          <XCircle className="w-4 h-4 text-red-400" />
          <AlertDescription className="text-red-300">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Info Box */}
      <div className="p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-300 mb-2">How it works:</h4>
        <ul className="space-y-1 text-xs text-blue-200">
          <li>• Your file uploads directly from browser to Google Cloud Storage</li>
          <li>• Completely bypasses server and Cloud Run infrastructure</li>
          <li>• No size limits - supports files up to 50GB+</li>
          <li>• Faster uploads with real-time progress tracking</li>
          <li>• Industry-standard secure cloud storage</li>
        </ul>
      </div>
    </div>
  );
}