import api from "./api";

export type ChatMessage = {
  id: string;
  senderUserId?: number;
  senderUsername: string;
  receiverUserId?: number;
  receiverUsername?: string;
  content: string;
  createdAt: string;
};

export type ChatConversationSummary = {
  otherUserId: number;
  otherUsername: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

const buildStableMessageId = (parts: Array<string | number | undefined>) =>
  parts
    .map((part) => (part == null ? "" : String(part).trim().toLowerCase()))
    .join("|");

const normalizeToSecond = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim().toLowerCase();
  const ms = date.getTime();
  return String(Math.floor(ms / 1000));
};

const pickString = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const pickNumber = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const pickNested = (
  payload: Record<string, unknown>,
  parentKeys: string[],
  valueKey: string,
) => {
  for (const parentKey of parentKeys) {
    const parent = payload[parentKey];
    if (!parent || typeof parent !== "object") continue;
    const value = (parent as Record<string, unknown>)[valueKey];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
};

export const extractChatItems = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    );
  }

  if (data && typeof data === "object" && "content" in data) {
    const pageContent = (data as { content?: unknown }).content;
    if (Array.isArray(pageContent)) {
      return pageContent.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object",
      );
    }
  }

  return [];
};

export const normalizeChatMessage = (
  payload: Record<string, unknown>,
): ChatMessage | null => {
  const content = pickString(payload, ["content", "message", "text", "body"]);
  if (!content) return null;

  const senderUserId =
    pickNumber(payload, [
      "senderUserId",
      "fromUserId",
      "senderId",
      "userId",
      "fromId",
    ]) ??
    (pickNested(payload, ["sender", "from", "user"], "id") as
      | number
      | undefined);

  const receiverUserId =
    pickNumber(payload, [
      "receiverUserId",
      "toUserId",
      "receiverId",
      "toId",
      "targetUserId",
    ]) ??
    (pickNested(payload, ["receiver", "to", "targetUser"], "id") as
      | number
      | undefined);

  const senderUsername =
    pickString(payload, ["senderUsername", "sender", "from", "username"]) ||
    (pickNested(payload, ["sender", "from", "user"], "username") as
      | string
      | undefined) ||
    (pickNested(payload, ["sender", "from", "user"], "name") as
      | string
      | undefined) ||
    "User";

  const receiverUsername =
    pickString(payload, [
      "receiverUsername",
      "toUsername",
      "targetUsername",
      "to",
    ]) ||
    (pickNested(payload, ["receiver", "to", "targetUser"], "username") as
      | string
      | undefined) ||
    (pickNested(payload, ["receiver", "to", "targetUser"], "name") as
      | string
      | undefined) ||
    undefined;

  const createdAt =
    pickString(payload, ["createdAt", "sentAt", "timestamp", "time"]) ||
    new Date().toISOString();

  const explicitId =
    pickString(payload, ["id", "messageId"]) ||
    String(
      pickNumber(payload, ["id", "messageId", "chatMessageId", "message_id"]) ??
        "",
    ).trim();

  return {
    id:
      explicitId ||
      buildStableMessageId([
        senderUserId,
        receiverUserId,
        senderUsername,
        receiverUsername,
        content,
        createdAt,
      ]),
    senderUserId,
    senderUsername,
    receiverUserId,
    receiverUsername,
    content,
    createdAt,
  };
};

export const buildChatMessageDedupeKey = (
  message: Pick<
    ChatMessage,
    | "senderUserId"
    | "senderUsername"
    | "receiverUserId"
    | "receiverUsername"
    | "content"
    | "createdAt"
  >,
) =>
  buildStableMessageId([
    message.senderUserId ?? message.senderUsername,
    message.receiverUserId ?? message.receiverUsername,
    message.content,
    normalizeToSecond(message.createdAt),
  ]);

export const resolveOtherUserId = (
  message: Pick<ChatMessage, "senderUserId" | "receiverUserId">,
  currentUserId?: number,
) => {
  if (typeof currentUserId === "number") {
    if (message.senderUserId === currentUserId) return message.receiverUserId;
    if (message.receiverUserId === currentUserId) return message.senderUserId;
  }
  return message.senderUserId ?? message.receiverUserId;
};

export const normalizeConversationSummary = (
  payload: Record<string, unknown>,
  currentUserId?: number,
): ChatConversationSummary | null => {
  const messageFromPayload = normalizeChatMessage(payload);
  const otherUserIdFromMessage =
    messageFromPayload && resolveOtherUserId(messageFromPayload, currentUserId);

  const otherUserId =
    pickNumber(payload, [
      "otherUserId",
      "userId",
      "partnerUserId",
      "participantUserId",
      "conversationUserId",
    ]) ??
    (pickNested(payload, ["otherUser", "partner", "participant"], "id") as
      | number
      | undefined) ??
    otherUserIdFromMessage;

  if (!otherUserId || otherUserId <= 0) return null;

  const otherUsername =
    pickString(payload, [
      "otherUsername",
      "partnerUsername",
      "participantUsername",
      "username",
      "name",
    ]) ||
    (pickNested(payload, ["otherUser", "partner", "participant"], "username") as
      | string
      | undefined) ||
    (pickNested(payload, ["otherUser", "partner", "participant"], "name") as
      | string
      | undefined) ||
    (messageFromPayload
      ? messageFromPayload.senderUserId === currentUserId
        ? messageFromPayload.receiverUsername
        : messageFromPayload.senderUsername
      : undefined) ||
    `User #${otherUserId}`;

  const lastMessage =
    pickString(payload, ["lastMessage", "message", "content", "text"]) ||
    messageFromPayload?.content ||
    "";

  const lastMessageAt =
    pickString(payload, [
      "lastMessageAt",
      "lastMessageTime",
      "updatedAt",
      "createdAt",
      "timestamp",
    ]) ||
    messageFromPayload?.createdAt ||
    new Date().toISOString();

  const unreadCount =
    pickNumber(payload, ["unreadCount", "unread", "newCount", "pendingCount"]) ??
    0;

  return {
    otherUserId,
    otherUsername,
    lastMessage,
    lastMessageAt,
    unreadCount: Math.max(0, unreadCount),
  };
};

export const sortConversationsByDate = (items: ChatConversationSummary[]) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a.lastMessageAt).getTime();
    const bTime = new Date(b.lastMessageAt).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
    return bTime - aTime;
  });

export const getChatConversations = async (currentUserId?: number) => {
  const { data } = await api.get<unknown>("/api/chat/conversations");
  const normalized = extractChatItems(data)
    .map((item) => normalizeConversationSummary(item, currentUserId))
    .filter((item): item is ChatConversationSummary => item !== null);
  return sortConversationsByDate(normalized);
};

export const getChatConversation = async (otherUserId: number) => {
  const { data } = await api.get<unknown>(`/api/chat/conversation/${otherUserId}`);
  return extractChatItems(data)
    .map((item) => normalizeChatMessage(item))
    .filter((item): item is ChatMessage => item !== null);
};

export const markChatConversationRead = async (otherUserId: number) => {
  await api.post(`/api/chat/mark-read/${otherUserId}`);
};
