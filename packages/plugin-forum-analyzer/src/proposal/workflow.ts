import { elizaLogger } from '@elizaos/core';
import { ProposalDraft, TemperatureCheckPoll } from './generator';

export type ProposalStage = 'draft' | 'temperature_check' | 'discussion' | 'final_proposal' | 'voting' | 'executed' | 'rejected';

export interface ProposalWorkflowConfig {
  temperatureCheckDuration: number; // in days
  discussionPeriod: number; // in days
  votingPeriod: number; // in days
  minimumQuorum: number; // 0-1 range
  approvalThreshold: number; // 0-1 range
  governanceConfig?: {
    criticalProposalThreshold: number; // Threshold for critical governance changes (0-1)
    extendedVotingPeriod: number; // in days, for critical proposals
    highQuorum: number; // 0-1 range, for critical proposals
  };
}

export interface ProposalVote {
  voter: string;
  choice: string;
  weight: number;
  timestamp: Date;
}

export interface ProposalWorkflowState {
  stage: ProposalStage;
  proposal: ProposalDraft;
  temperatureCheck?: {
    poll: TemperatureCheckPoll;
    votes: ProposalVote[];
    endTime: Date;
    result?: {
      support: number;
      opposition: number;
      needsDiscussion: number;
    };
  };
  discussion?: {
    comments: Array<{
      author: string;
      content: string;
      timestamp: Date;
    }>;
    endTime: Date;
  };
  voting?: {
    votes: ProposalVote[];
    startTime: Date;
    endTime: Date;
    result?: {
      approved: boolean;
      support: number;
      quorumReached: boolean;
    };
  };
}

export const DEFAULT_CONFIG: ProposalWorkflowConfig = {
  temperatureCheckDuration: 3,
  discussionPeriod: 5,
  votingPeriod: 7,
  minimumQuorum: 0.1, // 10%
  approvalThreshold: 0.5, // 50%
  governanceConfig: {
    criticalProposalThreshold: 0.8,
    extendedVotingPeriod: 14,
    highQuorum: 0.2 // 20%
  }
};

export class ProposalWorkflow {
  private config: ProposalWorkflowConfig;
  private state: ProposalWorkflowState;

  constructor(
    proposal: ProposalDraft,
    config: Partial<ProposalWorkflowConfig> = {}
  ) {
    elizaLogger.info('[ProposalWorkflow] Initializing workflow');
    elizaLogger.debug('[ProposalWorkflow] Configuration:', { ...config });
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      stage: 'draft',
      proposal,
    };
    
