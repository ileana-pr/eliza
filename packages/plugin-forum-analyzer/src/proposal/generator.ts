import { DiscussionAnalysis, Proposal, ProposalSection } from "../types";
import { elizaLogger } from '@elizaos/core';

export interface TemperatureCheckPoll {
  title: string;
  description: string;
  options: string[];
  duration: number; // in days
  threshold: number; // minimum participation threshold
}

export interface ProposalDraft {
  title: string;
  author: string;
  createdAt: Date;
  status: 'draft' | 'temperature_check' | 'proposal';
  sections: ProposalSection[];
  poll?: TemperatureCheckPoll;
  sourceDiscussions: string[]; // URLs of source discussions
  tags: string[];
  estimatedImpact: {
    technical: number; // 0-1 scale
    social: number;
    economic: number;
  };
  metadata?: {
    source: string;
    platform: string;
    timestamp: Date;
    author: string;
    tags: string[];
    engagement: {
      participationRate: number;
      uniqueParticipants: number;
      totalInteractions: number;
    };
  };
}

export interface ProposalGeneratorOptions {
  includeTemperatureCheck?: boolean;
  pollDuration?: number; // in days
  minimumParticipationThreshold?: number;
  requireBudgetEstimate?: boolean;
}

const DEFAULT_OPTIONS: ProposalGeneratorOptions = {
  includeTemperatureCheck: true,
  pollDuration: 3,
  minimumParticipationThreshold: 0.1, // 10% of token holders
  requireBudgetEstimate: true,
};

export class ProposalGenerator {
  private generateAbstract(analysis: DiscussionAnalysis): ProposalSection {
    elizaLogger.debug('[ProposalGenerator] Generating abstract section');
    const { keyPoints, proposalPotential } = analysis;
    
    const content = `
This governance proposal addresses key community points based on recent discussions.

Key Points:
${keyPoints.map(point => `- ${point}`).join('\n')}

Governance Relevance: ${Math.round(proposalPotential.governanceRelevance * 100)}%
Community Consensus: ${Math.round(proposalPotential.consensus.level * 100)}%
    `.trim();

    elizaLogger.debug('[ProposalGenerator] Generated abstract with key points:', { 
      count: keyPoints.length,
      governanceRelevance: proposalPotential.governanceRelevance,
      consensusLevel: proposalPotential.consensus.level
    });
    
    return {
      title: 'Abstract',
      content,
      type: "summary",
    };
  }

  private generateMotivation(analysis: DiscussionAnalysis): ProposalSection {
    elizaLogger.debug('[ProposalGenerator] Generating motivation section');
    const { proposalPotential, sentiment } = analysis;
    const { consensus } = proposalPotential;
    
    const content = `
Background:
The community has expressed ${sentiment.label} sentiment regarding these governance topics, 
with a consensus level of ${Math.round(consensus.level * 100)}%.

Community Perspectives:
${proposalPotential.keyPoints.map(point => `- ${point}`).join('\n')}

${consensus.majorityOpinion ? `Majority Opinion: ${consensus.majorityOpinion}` : ''}
${consensus.dissenting ? `\nDissenting Views: ${consensus.dissenting}` : ''}

Governance Impact:
This proposal has been identified as having significant governance implications with a 
relevance score of ${Math.round(proposalPotential.governanceRelevance * 100)}%.
    `.trim();

    elizaLogger.debug('[ProposalGenerator] Generated motivation section', {
      keyPoints: proposalPotential.keyPoints.length,
      consensusLevel: consensus.level,
      sentiment: sentiment.label,
      governanceRelevance: proposalPotential.governanceRelevance
    });

    return {
      title: 'Motivation',
      content,
      type: "motivation",
    };
  }

  private generateSpecification(analysis: DiscussionAnalysis): ProposalSection {
    const { proposalPotential } = analysis;
    
    const content = `
Proposed Governance Changes:
${proposalPotential.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

Implementation Approach:
${this.generateImplementationSteps(analysis)}

Governance Considerations:
- Impact Level: ${this.getImpactLevel(proposalPotential.governanceRelevance)}
- Required Changes: ${this.generateRequiredChanges(analysis)}
- Voting Parameters: ${this.generateVotingParameters(analysis)}
${this.generateBudgetEstimate(analysis)}
    `.trim();

    return {
      title: 'Specification',
      content,
      type: "specification",
    };
  }

