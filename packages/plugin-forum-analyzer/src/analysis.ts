import { elizaLogger } from "@elizaos/core";
import type { 
    ForumPost, 
    DiscussionAnalysis, 
    AnalysisOptions,
    ProposalPotential,
    Sentiment 
} from "./types";

// Keywords that indicate potential governance proposals
const PROPOSAL_KEYWORDS = [
  'proposal', 'propose', 'governance', 'vote', 'voting', 'decision',
  'treasury', 'fund', 'funding', 'budget', 'allocation', 'grant',
  'improvement', 'upgrade', 'change', 'modify', 'update', 'implement',
  'strategy', 'policy', 'protocol', 'parameter', 'framework'
];

// Keywords that indicate high engagement/importance
const IMPORTANCE_KEYWORDS = [
  'urgent', 'important', 'critical', 'crucial', 'significant',
  'essential', 'necessary', 'required', 'needed', 'priority'
];

// Enhanced governance-specific keywords
const GOVERNANCE_KEYWORDS = [
  // Proposal types
  'proposal', 'motion', 'referendum', 'resolution', 'amendment',
  // Actions
  'vote', 'voting', 'poll', 'ballot', 'quorum', 'consensus',
  // Resources
  'treasury', 'fund', 'budget', 'grant', 'allocation', 'distribution',
  // Changes
  'improvement', 'upgrade', 'change', 'modify', 'update', 'implement',
  // Policy
  'governance', 'policy', 'protocol', 'parameter', 'framework', 'guideline',
  // DAO specific
  'dao', 'decentralized', 'autonomous', 'organization', 'community',
  // Stakeholders
  'stakeholder', 'holder', 'member', 'participant', 'delegate'
];

export async function analyzeDiscussion(post: ForumPost, options: AnalysisOptions = {}): Promise<DiscussionAnalysis> {
    elizaLogger.info(`[Analysis] Starting analysis for post "${post.title}" (ID: ${post.id})`);
    elizaLogger.debug(`[Analysis] Configuration:`, {
        platform: post.platform,
        contentLength: post.content.length,
        options: {
            proposalThreshold: options.proposalThreshold || 0.7,
            sentimentAnalysis: !!options.sentimentAnalysis,
            keywordExtraction: !!options.keywordExtraction
        }
    });

    try {
        // Track each step of analysis with clear progress indicators
        elizaLogger.info(`[Analysis] Step 1/4: Extracting topics and stakeholders`);
        const topics = await extractTopics(post.content);
        const stakeholders = await identifyStakeholders(post.content);
        elizaLogger.debug(`[Analysis] Found ${topics.length} topics and ${stakeholders.length} stakeholders`);
        
        elizaLogger.info(`[Analysis] Step 2/4: Evaluating proposal potential`);
        const proposalPotential = await evaluateProposalPotential(post, options);
        elizaLogger.info(`[Analysis] Proposal score: ${(proposalPotential.score * 100).toFixed(1)}% (${proposalPotential.type})`);
        
        elizaLogger.info(`[Analysis] Step 3/4: Analyzing sentiment`);
        const sentiment = options.sentimentAnalysis ? await analyzeSentiment(post.content) : undefined;
        if (sentiment) {
            elizaLogger.debug(`[Analysis] Sentiment analysis:`, {
                score: sentiment.score,
                label: sentiment.label
            });
        }
        
        elizaLogger.info(`[Analysis] Step 4/4: Extracting keywords`);
        const keywords = options.keywordExtraction ? await extractKeywords(post.content) : undefined;
        if (keywords) {
            elizaLogger.debug(`[Analysis] Extracted ${keywords.length} relevant keywords`);
        }

        elizaLogger.info(`[Analysis] Analysis complete for "${post.title}"`);
        elizaLogger.debug(`[Analysis] Summary:`, {
            proposalScore: proposalPotential.score,
            governanceRelevance: proposalPotential.governanceRelevance,
            consensusLevel: proposalPotential.consensus.level,
            topicCount: topics.length,
            stakeholderCount: stakeholders.length,
            keywordCount: keywords?.length || 0
        });

        return {
            postId: post.id,
            platform: post.platform,
            post: { title: post.title },
            topics,
            stakeholders,
            proposalPotential,
            sentiment,
            keywords
        };
    } catch (error) {
        elizaLogger.error(`[Analysis] Error analyzing post "${post.title}":`, {
            error: error.message,
            postId: post.id,
            platform: post.platform
        });
        throw error;
    }
}

