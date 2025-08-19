import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
// Progress component not available - using simple div
import { Upload, X } from 'lucide-react';

interface StreamingUploadButtonProps {
  dealId: number;
  onUploadComplete: () => void;
  disabled?: boolean;
}

export function StreamingUploadButton({ 
  dealId, 
  onUploadComplete, 
  disabled = false 
}: StreamingUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || disabled) return;

    console.log(`🔥 Starting streaming upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    setIsUploading(true);
    setError('');
    setProgress(0);
    setStatus('Initializing upload...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Step 1: Initialize upload
      const initResponse = await fetch(`/api/streaming/init/${dealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          totalSize: file.size
        }),
        signal: abortController.signal
      });

      if (!initResponse.ok) {
        throw new Error(`Initialization failed: ${initResponse.statusText}`);
      }

      const { uploadId, chunkSize } = await initResponse.json();
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      console.log(`✅ Upload initialized: ${uploadId} (${totalChunks} chunks of ${chunkSize} bytes)`);
      setStatus(`Uploading ${totalChunks} chunks...`);

      // Step 2: Upload chunks sequentially
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);

        const chunkResponse = await fetch(`/api/streaming/chunk/${uploadId}/${chunkIndex}`, {
          method: 'POST',
          body: formData,
          signal: abortController.signal
        });

        if (!chunkResponse.ok) {
          throw new Error(`Chunk ${chunkIndex} failed: ${chunkResponse.statusText}`);
        }

        const chunkResult = await chunkResponse.json();
        const progressPercent = chunkResult.progress;
        
        setProgress(progressPercent);
        setStatus(`Uploaded chunk ${chunkIndex + 1}/${totalChunks} (${progressPercent.toFixed(1)}%)`);
        
        // Log progress every 100 chunks
        if ((chunkIndex + 1) % 100 === 0) {
          console.log(`📦 Progress: ${chunkIndex + 1}/${totalChunks} chunks (${progressPercent.toFixed(1)}%)`);
        }
      }

      // Step 3: Complete upload
      setStatus('Finalizing upload...');
      const completeResponse = await fetch(`/api/streaming/complete/${uploadId}`, {
        method: 'POST',
        signal: abortController.signal
      });

      if (!completeResponse.ok) {
        throw new Error(`Completion failed: ${completeResponse.statusText}`);
      }

      const result = await completeResponse.json();
      
      setProgress(100);
      setStatus('Upload completed successfully!');
      console.log(`🎉 Upload completed: ${file.name} - ${result.message}`);

      setTimeout(() => {
        onUploadComplete();
        resetState();
      }, 2000);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatus('Upload cancelled');
      } else {
        console.error('Streaming upload error:', error);
        setError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('🚫 Upload cancelled by user');
    }
    resetState();
  };

  const resetState = () => {
    setIsUploading(false);
    setProgress(0);
    setStatus('');
    setError('');
    abortControllerRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {!isUploading && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".zip,.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-1" />
            🔥 Stream Upload (Any Size)
          </Button>
        </>
      )}

      {isUploading && (
        <div className="space-y-2 p-3 bg-muted rounded">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Streaming Upload</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="text-xs text-muted-foreground">
            {status}
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}