    elizaLogger.info('[ProposalWorkflow] Workflow initialized in draft stage');
  }

  public async startTemperatureCheck(): Promise<void> {
    elizaLogger.info('[ProposalWorkflow] Attempting to start temperature check phase');
    
    if (this.state.stage !== 'draft') {
      const error = 'Temperature check can only be started from draft stage';
      elizaLogger.error(`[ProposalWorkflow] ${error}`, { currentStage: this.state.stage });
      throw new Error(error);
    }

    if (!this.state.proposal.poll) {
      const error = 'Proposal does not have a temperature check poll configured';
      elizaLogger.error(`[ProposalWorkflow] ${error}`);
      throw new Error(error);
    }

    const endTime = new Date();
    endTime.setDate(endTime.getDate() + this.config.temperatureCheckDuration);

    this.state = {
      ...this.state,
      stage: 'temperature_check',
      temperatureCheck: {
        poll: this.state.proposal.poll,
        votes: [],
        endTime,
      },
    };

    elizaLogger.info('[ProposalWorkflow] Started temperature check phase', {
      duration: this.config.temperatureCheckDuration,
      endTime
    });
  }

  public async submitTemperatureCheckVote(vote: ProposalVote): Promise<void> {
    elizaLogger.info('[ProposalWorkflow] Processing temperature check vote');
    elizaLogger.debug('[ProposalWorkflow] Vote details:', { 
      voter: vote.voter,
      choice: vote.choice,
      weight: vote.weight
    });

    if (this.state.stage !== 'temperature_check') {
      const error = 'Votes can only be submitted during temperature check phase';
      elizaLogger.error(`[ProposalWorkflow] ${error}`, { currentStage: this.state.stage });
      throw new Error(error);
    }

    if (!this.state.temperatureCheck) {
      const error = 'Temperature check state not initialized';
      elizaLogger.error(`[ProposalWorkflow] ${error}`);
      throw new Error(error);
    }

    this.state.temperatureCheck.votes.push(vote);
    elizaLogger.info('[ProposalWorkflow] Vote recorded successfully', {
      totalVotes: this.state.temperatureCheck.votes.length
    });
  }

  public async finalizeTemperatureCheck(): Promise<void> {
    elizaLogger.info('[ProposalWorkflow] Attempting to finalize temperature check');
    
    if (this.state.stage !== 'temperature_check') {
      const error = 'Can only finalize from temperature check phase';
      elizaLogger.error(`[ProposalWorkflow] ${error}`, { currentStage: this.state.stage });
      throw new Error(error);
    }

    if (!this.state.temperatureCheck) {
      const error = 'Temperature check state not initialized';
      elizaLogger.error(`[ProposalWorkflow] ${error}`);
      throw new Error(error);
    }

    const { votes } = this.state.temperatureCheck;
    const totalVotes = votes.length;
    
    if (totalVotes === 0) {
      elizaLogger.warn('[ProposalWorkflow] No votes received during temperature check');
    }

    const result = {
      support: votes.filter(v => v.choice === 'Strongly Support' || v.choice === 'Support with Minor Changes').length / totalVotes,
      opposition: votes.filter(v => v.choice === 'Do Not Support').length / totalVotes,
      needsDiscussion: votes.filter(v => v.choice === 'Need More Discussion').length / totalVotes,
    };

    this.state.temperatureCheck.result = result;
    this.state.stage = result.support > 0.5 ? 'discussion' : 'rejected';

    elizaLogger.info('[ProposalWorkflow] Temperature check finalized', {
      result,
      newStage: this.state.stage,
      totalVotes
    });
  }

  public async startDiscussion(): Promise<void> {
    elizaLogger.info('[ProposalWorkflow] Attempting to start discussion phase');
    
    if (this.state.stage !== 'temperature_check') {
      const error = 'Discussion can only be started after temperature check';
      elizaLogger.error(`[ProposalWorkflow] ${error}`, { currentStage: this.state.stage });
      throw new Error(error);
    }

    const endTime = new Date();
    endTime.setDate(endTime.getDate() + this.config.discussionPeriod);

    this.state = {
      ...this.state,
      stage: 'discussion',
      discussion: {
        comments: [],
        endTime,
      },
    };

    elizaLogger.info('[ProposalWorkflow] Started discussion phase', {
      duration: this.config.discussionPeriod,
      endTime
    });
  }

  public async addDiscussionComment(author: string, content: string): Promise<void> {
    if (this.state.stage !== 'discussion' || !this.state.discussion) {
      throw new Error('Discussion period is not active');
    }

    if (new Date() > this.state.discussion.endTime) {
      throw new Error('Discussion period has ended');
    }

    this.state.discussion.comments.push({
      author,
      content,
      timestamp: new Date(),
    });
  }

  public async finalizeDiscussion(): Promise<void> {
    if (this.state.stage !== 'discussion') {
      throw new Error('Discussion is not active');
    }

    this.state.stage = 'final_proposal';
    elizaLogger.info('[ProposalWorkflow] Moved to final proposal stage');
  }

  public async startVoting(): Promise<void> {
    if (this.state.stage !== 'final_proposal') {
      throw new Error('Proposal must be finalized before voting');
    }

    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + this.config.votingPeriod);

    this.state = {
      ...this.state,
      stage: 'voting',
      voting: {
        votes: [],
        startTime,
        endTime,
      },
    };

    elizaLogger.info('[ProposalWorkflow] Started voting phase');
  }

  public async submitVote(vote: ProposalVote): Promise<void> {
    if (this.state.stage !== 'voting' || !this.state.voting) {
      throw new Error('Voting is not active');
    }

    if (new Date() > this.state.voting.endTime) {
      throw new Error('Voting period has ended');
    }

    this.state.voting.votes.push(vote);
    elizaLogger.info('[ProposalWorkflow] Recorded vote');
  }

  public async finalizeVoting(): Promise<void> {
    if (this.state.stage !== 'voting' || !this.state.voting) {
      throw new Error('Voting is not active');
    }

    const { votes } = this.state.voting;
    const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
    const supportWeight = votes
      .filter(v => v.choice === 'Support')
      .reduce((sum, vote) => sum + vote.weight, 0);

    const result = {
      approved: false,
      support: supportWeight / totalWeight,
      quorumReached: totalWeight >= this.config.minimumQuorum,
    };

    result.approved = result.quorumReached && result.support >= this.config.approvalThreshold;
    this.state.voting.result = result;
    this.state.stage = result.approved ? 'executed' : 'rejected';

    elizaLogger.info(`[ProposalWorkflow] Proposal ${result.approved ? 'approved' : 'rejected'}`);
  }

  public getState(): ProposalWorkflowState {
    return this.state;
  }

  public getCurrentStage(): ProposalStage {
    return this.state.stage;
  }
} 