// Helper functions with logging
async function extractTopics(content: string): Promise<string[]> {
    elizaLogger.debug(`[Analysis] Extracting topics from content of length ${content.length}`);
    // Implementation
    return [];
}

async function identifyStakeholders(content: string): Promise<string[]> {
    elizaLogger.debug(`[Analysis] Identifying stakeholders from content of length ${content.length}`);
    // Implementation
    return [];
}

async function evaluateProposalPotential(post: ForumPost, options: AnalysisOptions): Promise<ProposalPotential> {
    elizaLogger.debug(`[Analysis] Evaluating proposal potential with threshold: ${options.proposalThreshold}`);
    
    const tokens = tokenize(post.content);
    const proposalScore = calculateProposalScore(tokens);
    const engagementScore = calculateEngagementScore(post);
    const confidence = calculateConfidence(proposalScore, engagementScore);
    const type = determineProposalType(tokens);
    
    // Extract key discussion points
    const keyPoints = extractKeyPoints(post.content);
    
    // Analyze community consensus
    const consensus = analyzeConsensus(post);
    
    // Analyze governance relevance
    const governanceRelevance = calculateGovernanceRelevance(post.content);
    
    const reasons = [];
    if (proposalScore > 0.5) reasons.push('High proposal relevance score');
    if (engagementScore > 0.5) reasons.push('Strong community engagement');
    if (consensus.level > 0.7) reasons.push('High community consensus');
    if (governanceRelevance > 0.5) reasons.push('Strong governance relevance');
    
    elizaLogger.debug(`[Analysis] Proposal potential results:`, {
        proposalScore,
        engagementScore,
        confidence,
        type,
        governanceRelevance,
        keyPointsCount: keyPoints.length
    });

    return {
        score: proposalScore,
        confidence,
        type,
        reasons,
        keyPoints,
        consensus,
        governanceRelevance
    };
}

async function analyzeSentiment(content: string): Promise<Sentiment | undefined> {
    elizaLogger.debug(`[Analysis] Analyzing sentiment of content length ${content.length}`);
    // Implementation
    return undefined;
}

async function extractKeywords(content: string): Promise<string[] | undefined> {
    elizaLogger.debug(`[Analysis] Extracting keywords from content length ${content.length}`);
    // Implementation
    return undefined;
}

function calculateProposalScore(tokens: string[]): number {
  let score = 0;
  
  // Calculate score based on proposal keywords
  PROPOSAL_KEYWORDS.forEach(keyword => {
    const measure = calculateTfIdf(keyword, tokens.join(' '), [tokens.join(' ')]);
    score += measure;
  });
  
  // Normalize score to 0-1 range
  return Math.min(score / (PROPOSAL_KEYWORDS.length * 2), 1);
}

function getSentimentLabel(score: number): 'positive' | 'negative' | 'neutral' {
  if (score > 0.1) return 'positive';
  if (score < -0.1) return 'negative';
  return 'neutral';
}

function calculateEngagementScore(post: ForumPost): number {
  const baseScore = 
    (post.replies || 0) * 2 + 
    (post.views || 0) / 100 +
    (Object.values(post.reactions || {}).reduce((sum, count) => sum + count, 0)) * 1.5;
    
  return Math.min(baseScore / 1000, 1); // Normalize to 0-1
}

function calculateParticipationRate(post: ForumPost): number {
  const uniqueParticipants = getUniqueParticipants(post);
  const totalInteractions = calculateTotalInteractions(post);
  
  return totalInteractions > 0 ? uniqueParticipants / totalInteractions : 0;
}

