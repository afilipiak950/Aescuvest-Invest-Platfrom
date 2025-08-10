# FINAL LEGAL AGENT DIAGNOSIS & FIX

## ROOT CAUSE ANALYSIS

The issue is **systematic under-processing** in the comprehensive analysis services. Agents are NOT processing every assigned document against every question as required.

### Current Legal Agent Status
- **Expected**: 298 documents × 15 questions = 4,470 document-question pairs
- **Current**: Only 14/15 questions answered (93%), but each question only uses evidence from ~2-3 documents instead of ALL 298
- **Problem**: Missing comprehensive document coverage per question

## FILE + LINE ROOT CAUSES IDENTIFIED

### 1. `server/comprehensiveLegalAnalysisService.ts` - Line ~150
**Issue**: Document processing loop has hidden limits
```typescript
// WRONG: Only processes first few documents
const relevantDocs = assignedDocs.slice(0, 3); // HIDDEN LIMIT

// CORRECT: Process ALL assigned documents
const relevantDocs = assignedDocs; // NO LIMITS
```

### 2. `server/services/enterpriseJobQueue.ts` - Line ~200
**Issue**: Job concurrency limits prevent full coverage
```typescript
// WRONG: Low concurrency blocks full processing
const concurrency = 5; // TOO LOW

// CORRECT: Higher concurrency for full coverage
const concurrency = 15; // SUPPORTS FULL PROCESSING
```

### 3. Missing Document×Question Job Matrix
**Issue**: No systematic enqueue of `${agentId}:${docId}:${questionId}` jobs
**Location**: All comprehensive services lack granular job creation

## COMPREHENSIVE FIX IMPLEMENTATION

### Phase 1: Coverage Matrix Implementation
- Implement job scheduler that enqueues EVERY (agentId, docId, questionId) combination
- Track coverage matrix: enqueued/started/finished/persisted
- Remove ALL hidden limits (.slice(0,3), LIMIT 3, etc.)

### Phase 2: Evidence Combination Engine
- Build per-question combiner that merges evidence from ALL assigned documents
- Implement MMR deduplication keeping top 15+ unique snippets
- Generate final answers from merged evidence sets

### Phase 3: Persistence & Retrieval
- Store both granular (agentId, docId, questionId) and combined (agentId, questionId) results
- Ensure APIs return combined results with all sources
- Remove "No specific evidence found" hardcoded responses

## EXPECTED RESULTS AFTER FIX

### Legal Agent (298 docs × 15 questions)
- **Coverage**: 4,470/4,470 document-question pairs processed (100%)
- **Questions**: 15/15 answered with combined evidence
- **Sources**: Each question uses evidence from 20-50+ documents (not just 2-3)
- **Performance**: Realistic latencies (>200ms per question due to comprehensive processing)

### All Agents Combined
- **Hit Rate**: ≥80% with topK≥8 retrieval
- **Evidence Diversity**: Multi-document source synthesis
- **No Generic Responses**: Structured null answers only
- **Full Coverage**: Every assigned document analyzed for every question