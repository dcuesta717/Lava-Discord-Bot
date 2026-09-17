import { OverwriteType, PermissionFlagsBits, type Guild, type OverwriteResolvable } from 'discord.js';

export const ROLE = OverwriteType.Role;
export const MEMBER = OverwriteType.Member;

/**
 * Discord rejects a channel create/edit when an overwrite sets a permission the bot itself does not hold,
 * so clamp every overwrite to the bot's own guild permissions (no-op for Administrator).
 * Also fails early with a readable message when the two permissions every setup needs are missing.
 */
export async function clampToBot(guild: Guild) {
  const me = await guild.members.fetchMe();
  const missing = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles].filter((p) => !me.permissions.has(p));
  if (missing.length && !me.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('bot is missing Manage Channels / Manage Roles — re-invite it with the OAuth URL in docs/discord-server-template.md');
  }
  const admin = me.permissions.has(PermissionFlagsBits.Administrator);
  return (list: OverwriteResolvable[]): OverwriteResolvable[] =>
    admin
      ? list
      : list.map((o) => ({
          ...o,
          allow: ((o as { allow?: bigint[] }).allow ?? []).filter((p) => me.permissions.has(p)),
          deny: ((o as { deny?: bigint[] }).deny ?? []).filter((p) => me.permissions.has(p)),
        }));
}