  private generateConclusion(analysis: DiscussionAnalysis): ProposalSection {
    const { proposalPotential, engagement } = analysis;
    
    const content = `
This proposal aims to address community needs with a confidence score of ${Math.round(proposalPotential.confidence * 100)}%.

Community Engagement:
- ${engagement.uniqueParticipants} unique participants
- ${Math.round(engagement.participationRate * 100)}% participation rate
- ${engagement.totalInteractions} total interactions

Next Steps:
1. Community feedback and discussion period (1 week)
2. Temperature check poll (3 days)
3. Final proposal refinement based on feedback
4. Formal governance proposal submission

Success Metrics:
${this.generateSuccessMetrics(analysis)}
    `.trim();

    return {
      title: 'Conclusion',
      content,
      type: "summary",
    };
  }

  private generateTemperatureCheckPoll(analysis: DiscussionAnalysis, options: ProposalGeneratorOptions): TemperatureCheckPoll {
    const { title = 'Community Discussion' } = analysis.post;
    const { topics = ['governance'] } = analysis;
    
    return {
      title: `Temperature Check: ${title}`,
      description: `This temperature check aims to gauge community sentiment on the proposed changes regarding ${topics.join(', ')}. Please vote to indicate your support level.`,
      options: [
        'Strongly Support',
        'Support with Minor Changes',
        'Need More Discussion',
        'Do Not Support',
      ],
      duration: options.pollDuration || DEFAULT_OPTIONS.pollDuration,
      threshold: options.minimumParticipationThreshold || DEFAULT_OPTIONS.minimumParticipationThreshold,
    };
  }

  private generateImplementationSteps(analysis: DiscussionAnalysis): string {
    const steps = [
      'Initial review and feedback collection',
      'Technical specification development',
      'Community review period',
      'Implementation and testing',
      'Deployment and monitoring',
    ];

    return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  }

  private generateRequiredChanges(analysis: DiscussionAnalysis): string {
    // This would be expanded based on the specific type of proposal
    const changes = [];
    
    if (analysis.proposalPotential.type === 'technical') {
      changes.push('Smart contract updates');
      changes.push('Technical documentation updates');
    } else if (analysis.proposalPotential.type === 'governance') {
      changes.push('Governance parameter updates');
      changes.push('Process documentation updates');
    }

    return changes.map(change => `- ${change}`).join('\n');
  }

  private generateBudgetEstimate(analysis: DiscussionAnalysis): string {
    if (analysis.proposalPotential.type !== 'treasury') {
      return '';
    }

    return `
Budget Estimate:
- Implementation: TBD
- Ongoing maintenance: TBD
- Contingency: 10%
    `.trim();
  }

  private generateSuccessMetrics(analysis: DiscussionAnalysis): string {
    const metrics = [
      'Increased participation in governance',
      'Improved community sentiment',
      'Technical metrics (if applicable)',
      'Economic impact metrics (if applicable)',
    ];

    return metrics.map(metric => `- ${metric}`).join('\n');
  }

  private getImpactLevel(governanceRelevance: number): string {
    if (governanceRelevance > 0.8) return 'Critical - Major governance changes';
    if (governanceRelevance > 0.6) return 'High - Significant governance updates';
    if (governanceRelevance > 0.4) return 'Medium - Moderate governance changes';
    return 'Low - Minor governance adjustments';
  }

  private generateVotingParameters(analysis: DiscussionAnalysis): string {
    const { proposalPotential } = analysis;
    
    // Adjust voting parameters based on governance relevance
    const votingPeriod = proposalPotential.governanceRelevance > 0.7 ? '7 days' : '5 days';
    const quorum = proposalPotential.governanceRelevance > 0.7 ? '20%' : '10%';
    
    return `
- Voting Period: ${votingPeriod}
- Quorum Requirement: ${quorum}
- Approval Threshold: >50% Yes votes
    `.trim();
  }

