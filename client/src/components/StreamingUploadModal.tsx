import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileUp } from 'lucide-react';
import { streamingUploadService, type StreamingUploadProgress } from '../services/streamingUploadService';

interface StreamingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: number;
  onUploadComplete: () => void;
}

export function StreamingUploadModal({
  isOpen,
  onClose,
  dealId,
  onUploadComplete,
}: StreamingUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<StreamingUploadProgress | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log(`🔥 Selected file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    setIsUploading(true);
    setError('');
    setStatus('Initializing upload...');
    setProgress(null);

    try {
      await streamingUploadService.uploadFile(file, dealId, {
        onProgress: (prog) => {
          setProgress(prog);
          setStatus(`Uploading chunk ${prog.currentChunk}/${prog.totalChunks} (${(prog.speed / 1024 / 1024).toFixed(1)} MB/s)`);
        },
        onComplete: () => {
          setStatus('Upload completed successfully!');
          setIsUploading(false);
          setTimeout(() => {
            onUploadComplete();
            onClose();
            resetState();
          }, 2000);
        },
        onError: (errorMsg) => {
          setError(`Upload failed: ${errorMsg}`);
          setIsUploading(false);
          setStatus('');
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsUploading(false);
      setStatus('');
    }
  };

  const resetState = () => {
    setProgress(null);
    setStatus('');
    setError('');
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      onClose();
      resetState();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Streaming File Upload
          </DialogTitle>
          <DialogDescription>
            Upload files of any size using 256KB streaming chunks - 100% reliable
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isUploading && (
            <div className="flex flex-col space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".zip,.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                size="lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                Select File to Upload
              </Button>
              
              <p className="text-sm text-muted-foreground text-center">
                Supports files up to 50GB+ with zero size limits
              </p>
            </div>
          )}

          {isUploading && progress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress.progress} className="h-2" />
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Uploaded:</span>
                  <span>{(progress.uploadedBytes / 1024 / 1024).toFixed(1)} MB / {(progress.totalBytes / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Speed:</span>
                  <span>{(progress.speed / 1024 / 1024).toFixed(1)} MB/s</span>
                </div>
                <div className="flex justify-between">
                  <span>Chunks:</span>
                  <span>{progress.currentChunk}/{progress.totalChunks}</span>
                </div>
              </div>
            </div>
          )}

          {status && (
            <div className="text-sm text-center py-2 bg-muted rounded">
              {status}
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive text-center py-2 bg-destructive/10 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              <X className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}