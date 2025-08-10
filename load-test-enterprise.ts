import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

// Load test configuration
const BASE_URL = 'http://localhost:5000';
const TOTAL_REQUESTS = 500;
const CONCURRENCY_LEVELS = [1, 5, 10, 25, 50];
const AGENT_TYPES = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
const DEAL_ID = 33; // Using existing deal with documents

interface TestResult {
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughputPerSecond: number;
  errorRate: number;
  startTime: number;
  endTime: number;
  duration: number;
}

interface JobTracker {
  jobId: string;
  agentType: string;
  submitTime: number;
  statusCheckTimes: number[];
  completionTime?: number;
  success: boolean;
  error?: string;
}

class EnterpriseLoadTester {
  private results: TestResult[] = [];
  private jobs: JobTracker[] = [];

  async runFullLoadTest(): Promise<void> {
    console.log(`🚀 Starting Enterprise AI Agent Load Test`);
    console.log(`📊 Target: ${TOTAL_REQUESTS} requests across ${CONCURRENCY_LEVELS.length} concurrency levels`);
    console.log(`🎯 Testing all 7 agents: ${AGENT_TYPES.join(', ')}`);
    console.log(`🔗 Base URL: ${BASE_URL}`);
    console.log(`📁 Deal ID: ${DEAL_ID}`);
    console.log('');

    // Test health endpoint first
    await this.testHealthEndpoint();

    for (const concurrency of CONCURRENCY_LEVELS) {
      console.log(`\n🧪 Testing concurrency level: ${concurrency}`);
      const result = await this.testConcurrencyLevel(concurrency);
      this.results.push(result);
      
      // Wait between tests to let system stabilize
      await this.wait(2000);
    }

    this.printDetailedResults();
    await this.validateJobCompletion();
  }