  async generateProposal(
    analysis: DiscussionAnalysis,
    options: ProposalGeneratorOptions = {}
  ): Promise<Proposal> {
    elizaLogger.info('[ProposalGenerator] Starting proposal generation');
    elizaLogger.debug('[ProposalGenerator] Generation options:', options);

    try {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
      const title = this.generateTitle(analysis);
      elizaLogger.debug('[ProposalGenerator] Generated title:', title);

      const sections: ProposalSection[] = [];
      
      // Generate each section
      elizaLogger.debug('[ProposalGenerator] Generating proposal sections');
      sections.push(this.generateAbstract(analysis));
      sections.push(this.generateMotivation(analysis));
      sections.push(this.generateSpecification(analysis));
      
      // Generate temperature check if needed
      let temperatureCheck;
      if (mergedOptions.includeTemperatureCheck) {
        elizaLogger.debug('[ProposalGenerator] Generating temperature check poll');
        temperatureCheck = this.generateTemperatureCheckPoll(analysis, mergedOptions);
      }

      const proposal: Proposal = {
        id: `PROP-${Date.now()}`,
        title,
        description: analysis.summary || '',
        sections,
        author: analysis.post.author || 'Unknown',
        timestamp: new Date(),
        status: 'draft',
        tags: analysis.keywords || [],
        sourceDiscussions: [analysis.postId],
        estimatedImpact: {
          technical: 0,
          social: 0,
          economic: 0
        },
        temperatureCheck,
        metadata: {
          source: analysis.post.url,
          platform: analysis.platform,
          timestamp: new Date(),
          author: analysis.post.author,
          tags: analysis.keywords || [],
          engagement: {
            participationRate: analysis.engagement?.participationRate || 0,
            uniqueParticipants: analysis.engagement?.uniqueParticipants || 0,
            totalInteractions: analysis.engagement?.totalInteractions || 0
          }
        }
      };

      elizaLogger.info('[ProposalGenerator] Successfully generated proposal');
      elizaLogger.debug('[ProposalGenerator] Proposal details:', {
        title,
        sectionCount: sections.length,
        hasTemperatureCheck: !!temperatureCheck
      });

      return proposal;
    } catch (error) {
      elizaLogger.error('[ProposalGenerator] Error generating proposal:', error);
      throw error;
    }
  }

  private generateTitle(analysis: DiscussionAnalysis): string {
    const prefix = this.getTitlePrefix(analysis);
    const base = analysis.summary?.split(".")[0] || "Community Proposal";
    return `${prefix}: ${base}`;
  }

  private getTitlePrefix(analysis: DiscussionAnalysis): string {
    const score = analysis.proposalPotential.score;
    if (score > 0.8) return "PROPOSAL";
    if (score > 0.6) return "RFC";
    return "DISCUSSION";
  }

  private generateMotivationSection(analysis: DiscussionAnalysis): string {
    let content = "## Background\n\n";
    content += analysis.summary || "This proposal addresses community needs and concerns.";
    content += "\n\n## Problem Statement\n\n";
    content += analysis.proposalPotential.reasons.map(r => `- ${r}`).join("\n");
    return content;
  }

  private generateSpecificationSection(analysis: DiscussionAnalysis): string {
    let content = "## Proposed Changes\n\n";
    if (analysis.keywords?.length) {
      content += "Key areas of focus:\n";
      content += analysis.keywords.map(k => `- ${k}`).join("\n");
    }
    return content;
  }

  private generateRationaleSection(analysis: DiscussionAnalysis): string {
    let content = "## Justification\n\n";
    content += "This proposal is supported by the following factors:\n\n";
    content += analysis.proposalPotential.reasons.map(r => `- ${r}`).join("\n");
    
    if (analysis.sentiment) {
      content += "\n\n## Community Sentiment\n\n";
      content += `The overall community sentiment is ${this.getSentimentDescription(analysis.sentiment.score)} `;
      content += `(score: ${analysis.sentiment.score.toFixed(2)}, magnitude: ${analysis.sentiment.magnitude.toFixed(2)})`;
    }
    
    return content;
  }

  private generateRisksSection(): string {
    return `## Risk Assessment

The following risks and considerations should be taken into account:

1. Implementation Complexity
2. Community Adoption
3. Resource Requirements
4. Timeline Dependencies

## Mitigation Strategies

- Thorough testing and review process
- Phased implementation approach
- Regular community feedback and adjustments
- Clear documentation and communication`;
  }

  private calculateImpact(analysis: DiscussionAnalysis): { technical: number; social: number; economic: number } {
    const score = analysis.proposalPotential.score;
    const baseImpact = score * 0.7; // Scale down the base impact

    return {
      technical: baseImpact,
      social: baseImpact,
      economic: baseImpact,
    };
  }

  private getSentimentDescription(score: number): string {
    if (score > 0.5) return "strongly positive";
    if (score > 0) return "positive";
    if (score === 0) return "neutral";
    if (score > -0.5) return "negative";
    return "strongly negative";
  }
} 