import { DiscourseClient } from './platforms/discourse';
import dotenv from 'dotenv';
import { latestTopicsAction } from './actions/latestTopics';
import { AgentRuntime, type Memory, type Content } from '@elizaos/core';
import { elizaLogger } from '@elizaos/core';

// Load environment variables
dotenv.config({ path: '../../.env' });

// Enable debug logging
elizaLogger.level = 'debug';

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

async function testForumFetch() {
    try {
        const client = new DiscourseClient({
            url: process.env.DISCOURSE_FORUM_URL || '',
            usePublicScraping: true,
            fetchOptions: {
                maxPosts: 10,
                includeReplies: false
            }
        });

        console.log('Fetching forum posts...');
        const posts = await client.getPosts();
        
        console.log('\nLatest Forum Topics:');
        console.log('-------------------');
        posts.slice(0, 5).forEach((post, index) => {
            console.log(`\n${index + 1}. ${post.title}`);
            console.log(`   Posted: ${formatDate(post.created_at)}`);
            console.log(`   Views: ${post.views} | Replies: ${post.reply_count} | Likes: ${post.like_count}`);
            if (post.tags.length > 0) {
                console.log(`   Tags: ${post.tags.join(', ')}`);
            }
            console.log(`   URL: ${post.url}`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

async function testForumAnalyzer() {
    console.log('Testing Forum Analyzer Plugin');
    
    // Create a mock runtime
    const mockRuntime = {} as InstanceType<typeof AgentRuntime>;
    
    // Test message that should trigger the action
    const testMessage: Memory = {
        userId: 'test-1234-5678-9abc-def012345678',
        agentId: 'agent-1234-5678-9abc-def012345678',
        roomId: 'room-1234-5678-9abc-def012345678',
        content: { text: "show me the latest forum topics" }
    };
    
    // Test validation
    const isValid = await latestTopicsAction.validate(mockRuntime, testMessage);
    console.log('Validation result:', isValid);
    
    if (isValid) {
        // Test handler
        const result = await latestTopicsAction.handler(
            mockRuntime,
            testMessage,
            undefined,
            undefined,
            async (response: Content) => {
                console.log('Handler callback response:', response);
                return [testMessage]; // Return a Memory array to satisfy the type
            }
        );
        console.log('Handler result:', result);
    }
}

// Run the test
testForumAnalyzer().catch(console.error);

testForumFetch(); 