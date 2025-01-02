import { Eliza } from '@eliza/core';
import { DAOForumPlugin } from '@eliza/plugin-dao-forum';

async function main() {
  // Initialize the DAO Forum plugin
  const daoForumPlugin = new DAOForumPlugin({
    // Example Discourse forum - replace with your target forum URL
    discourseUrl: 'https://forum.yourdao.org',
    usePublicDiscourse: true,

    // Optional: Discord configuration
    // discordToken: process.env.DISCORD_TOKEN,
    // discordChannelIds: ['your-channel-id'],

    // Optional: Commonwealth configuration
    // commonwealthUrl: 'https://commonwealth.im/your-dao'
  });

  // Initialize Eliza with DAOra character and the plugin
  const eliza = new Eliza({
    characterPath: '../characters/daora.character.json',
    plugins: [daoForumPlugin]
  });

  // Start the processing
  await eliza.start();

  // Example: Get messages from the forum
  const messages = await daoForumPlugin.scrapeDiscourse();
  console.log(`Fetched ${messages.length} messages from the forum`);

  // Process messages through DAOra
  for (const message of messages) {
    const response = await eliza.processMessage(message);
    console.log('DAOra Response:', response);
  }
}

main().catch(console.error);