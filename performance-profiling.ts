#!/usr/bin/env tsx

/**
 * Comprehensive Performance Profiling for AI Agent System
 * 
 * This script analyzes the bottlenecks in our 7-agent analysis pipeline
 * and provides detailed metrics for optimization.
 */

import { performance } from 'perf_hooks';

interface JobMetrics {
  jobId: string;
  agentType: string;
  queueWaitTime: number;
  runTime: number;
  documentProcessingTime: number;
  llmCallTime: number;
  retryCount: number;
  timeouts: number;
  status: 'completed' | 'failed' | 'timeout';
  documentsProcessed: number;
  startTime: number;
  endTime: number;
}

interface SystemMetrics {
  totalDocuments: number;
  totalAgents: number;
  concurrentJobs: number;
  avgQueueWait: number;
  avgProcessingTime: number;
  p50ProcessingTime: number;
  p95ProcessingTime: number;
  successRate: number;
  documentsPerMinute: number;
  bottleneckAgent: string;
  memoryUsage: number;
  cpuUsage: number;
}

class PerformanceProfiler {
  private jobs: JobMetrics[] = [];
  private startTime: number = 0;
  private dealId: number = 33;

  constructor(dealId: number = 33) {
    this.dealId = dealId;
  }

  async profileAnalysisRun(): Promise<SystemMetrics> {
    console.log('🔍 Starting comprehensive performance profiling...');
    this.startTime = performance.now();

    // Start monitoring system resources
    const resourceMonitor = this.startResourceMonitoring();

    // Trigger analysis reset and run
    await this.resetAndRunAnalyses();

    // Monitor job progress and collect metrics
    await this.monitorJobExecution();

    // Stop resource monitoring
    clearInterval(resourceMonitor);

    // Calculate and return metrics
    return this.calculateSystemMetrics();
  }

