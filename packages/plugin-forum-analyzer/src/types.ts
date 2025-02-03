export interface ForumPost {
  id: string;
  platform: string;
  title: string;
  content: string;
  author: string;
  timestamp: Date;
  url: string;
  category?: string;
  replies?: number;
  views?: number;
  reactions?: {
    [key: string]: number;
  };
}

export interface DiscussionAnalysis {
  postId: string;
  platform: string;
  post: {
    title?: string;
  };
  topics?: string[];
  stakeholders?: string[];
  proposalPotential: {
    score: number;
    confidence: number;
    reasons: string[];
    type?: 'technical' | 'governance' | 'treasury' | 'social' | 'other';
  };
  sentiment?: {
    score: number;
    magnitude: number;
    label?: 'positive' | 'negative' | 'neutral';
  };
  keywords?: string[];
  summary?: string;
  keyPoints?: string[];
  perspectives?: string[];
  consensus?: {
    level: number;
    majorityOpinion?: string;
    dissenting?: string;
  };
  suggestedSolutions?: string[];
  engagement?: {
    participationRate: number;
    uniqueParticipants: number;
    totalInteractions: number;
  };
}

export interface ForumAnalyzerConfig {
  platforms: {
    discourse?: {
      url: string;
      apiKey?: string;
    };
    discord?: {
      token: string;
      channels: string[];
    };
    commonwealth?: {
      url: string;
      apiKey?: string;
    };
  };
  analysisOptions?: {
    proposalThreshold?: number;
    sentimentAnalysis?: boolean;
    keywordExtraction?: boolean;
  };
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  sections: ProposalSection[];
  author: string;
  timestamp: Date;
  status: ProposalStatus;
  tags: string[];
  sourceDiscussions: string[];
  estimatedImpact: {
    technical: number;
    social: number;
    economic: number;
  };
  poll?: ProposalPoll;
}

export interface ProposalSection {
  title: string;
  content: string;
  type: ProposalSectionType;
}

export type ProposalSectionType = 
  | "summary"
  | "background"
  | "motivation"
  | "specification"
  | "rationale"
  | "implementation"
  | "risks"
  | "timeline"
  | "budget"
  | "alternatives"
  | "references";

export type ProposalStatus = 
  | "draft"
  | "discussion"
  | "voting"
  | "accepted"
  | "rejected"
  | "implemented"
  | "withdrawn";

export interface ProposalPoll {
  question: string;
  options: string[];
  duration: number;
  minParticipation?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface PluginContext {
  id: string;
  name: string;
  version: string;
  config?: Record<string, unknown>;
} 