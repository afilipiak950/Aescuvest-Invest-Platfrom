/**
 * 🛡️ RELIABLE GCS INTEGRATION SERVICE
 * 
 * This service integrates the enterprise reliability features with existing GCS services
 * to provide a seamless upgrade path to "100% reliability" without breaking changes.
 * 
 * RELIABILITY FEATURES INTEGRATED:
 * ✅ Wraps existing googleCloudStorage.ts with enterprise reliability
 * ✅ Maintains backward compatibility with all existing code
 * ✅ Adds resumable uploads, CRC32C validation, retry logic
 * ✅ Provides reliability metrics and monitoring
 */

import { gcsService } from './googleCloudStorage';
import { EnterpriseGcsReliabilityService } from './enterpriseGcsReliabilityService';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';

interface ReliabilityMetrics {
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  resumedUploads: number;
  integrityValidations: number;
  averageRetryCount: number;
  reliabilityPercentage: number;
}

export class ReliableGcsIntegrationService {
  private enterpriseService: EnterpriseGcsReliabilityService;
  private metrics: ReliabilityMetrics = {
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    resumedUploads: 0,
    integrityValidations: 0,
    averageRetryCount: 0,
    reliabilityPercentage: 100.0
  };

  constructor() {
    // Initialize enterprise reliability service using existing GCS configuration
    const storage = (gcsService as any).storage;
    const bucketName = (gcsService as any).bucketName;
    
    if (!storage || !bucketName) {
      console.log('⚠️ GCS not initialized, deferring enterprise service initialization');
      return;
    }

    this.enterpriseService = new EnterpriseGcsReliabilityService(
      storage,
      bucketName,
      {
        maxRetries: 5,
        enableChecksumValidation: true,
        enableResumableUploads: true,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        urlRefreshThresholdMs: 15 * 60 * 1000 // 15 minutes
      }
    );

    console.log('🛡️ Reliable GCS Integration Service initialized with enterprise features');
  }

  /**
   * Enhanced upload with automatic reliability features
   * Falls back to original implementation if enterprise features unavailable
   */
  async uploadFileWithReliability(
    localPath: string,
    dealId: number,
    fileName: string,
    enableEnterpriseFeatures: boolean = true
  ): Promise<string> {
    this.metrics.totalUploads++;
    
    console.log(`🚀 Starting reliable upload: ${fileName} (enterprise: ${enableEnterpriseFeatures})`);

    try {
      let result: string;
      
      if (enableEnterpriseFeatures && this.enterpriseService) {
        console.log('🛡️ Using enterprise reliability features...');
        
        // Generate GCS destination path
        const timestamp = Date.now();
        const gcsFileName = `deals/${dealId}/documents/${timestamp}_${fileName}`;
        
        // Use enterprise resumable upload with all reliability features
        const uploadId = await this.enterpriseService.startResumableUpload(
          localPath,
          gcsFileName,
          dealId,
          (progress) => {
            console.log(`📊 Upload progress: ${progress.progressPercent.toFixed(1)}% (${Math.round(progress.speedBytesPerSecond / 1024)} KB/s)`);
          }
        );
        
        result = `gs://${(gcsService as any).bucketName}/${gcsFileName}`;
        console.log(`✅ Enterprise upload completed: ${uploadId}`);
        this.metrics.successfulUploads++;
        this.metrics.integrityValidations++;
        
      } else {
        console.log('📦 Using standard upload (enterprise features disabled)...');
        
        // Fall back to existing implementation
        result = await gcsService.uploadFile(localPath, dealId, fileName);
        this.metrics.successfulUploads++;
      }
      
      // Clean up local file after successful upload
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`🗑️ Cleaned up local file: ${localPath}`);
      }
      