  private async resetAndRunAnalyses(): Promise<void> {
    console.log('🔄 Resetting analyses...');
    
    try {
      // Reset all analyses for clean start
      const resetResponse = await fetch(`http://localhost:5000/api/analyses/${this.dealId}/reset`, {
        method: 'POST'
      });
      
      if (!resetResponse.ok) {
        throw new Error(`Reset failed: ${resetResponse.status}`);
      }

      console.log('✅ Analyses reset complete');

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start all analyses
      console.log('🚀 Starting all analyses...');
      const runResponse = await fetch(`http://localhost:5000/api/analyses/${this.dealId}/run-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forceRefresh: true })
      });

      if (!runResponse.ok) {
        throw new Error(`Run failed: ${runResponse.status}`);
      }

      console.log('✅ All analyses started');
    } catch (error) {
      console.error('❌ Error in reset/run:', error);
      throw error;
    }
  }

  private async monitorJobExecution(): Promise<void> {
    console.log('📊 Monitoring job execution...');
    
    let completedJobs = 0;
    const targetJobs = 7; // 7 agents
    const pollInterval = 1000; // 1 second
    const maxWaitTime = 600000; // 10 minutes
    let totalWaitTime = 0;

    while (completedJobs < targetJobs && totalWaitTime < maxWaitTime) {
      try {
        // Get enterprise job progress
        const progressResponse = await fetch(`http://localhost:5000/api/enterprise/progress/${this.dealId}`);
        const progressData = await progressResponse.json();

        // Get queue metrics
        const metricsResponse = await fetch('http://localhost:5000/api/enterprise/metrics');
        const metricsData = await metricsResponse.json();

        if (progressData.success && progressData.jobs) {
          // Update job metrics
          for (const job of progressData.jobs) {
            this.updateJobMetrics(job);
          }
        }

        if (metricsData.success) {
          console.log(`📈 Queue: ${metricsData.metrics.active} active, ${metricsData.metrics.completed} completed, ${metricsData.metrics.failed} failed`);
          completedJobs = metricsData.metrics.completed;
        }

        // Log current progress
        const runningJobs = progressData.jobs?.filter((j: any) => j.status === 'active').length || 0;
        if (runningJobs > 0) {
          console.log(`⏳ ${runningJobs} jobs running, ${completedJobs}/${targetJobs} completed`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        totalWaitTime += pollInterval;
      } catch (error) {
        console.error('❌ Error monitoring jobs:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        totalWaitTime += pollInterval;
      }
    }

    console.log(`✅ Monitoring complete. ${completedJobs}/${targetJobs} jobs completed in ${totalWaitTime/1000}s`);
  }

  private updateJobMetrics(jobData: any): void {
    const existingJob = this.jobs.find(j => j.jobId === jobData.jobId);
    
    if (!existingJob) {
      // New job
      this.jobs.push({
        jobId: jobData.jobId,
        agentType: jobData.agentType,
        queueWaitTime: 0, // Will calculate from startTime
        runTime: 0, // Will calculate when completed
        documentProcessingTime: 0,
        llmCallTime: 0,
        retryCount: 0,
        timeouts: 0,
        status: jobData.status === 'completed' ? 'completed' : 'failed',
        documentsProcessed: jobData.processedDocuments || 0,
        startTime: Date.parse(jobData.startTime) || Date.now(),
        endTime: jobData.status === 'completed' ? Date.now() : 0
      });
    } else {
      // Update existing job
      existingJob.documentsProcessed = jobData.processedDocuments || existingJob.documentsProcessed;
      existingJob.status = jobData.status === 'completed' ? 'completed' : 
                          jobData.status === 'failed' ? 'failed' : existingJob.status;
      if (jobData.status === 'completed' && existingJob.endTime === 0) {
        existingJob.endTime = Date.now();
        existingJob.runTime = existingJob.endTime - existingJob.startTime;
      }
    }
  }

  private calculateSystemMetrics(): SystemMetrics {
    const completedJobs = this.jobs.filter(j => j.status === 'completed');
    const totalRunTime = performance.now() - this.startTime;
    
    // Calculate processing times
    const processingTimes = completedJobs.map(j => j.runTime).filter(t => t > 0);
    const queueWaits = this.jobs.map(j => j.queueWaitTime).filter(t => t > 0);
    
    // Sort for percentiles
    const sortedTimes = [...processingTimes].sort((a, b) => a - b);
    
    const p50Index = Math.floor(sortedTimes.length * 0.5);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    
    const metrics: SystemMetrics = {
      totalDocuments: 5, // Known from our test
      totalAgents: 7,
      concurrentJobs: Math.max(...this.jobs.map(j => j.documentsProcessed)),
      avgQueueWait: queueWaits.length > 0 ? queueWaits.reduce((a, b) => a + b, 0) / queueWaits.length : 0,
      avgProcessingTime: processingTimes.length > 0 ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0,
      p50ProcessingTime: sortedTimes[p50Index] || 0,
      p95ProcessingTime: sortedTimes[p95Index] || 0,
      successRate: this.jobs.length > 0 ? (completedJobs.length / this.jobs.length) * 100 : 0,
      documentsPerMinute: (5 * 60 * 1000) / totalRunTime, // 5 docs per total time in minutes
      bottleneckAgent: this.findBottleneckAgent(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: 0 // Will be updated by resource monitoring
    };

    this.logDetailedMetrics(metrics);
    return metrics;
  }

  private findBottleneckAgent(): string {
    const agentTimes: { [key: string]: number[] } = {};
    
    for (const job of this.jobs) {
      if (!agentTimes[job.agentType]) {
        agentTimes[job.agentType] = [];
      }
      agentTimes[job.agentType].push(job.runTime);
    }

    let slowestAgent = '';
    let slowestTime = 0;

    for (const [agent, times] of Object.entries(agentTimes)) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      if (avgTime > slowestTime) {
        slowestTime = avgTime;
        slowestAgent = agent;
      }
    }

    return slowestAgent;
  }

  private startResourceMonitoring(): NodeJS.Timeout {
    return setInterval(() => {
      const memUsage = process.memoryUsage();
      console.log(`💾 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
    }, 5000);
  }

  private logDetailedMetrics(metrics: SystemMetrics): void {
    console.log('\n🎯 PERFORMANCE ANALYSIS RESULTS');
    console.log('=====================================');
    console.log(`📊 Documents: ${metrics.totalDocuments} | Agents: ${metrics.totalAgents}`);
    console.log(`⏱️  Average Processing: ${Math.round(metrics.avgProcessingTime/1000)}s`);
    console.log(`⏱️  P50 Processing: ${Math.round(metrics.p50ProcessingTime/1000)}s`);
    console.log(`⏱️  P95 Processing: ${Math.round(metrics.p95ProcessingTime/1000)}s`);
    console.log(`⏱️  Average Queue Wait: ${Math.round(metrics.avgQueueWait/1000)}s`);
    console.log(`✅ Success Rate: ${metrics.successRate.toFixed(1)}%`);
    console.log(`🚀 Throughput: ${metrics.documentsPerMinute.toFixed(1)} docs/min`);
    console.log(`🐌 Bottleneck Agent: ${metrics.bottleneckAgent}`);
    console.log(`💾 Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB`);
    console.log('\n📋 JOB DETAILS:');
    
    for (const job of this.jobs) {
      const duration = job.runTime > 0 ? Math.round(job.runTime/1000) : 'running';
      console.log(`   ${job.agentType}: ${duration}s (${job.documentsProcessed}/${metrics.totalDocuments} docs) - ${job.status}`);
    }
    
    console.log('\n🎯 SCALING PROJECTION:');
    const scalingFactor = 500 / metrics.totalDocuments;
    const projected500Time = (metrics.p95ProcessingTime * scalingFactor) / 1000 / 60; // minutes
    console.log(`   📈 500 docs projected time: ${projected500Time.toFixed(1)} minutes`);
    console.log(`   🎯 Target: <10 minutes | Current projection: ${projected500Time > 10 ? '❌ FAIL' : '✅ PASS'}`);
  }
}

// Run profiling
async function main() {
  const profiler = new PerformanceProfiler(33);
  
  try {
    const metrics = await profiler.profileAnalysisRun();
    
    // Write results to file for analysis
    const fs = await import('fs');
    fs.writeFileSync('performance-results.json', JSON.stringify(metrics, null, 2));
    console.log('📄 Results saved to performance-results.json');
    
  } catch (error) {
    console.error('❌ Profiling failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { PerformanceProfiler, type SystemMetrics, type JobMetrics };