import { Client, GatewayIntentBits, Partials } from 'discord.js';

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // must also be enabled in the Developer Portal → Bot → Privileged Gateway Intents
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers, // Server Members intent (portal): role hand-off when an onboarded model joins
      GatewayIntentBits.DirectMessages, // girls can DM the bot (away-replies)
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });
}
