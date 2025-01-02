import { Runtime } from '@eliza/core';
import { DAOForumPlugin } from '../packages/plugin-dao-forum/src';
import path from 'path';

async function testDAOra() {
  // Initialize the DAO Forum plugin
  const daoForumPlugin = new DAOForumPlugin({
    // Using Decentraland's forum as an example
    discourseUrl: 'https://forum.decentraland.org',
    usePublicDiscourse: true
  });

  // Initialize Eliza runtime with DAOra character
  const runtime = new Runtime({
    characterPath: path.join(__dirname, '../characters/daora.character.json'),
    plugins: [daoForumPlugin]
  });

  console.log('Starting DAOra test...');

  try {
    // Start the runtime
    await runtime.start();
    console.log('DAOra initialized successfully');

    // Test forum scraping
    const messages = await daoForumPlugin.scrapeDiscourse();
    console.log(`Fetched ${messages.length} messages from the forum`);

    // Process first 5 messages as a test
    for (const message of messages.slice(0, 5)) {
      console.log('\nProcessing message:', message.content.text.substring(0, 100) + '...');
      const response = await runtime.processMessage(message);
      console.log('DAOra Response:', response);
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testDAOra().catch(console.error);