function getUniqueParticipants(post: ForumPost): number {
  // This is a placeholder - in a real implementation, we'd track unique participants
  // through replies and reactions
  return 1; // Minimum is the original poster
}

function calculateTotalInteractions(post: ForumPost): number {
  return (
    1 + // Original post
    (post.replies || 0) +
    Object.values(post.reactions || {}).reduce((sum, count) => sum + count, 0)
  );
}

function calculateConfidence(proposalScore: number, engagementScore: number): number {
  // Weight both scores equally
  return (proposalScore + engagementScore) / 2;
}

function determineProposalType(tokens: string[]): 'governance' | 'treasury' | 'technical' | 'social' | 'other' {
  const types = {
    governance: ['governance', 'vote', 'proposal', 'policy'],
    treasury: ['treasury', 'fund', 'budget', 'grant'],
    technical: ['technical', 'protocol', 'code', 'implementation'],
    social: ['community', 'social', 'communication', 'culture']
  };
  
  const scores = Object.entries(types).map(([type, keywords]) => ({
    type,
    score: keywords.reduce((sum, keyword) => 
      sum + tokens.filter(t => t === keyword).length, 0
    )
  }));
  
  const maxScore = Math.max(...scores.map(s => s.score));
  const topType = scores.find(s => s.score === maxScore);
  
  return (topType?.type as 'governance' | 'treasury' | 'technical' | 'social') || 'other';
}

function extractKeyPoints(content: string): string[] {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  
  // Get the most important sentences based on TF-IDF scores
  const sentenceScores = sentences.map((sentence, index) => ({
    sentence,
    score: calculateSentenceImportance(sentence, sentences)
  }));
  
  return sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.sentence);
}

function calculateSentenceImportance(sentence: string, allSentences: string[]): number {
  const words = tokenize(sentence);
  let score = 0;
  
  // Score based on proposal and importance keywords
  [...PROPOSAL_KEYWORDS, ...IMPORTANCE_KEYWORDS].forEach(keyword => {
    score += calculateTfIdf(keyword, sentence, allSentences);
  });
  
  return score;
}

function analyzeConsensus(post: ForumPost) {
  // This is a simplified consensus analysis
  // In a real implementation, we'd analyze reply sentiment and reaction patterns
  return {
    level: 0.5, // Default neutral consensus
    majorityOpinion: undefined,
    dissenting: undefined
  };
}

function normalizeScore(score: number, min: number, max: number): number {
  return (score - min) / (max - min) * 2 - 1;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(word => word.length > 0);
}

function calculateTfIdf(word: string, doc: string, docs: string[]): number {
  const tf = doc.toLowerCase().split(/\W+/).filter(w => w === word).length;
  const docsWithWord = docs.filter(d => d.toLowerCase().includes(word)).length;
  const idf = Math.log(docs.length / (1 + docsWithWord));
  return tf * idf;
}

function simpleSentimentAnalysis(text: string): { score: number } {
  const positiveWords = ['good', 'great', 'excellent', 'positive', 'agree', 'support'];
  const negativeWords = ['bad', 'poor', 'negative', 'disagree', 'against', 'reject'];
  
  const words = tokenize(text);
  const positiveCount = words.filter(word => positiveWords.includes(word)).length;
  const negativeCount = words.filter(word => negativeWords.includes(word)).length;
  
  return {
    score: (positiveCount - negativeCount) / words.length || 0
  };
}

function calculateGovernanceRelevance(content: string): number {
    const tokens = tokenize(content);
    let score = 0;
    
    // Calculate score based on governance keywords
    GOVERNANCE_KEYWORDS.forEach(keyword => {
        const measure = calculateTfIdf(keyword, tokens.join(' '), [tokens.join(' ')]);
        score += measure;
    });
    
    // Normalize score to 0-1 range
    return Math.min(score / (GOVERNANCE_KEYWORDS.length * 2), 1);
} 