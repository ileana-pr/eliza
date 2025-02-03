import { ForumPost, DiscussionAnalysis } from "./types";

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

interface AnalysisOptions {
  minEngagementThreshold?: number;
  proposalThreshold?: number;
  includeSentiment?: boolean;
  includeConsensus?: boolean;
  sentimentAnalysis?: boolean;
  keywordExtraction?: boolean;
}

export async function analyzeDiscussion(
  post: ForumPost,
  options: AnalysisOptions = {}
): Promise<DiscussionAnalysis> {
  const {
    proposalThreshold = 0.7,
    sentimentAnalysis = true,
    keywordExtraction = true,
  } = options;

  const tokens = tokenize(post.content.toLowerCase());
  const proposalScore = calculateProposalScore(tokens);
  const sentimentResult = analyzeSentiment(post.content);
  const engagementScore = calculateEngagementScore(post);
  
  // Initialize analysis result
  const analysis: DiscussionAnalysis = {
    postId: post.id,
    platform: post.platform,
    post: {
      title: post.title
    },
    proposalPotential: {
      score: 0,
      confidence: 0,
      reasons: [],
    },
    sentiment: {
      score: sentimentResult.score,
      magnitude: Math.abs(sentimentResult.score),
      label: getSentimentLabel(sentimentResult.score)
    },
    engagement: {
      participationRate: calculateParticipationRate(post),
      uniqueParticipants: getUniqueParticipants(post),
      totalInteractions: calculateTotalInteractions(post)
    },
    consensus: analyzeConsensus(post),
    topics: extractTopics(post.content),
    perspectives: extractPerspectives(post.content),
    suggestedSolutions: extractSolutions(post.content),
    stakeholders: extractStakeholders(post.content),
    keyPoints: extractKeyPoints(post.content)
  };

  // Analyze proposal potential
  const proposalIndicators = [
    { pattern: /proposal/i, weight: 1.0 },
    { pattern: /suggest/i, weight: 0.8 },
    { pattern: /recommend/i, weight: 0.8 },
    { pattern: /governance/i, weight: 0.9 },
    { pattern: /vote/i, weight: 0.9 },
    { pattern: /change/i, weight: 0.7 },
    { pattern: /improve/i, weight: 0.7 },
    { pattern: /implement/i, weight: 0.8 },
  ];

  let totalScore = 0;
  let maxScore = proposalIndicators.length;
  const reasons: string[] = [];

  proposalIndicators.forEach(({ pattern, weight }) => {
    if (pattern.test(post.title) || pattern.test(post.content)) {
      totalScore += weight;
      reasons.push(`Contains ${pattern.source} related discussion`);
    }
  });

  // Add engagement factors
  if (post.replies && post.replies > 5) {
    totalScore += 0.5;
    reasons.push("Has significant community engagement");
  }

  if (post.reactions && Object.values(post.reactions).reduce((a, b) => a + b, 0) > 3) {
    totalScore += 0.3;
    reasons.push("Received multiple community reactions");
  }

  const normalizedScore = totalScore / maxScore;
  analysis.proposalPotential = {
    score: normalizedScore,
    confidence: normalizedScore > proposalThreshold ? 0.8 : 0.6,
    reasons,
  };

  // Perform sentiment analysis if enabled
  if (sentimentAnalysis) {
    const analyzer = simpleSentimentAnalysis(post.content);
    analysis.sentiment = {
      score: analyzer.score,
      magnitude: Math.abs(analyzer.score),
    };
  }

  // Extract keywords if enabled
  if (keywordExtraction) {
    const words = new Set(tokenize(post.content));
    const wordScores = Array.from(words).map(word => ({
      word,
      score: calculateTfIdf(word, post.content, [post.content])
    }));
    
    const keywords = wordScores
      .filter(item => item.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .map(item => item.word)
      .slice(0, 10);
    
    analysis.keywords = keywords;
  }

  // Generate a summary
  const sentences = post.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 3) {
    analysis.summary = sentences.slice(0, 3).join(". ") + ".";
  }

  return analysis;
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

function analyzeSentiment(content: string) {
  const words = tokenize(content);
  const score = simpleSentimentAnalysis(content);
  
  return {
    score: normalizeScore(score.score, -5, 5) // Normalize from AFINN range to -1 to 1
  };
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

function extractTopics(content: string): string[] {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  
  // Get unique words from content
  const words = new Set(tokenize(content));
  
  // Calculate TF-IDF scores for each word
  const wordScores: Array<{ word: string; score: number }> = Array.from(words).map((word: string) => ({
    word,
    score: sentences.reduce((sum, sentence) => sum + calculateTfIdf(word, sentence, sentences), 0)
  }));
  
  // Return top 5 scoring words as topics
  return wordScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(ws => ws.word);
}

function extractPerspectives(content: string): string[] {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const perspectiveIndicators = [
    'think', 'believe', 'feel', 'suggest', 'propose',
    'argue', 'consider', 'view', 'opinion', 'perspective'
  ];
  
  return sentences
    .filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return perspectiveIndicators.some(indicator => lowerSentence.includes(indicator));
    })
    .slice(0, 3); // Limit to top 3 perspectives
}

function extractSolutions(content: string): string[] {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const solutionIndicators = [
    'should', 'could', 'propose', 'suggest', 'recommend',
    'solution', 'implement', 'improve', 'resolve', 'fix',
    'address', 'solve', 'approach'
  ];
  
  return sentences
    .filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return solutionIndicators.some(indicator => lowerSentence.includes(indicator));
    })
    .slice(0, 3); // Limit to top 3 solutions
}

function extractStakeholders(content: string): string[] {
  const stakeholderIndicators = [
    'community', 'users', 'developers', 'team', 'contributors',
    'holders', 'investors', 'members', 'participants', 'stakeholders',
    'dao', 'protocol', 'foundation', 'council', 'committee'
  ];
  
  const words = tokenize(content.toLowerCase());
  const stakeholders = new Set<string>();
  
  // Find direct mentions of stakeholder groups
  stakeholderIndicators.forEach(indicator => {
    if (words.includes(indicator)) {
      stakeholders.add(indicator);
    }
  });
  
  // Look for compound stakeholder terms (e.g., "core team", "community members")
  const compoundStakeholders = content.toLowerCase()
    .match(new RegExp(`\\b(${stakeholderIndicators.join('|')})\\s+\\w+\\b`, 'g')) || [];
    
  compoundStakeholders.forEach(match => stakeholders.add(match));
  
  return Array.from(stakeholders).slice(0, 5); // Limit to top 5 stakeholders
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