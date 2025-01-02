import axios from 'axios';
import path from 'path';

interface Message {
  content: {
    text: string;
    metadata: {
      source: string;
      type?: string;
      url?: string;
      timestamp: Date;
      topicId?: string | number;
      category?: string;
      channelId?: string;
    };
  };
  user: string;
}

async function scrapeGovernanceDiscussions(forumUrl: string): Promise<Message[]> {
  const messages: Message[] = [];
  try {
    // First, get the governance category ID
    const categoriesResponse = await axios.get(`${forumUrl}/categories.json`);
    const governanceCategory = categoriesResponse.data.category_list.categories
      .find(cat => cat.name.toLowerCase().includes('governance') || cat.name.toLowerCase().includes('dao'));

    if (!governanceCategory) {
      console.log('No governance category found, falling back to latest topics');
      return scrapeLatestTopics(forumUrl);
    }

    console.log(`Found governance category: ${governanceCategory.name}`);

    // Fetch topics from governance category
    const topicsResponse = await axios.get(`${forumUrl}/c/${governanceCategory.id}.json`);
    const topics = topicsResponse.data.topic_list.topics;
    console.log(`Found ${topics.length} governance topics`);

    // Process each topic
    for (const topic of topics) {
      try {
        const topicResponse = await axios.get(`${forumUrl}/t/${topic.id}.json`);
        const posts = topicResponse.data.post_stream.posts;

        // Add the main post
        messages.push({
          content: {
            text: `Title: ${topic.title}\n\nContent: ${posts[0].cooked.replace(/<[^>]*>/g, '')}`,
            metadata: {
              source: 'discourse',
              type: 'main_post',
              url: `${forumUrl}/t/${topic.id}`,
              timestamp: new Date(posts[0].created_at),
              topicId: topic.id,
              category: governanceCategory.name
            }
          },
          user: posts[0].username
        });

        // Add responses/comments
        for (const post of posts.slice(1)) {
          messages.push({
            content: {
              text: post.cooked.replace(/<[^>]*>/g, ''),
              metadata: {
                source: 'discourse',
                type: 'comment',
                url: `${forumUrl}/t/${topic.id}/${post.post_number}`,
                timestamp: new Date(post.created_at),
                topicId: topic.id,
                category: governanceCategory.name
              }
            },
            user: post.username
          });
        }

        console.log(`Processed topic: ${topic.title} (${posts.length} posts)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      } catch (error) {
        console.error(`Error processing topic ${topic.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching governance category:', error.message);
  }
  return messages;
}

async function scrapeLatestTopics(forumUrl: string): Promise<Message[]> {
  const messages: Message[] = [];
  const response = await axios.get(`${forumUrl}/latest.json`);
  const topics = response.data.topic_list.topics;

  for (const topic of topics.slice(0, 10)) { // Process top 10 topics
    try {
      const topicResponse = await axios.get(`${forumUrl}/t/${topic.id}.json`);
      const posts = topicResponse.data.post_stream.posts;

      messages.push({
        content: {
          text: `Title: ${topic.title}\n\nContent: ${posts[0].cooked.replace(/<[^>]*>/g, '')}`,
          metadata: {
            source: 'discourse',
            type: 'main_post',
            url: `${forumUrl}/t/${topic.id}`,
            timestamp: new Date(posts[0].created_at)
          }
        },
        user: posts[0].username
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing topic ${topic.id}:`, error.message);
    }
  }
  return messages;
}

async function analyzeDiscussions(messages: Message[]): Promise<void> {
  // Group messages by topic
  const messagesByTopic: Record<string | number, Message[]> = messages.reduce((acc, msg) => {
    const topicId = msg.content.metadata.topicId;
    if (topicId) {
      if (!acc[topicId]) acc[topicId] = [];
      acc[topicId].push(msg);
    }
    return acc;
  }, {} as Record<string | number, Message[]>);

  // Analyze each topic thread
  for (const [topicId, topicMessages] of Object.entries(messagesByTopic)) {
    const mainPost = topicMessages.find(m => m.content.metadata.type === 'main_post');
    if (!mainPost) continue;

    const analysis = analyzeDiscussion(topicMessages);
    const ideas = extractProposalIdeas(analysis);

    console.log('\n=== Topic Analysis ===');
    console.log('Title:', analysis.title);
    console.log('URL:', analysis.url);
    console.log('Author:', analysis.mainPost.author);
    console.log('Created:', analysis.mainPost.timestamp);

    console.log('\nEngagement:');
    console.log('- Responses:', analysis.responses.count);
    console.log('- Unique Participants:', analysis.responses.uniqueParticipants);
    console.log('- Engagement Level:', analysis.communityEngagement.level);
    console.log('- Consensus Level:', Math.round(analysis.communityEngagement.consensusLevel * 100) + '%');

    console.log('\nSentiment:');
    console.log('- Overall:', Math.round(analysis.sentiment.overall * 100) / 100);
    console.log('- Breakdown:');
    console.log('  * Positive:', Math.round(analysis.sentiment.breakdown.positive * 100) + '%');
    console.log('  * Neutral:', Math.round(analysis.sentiment.breakdown.neutral * 100) + '%');
    console.log('  * Negative:', Math.round(analysis.sentiment.breakdown.negative * 100) + '%');
    console.log('- Key Phrases:', analysis.sentiment.keyPhrases.join(', '));

    console.log('\nProposal Potential:');
    console.log('- Score:', Math.round(analysis.proposalPotential.score * 100) + '%');
    console.log('- Type:', analysis.proposalPotential.type);
    console.log('- Related Topics:', analysis.proposalPotential.relevantTopics.join(', '));

    if (ideas.length > 0) {
      console.log('\nPotential Proposal Ideas:');
      ideas.forEach((idea, index) => {
        console.log(`\n${index + 1}. ${idea.title}`);
        console.log('Context:', idea.context);
        console.log('Supporting Evidence:', idea.supportingEvidence.length > 0 ? idea.supportingEvidence[0] : 'None');
        console.log('Sentiment:', Math.round(idea.sentiment.score * 100) / 100);
        console.log('Community Reaction:', idea.sentiment.communityReaction);
      });
    }

    console.log('\n------------------------\n');
  }
}

function analyzeDiscussion(messages: Message[]): DiscussionAnalysis {
  const mainPost = messages[0];
  const responses = messages.slice(1);

  // Calculate sentiment scores
  const sentiments = messages.map(msg => analyzeSentiment(msg.content.text));
  const overallSentiment = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;

  // Count sentiment distribution
  const sentimentBreakdown = {
    positive: sentiments.filter(s => s.score > 0.3).length / sentiments.length,
    neutral: sentiments.filter(s => Math.abs(s.score) <= 0.3).length / sentiments.length,
    negative: sentiments.filter(s => s.score < -0.3).length / sentiments.length
  };

  // Analyze proposal potential
  const proposalKeywords = ['governance', 'proposal', 'vote', 'change', 'improve', 'implement'];
  const proposalScore = proposalKeywords.reduce((score, keyword) =>
    score + (mainPost.content.text.toLowerCase().includes(keyword) ? 1 : 0), 0
  ) / proposalKeywords.length;

  return {
    topicId: mainPost.content.metadata.topicId!,
    title: mainPost.content.text.split('\n')[0].replace('Title: ', ''),
    url: mainPost.content.metadata.url!,
    mainPost: {
      content: mainPost.content.text,
      author: mainPost.user,
      timestamp: mainPost.content.metadata.timestamp
    },
    responses: {
      count: responses.length,
      uniqueParticipants: new Set(responses.map(r => r.user)).size,
      averageSentiment: responses.length > 0
        ? responses.map(r => analyzeSentiment(r.content.text).score).reduce((a, b) => a + b) / responses.length
        : 0
    },
    sentiment: {
      overall: overallSentiment,
      breakdown: sentimentBreakdown,
      keyPhrases: Array.from(new Set(sentiments.flatMap(s => s.keywords)))
    },
    proposalPotential: {
      score: proposalScore,
      type: determineProposalType(mainPost.content.text),
      relevantTopics: extractRelevantTopics(mainPost.content.text)
    },
    communityEngagement: {
      level: determineEngagementLevel(responses.length),
      participationRate: responses.length / (responses.length + 1),
      consensusLevel: calculateConsensusLevel(sentiments)
    }
  };
}

function analyzeSentiment(text: string): { score: number; keywords: string[] } {
  const keywords = new Set<string>();
  let score = 0;

  const positiveTerms = ['support', 'agree', 'good', 'great', 'improve', 'benefit', 'positive', 'yes', 'approve'];
  const negativeTerms = ['against', 'disagree', 'bad', 'poor', 'harm', 'negative', 'no', 'reject', 'oppose'];

  const words = text.toLowerCase().split(/\W+/);
  let totalTerms = 0;

  words.forEach(word => {
    if (positiveTerms.includes(word)) {
      score += 1;
      keywords.add(word);
      totalTerms++;
    }
    if (negativeTerms.includes(word)) {
      score -= 1;
      keywords.add(word);
      totalTerms++;
    }
  });

  return {
    score: totalTerms > 0 ? score / totalTerms : 0,
    keywords: Array.from(keywords)
  };
}

function extractProposalIdeas(discussion: DiscussionAnalysis): ProposalIdea[] {
  const ideas: ProposalIdea[] = [];
  const proposalIndicators = [
    'should', 'could', 'propose', 'suggest', 'idea', 'improve',
    'change', 'implement', 'add', 'remove', 'modify', 'update'
  ];

  const sentences = discussion.mainPost.content.split(/[.!?]+/);
  let currentIdea: Partial<ProposalIdea> | null = null;

  sentences.forEach(sentence => {
    const hasIndicator = proposalIndicators.some(indicator =>
      sentence.toLowerCase().includes(indicator)
    );

    if (hasIndicator) {
      if (currentIdea) {
        ideas.push(currentIdea as ProposalIdea);
      }

      const sentiment = analyzeSentiment(sentence);
      currentIdea = {
        title: sentence.trim(),
        context: discussion.title,
        supportingEvidence: [],
        relatedTopics: discussion.proposalPotential.relevantTopics,
        sentiment: {
          score: sentiment.score,
          keywords: sentiment.keywords,
          communityReaction: discussion.responses.averageSentiment > 0 ? 'positive' : 'negative'
        }
      };
    } else if (currentIdea) {
      currentIdea.supportingEvidence?.push(sentence.trim());
    }
  });

  if (currentIdea) {
    ideas.push(currentIdea as ProposalIdea);
  }

  return ideas;
}

function determineProposalType(text: string): 'improvement' | 'feature' | 'governance' | 'other' {
  const lowercase = text.toLowerCase();
  if (lowercase.includes('governance') || lowercase.includes('policy') || lowercase.includes('rule')) {
    return 'governance';
  }
  if (lowercase.includes('improve') || lowercase.includes('update') || lowercase.includes('fix')) {
    return 'improvement';
  }
  if (lowercase.includes('new') || lowercase.includes('add') || lowercase.includes('create')) {
    return 'feature';
  }
  return 'other';
}

function extractRelevantTopics(text: string): string[] {
  const topics = new Set<string>();
  const commonTopics = [
    'governance', 'treasury', 'voting', 'proposal', 'community',
    'development', 'security', 'token', 'protocol', 'upgrade'
  ];

  commonTopics.forEach(topic => {
    if (text.toLowerCase().includes(topic)) {
      topics.add(topic);
    }
  });

  return Array.from(topics);
}

function determineEngagementLevel(responseCount: number): 'high' | 'medium' | 'low' {
  if (responseCount > 10) return 'high';
  if (responseCount > 5) return 'medium';
  return 'low';
}

function calculateConsensusLevel(sentiments: { score: number }[]): number {
  if (sentiments.length < 2) return 1;

  const scores = sentiments.map(s => s.score);
  const mean = scores.reduce((a, b) => a + b) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

  return 1 / (1 + variance);
}

interface DiscussionAnalysis {
  topicId: string | number;
  title: string;
  url: string;
  mainPost: {
    content: string;
    author: string;
    timestamp: Date;
  };
  responses: {
    count: number;
    uniqueParticipants: number;
    averageSentiment: number;
  };
  sentiment: {
    overall: number;
    breakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
    keyPhrases: string[];
  };
  proposalPotential: {
    score: number;
    type: 'improvement' | 'feature' | 'governance' | 'other';
    relevantTopics: string[];
  };
  communityEngagement: {
    level: 'high' | 'medium' | 'low';
    participationRate: number;
    consensusLevel: number;
  };
}

interface ProposalIdea {
  title: string;
  context: string;
  supportingEvidence: string[];
  relatedTopics: string[];
  sentiment: {
    score: number;
    keywords: string[];
    communityReaction: string;
  };
}

async function main() {
  const forumUrl = 'https://forum.decentraland.org';
  console.log('Starting governance forum analysis...');

  const messages = await scrapeGovernanceDiscussions(forumUrl);
  console.log(`\nCollected ${messages.length} messages from ${new Set(messages.map(m => m.content.metadata.topicId)).size} topics`);

  await analyzeDiscussions(messages);
}

// Run the analysis
main().catch(console.error);