      this.updateReliabilityMetrics();
      return result;
      
    } catch (error: any) {
      console.error(`❌ Reliable upload failed: ${error.message}`);
      this.metrics.failedUploads++;
      this.updateReliabilityMetrics();
      
      // Try fallback to standard upload if enterprise failed
      if (enableEnterpriseFeatures && this.enterpriseService) {
        console.log('🔄 Attempting fallback to standard upload...');
        try {
          const result = await gcsService.uploadFile(localPath, dealId, fileName);
          this.metrics.successfulUploads++;
          this.updateReliabilityMetrics();
          return result;
        } catch (fallbackError: any) {
          console.error(`❌ Fallback upload also failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Enhanced download with integrity verification
   */
  async downloadFileWithIntegrity(gcsPath: string, localPath: string): Promise<void> {
    if (this.enterpriseService) {
      console.log('🛡️ Using enterprise download with integrity verification...');
      await this.enterpriseService.downloadFileWithIntegrity(gcsPath, localPath);
      this.metrics.integrityValidations++;
    } else {
      console.log('📦 Using standard download...');
      await gcsService.downloadFile(gcsPath, localPath);
    }
  }

  /**
   * Test enterprise reliability features
   */
  async runReliabilityTests(): Promise<{ 
    passed: boolean; 
    results: Array<{ test: string; passed: boolean; message: string }> 
  }> {
    console.log('🧪 Running comprehensive reliability tests...');
    
    const testResults: Array<{ test: string; passed: boolean; message: string }> = [];

    // Test 1: Enterprise service initialization
    try {
      const metrics = this.enterpriseService?.getReliabilityMetrics();
      testResults.push({
        test: 'Enterprise Service Initialization',
        passed: !!metrics,
        message: metrics ? 'Enterprise features available' : 'Enterprise features not available'
      });
    } catch (error: any) {
      testResults.push({
        test: 'Enterprise Service Initialization',
        passed: false,
        message: `Initialization failed: ${error.message}`
      });
    }

    // Test 2: Retry mechanism validation
    try {
      // Test retry logic with invalid operation
      const retryResult = await this.testRetryMechanism();
      testResults.push({
        test: 'Exponential Backoff Retry',
        passed: retryResult.passed,
        message: retryResult.message
      });
    } catch (error: any) {
      testResults.push({
        test: 'Exponential Backoff Retry',
        passed: false,
        message: `Retry test failed: ${error.message}`
      });
    }

    // Test 3: CRC32C checksum calculation
    try {
      if (this.enterpriseService) {
        // Create a small test file
        const testFile = '/tmp/reliability_test.txt';
        fs.writeFileSync(testFile, 'Test data for reliability validation');
        
        const checksum = await this.enterpriseService.calculateCRC32C(testFile);
        fs.unlinkSync(testFile);
        
        testResults.push({
          test: 'CRC32C Checksum Calculation',
          passed: !!checksum,
          message: checksum ? `Checksum calculated: ${checksum}` : 'Checksum calculation failed'
        });
      } else {
        testResults.push({
          test: 'CRC32C Checksum Calculation',
          passed: false,
          message: 'Enterprise service not available'
        });
      }
    } catch (error: any) {
      testResults.push({
        test: 'CRC32C Checksum Calculation',
        passed: false,
        message: `Checksum test failed: ${error.message}`
      });
    }

    // Test 4: Validate existing GCS service availability
    try {
      const gcsInitialized = !!(gcsService as any).bucket;
      testResults.push({
        test: 'Base GCS Service Availability',
        passed: gcsInitialized,
        message: gcsInitialized ? 'GCS service properly initialized' : 'GCS service not initialized'
      });
    } catch (error: any) {
      testResults.push({
        test: 'Base GCS Service Availability',
        passed: false,
        message: `GCS service check failed: ${error.message}`
      });
    }

    // Test 5: Reliability metrics tracking
    try {
      const metricsAvailable = this.metrics && typeof this.metrics.reliabilityPercentage === 'number';
      testResults.push({
        test: 'Reliability Metrics Tracking',
        passed: metricsAvailable,
        message: metricsAvailable ? `Current reliability: ${this.metrics.reliabilityPercentage}%` : 'Metrics tracking unavailable'
      });
    } catch (error: any) {
      testResults.push({
        test: 'Reliability Metrics Tracking',
        passed: false,
        message: `Metrics test failed: ${error.message}`
      });
    }

    const allPassed = testResults.every(result => result.passed);
    const passedCount = testResults.filter(result => result.passed).length;
    
    console.log(`🧪 Reliability tests completed: ${passedCount}/${testResults.length} passed`);
    
    return {
      passed: allPassed,
      results: testResults
    };
  }

  /**
   * Get comprehensive reliability status
   */
  getReliabilityStatus(): {
    enterpriseFeatures: boolean;
    metrics: ReliabilityMetrics;
    guarantees: string[];
    limitations: string[];
  } {
    const enterpriseAvailable = !!this.enterpriseService;
    
    return {
      enterpriseFeatures: enterpriseAvailable,
      metrics: this.metrics,
      guarantees: enterpriseAvailable ? [
        "Data integrity verified with CRC32C checksums",
        "Automatic retry with exponential backoff (up to 5 attempts)",
        "Resumable uploads that continue from exact byte position",
        "Universal error handling with intelligent retry logic",
        "Fallback to standard upload if enterprise features fail",
        `Current system reliability: ${this.metrics.reliabilityPercentage}%`
      ] : [
        "Basic upload/download functionality",
        "Limited retry logic in some components",
        "Standard error handling",
        `Basic system reliability tracked: ${this.metrics.reliabilityPercentage}%`
      ],
      limitations: enterpriseAvailable ? [
        "Requires stable network connection for optimal performance",
        "Very large files (>5GB) may require extended time",
        "CRC32C validation adds small computational overhead"
      ] : [
        "No resumable uploads - failed uploads restart from beginning",
        "No data integrity verification",
        "Limited retry logic - may fail on temporary network issues",
        "No upload continuation capability"
      ]
    };
  }

  /**
   * Private helper methods
   */
  private async testRetryMechanism(): Promise<{ passed: boolean; message: string }> {
    if (!this.enterpriseService) {
      return { passed: false, message: 'Enterprise service not available for retry testing' };
    }

    let retryCount = 0;
    try {
      await this.enterpriseService.withUniversalRetry(async () => {
        retryCount++;
        if (retryCount < 3) {
          throw new Error('Simulated transient error');
        }
        return 'success';
      }, 'retry mechanism test');
      
      return { 
        passed: retryCount >= 3, 
        message: `Retry mechanism worked after ${retryCount} attempts` 
      };
    } catch (error: any) {
      return { 
        passed: false, 
        message: `Retry test failed: ${error.message}` 
      };
    }
  }

  private updateReliabilityMetrics(): void {
    if (this.metrics.totalUploads > 0) {
      this.metrics.reliabilityPercentage = (this.metrics.successfulUploads / this.metrics.totalUploads) * 100;
    }
    console.log(`📊 Updated reliability metrics: ${this.metrics.reliabilityPercentage.toFixed(1)}% (${this.metrics.successfulUploads}/${this.metrics.totalUploads} successful)`);
  }
}

// Export singleton instance
export const reliableGcsService = new ReliableGcsIntegrationService();