  private async testHealthEndpoint(): Promise<void> {
    try {
      console.log('🔍 Testing health endpoint...');
      const response = await fetch(`${BASE_URL}/api/enterprise/health`);
      const data = await response.json() as any;
      
      if (data.success) {
        console.log('✅ Enterprise API is healthy');
      } else {
        console.log('⚠️ Enterprise API health check failed:', data);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    }
  }

  private async testConcurrencyLevel(concurrency: number): Promise<TestResult> {
    const requestsPerLevel = Math.min(TOTAL_REQUESTS / CONCURRENCY_LEVELS.length, 100);
    const responseTimes: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    console.log(`📦 Submitting ${requestsPerLevel} requests with concurrency ${concurrency}`);
    
    const startTime = performance.now();
    
    // Create batches of requests
    const batches = [];
    for (let i = 0; i < requestsPerLevel; i += concurrency) {
      const batchSize = Math.min(concurrency, requestsPerLevel - i);
      batches.push(batchSize);
    }

    // Execute batches
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batchSize = batches[batchIndex];
      const promises: Promise<void>[] = [];

      for (let j = 0; j < batchSize; j++) {
        const agentType = AGENT_TYPES[(batchIndex * concurrency + j) % AGENT_TYPES.length];
        promises.push(this.submitAnalysisRequest(agentType, responseTimes));
      }

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(promises);
      
      successfulRequests += batchResults.filter(r => r.status === 'fulfilled').length;
      failedRequests += batchResults.filter(r => r.status === 'rejected').length;

      // Small delay between batches for realistic load
      if (batchIndex < batches.length - 1) {
        await this.wait(100);
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Calculate metrics
    responseTimes.sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;
    const throughputPerSecond = (successfulRequests / duration) * 1000;
    const errorRate = (failedRequests / (successfulRequests + failedRequests)) * 100;

    const result: TestResult = {
      concurrency,
      totalRequests: successfulRequests + failedRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      throughputPerSecond,
      errorRate,
      startTime,
      endTime,
      duration
    };

    this.printBatchResults(result);
    return result;
  }

  private async submitAnalysisRequest(agentType: string, responseTimes: number[]): Promise<void> {
    const requestStart = performance.now();
    const jobTracker: JobTracker = {
      jobId: '',
      agentType,
      submitTime: requestStart,
      statusCheckTimes: [],
      success: false
    };

    try {
      const response = await fetch(`${BASE_URL}/api/enterprise/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId: DEAL_ID,
          agentType,
          priority: Math.floor(Math.random() * 10) + 1, // Random priority 1-10
          forceRefresh: false
        })
      });

      const requestEnd = performance.now();
      const responseTime = requestEnd - requestStart;
      responseTimes.push(responseTime);

      if (response.status === 202) {
        const data = await response.json() as any;
        jobTracker.jobId = data.jobId;
        jobTracker.success = true;
        this.jobs.push(jobTracker);
      } else {
        const errorData = await response.json() as any;
        jobTracker.error = `HTTP ${response.status}: ${errorData.error || 'Unknown error'}`;
        this.jobs.push(jobTracker);
        throw new Error(jobTracker.error);
      }
    } catch (error) {
      jobTracker.error = error.message;
      jobTracker.success = false;
      this.jobs.push(jobTracker);
      throw error;
    }
  }

  private async validateJobCompletion(): Promise<void> {
    console.log('\n🔍 Validating job completion status...');
    
    const successfulJobs = this.jobs.filter(j => j.success && j.jobId);
    console.log(`📊 Checking status of ${successfulJobs.length} successfully submitted jobs`);

    let completedJobs = 0;
    let failedJobs = 0;
    let pendingJobs = 0;

    // Check job status for sample of jobs
    const sampleSize = Math.min(20, successfulJobs.length);
    const sampledJobs = successfulJobs.slice(0, sampleSize);

    for (const job of sampledJobs) {
      try {
        const statusResponse = await fetch(`${BASE_URL}/api/enterprise/status/${job.jobId}`);
        const statusData = await statusResponse.json() as any;

        if (statusData.success) {
          switch (statusData.status) {
            case 'completed':
              completedJobs++;
              job.completionTime = performance.now();
              break;
            case 'failed':
              failedJobs++;
              break;
            default:
              pendingJobs++;
              break;
          }
        } else {
          failedJobs++;
        }
      } catch (error) {
        failedJobs++;
      }

      // Add small delay between status checks
      await this.wait(50);
    }

    console.log(`✅ Sample job completion status:`);
    console.log(`   Completed: ${completedJobs}/${sampleSize} (${(completedJobs/sampleSize*100).toFixed(1)}%)`);
    console.log(`   Failed: ${failedJobs}/${sampleSize} (${(failedJobs/sampleSize*100).toFixed(1)}%)`);
    console.log(`   Pending: ${pendingJobs}/${sampleSize} (${(pendingJobs/sampleSize*100).toFixed(1)}%)`);
  }

  private printBatchResults(result: TestResult): void {
    console.log(`  📊 Results:`);
    console.log(`     Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`);
    console.log(`     Average Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
    console.log(`     P95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`);
    console.log(`     Throughput: ${result.throughputPerSecond.toFixed(2)} requests/second`);
    console.log(`     Error Rate: ${result.errorRate.toFixed(2)}%`);
  }

  private printDetailedResults(): void {
    console.log('\n📊 ENTERPRISE LOAD TEST RESULTS SUMMARY');
    console.log('═'.repeat(80));
    
    console.log('\n🎯 TARGET METRICS:');
    console.log('   Success Rate: ≥98%');
    console.log('   P95 Response Time: ≤120s (120,000ms)');
    console.log('   Error Rate: ≤2%');
    console.log('   Throughput: >0.1 requests/second');

    console.log('\n📈 DETAILED RESULTS:');
    console.table(this.results.map(r => ({
      'Concurrency': r.concurrency,
      'Total Requests': r.totalRequests,
      'Success Rate (%)': ((r.successfulRequests / r.totalRequests) * 100).toFixed(1),
      'Avg Response (ms)': r.averageResponseTime.toFixed(1),
      'P95 Response (ms)': r.p95ResponseTime.toFixed(1),
      'P99 Response (ms)': r.p99ResponseTime.toFixed(1),
      'Throughput (req/s)': r.throughputPerSecond.toFixed(2),
      'Error Rate (%)': r.errorRate.toFixed(1),
      'Duration (s)': (r.duration / 1000).toFixed(1)
    })));

    // Calculate overall metrics
    const totalRequests = this.results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalSuccessful = this.results.reduce((sum, r) => sum + r.successfulRequests, 0);
    const overallSuccessRate = (totalSuccessful / totalRequests) * 100;
    const overallErrorRate = 100 - overallSuccessRate;
    const avgThroughput = this.results.reduce((sum, r) => sum + r.throughputPerSecond, 0) / this.results.length;
    const maxP95 = Math.max(...this.results.map(r => r.p95ResponseTime));

    console.log('\n🏆 OVERALL PERFORMANCE:');
    console.log(`   Total Requests: ${totalRequests}`);
    console.log(`   Overall Success Rate: ${overallSuccessRate.toFixed(1)}% ${overallSuccessRate >= 98 ? '✅' : '❌'}`);
    console.log(`   Overall Error Rate: ${overallErrorRate.toFixed(1)}% ${overallErrorRate <= 2 ? '✅' : '❌'}`);
    console.log(`   Average Throughput: ${avgThroughput.toFixed(2)} req/s ${avgThroughput > 0.1 ? '✅' : '❌'}`);
    console.log(`   Max P95 Response Time: ${maxP95.toFixed(1)}ms ${maxP95 <= 120000 ? '✅' : '❌'}`);

    // Performance grade
    let passedChecks = 0;
    if (overallSuccessRate >= 98) passedChecks++;
    if (overallErrorRate <= 2) passedChecks++;
    if (avgThroughput > 0.1) passedChecks++;
    if (maxP95 <= 120000) passedChecks++;

    const grade = passedChecks === 4 ? 'A' : passedChecks === 3 ? 'B' : passedChecks === 2 ? 'C' : 'F';
    const emoji = grade === 'A' ? '🏆' : grade === 'B' ? '🥈' : grade === 'C' ? '🥉' : '❌';
    
    console.log(`\n${emoji} PERFORMANCE GRADE: ${grade} (${passedChecks}/4 targets met)`);

    console.log('\n🔗 Job Submission Summary:');
    console.log(`   Total Jobs Submitted: ${this.jobs.length}`);
    console.log(`   Successful Submissions: ${this.jobs.filter(j => j.success).length}`);
    console.log(`   Failed Submissions: ${this.jobs.filter(j => !j.success).length}`);
    
    // Agent type distribution
    const agentCounts = AGENT_TYPES.reduce((acc, agent) => {
      acc[agent] = this.jobs.filter(j => j.agentType === agent).length;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📊 Agent Type Distribution:');
    Object.entries(agentCounts).forEach(([agent, count]) => {
      console.log(`   ${agent}: ${count} jobs`);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 Enterprise AI Agent Load Tester

Usage: npm run load:500 [options]

Options:
  --help, -h          Show this help message
  --quick             Run quick test with reduced load
  --metrics-only      Only show queue metrics without load testing

Description:
  Tests the enterprise job queue system by submitting analysis requests
  across all 7 AI agents with varying concurrency levels to validate:
  
  • ≥98% success rate
  • ≤120s P95 response time  
  • ≤2% error rate
  • Concurrent processing capability
  • Job queue reliability

Examples:
  npm run load:500              # Full load test
  npm run load:500 -- --quick   # Quick test
    `);
    return;
  }

  if (args.includes('--metrics-only')) {
    try {
      const response = await fetch(`${BASE_URL}/api/enterprise/metrics`);
      const data = await response.json() as any;
      console.log('📊 Current Queue Metrics:');
      console.log(JSON.stringify(data.metrics, null, 2));
    } catch (error) {
      console.error('❌ Failed to fetch metrics:', error.message);
    }
    return;
  }

  const tester = new EnterpriseLoadTester();
  
  try {
    await tester.runFullLoadTest();
    console.log('\n✅ Load test completed successfully!');
  } catch (error) {
    console.error('\n❌ Load test failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { EnterpriseLoadTester };