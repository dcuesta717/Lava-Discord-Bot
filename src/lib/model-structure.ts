import { ChannelType, PermissionFlagsBits, type CategoryChannel, type Guild, type OverwriteResolvable } from 'discord.js';
import { MEMBER, ROLE, clampToBot } from './overwrites.js';

/**
 * A model's private Discord home (docs/discord-server-template.md): role `model-<slug>`, category = her display name,
 * #💬-general-chat, 🎬-reels-copy-board (forum, read-only for her), #🌸-custom, #🔔-notification, #📚-resources, 🔊 call.
 * Idempotent by name: re-running finds what exists. Shared by scripts/setup-server.ts and /model add.
 */
export interface ModelStructureIds {
  category_id: string;
  role_id: string;
  channels: { general: string; reels_board: string; custom: string; notification: string; resources: string; call: string };
  created: string[];
}

export async function ensureModelStructure(guild: Guild, opts: { slug: string; displayName: string; userId: string; botId: string; staffIds: string[] }): Promise<ModelStructureIds> {
  await guild.roles.fetch();
  await guild.channels.fetch();
  const clamp = await clampToBot(guild);

  const roleName = `model-${opts.slug}`;
  const role = guild.roles.cache.find((r) => r.name === roleName) ?? (await guild.roles.create({ name: roleName, mentionable: false }));
  await guild.members
    .fetch(opts.userId)
    .then((m) => m.roles.add(role))
    .catch(() => undefined); // not in the server yet — the role is applied when she joins (see /model add reply)

  const overwrites: OverwriteResolvable[] = clamp([
    { id: guild.roles.everyone.id, type: ROLE, deny: [PermissionFlagsBits.ViewChannel] },
    { id: role.id, type: ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.AddReactions, PermissionFlagsBits.UseApplicationCommands, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: opts.botId, type: MEMBER, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory] },
    ...[...new Set(opts.staffIds)].filter((id) => id !== opts.botId).map((id): OverwriteResolvable => ({ id, type: MEMBER, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] })),
  ]);
  const boardOverwrites: OverwriteResolvable[] = overwrites.map((o) =>
    o.id === role.id
      ? { id: role.id, type: ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads] }
      : o,
  );

  const created: string[] = [];
  const catName = opts.displayName;
  let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === catName.toLowerCase()) as CategoryChannel | undefined;
  if (!category) {
    category = await guild.channels.create({ name: catName, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
    created.push(catName);
  } else await category.permissionOverwrites.set(overwrites).catch(() => undefined);

  const spec = [
    { key: 'general', name: '💬-general-chat', type: ChannelType.GuildText, perms: overwrites },
    { key: 'reels_board', name: '🎬-reels-copy-board', type: ChannelType.GuildForum, perms: boardOverwrites },
    { key: 'custom', name: '🌸-custom', type: ChannelType.GuildText, perms: overwrites },
    { key: 'notification', name: '🔔-notification', type: ChannelType.GuildText, perms: overwrites },
    { key: 'resources', name: '📚-resources', type: ChannelType.GuildText, perms: overwrites },
    { key: 'call', name: 'call', type: ChannelType.GuildVoice, perms: overwrites },
  ] as const;

  const ids: Record<string, string> = {};
  for (const s of spec) {
    const name = s.name.replace(/️/g, '');
    const existing = guild.channels.cache.find((c) => c.parentId === category!.id && c.name === name);
    if (existing) {
      ids[s.key] = existing.id;
      continue;
    }
    const ch = await guild.channels.create({ name, type: s.type, parent: category.id, permissionOverwrites: s.perms });
    ids[s.key] = ch.id;
    created.push(name);
  }

  return {
    category_id: category.id,
    role_id: role.id,
    channels: { general: ids.general, reels_board: ids.reels_board, custom: ids.custom, notification: ids.notification, resources: ids.resources, call: ids.call },
    created,
  };
}
