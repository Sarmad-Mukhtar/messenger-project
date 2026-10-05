"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type User = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

type MessageAttachment = {
  id?: string;
  messageId?: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  createdAt?: string;
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  isPinned: boolean;
  createdAt: string;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    sender?: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  } | null;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
};

type Conversation = {
  id: string;
  otherUser: User;
  lastMessage: Message | null;
  createdAt: string;
  updatedAt: string;
};

type FriendRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  sender: User;
};

type Notification = {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);

  // --------------------------------------------------
  // Smooth chat scrolling state
  // --------------------------------------------------

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  // --------------------------------------------------
  // Sending message state
  // --------------------------------------------------

  const [sendingMessage, setSendingMessage] = useState(false);

  const [failedOutgoingMessage, setFailedOutgoingMessage] =
    useState<{
      receiverId: string;
      content: string;
      replyToId?: string;
      attachment?: MessageAttachment;
    } | null>(null);

  // --------------------------------------------------
  // Message pagination state
  // --------------------------------------------------

  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextMessageCursor, setNextMessageCursor] =
    useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] =
    useState(false);

  // --------------------------------------------------
  // Typing indicator state
  // --------------------------------------------------

  const [isOtherUserTyping, setIsOtherUserTyping] =
    useState(false);
  const [error, setError] = useState("");

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(
    () => new Set(),
  );

  const [currentUser, setCurrentUser] =
    useState<User | null>(null);

  const [friends, setFriends] =
    useState<User[]>([]);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [selectedFriend, setSelectedFriend] =
    useState<User | null>(null);

  const [conversation, setConversation] =
    useState<Conversation | null>(null);

  const [loadingFriends, setLoadingFriends] =
    useState(true);

  const [loadingConversations, setLoadingConversations] =
    useState(true);

  const [loadingConversation, setLoadingConversation] =
    useState(false);

  // --------------------------------------------------
  // Friend request state
  // --------------------------------------------------

  const [searchUsername, setSearchUsername] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<User[]>([]);

  const [searching, setSearching] =
    useState(false);

  const [hasSearched, setHasSearched] =
    useState(false);

  const [sendingRequestId, setSendingRequestId] =
    useState<string | null>(null);

  const [friendRequests, setFriendRequests] =
    useState<FriendRequest[]>([]);

  const [loadingRequests, setLoadingRequests] =
    useState(true);

  const [processingRequestId, setProcessingRequestId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // Notification state
  // --------------------------------------------------

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [loadingNotifications, setLoadingNotifications] =
    useState(true);

  const [processingNotificationId, setProcessingNotificationId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // Profile state
  // --------------------------------------------------

  const [showProfile, setShowProfile] =
    useState(false);

  const [profileDisplayName, setProfileDisplayName] =
    useState("");

  const [profileAvatarUrl, setProfileAvatarUrl] =
    useState("");

  const [loadingProfile, setLoadingProfile] =
    useState(false);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [profileMessage, setProfileMessage] =
    useState("");

  // --------------------------------------------------
  // Block / Unblock state
  // --------------------------------------------------

  const [isBlocked, setIsBlocked] =
    useState(false);

  const [processingBlock, setProcessingBlock] =
    useState(false);

  // --------------------------------------------------
  // Delete conversation state
  // --------------------------------------------------

  const [deletingConversation, setDeletingConversation] =
    useState(false);

  // --------------------------------------------------
  // Edit message state
  // --------------------------------------------------

  const [editingMessageId, setEditingMessageId] =
    useState<string | null>(null);

  const [editingMessageContent, setEditingMessageContent] =
    useState("");

  const [savingEditedMessage, setSavingEditedMessage] =
    useState(false);

  // --------------------------------------------------
  // Message UX indicators
  // --------------------------------------------------

  // These sets keep the UI indicators visible for messages that
  // were edited or forwarded during the current client session.
  const [editedMessageIds, setEditedMessageIds] =
    useState<Set<string>>(new Set());

  const [forwardedMessageIds, setForwardedMessageIds] =
    useState<Set<string>>(new Set());

  // --------------------------------------------------
  // Delete message state
  // --------------------------------------------------

  const [deletingMessageId, setDeletingMessageId] =
    useState<string | null>(null);

  const [deleteMessageMenuId, setDeleteMessageMenuId] =
    useState<string | null>(null);

  const [messageContextMenuId, setMessageContextMenuId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // Message selection state
  // --------------------------------------------------

  const [selectedMessageIds, setSelectedMessageIds] =
    useState<Set<string>>(() => new Set());

  const [deletingSelectedMessages, setDeletingSelectedMessages] =
    useState(false);

  // --------------------------------------------------
  // Reply message state
  // --------------------------------------------------

  const [replyingToMessage, setReplyingToMessage] =
    useState<Message | null>(null);

  // --------------------------------------------------
  // Message reaction state
  // --------------------------------------------------

  const [reactionPickerMessageId, setReactionPickerMessageId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // Message attachment state
  // --------------------------------------------------

  const [selectedAttachment, setSelectedAttachment] =
    useState<File | null>(null);

  const [uploadingAttachment, setUploadingAttachment] =
    useState(false);

  // --------------------------------------------------
  // Message search state
  // --------------------------------------------------

  const [messageSearchQuery, setMessageSearchQuery] =
    useState("");

  const [messageSearchResults, setMessageSearchResults] =
    useState<Message[]>([]);

  const [searchingMessages, setSearchingMessages] =
    useState(false);

  const [showMessageSearch, setShowMessageSearch] =
    useState(false);

  const [searchingMessageId, setSearchingMessageId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // Message pinning state
  // --------------------------------------------------

  const [pinnedMessages, setPinnedMessages] =
    useState<Message[]>([]);

  const [showPinnedMessages, setShowPinnedMessages] =
    useState(false);

  const [loadingPinnedMessages, setLoadingPinnedMessages] =
    useState(false);

  const [processingPinnedMessageId, setProcessingPinnedMessageId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // Forward message state
  // --------------------------------------------------

  const [forwardingMessage, setForwardingMessage] =
    useState<Message | null>(null);

  const [forwardingToUserId, setForwardingToUserId] =
    useState<string | null>(null);

  const [forwardingMessageLoading, setForwardingMessageLoading] =
    useState(false);

  // --------------------------------------------------
  // Refs
  // --------------------------------------------------

  const socketRef =
    useRef<Socket | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const messagesContainerRef =
    useRef<HTMLDivElement | null>(null);

  const loadingOlderMessagesRef =
    useRef(false);

  const shouldScrollToBottomRef =
    useRef(false);

  const isNearBottomRef =
    useRef(true);

  const restoreScrollPositionRef =
    useRef<{
      scrollHeight: number;
      scrollTop: number;
    } | null>(null);

  const currentUserRef =
    useRef<User | null>(null);

  const conversationRef =
    useRef<Conversation | null>(null);

  const typingTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const attachmentInputRef =
    useRef<HTMLInputElement | null>(null);

  // --------------------------------------------------
  // Keep refs synchronized with React state
  // --------------------------------------------------

  useEffect(() => {
    currentUserRef.current =
      currentUser;
  }, [currentUser]);

  useEffect(() => {
    conversationRef.current =
      conversation;
  }, [conversation]);

  useEffect(() => {
    setSelectedMessageIds(new Set());
    setMessageContextMenuId(null);
    setDeleteMessageMenuId(null);
    setReactionPickerMessageId(null);
  }, [conversation?.id]);

  // --------------------------------------------------
  // Close message menus when clicking outside / pressing Escape
  // --------------------------------------------------

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("[data-message-context-menu]") ||
        target?.closest("[data-message-context-trigger]")
      ) {
        return;
      }

      setMessageContextMenuId(null);
      setDeleteMessageMenuId(null);
      setReactionPickerMessageId(null);
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMessageContextMenuId(null);
        setDeleteMessageMenuId(null);
        setReactionPickerMessageId(null);

        if (selectedMessageIds.size > 0) {
          setSelectedMessageIds(new Set());
        }
      }
    }

    document.addEventListener(
      "mousedown",
      handleDocumentMouseDown,
    );
    document.addEventListener(
      "keydown",
      handleDocumentKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleDocumentMouseDown,
      );
      document.removeEventListener(
        "keydown",
        handleDocumentKeyDown,
      );
    };
  }, []);

  // --------------------------------------------------
  // Get stored user id
  // --------------------------------------------------

  function getStoredUserId(): string | null {
    const storedUser =
      localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      const parsedUser =
        JSON.parse(storedUser);

      return parsedUser.id ?? null;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------
  // Update local read state
  // --------------------------------------------------

  function updateConversationReadState(
    conversationId: string,
    userId: string,
  ) {
    // ------------------------------------------------
    // Update messages
    // ------------------------------------------------

    setMessages(
      (currentMessages) =>
        currentMessages.map((msg) => {
          if (
            msg.conversationId !==
            conversationId
          ) {
            return msg;
          }

          // Only incoming messages become read
          // when I open the conversation.
          if (
            msg.senderId ===
            userId
          ) {
            return msg;
          }

          return {
            ...msg,
            isRead: true,
          };
        }),
    );

    // ------------------------------------------------
    // Update conversation list
    // ------------------------------------------------

    setConversations(
      (currentConversations) =>
        currentConversations.map(
          (item) => {
            if (
              item.id !==
                conversationId ||
              !item.lastMessage
            ) {
              return item;
            }

            if (
              item.lastMessage.senderId ===
              userId
            ) {
              return item;
            }

            return {
              ...item,
              lastMessage: {
                ...item.lastMessage,
                isRead: true,
              },
            };
          },
        ),
    );

    // ------------------------------------------------
    // Update currently open conversation
    // ------------------------------------------------

    setConversation(
      (currentConversation) => {
        if (
          !currentConversation ||
          currentConversation.id !==
            conversationId ||
          !currentConversation.lastMessage
        ) {
          return currentConversation;
        }

        if (
          currentConversation.lastMessage.senderId ===
          userId
        ) {
          return currentConversation;
        }

        return {
          ...currentConversation,
          lastMessage: {
            ...currentConversation.lastMessage,
            isRead: true,
          },
        };
      },
    );
  }

  // --------------------------------------------------
  // Mark conversation messages as read
  // --------------------------------------------------

  async function markConversationAsRead(
    conversationId: string,
  ) {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    const userId =
      currentUserRef.current?.id ??
      getStoredUserId();

    if (!token || !userId) {
      return;
    }

    const socket =
      socketRef.current;

    // ------------------------------------------------
    // Preferred method:
    // WebSocket
    //
    // This lets the backend:
    //
    // 1. Mark messages as read
    // 2. Emit "messagesRead"
    // 3. Notify the sender immediately
    // ------------------------------------------------

    if (
      socket &&
      socket.connected
    ) {
      console.log(
        "Sending markConversationAsRead through WebSocket:",
        conversationId,
      );

      socket.emit(
        "markConversationAsRead",
        {
          conversationId,
        },
        (
          response: {
            message?: string;
            count?: number;
            error?: string;
          },
        ) => {
          console.log(
            "Read receipt response:",
            response,
          );

          if (
            response?.error
          ) {
            console.error(
              "Could not mark messages as read:",
              response.error,
            );

            return;
          }

          console.log(
            "Messages marked as read:",
            response,
          );
        },
      );

      // ------------------------------------------------
      // Update the receiver's UI immediately.
      // ------------------------------------------------

      updateConversationReadState(
        conversationId,
        userId,
      );

      return;
    }

    // ------------------------------------------------
    // REST fallback
    //
    // This is only used if the WebSocket has not
    // connected yet.
    // ------------------------------------------------

    console.log(
      "WebSocket not connected. Using REST fallback.",
    );

    try {
      const response =
        await fetch(
          `http://localhost:3001/messages/${conversationId}/read`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "Could not mark messages as read:",
          data,
        );

        return;
      }

      console.log(
        "Messages marked as read through REST:",
        data,
      );

      updateConversationReadState(
        conversationId,
        userId,
      );
    } catch (error) {
      console.error(
        "Failed to mark messages as read:",
        error,
      );
    }
  }

  // --------------------------------------------------
  // Notification helpers
  // --------------------------------------------------

  const unreadNotificationCount =
    notifications.filter(
      (notification) =>
        !notification.isRead,
    ).length;

  async function loadNotifications() {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setLoadingNotifications(false);
      return;
    }

    try {
      setLoadingNotifications(true);

      const response =
        await fetch(
          "http://localhost:3001/notifications",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load notifications",
        );
      }

      setNotifications(data);

      console.log(
        "Notifications loaded:",
        data,
      );
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error,
      );
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function markNotificationAsRead(
    notificationId: string,
  ) {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );
      return;
    }

    try {
      setProcessingNotificationId(
        notificationId,
      );

      const response =
        await fetch(
          `http://localhost:3001/notifications/${notificationId}/read`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not mark notification as read",
        );
      }

      setNotifications(
        (currentNotifications) =>
          currentNotifications.map(
            (notification) =>
              notification.id ===
              notificationId
                ? {
                    ...notification,
                    isRead: true,
                  }
                : notification,
          ),
      );
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error,
      );

      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      }
    } finally {
      setProcessingNotificationId(
        null,
      );
    }
  }

  async function markAllNotificationsAsRead() {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );
      return;
    }

    try {
      const response =
        await fetch(
          "http://localhost:3001/notifications/read-all",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not mark all notifications as read",
        );
      }

      setNotifications(
        (currentNotifications) =>
          currentNotifications.map(
            (notification) => ({
              ...notification,
              isRead: true,
            }),
          ),
      );

      console.log(
        "All notifications marked as read:",
        data,
      );
    } catch (error) {
      console.error(
        "Failed to mark all notifications as read:",
        error,
      );

      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      }
    }
  }

  // --------------------------------------------------
  // Load current user + friends + conversations
  // + friend requests + notifications + connect WebSocket
  // --------------------------------------------------

  useEffect(() => {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    const storedUser =
      localStorage.getItem("user");

    if (!token) {
      console.error(
        "No access token found",
      );

      setError(
        "Please login first.",
      );

      setLoadingFriends(false);
      setLoadingConversations(false);
      setLoadingRequests(false);

      return;
    }

    // --------------------------------------------------
    // Current user
    // --------------------------------------------------

    if (storedUser) {
      try {
        const parsedUser =
          JSON.parse(storedUser);

        setCurrentUser(
          parsedUser,
        );

        currentUserRef.current =
          parsedUser;
      } catch {
        console.error(
          "Could not read stored user",
        );
      }
    }

    // --------------------------------------------------
    // Load friends
    // --------------------------------------------------

    async function loadFriends() {
      try {
        const response =
          await fetch(
            "http://localhost:3001/friends",
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load friends",
          );
        }

        setFriends(data);

        console.log(
          "Friends loaded:",
          data,
        );
      } catch (error) {
        console.error(
          "Failed to load friends:",
          error,
        );

        if (
          error instanceof Error
        ) {
          setError(
            error.message,
          );
        } else {
          setError(
            "Could not load friends",
          );
        }
      } finally {
        setLoadingFriends(false);
      }
    }

    // --------------------------------------------------
    // Load conversations
    // --------------------------------------------------

    async function loadConversations() {
      try {
        const response =
          await fetch(
            "http://localhost:3001/messages/conversations",
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load conversations",
          );
        }

        setConversations(data);

        console.log(
          "Conversations loaded:",
          data,
        );
      } catch (error) {
        console.error(
          "Failed to load conversations:",
          error,
        );

        if (
          error instanceof Error
        ) {
          setError(
            error.message,
          );
        } else {
          setError(
            "Could not load conversations",
          );
        }
      } finally {
        setLoadingConversations(false);
      }
    }

    // --------------------------------------------------
    // Load incoming friend requests
    // --------------------------------------------------

    async function loadFriendRequests() {
      try {
        const response =
          await fetch(
            "http://localhost:3001/friends/requests",
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load friend requests",
          );
        }

        setFriendRequests(data);

        console.log(
          "Friend requests loaded:",
          data,
        );
      } catch (error) {
        console.error(
          "Failed to load friend requests:",
          error,
        );

        if (
          error instanceof Error
        ) {
          setError(
            error.message,
          );
        } else {
          setError(
            "Could not load friend requests",
          );
        }
      } finally {
        setLoadingRequests(false);
      }
    }

    loadFriends();
    loadConversations();
    loadFriendRequests();
    loadNotifications();

    // --------------------------------------------------
    // WebSocket
    // --------------------------------------------------

    const socket =
      io(
        "http://localhost:3001",
        {
          auth: {
            token,
          },
        },
      );

    socketRef.current =
      socket;

    socket.on(
      "connect",
      () => {
        console.log(
          "Connected to WebSocket",
        );

        setConnected(true);
        setError("");
      },
    );

    // --------------------------------------------------
    // Online / offline presence
    // --------------------------------------------------

    socket.on(
      "onlineUsers",
      (data: {
        userIds: string[];
      }) => {
        console.log(
          "Currently online users:",
          data.userIds,
        );

        setOnlineUsers(
          new Set(
            data.userIds,
          ),
        );
      },
    );

    socket.on(
      "userOnline",
      (data: {
        userId: string;
      }) => {
        console.log(
          "User came online:",
          data.userId,
        );

        setOnlineUsers(
          (currentUsers) => {
            const updatedUsers =
              new Set(
                currentUsers,
              );

            updatedUsers.add(
              data.userId,
            );

            return updatedUsers;
          },
        );
      },
    );

    socket.on(
      "userOffline",
      (data: {
        userId: string;
      }) => {
        console.log(
          "User went offline:",
          data.userId,
        );

        setOnlineUsers(
          (currentUsers) => {
            const updatedUsers =
              new Set(
                currentUsers,
              );

            updatedUsers.delete(
              data.userId,
            );

            return updatedUsers;
          },
        );
      },
    );

    // --------------------------------------------------
    // MESSAGES READ
    //
    // This event is sent by the backend to the sender
    // when the other user opens the conversation.
    // --------------------------------------------------

    socket.on(
      "messagesRead",
      (data: {
        conversationId: string;
        readBy: string;
      }) => {
        console.log(
          "Messages read event received:",
          data,
        );

        const userId =
          currentUserRef.current?.id ??
          getStoredUserId();

        if (!userId) {
          console.error(
            "Could not determine current user",
          );

          return;
        }

        // ------------------------------------------------
        // IMPORTANT:
        //
        // These are messages SENT BY ME.
        // The other user just read them.
        //
        // Therefore:
        //
        // false → true
        // ✓ Sent → ✓✓ Read
        // ------------------------------------------------

        setMessages(
          (currentMessages) =>
            currentMessages.map(
              (msg) => {
                if (
                  msg.conversationId !==
                  data.conversationId
                ) {
                  return msg;
                }

                if (
                  msg.senderId !==
                  userId
                ) {
                  return msg;
                }

                return {
                  ...msg,
                  isRead: true,
                };
              },
            ),
        );

        // ------------------------------------------------
        // Update conversation list
        // ------------------------------------------------

        setConversations(
          (currentConversations) =>
            currentConversations.map(
              (item) => {
                if (
                  item.id !==
                    data.conversationId ||
                  !item.lastMessage
                ) {
                  return item;
                }

                if (
                  item.lastMessage.senderId !==
                  userId
                ) {
                  return item;
                }

                return {
                  ...item,
                  lastMessage: {
                    ...item.lastMessage,
                    isRead: true,
                  },
                };
              },
            ),
        );

        // ------------------------------------------------
        // Update current conversation
        // ------------------------------------------------

        setConversation(
          (currentConversation) => {
            if (
              !currentConversation ||
              currentConversation.id !==
                data.conversationId ||
              !currentConversation.lastMessage
            ) {
              return currentConversation;
            }

            if (
              currentConversation.lastMessage.senderId !==
              userId
            ) {
              return currentConversation;
            }

            return {
              ...currentConversation,
              lastMessage: {
                ...currentConversation.lastMessage,
                isRead: true,
              },
            };
          },
        );
      },
    );

    // --------------------------------------------------
    // TYPING INDICATOR
    // --------------------------------------------------

    socket.on(
      "userTyping",
      (data: {
        conversationId: string;
        userId: string;
      }) => {
        const activeConversation =
          conversationRef.current;

        if (
          !activeConversation ||
          activeConversation.id !==
            data.conversationId
        ) {
          return;
        }

        const userId =
          currentUserRef.current?.id ??
          getStoredUserId();

        if (!userId || data.userId === userId) {
          return;
        }

        console.log(
          "Other user is typing:",
          data,
        );

        setIsOtherUserTyping(true);
      },
    );

    socket.on(
      "userStoppedTyping",
      (data: {
        conversationId: string;
        userId: string;
      }) => {
        const activeConversation =
          conversationRef.current;

        if (
          !activeConversation ||
          activeConversation.id !==
            data.conversationId
        ) {
          return;
        }

        const userId =
          currentUserRef.current?.id ??
          getStoredUserId();

        if (!userId || data.userId === userId) {
          return;
        }

        console.log(
          "Other user stopped typing:",
          data,
        );

        setIsOtherUserTyping(false);
      },
    );

    // --------------------------------------------------
    // NEW MESSAGE
    // --------------------------------------------------

    socket.on(
      "newNotification",
      (newNotification: Notification) => {
        console.log(
          "Real-time notification received:",
          newNotification,
        );

        setNotifications(
          (currentNotifications) => {
            const alreadyExists =
              currentNotifications.some(
                (notification) =>
                  notification.id ===
                  newNotification.id,
              );

            if (alreadyExists) {
              return currentNotifications;
            }

            return [
              newNotification,
              ...currentNotifications,
            ];
          },
        );
      },
    );

    socket.on(
      "newMessage",
      (newMessage: Message) => {
        console.log(
          "New message received:",
          newMessage,
        );

        const activeConversation =
          conversationRef.current;

        const userId =
          currentUserRef.current?.id ??
          getStoredUserId();

        // ------------------------------------------------
        // Is this conversation currently open?
        // ------------------------------------------------

        const isConversationOpen =
          activeConversation?.id ===
          newMessage.conversationId;

        // ------------------------------------------------
        // Is this an incoming message?
        // ------------------------------------------------

        const isIncomingMessage =
          newMessage.senderId !==
          userId;

        // ------------------------------------------------
        // If conversation is open and the message is
        // incoming, mark it read immediately.
        // ------------------------------------------------

        const shouldMarkAsRead =
          isConversationOpen &&
          isIncomingMessage;

        const messageForState =
          shouldMarkAsRead
            ? {
                ...newMessage,
                isRead: true,
              }
            : newMessage;

        // ------------------------------------------------
        // Add message to currently open conversation
        // ------------------------------------------------

        if (
          isConversationOpen
        ) {
          // Only auto-scroll when the user is already near the bottom.
          // If they are reading older messages, keep their position and
          // show a new-message indicator instead.
          if (isNearBottomRef.current) {
            shouldScrollToBottomRef.current = true;
          } else if (isIncomingMessage) {
            setNewMessageCount((count) => count + 1);
          }

          setMessages(
            (currentMessages) => {
              const alreadyExists =
                currentMessages.some(
                  (existingMessage) =>
                    existingMessage.id ===
                    newMessage.id,
                );

              if (
                alreadyExists
              ) {
                return currentMessages;
              }

              return [
                ...currentMessages,
                messageForState,
              ];
            },
          );
        }

        // ------------------------------------------------
        // Update conversation list
        // ------------------------------------------------

        setConversations(
          (currentConversations) => {
            const exists =
              currentConversations.some(
                (item) =>
                  item.id ===
                  newMessage.conversationId,
              );

            if (!exists) {
              return currentConversations;
            }

            const updated =
              currentConversations.map(
                (item) =>
                  item.id ===
                  newMessage.conversationId
                    ? {
                        ...item,
                        lastMessage:
                          messageForState,
                        updatedAt:
                          newMessage.createdAt,
                      }
                    : item,
              );

            return updated.sort(
              (a, b) =>
                new Date(
                  b.updatedAt,
                ).getTime() -
                new Date(
                  a.updatedAt,
                ).getTime(),
            );
          },
        );

        // ------------------------------------------------
        // Mark incoming message as read if the
        // conversation is currently open.
        // ------------------------------------------------

        if (
          shouldMarkAsRead
        ) {
          console.log(
            "Conversation is open. Marking incoming message as read.",
          );

          void markConversationAsRead(
            newMessage.conversationId,
          );
        } else {
          console.log(
            "Conversation is NOT open. Keeping message unread.",
          );
        }
      },
    );

    // --------------------------------------------------
    // MESSAGE REACTION UPDATED
    // --------------------------------------------------

    socket.on(
      "messageReactionUpdated",
      (data: {
        action: "added" | "removed";
        reaction: MessageReaction | {
          messageId: string;
          userId: string;
        };
      }) => {
        console.log(
          "Message reaction update received:",
          data,
        );

        const messageId = data.reaction.messageId;

        setMessages(
          (currentMessages) =>
            currentMessages.map((msg) => {
              if (msg.id !== messageId) {
                return msg;
              }

              const currentReactions =
                msg.reactions ?? [];

              if (data.action === "removed") {
                return {
                  ...msg,
                  reactions: currentReactions.filter(
                    (reaction) =>
                      !(
                        reaction.messageId === messageId &&
                        reaction.userId === data.reaction.userId
                      ),
                  ),
                };
              }

              const newReaction =
                data.reaction as MessageReaction;

              const reactionsWithoutUser =
                currentReactions.filter(
                  (reaction) =>
                    reaction.userId !==
                    newReaction.userId,
                );

              return {
                ...msg,
                reactions: [
                  ...reactionsWithoutUser,
                  newReaction,
                ],
              };
            }),
        );

        // Keep the sidebar preview in sync if this message
        // is the latest message in the conversation.
        setConversations(
          (currentConversations) =>
            currentConversations.map((item) => {
              if (item.lastMessage?.id !== messageId) {
                return item;
              }

              const currentReactions =
                item.lastMessage.reactions ?? [];

              const updatedReactions =
                data.action === "removed"
                  ? currentReactions.filter(
                      (reaction) =>
                        !(
                          reaction.messageId === messageId &&
                          reaction.userId === data.reaction.userId
                        ),
                    )
                  : [
                      ...currentReactions.filter(
                        (reaction) =>
                          reaction.userId !==
                          data.reaction.userId,
                      ),
                      data.reaction as MessageReaction,
                    ];

              return {
                ...item,
                lastMessage: {
                  ...item.lastMessage,
                  reactions: updatedReactions,
                },
              };
            }),
        );

        setConversation(
          (currentConversation) => {
            if (
              !currentConversation ||
              currentConversation.lastMessage?.id !==
                messageId
            ) {
              return currentConversation;
            }

            const currentReactions =
              currentConversation.lastMessage.reactions ?? [];

            const updatedReactions =
              data.action === "removed"
                ? currentReactions.filter(
                    (reaction) =>
                      !(
                        reaction.messageId === messageId &&
                        reaction.userId === data.reaction.userId
                      ),
                  )
                : [
                    ...currentReactions.filter(
                      (reaction) =>
                        reaction.userId !==
                        data.reaction.userId,
                    ),
                    data.reaction as MessageReaction,
                  ];

            return {
              ...currentConversation,
              lastMessage: {
                ...currentConversation.lastMessage,
                reactions: updatedReactions,
              },
            };
          },
        );
      },
    );

    // --------------------------------------------------
    // MESSAGE EDITED
    // --------------------------------------------------

    socket.on(
      "messageEdited",
      (updatedMessage: Message) => {
        console.log(
          "Edited message received:",
          updatedMessage,
        );

        setMessages(
          (currentMessages) =>
            currentMessages.map(
              (msg) =>
                msg.id === updatedMessage.id
                  ? updatedMessage
                  : msg,
            ),
        );

        setEditedMessageIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(updatedMessage.id);
          return nextIds;
        });

        setConversations(
          (currentConversations) =>
            currentConversations.map(
              (item) =>
                item.id ===
                  updatedMessage.conversationId &&
                item.lastMessage?.id ===
                  updatedMessage.id
                  ? {
                      ...item,
                      lastMessage:
                        updatedMessage,
                    }
                  : item,
            ),
        );

        setConversation(
          (currentConversation) => {
            if (
              !currentConversation ||
              currentConversation.id !==
                updatedMessage.conversationId ||
              currentConversation.lastMessage?.id !==
                updatedMessage.id
            ) {
              return currentConversation;
            }

            return {
              ...currentConversation,
              lastMessage: updatedMessage,
            };
          },
        );

        if (
          editingMessageId ===
          updatedMessage.id
        ) {
          setEditingMessageId(null);
          setEditingMessageContent("");
          setSavingEditedMessage(false);
        }
      },
    );

    // --------------------------------------------------
    // MESSAGE DELETED
    // --------------------------------------------------

    socket.on(
      "messageDeleted",
      (data: {
        messageId: string;
        conversationId: string;
      }) => {
        console.log(
          "Deleted message received:",
          data,
        );

        setMessages(
          (currentMessages) =>
            currentMessages.filter(
              (msg) => msg.id !== data.messageId,
            ),
        );

        // If the deleted message is the current sidebar
        // preview, refresh conversations so the preview
        // shows the real latest remaining message.
        setConversations((currentConversations) => {
          const item = currentConversations.find(
            (conversationItem) =>
              conversationItem.id === data.conversationId,
          );

          if (
            !item ||
            item.lastMessage?.id !== data.messageId
          ) {
            return currentConversations;
          }

          return currentConversations.map((conversationItem) =>
            conversationItem.id === data.conversationId
              ? {
                  ...conversationItem,
                  lastMessage: null,
                }
              : conversationItem,
          );
        });

        setConversation((currentConversation) => {
          if (
            !currentConversation ||
            currentConversation.id !== data.conversationId ||
            currentConversation.lastMessage?.id !== data.messageId
          ) {
            return currentConversation;
          }

          return {
            ...currentConversation,
            lastMessage: null,
          };
        });

        if (deletingMessageId === data.messageId) {
          setDeletingMessageId(null);
        }
      },
    );


    // --------------------------------------------------
    // MESSAGE PINNED
    // --------------------------------------------------

    socket.on(
      "messagePinned",
      (updatedMessage: Message) => {
        console.log(
          "Message pinned received:",
          updatedMessage,
        );

        const activeConversation =
          conversationRef.current;

        // Ignore updates for another conversation.
        if (
          !activeConversation ||
          activeConversation.id !==
            updatedMessage.conversationId
        ) {
          return;
        }

        updatePinnedMessageInState(
          updatedMessage,
        );
      },
    );

    // --------------------------------------------------
    // MESSAGE UNPINNED
    // --------------------------------------------------

    socket.on(
      "messageUnpinned",
      (updatedMessage: Message) => {
        console.log(
          "Message unpinned received:",
          updatedMessage,
        );

        const activeConversation =
          conversationRef.current;

        // Ignore updates for another conversation.
        if (
          !activeConversation ||
          activeConversation.id !==
            updatedMessage.conversationId
        ) {
          return;
        }

        updatePinnedMessageInState(
          updatedMessage,
        );
      },
    );

    // --------------------------------------------------
    // WebSocket connection error
    // --------------------------------------------------

    socket.on(
      "connect_error",
      (socketError) => {
        console.error(
          "WebSocket connection error:",
          socketError.message,
        );

        setConnected(false);

        setError(
          "WebSocket error: " +
            socketError.message,
        );
      },
    );

    // --------------------------------------------------
    // WebSocket disconnect
    // --------------------------------------------------

    socket.on(
      "disconnect",
      () => {
        console.log(
          "Disconnected from WebSocket",
        );

        setConnected(false);
      },
    );

    // --------------------------------------------------
    // Cleanup
    // --------------------------------------------------

    return () => {
      socket.off(
        "onlineUsers",
      );

      socket.off(
        "userOnline",
      );

      socket.off(
        "userOffline",
      );

      socket.off(
        "newNotification",
      );

      socket.off(
        "userTyping",
      );

      socket.off(
        "userStoppedTyping",
      );

      socket.off(
        "messagesRead",
      );

      socket.off(
        "newMessage",
      );

      socket.off(
        "messageEdited",
      );

      socket.off(
        "messageDeleted",
      );

      socket.off(
        "messageReactionUpdated",
      );

      socket.off(
        "messagePinned",
      );

      socket.off(
        "messageUnpinned",
      );

      socket.off(
        "connect",
      );

      socket.off(
        "connect_error",
      );

      socket.off(
        "disconnect",
      );

      if (typingTimeoutRef.current) {
        clearTimeout(
          typingTimeoutRef.current,
        );

        typingTimeoutRef.current = null;
      }

      socket.disconnect();

      if (
        socketRef.current ===
        socket
      ) {
        socketRef.current =
          null;
      }
    };
  }, []);

  // --------------------------------------------------
  // Open conversation when friend is selected
  // --------------------------------------------------

  useEffect(() => {
    if (!selectedFriend) {
      return;
    }

    void loadBlockStatus(
      selectedFriend.id,
    );

    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    async function openConversation() {
      setLoadingConversation(
        true,
      );

      setError("");
      stopTyping();
      setIsOtherUserTyping(false);

      setMessages([]);
      setHasMoreMessages(false);
      setNextMessageCursor(null);
      setLoadingOlderMessages(false);
      loadingOlderMessagesRef.current = false;
      restoreScrollPositionRef.current = null;
      shouldScrollToBottomRef.current = true;
      isNearBottomRef.current = true;
      setIsNearBottom(true);
      setNewMessageCount(0);

      setConversation(null);
      setEditingMessageId(null);
      setEditingMessageContent("");
      setSavingEditedMessage(false);
      setDeletingMessageId(null);
      setDeleteMessageMenuId(null);
      setReplyingToMessage(null);
      setReactionPickerMessageId(null);
      setSelectedAttachment(null);
      setPinnedMessages([]);
      setShowPinnedMessages(false);
      setLoadingPinnedMessages(false);
      setProcessingPinnedMessageId(null);

      clearMessageSearch();

      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }

      // ------------------------------------------------
      // Clear active conversation immediately.
      // ------------------------------------------------

      conversationRef.current =
        null;

      try {
        console.log(
          "Opening conversation with:",
          selectedFriend?.username,
        );

        // ------------------------------------------------
        // Get or create conversation
        // ------------------------------------------------

        const conversationResponse =
          await fetch(
            `http://localhost:3001/messages/conversations/${selectedFriend?.id}`,
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const conversationData =
          await conversationResponse.json();

        if (
          !conversationResponse.ok
        ) {
          throw new Error(
            conversationData.message ||
              "Could not open conversation",
          );
        }

        console.log(
          "Conversation:",
          conversationData,
        );

        const existingConversation =
          conversations.find(
            (item) =>
              item.id ===
              conversationData.id,
          );

        const conversationForState:
          Conversation =
          existingConversation ?? {
            id: conversationData.id,
            otherUser:
              selectedFriend,
            lastMessage: null,
            createdAt:
              conversationData.createdAt,
            updatedAt:
              conversationData.updatedAt,
          };

        setConversation(
          conversationForState,
        );

        // ------------------------------------------------
        // IMPORTANT:
        //
        // Set the ref immediately so that new incoming
        // messages know this conversation is open.
        // ------------------------------------------------

        conversationRef.current =
          conversationForState;

        // ------------------------------------------------
        // Add conversation to list if needed
        // ------------------------------------------------

        if (
          !existingConversation
        ) {
          setConversations(
            (currentConversations) => {
              const alreadyExists =
                currentConversations.some(
                  (item) =>
                    item.id ===
                    conversationForState.id,
                );

              if (
                alreadyExists
              ) {
                return currentConversations;
              }

              return [
                conversationForState,
                ...currentConversations,
              ];
            },
          );
        }

        // ------------------------------------------------
        // Load message history
        // ------------------------------------------------

        const messagesResponse =
          await fetch(
            `http://localhost:3001/messages/${conversationData.id}?limit=10`,
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const messagesData =
          await messagesResponse.json();

        if (
          !messagesResponse.ok
        ) {
          throw new Error(
            messagesData.message ||
              "Could not load messages",
          );
        }

        console.log(
          "Conversation messages:",
          messagesData,
        );

        setMessages(
          messagesData.messages,
        );

        setHasMoreMessages(
          messagesData.hasMore === true,
        );

        setNextMessageCursor(
          messagesData.nextCursor ?? null,
        );

        shouldScrollToBottomRef.current = true;
        isNearBottomRef.current = true;
        setIsNearBottom(true);
        setNewMessageCount(0);

        // ------------------------------------------------
        // IMPORTANT:
        //
        // User has now opened the conversation.
        //
        // This uses WebSocket and causes the backend
        // to send "messagesRead" to the other user.
        // ------------------------------------------------

        await markConversationAsRead(
          conversationData.id,
        );

        void loadPinnedMessages(
          conversationData.id,
        );

        // ------------------------------------------------
        // Join Socket.IO conversation room
        // ------------------------------------------------

        const socket =
          socketRef.current;

        if (
          socket &&
          socket.connected
        ) {
          socket.emit(
            "joinConversation",
            {
              conversationId:
                conversationData.id,
            },
          );

          console.log(
            "Joined conversation:",
            conversationData.id,
          );
        }
      } catch (error) {
        console.error(
          "Failed to open conversation:",
          error,
        );

        if (
          error instanceof Error
        ) {
          setError(
            error.message,
          );
        } else {
          setError(
            "Could not open conversation",
          );
        }
      } finally {
        setLoadingConversation(
          false,
        );
      }
    }

    openConversation();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFriend]);

  // --------------------------------------------------
  // Join conversation after socket connects
  // --------------------------------------------------

  useEffect(() => {
    const socket =
      socketRef.current;

    if (
      !socket ||
      !connected ||
      !conversation
    ) {
      return;
    }

    socket.emit(
      "joinConversation",
      {
        conversationId:
          conversation.id,
      },
    );

    console.log(
      "Joined conversation:",
      conversation.id,
    );
  }, [
    connected,
    conversation,
  ]);

  // --------------------------------------------------
  // Message scroll handling
  // --------------------------------------------------

  useEffect(() => {
    const container =
      messagesContainerRef.current;

    const restorePosition =
      restoreScrollPositionRef.current;

    if (container && restorePosition) {
      const heightDifference =
        container.scrollHeight -
        restorePosition.scrollHeight;

      container.scrollTop =
        restorePosition.scrollTop +
        heightDifference;

      restoreScrollPositionRef.current = null;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });

      shouldScrollToBottomRef.current = false;
    }
  }, [messages]);

  async function loadOlderMessages() {
    if (
      loadingOlderMessagesRef.current ||
      !hasMoreMessages ||
      !nextMessageCursor
    ) {
      return;
    }

    const token =
      localStorage.getItem("accessToken");

    const activeConversation =
      conversationRef.current;

    if (!token || !activeConversation) {
      return;
    }

    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    loadingOlderMessagesRef.current = true;
    setLoadingOlderMessages(true);
    setError("");

    const previousScrollHeight =
      container.scrollHeight;

    const previousScrollTop =
      container.scrollTop;

    try {
      const response = await fetch(
        `http://localhost:3001/messages/${activeConversation.id}?limit=30&before=${encodeURIComponent(nextMessageCursor)}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load older messages",
        );
      }

      if (
        conversationRef.current?.id !==
        activeConversation.id
      ) {
        return;
      }

      restoreScrollPositionRef.current = {
        scrollHeight:
          previousScrollHeight,
        scrollTop:
          previousScrollTop,
      };

      setMessages(
        (currentMessages) => {
          const existingIds =
            new Set(
              currentMessages.map(
                (msg) => msg.id,
              ),
            );

          const olderMessages =
            (data.messages ?? []).filter(
              (msg: Message) =>
                !existingIds.has(msg.id),
            );

          return [
            ...olderMessages,
            ...currentMessages,
          ];
        },
      );

      setHasMoreMessages(
        data.hasMore === true,
      );

      setNextMessageCursor(
        data.nextCursor ?? null,
      );
    } catch (error) {
      console.error(
        "Failed to load older messages:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Could not load older messages",
      );

      restoreScrollPositionRef.current =
        null;
    } finally {
      loadingOlderMessagesRef.current = false;
      setLoadingOlderMessages(false);
    }
  }

  function handleMessagesScroll(
    event: React.UIEvent<HTMLDivElement>,
  ) {
    const container =
      event.currentTarget;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    const nearBottom = distanceFromBottom <= 120;

    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);

    if (nearBottom && newMessageCount > 0) {
      setNewMessageCount(0);
    }

    if (
      container.scrollTop <= 80 &&
      hasMoreMessages &&
      !loadingOlderMessagesRef.current
    ) {
      void loadOlderMessages();
    }
  }

  function scrollToLatestMessages() {
    shouldScrollToBottomRef.current = false;
    isNearBottomRef.current = true;
    setIsNearBottom(true);
    setNewMessageCount(0);

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }

  // --------------------------------------------------
  // Search messages in current conversation
  // --------------------------------------------------

  async function searchMessages() {
    const query = messageSearchQuery.trim();
    const activeConversation =
      conversationRef.current;

    if (!activeConversation) {
      setError("Please open a conversation first.");
      return;
    }

    if (!query) {
      setMessageSearchResults([]);
      return;
    }

    const token =
      localStorage.getItem("accessToken");

    if (!token) {
      setError("Please login first.");
      return;
    }

    try {
      setSearchingMessages(true);
      setError("");

      const response = await fetch(
        `http://localhost:3001/messages/${activeConversation.id}/search?q=${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not search messages",
        );
      }

      if (
        conversationRef.current?.id !==
        activeConversation.id
      ) {
        return;
      }

      setMessageSearchResults(
        data.messages ?? [],
      );

      console.log(
        "Message search results:",
        data,
      );
    } catch (error) {
      console.error(
        "Message search failed:",
        error,
      );

      setMessageSearchResults([]);

      setError(
        error instanceof Error
          ? error.message
          : "Could not search messages",
      );
    } finally {
      setSearchingMessages(false);
    }
  }

  function clearMessageSearch() {
    setMessageSearchQuery("");
    setMessageSearchResults([]);
    setSearchingMessageId(null);
  }

  function scrollToLoadedMessage(
    messageId: string,
  ) {
    const element =
      document.getElementById(
        `message-${messageId}`,
      );

    if (!element) {
      return false;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setSearchingMessageId(messageId);

    window.setTimeout(() => {
      setSearchingMessageId((currentId) =>
        currentId === messageId
          ? null
          : currentId,
      );
    }, 1200);

    return true;
  }

  async function jumpToSearchResult(
    targetMessage: Message,
  ) {
    const activeConversation =
      conversationRef.current;

    if (
      !activeConversation ||
      targetMessage.conversationId !==
        activeConversation.id
    ) {
      return;
    }

    setError("");
    setSearchingMessageId(
      targetMessage.id,
    );

    // If the message is already loaded, jump to it immediately.
    if (
      scrollToLoadedMessage(
        targetMessage.id,
      )
    ) {
      setMessageSearchResults([]);
      return;
    }

    const token =
      localStorage.getItem("accessToken");

    if (!token) {
      setError("Please login first.");
      setSearchingMessageId(null);
      return;
    }

    // The search endpoint searches the whole conversation,
    // but the UI only keeps a paginated portion in memory.
    // Keep loading older pages until the target is found.
    let cursor = nextMessageCursor;
    let more = hasMoreMessages;

    if (!cursor || !more) {
      setError(
        "This message is not currently loaded.",
      );
      setSearchingMessageId(null);
      return;
    }

    try {
      while (more && cursor) {
        const response = await fetch(
          `http://localhost:3001/messages/${activeConversation.id}?limit=30&before=${encodeURIComponent(cursor)}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load older messages",
          );
        }

        if (
          conversationRef.current?.id !==
          activeConversation.id
        ) {
          return;
        }

        const olderMessages =
          (data.messages ?? []) as Message[];

        setMessages(
          (currentMessages) => {
            const existingIds =
              new Set(
                currentMessages.map(
                  (msg) => msg.id,
                ),
              );

            return [
              ...olderMessages.filter(
                (msg) =>
                  !existingIds.has(msg.id),
              ),
              ...currentMessages,
            ];
          },
        );

        more = data.hasMore === true;
        cursor = data.nextCursor ?? null;

        setHasMoreMessages(more);
        setNextMessageCursor(cursor);

        if (
          olderMessages.some(
            (msg) =>
              msg.id ===
              targetMessage.id,
          )
        ) {
          // Give React time to render the newly loaded message.
          window.setTimeout(() => {
            scrollToLoadedMessage(
              targetMessage.id,
            );
            setMessageSearchResults([]);
          }, 0);

          return;
        }
      }

      setError(
        "Could not find that message in the loaded conversation.",
      );
      setSearchingMessageId(null);
    } catch (error) {
      console.error(
        "Failed to jump to searched message:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Could not open searched message",
      );

      setSearchingMessageId(null);
    }
  }

  // --------------------------------------------------
  // Message pinning
  // --------------------------------------------------

  function updatePinnedMessageInState(
    updatedMessage: Message,
  ) {
    setMessages((currentMessages) =>
      currentMessages.map((msg) =>
        msg.id === updatedMessage.id
          ? updatedMessage
          : msg,
      ),
    );

    setConversations((currentConversations) =>
      currentConversations.map((item) =>
        item.lastMessage?.id === updatedMessage.id
          ? { ...item, lastMessage: updatedMessage }
          : item,
      ),
    );

    setConversation((currentConversation) => {
      if (
        !currentConversation ||
        currentConversation.lastMessage?.id !==
          updatedMessage.id
      ) {
        return currentConversation;
      }

      return { ...currentConversation, lastMessage: updatedMessage };
    });

    setPinnedMessages((currentPinnedMessages) => {
      const exists = currentPinnedMessages.some(
        (msg) => msg.id === updatedMessage.id,
      );

      if (updatedMessage.isPinned && !exists) {
        return [...currentPinnedMessages, updatedMessage];
      }

      if (!updatedMessage.isPinned) {
        return currentPinnedMessages.filter(
          (msg) => msg.id !== updatedMessage.id,
        );
      }

      return currentPinnedMessages.map((msg) =>
        msg.id === updatedMessage.id
          ? updatedMessage
          : msg,
      );
    });
  }

  async function loadPinnedMessages(
    conversationId: string,
  ) {
    const token = localStorage.getItem("accessToken");

    if (!token) return;

    try {
      setLoadingPinnedMessages(true);

      const response = await fetch(
        `http://localhost:3001/messages/${conversationId}/pinned`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load pinned messages",
        );
      }

      if (conversationRef.current?.id !== conversationId) {
        return;
      }

      setPinnedMessages(data ?? []);
    } catch (error) {
      console.error("Failed to load pinned messages:", error);

      if (error instanceof Error) {
        setError(error.message);
      }
    } finally {
      setLoadingPinnedMessages(false);
    }
  }

  async function togglePinMessage(msg: Message) {
    const token = localStorage.getItem("accessToken");
    const activeConversation = conversationRef.current;

    if (!token || !activeConversation) {
      setError("Please open a conversation first.");
      return;
    }

    if (msg.conversationId !== activeConversation.id) return;
    if (processingPinnedMessageId) return;

    const wasPinned = msg.isPinned;
    const action = wasPinned ? "unpin" : "pin";

    try {
      setProcessingPinnedMessageId(msg.id);
      setError("");

      const response = await fetch(
        `http://localhost:3001/messages/${msg.id}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Could not ${action} message`,
        );
      }

      updatePinnedMessageInState(data);
    } catch (error) {
      console.error(
        `Failed to ${action} message:`,
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Could not update message pin",
      );
    } finally {
      setProcessingPinnedMessageId(null);
    }
  }

  function jumpToPinnedMessage(messageId: string) {
    setShowPinnedMessages(false);

    const element = document.getElementById(
      `message-${messageId}`,
    );

    if (!element) {
      setError(
        "This pinned message is not currently loaded. Use message search to find it.",
      );
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setSearchingMessageId(messageId);

    window.setTimeout(() => {
      setSearchingMessageId((currentId) =>
        currentId === messageId ? null : currentId,
      );
    }, 1200);
  }

  // --------------------------------------------------
  // Search users
  // --------------------------------------------------

  async function searchUsers() {
    const username =
      searchUsername.trim();

    if (!username) {
      setSearchResults([]);
      setHasSearched(false);

      return;
    }

    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    try {
      setSearching(true);
      setHasSearched(false);
      setError("");

      const response =
        await fetch(
          `http://localhost:3001/users/search?username=${encodeURIComponent(username)}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not search users",
        );
      }

      setSearchResults(data);
      setHasSearched(true);

      console.log(
        "User search results:",
        data,
      );
    } catch (error) {
      console.error(
        "User search failed:",
        error,
      );

      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "Could not search users",
        );
      }
    } finally {
      setSearching(false);
    }
  }

  // --------------------------------------------------
  // Send friend request
  // --------------------------------------------------

  async function sendFriendRequest(
    receiverId: string,
  ) {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    try {
      setSendingRequestId(
        receiverId,
      );

      setError("");

      const response =
        await fetch(
          "http://localhost:3001/friends/request",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              receiverId,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not send friend request",
        );
      }

      console.log(
        "Friend request sent:",
        data,
      );

      setSearchResults(
        (currentResults) =>
          currentResults.filter(
            (user) =>
              user.id !==
              receiverId,
          ),
      );
    } catch (error) {
      console.error(
        "Failed to send friend request:",
        error,
      );

      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "Could not send friend request",
        );
      }
    } finally {
      setSendingRequestId(
        null,
      );
    }
  }

  // --------------------------------------------------
  // Accept friend request
  // --------------------------------------------------

  async function acceptFriendRequest(
    requestId: string,
  ) {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    try {
      setProcessingRequestId(
        requestId,
      );

      setError("");

      const response =
        await fetch(
          `http://localhost:3001/friends/requests/${requestId}/accept`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not accept friend request",
        );
      }

      console.log(
        "Friend request accepted:",
        data,
      );

      setFriendRequests(
        (currentRequests) =>
          currentRequests.filter(
            (request) =>
              request.id !==
              requestId,
          ),
      );

      const friendsResponse =
        await fetch(
          "http://localhost:3001/friends",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const friendsData =
        await friendsResponse.json();

      if (!friendsResponse.ok) {
        throw new Error(
          friendsData.message ||
            "Could not refresh friends",
        );
      }

      setFriends(
        friendsData,
      );
    } catch (error) {
      console.error(
        "Failed to accept friend request:",
        error,
      );

      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "Could not accept friend request",
        );
      }
    } finally {
      setProcessingRequestId(
        null,
      );
    }
  }

  // --------------------------------------------------
  // Reject friend request
  // --------------------------------------------------

  async function rejectFriendRequest(
    requestId: string,
  ) {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    try {
      setProcessingRequestId(
        requestId,
      );

      setError("");

      const response =
        await fetch(
          `http://localhost:3001/friends/requests/${requestId}/reject`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not reject friend request",
        );
      }

      console.log(
        "Friend request rejected:",
        data,
      );

      setFriendRequests(
        (currentRequests) =>
          currentRequests.filter(
            (request) =>
              request.id !==
              requestId,
          ),
      );
    } catch (error) {
      console.error(
        "Failed to reject friend request:",
        error,
      );

      if (
        error instanceof Error
      ) {
        setError(
          error.message,
        );
      } else {
        setError(
          "Could not reject friend request",
        );
      }
    } finally {
      setProcessingRequestId(
        null,
      );
    }
  }

  // --------------------------------------------------
  // Load profile
  // --------------------------------------------------

  async function loadProfile() {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    try {
      setLoadingProfile(true);
      setProfileMessage("");
      setError("");

      const response =
        await fetch(
          "http://localhost:3001/users/me",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load profile",
        );
      }

      setProfileDisplayName(
        data.displayName ||
          "",
      );

      setProfileAvatarUrl(
        data.avatarUrl ||
          "",
      );

      setCurrentUser(
        data,
      );

      currentUserRef.current =
        data;

      localStorage.setItem(
        "user",
        JSON.stringify(data),
      );
    } catch (error) {
      console.error(
        "Failed to load profile:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Could not load profile",
      );
    } finally {
      setLoadingProfile(false);
    }
  }

  // --------------------------------------------------
  // Update profile
  // --------------------------------------------------

  async function updateProfile() {
    const token =
      localStorage.getItem(
        "accessToken",
      );

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    const trimmedDisplayName =
      profileDisplayName.trim();

    if (!trimmedDisplayName) {
      setProfileMessage(
        "Display name cannot be empty.",
      );

      return;
    }

    try {
      setSavingProfile(true);
      setProfileMessage("");
      setError("");

      const response =
        await fetch(
          "http://localhost:3001/users/me",
          {
            method: "PATCH",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              displayName:
                trimmedDisplayName,

              avatarUrl:
                profileAvatarUrl.trim()
                  ? profileAvatarUrl.trim()
                  : null,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update profile",
        );
      }

      setCurrentUser(
        data.user,
      );

      currentUserRef.current =
        data.user;

      localStorage.setItem(
        "user",
        JSON.stringify(
          data.user,
        ),
      );

      setProfileDisplayName(
        data.user.displayName ||
          "",
      );

      setProfileAvatarUrl(
        data.user.avatarUrl ||
          "",
      );

      setProfileMessage(
        "Profile updated successfully.",
      );
    } catch (error) {
      console.error(
        "Failed to update profile:",
        error,
      );

      setProfileMessage(
        error instanceof Error
          ? error.message
          : "Could not update profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------

  function handleLogout() {
    console.log(
      "Logging out...",
    );

    const socket =
      socketRef.current;

    if (
      socket &&
      socket.connected
    ) {
      console.log(
        "Sending logout event to server...",
      );

      socket.emit(
        "logout",
      );

      setTimeout(() => {
        console.log(
          "Cleaning up local session...",
        );

        socket.disconnect();

        if (
          socketRef.current ===
          socket
        ) {
          socketRef.current =
            null;
        }

        localStorage.removeItem(
          "accessToken",
        );

        localStorage.removeItem(
          "refreshToken",
        );

        localStorage.removeItem(
          "user",
        );

        setConnected(false);
        setOnlineUsers(
          new Set(),
        );

        setCurrentUser(
          null,
        );

        setNotifications([]);
        setShowNotifications(false);

        setSelectedFriend(
          null,
        );

        setConversation(
          null,
        );

        setMessages([]);
        setReactionPickerMessageId(null);

        currentUserRef.current =
          null;

        conversationRef.current =
          null;

        window.location.href =
          "/login";
      }, 300);

      return;
    }

    console.log(
      "No active WebSocket. Cleaning up local session...",
    );

    localStorage.removeItem(
      "accessToken",
    );

    localStorage.removeItem(
      "refreshToken",
    );

    localStorage.removeItem(
      "user",
    );

    setConnected(false);

    setOnlineUsers(
      new Set(),
    );

    setCurrentUser(
      null,
    );

    setNotifications([]);
    setShowNotifications(false);

    setSelectedFriend(
      null,
    );

    setConversation(
      null,
    );

    setMessages([]);
    setReactionPickerMessageId(null);

    currentUserRef.current =
      null;

    conversationRef.current =
      null;

    window.location.href =
      "/login";
  }

  // --------------------------------------------------
  // Select conversation
  // --------------------------------------------------

  function selectConversation(
    selectedConversation: Conversation,
  ) {
    setSelectedFriend(
      selectedConversation.otherUser,
    );
  }

  // --------------------------------------------------
  // Block / Unblock user
  // --------------------------------------------------

  async function loadBlockStatus(
    userId: string,
  ) {
    const token =
      localStorage.getItem("accessToken");

    if (!token) {
      return;
    }

    try {
      const response =
        await fetch(
          `http://localhost:3001/blocks/${userId}`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not check block status",
        );
      }

      setIsBlocked(
        data.blocked === true,
      );
    } catch (error) {
      console.error(
        "Failed to load block status:",
        error,
      );
    }
  }

  async function toggleBlockUser() {
    if (!selectedFriend) {
      return;
    }

    const token =
      localStorage.getItem("accessToken");

    if (!token) {
      setError(
        "Please login first.",
      );

      return;
    }

    try {
      setProcessingBlock(true);
      setError("");

      const method =
        isBlocked
          ? "DELETE"
          : "POST";

      const response =
        await fetch(
          `http://localhost:3001/blocks/${selectedFriend.id}`,
          {
            method,
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update block status",
        );
      }

      setIsBlocked(
        !isBlocked,
      );

      if (!isBlocked) {
        stopTyping();
        setIsOtherUserTyping(false);
        setMessage("");
      }
    } catch (error) {
      console.error(
        "Failed to update block status:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Could not update block status",
      );
    } finally {
      setProcessingBlock(false);
    }
  }

  // --------------------------------------------------
  // Delete conversation
  // --------------------------------------------------

  async function deleteConversation() {
    if (!conversation) {
      return;
    }

    const confirmed = window.confirm(
      `Delete your conversation with ${selectedFriend?.displayName ?? "this user"}? This will permanently delete all messages in this conversation.`
    );

    if (!confirmed) {
      return;
    }

    const token =
      localStorage.getItem("accessToken");

    if (!token) {
      setError("Please login first.");
      return;
    }

    const conversationId = conversation.id;
    const socket = socketRef.current;

    try {
      setDeletingConversation(true);
      setError("");

      stopTyping();

      const response = await fetch(
        `http://localhost:3001/messages/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not delete conversation",
        );
      }

      // Leave the Socket.IO conversation room.
      if (socket && socket.connected) {
        socket.emit("leaveConversation", {
          conversationId,
        });
      }

      // Remove the conversation from the sidebar.
      setConversations((currentConversations) =>
        currentConversations.filter(
          (item) => item.id !== conversationId,
        ),
      );

      // Clear the open conversation.
      setConversation(null);
      conversationRef.current = null;
      setMessages([]);
      setMessage("");
      setIsOtherUserTyping(false);
      setIsBlocked(false);
      setEditingMessageId(null);
      setEditingMessageContent("");
      setSavingEditedMessage(false);
      setDeletingMessageId(null);
      setDeleteMessageMenuId(null);
      setReplyingToMessage(null);

      console.log(
        "Conversation deleted:",
        conversationId,
      );
    } catch (error) {
      console.error(
        "Failed to delete conversation:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Could not delete conversation",
      );
    } finally {
      setDeletingConversation(false);
    }
  }

  // --------------------------------------------------
  // Typing indicator
  // --------------------------------------------------

  function handleMessageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (isBlocked) {
      return;
    }

    const newMessage = event.target.value;

    setMessage(newMessage);

    const socket = socketRef.current;
    const activeConversation =
      conversationRef.current;

    if (
      !socket ||
      !socket.connected ||
      !activeConversation
    ) {
      return;
    }

    if (newMessage.length > 0) {
      socket.emit("typing", {
        conversationId:
          activeConversation.id,
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(
        typingTimeoutRef.current,
      );
    }

    typingTimeoutRef.current =
      setTimeout(() => {
        socket.emit("stopTyping", {
          conversationId:
            activeConversation.id,
        });

        typingTimeoutRef.current = null;
      }, 1000);

    if (newMessage.length === 0) {
      clearTimeout(
        typingTimeoutRef.current,
      );

      typingTimeoutRef.current = null;

      socket.emit("stopTyping", {
        conversationId:
          activeConversation.id,
      });
    }
  }

  function stopTyping() {
    const socket = socketRef.current;
    const activeConversation =
      conversationRef.current;

    if (typingTimeoutRef.current) {
      clearTimeout(
        typingTimeoutRef.current,
      );

      typingTimeoutRef.current = null;
    }

    if (
      socket &&
      socket.connected &&
      activeConversation
    ) {
      socket.emit("stopTyping", {
        conversationId:
          activeConversation.id,
      });
    }
  }

  // --------------------------------------------------
  // Message selection
  // --------------------------------------------------

  function toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(messageId)) {
        nextIds.delete(messageId);
      } else {
        nextIds.add(messageId);
      }

      return nextIds;
    });

    closeMessageContextMenu();
    setError("");
  }

  function startMessageSelection(msg: Message) {
    setSelectedMessageIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(msg.id);
      return nextIds;
    });

    closeMessageContextMenu();
    setError("");
  }

  function clearMessageSelection() {
    if (deletingSelectedMessages) {
      return;
    }

    setSelectedMessageIds(new Set());
    setError("");
  }

  async function copySelectedMessages() {
    const selectedMessages = messages.filter((item) =>
      selectedMessageIds.has(item.id),
    );

    if (selectedMessages.length === 0) {
      return;
    }

    const copyText = selectedMessages
      .map((item) => item.content || "📎 Attachment")
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(copyText);
      setError("");
    } catch (error) {
      console.error("Failed to copy selected messages:", error);
      setError("Could not copy the selected messages.");
    }
  }

  function replyToSelectedMessage() {
    const selectedMessages = messages.filter((item) =>
      selectedMessageIds.has(item.id),
    );

    if (selectedMessages.length !== 1) {
      setError("Select exactly one message to reply.");
      return;
    }

    startReplyingToMessage(selectedMessages[0]);
    clearMessageSelection();
  }

  function forwardSelectedMessage() {
    const selectedMessages = messages.filter((item) =>
      selectedMessageIds.has(item.id),
    );

    if (selectedMessages.length !== 1) {
      setError("Select exactly one message to forward.");
      return;
    }

    openForwardMessage(selectedMessages[0]);
    clearMessageSelection();
  }

  async function deleteSelectedMessagesForMe() {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setError("Please login first.");
      return;
    }

    const selectedMessages = messages.filter((item) =>
      selectedMessageIds.has(item.id),
    );

    if (selectedMessages.length === 0 || deletingSelectedMessages) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedMessages.length} selected message${
        selectedMessages.length === 1 ? "" : "s"
      } for you?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingSelectedMessages(true);
    closeMessageContextMenu();
    setError("");

    try {
      const results = await Promise.all(
        selectedMessages.map(async (msg) => {
          const response = await fetch(
            `http://localhost:3001/messages/${msg.id}/me`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.message ||
                `Could not delete message ${msg.id}`,
            );
          }

          return msg;
        }),
      );

      const deletedIds = new Set(
        results.map((item) => item.id),
      );

      setMessages((currentMessages) =>
        currentMessages.filter((item) => !deletedIds.has(item.id)),
      );

      setConversations((currentConversations) =>
        currentConversations.map((item) =>
          item.lastMessage && deletedIds.has(item.lastMessage.id)
            ? { ...item, lastMessage: null }
            : item,
        ),
      );

      setConversation((currentConversation) =>
        currentConversation &&
        currentConversation.lastMessage &&
        deletedIds.has(currentConversation.lastMessage.id)
          ? { ...currentConversation, lastMessage: null }
          : currentConversation,
      );

      setSelectedMessageIds(new Set());
    } catch (error) {
      console.error("Failed to delete selected messages:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not delete the selected messages.",
      );
    } finally {
      setDeletingSelectedMessages(false);
    }
  }

  // --------------------------------------------------
  // Reply to message
  // --------------------------------------------------

  function startReplyingToMessage(msg: Message) {
    setReplyingToMessage(msg);
    setError("");
  }

  function cancelReplyingToMessage() {
    setReplyingToMessage(null);
  }

  // --------------------------------------------------
  // Message reactions
  // --------------------------------------------------

  const reactionEmojis = [
    "❤️",
    "😂",
    "👍",
    "😮",
    "😢",
    "🔥",
  ];

  function toggleReactionPicker(messageId: string) {
    setReactionPickerMessageId((currentId) =>
      currentId === messageId ? null : messageId,
    );
  }

  function reactToMessage(
    msg: Message,
    emoji: string,
  ) {
    const userId =
      currentUserRef.current?.id ??
      getStoredUserId();

    const socket = socketRef.current;

    if (!userId) {
      setError("Could not determine current user.");
      return;
    }

    if (!socket || !socket.connected) {
      setError("WebSocket is not connected.");
      return;
    }

    const myReaction =
      (msg.reactions ?? []).find(
        (reaction) =>
          reaction.userId === userId,
      );

    setError("");

    if (myReaction?.emoji === emoji) {
      socket.emit(
        "removeReaction",
        {
          messageId: msg.id,
        },
        (response: { error?: string }) => {
          if (response?.error) {
            setError(response.error);
          }
        },
      );
    } else {
      socket.emit(
        "reactToMessage",
        {
          messageId: msg.id,
          emoji,
        },
        (response: { error?: string }) => {
          if (response?.error) {
            setError(response.error);
          }
        },
      );
    }

    setReactionPickerMessageId(null);
  }

  // --------------------------------------------------
  // Edit message
  // --------------------------------------------------

  function startEditingMessage(msg: Message) {
    if (
      msg.senderId !== currentUserRef.current?.id
    ) {
      return;
    }

    setEditingMessageId(msg.id);
    setEditingMessageContent(msg.content);
    setError("");
  }

  function cancelEditingMessage() {
    if (savingEditedMessage) {
      return;
    }

    setEditingMessageId(null);
    setEditingMessageContent("");
  }

  function saveEditedMessage() {
    if (!editingMessageId) {
      return;
    }

    const trimmedContent =
      editingMessageContent.trim();

    if (!trimmedContent) {
      setError(
        "Message content cannot be empty.",
      );
      return;
    }

    const socket =
      socketRef.current;

    if (
      !socket ||
      !socket.connected
    ) {
      setError(
        "WebSocket is not connected.",
      );
      return;
    }

    setSavingEditedMessage(true);
    setError("");

    console.log(
      "Editing message:",
      editingMessageId,
    );

    socket.emit(
      "editMessage",
      {
        messageId:
          editingMessageId,
        content:
          trimmedContent,
      },
      (
        response: {
          message?: string;
          data?: Message;
          error?: string;
        },
      ) => {
        console.log(
          "Edit message response:",
          response,
        );

        if (response?.error) {
          setError(response.error);
          setSavingEditedMessage(false);
          return;
        }

        if (response?.data) {
          const updatedMessage =
            response.data;

          setMessages(
            (currentMessages) =>
              currentMessages.map(
                (msg) =>
                  msg.id ===
                    updatedMessage.id
                    ? updatedMessage
                    : msg,
              ),
          );

          setConversations(
            (currentConversations) =>
              currentConversations.map(
                (item) =>
                  item.id ===
                    updatedMessage.conversationId &&
                  item.lastMessage?.id ===
                    updatedMessage.id
                    ? {
                        ...item,
                        lastMessage:
                          updatedMessage,
                      }
                    : item,
              ),
          );

          setConversation(
            (currentConversation) => {
              if (
                !currentConversation ||
                currentConversation.id !==
                  updatedMessage.conversationId ||
                currentConversation.lastMessage?.id !==
                  updatedMessage.id
              ) {
                return currentConversation;
              }

              return {
                ...currentConversation,
                lastMessage:
                  updatedMessage,
              };
            },
          );
        }

        setEditingMessageId(null);
        setEditingMessageContent("");
        setSavingEditedMessage(false);
      },
    );
  }

  // --------------------------------------------------
  // Delete message for me / everyone
  // --------------------------------------------------

  async function deleteMessageForMe(msg: Message) {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setError("Please login first.");
      return;
    }

    if (deletingMessageId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this message for you?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingMessageId(msg.id);
    closeMessageContextMenu();
    setError("");

    try {
      const response = await fetch(
        `http://localhost:3001/messages/${msg.id}/me`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not delete message for you",
        );
      }

      setMessages((currentMessages) =>
        currentMessages.filter((item) => item.id !== msg.id),
      );

      setConversations((currentConversations) =>
        currentConversations.map((item) =>
          item.id === msg.conversationId &&
          item.lastMessage?.id === msg.id
            ? { ...item, lastMessage: null }
            : item,
        ),
      );

      setConversation((currentConversation) =>
        currentConversation &&
        currentConversation.id === msg.conversationId &&
        currentConversation.lastMessage?.id === msg.id
          ? { ...currentConversation, lastMessage: null }
          : currentConversation,
      );
    } catch (error) {
      console.error("Failed to delete message for me:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not delete message for you",
      );
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function deleteMessageForEveryone(msg: Message) {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setError("Please login first.");
      return;
    }

    if (msg.senderId !== currentUserRef.current?.id) {
      return;
    }

    if (deletingMessageId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this message for everyone? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingMessageId(msg.id);
    closeMessageContextMenu();
    setError("");

    try {
      const response = await fetch(
        `http://localhost:3001/messages/${msg.id}/everyone`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not delete message for everyone",
        );
      }

      setMessages((currentMessages) =>
        currentMessages.filter((item) => item.id !== msg.id),
      );

      setConversations((currentConversations) =>
        currentConversations.map((item) =>
          item.id === msg.conversationId &&
          item.lastMessage?.id === msg.id
            ? { ...item, lastMessage: null }
            : item,
        ),
      );

      setConversation((currentConversation) =>
        currentConversation &&
        currentConversation.id === msg.conversationId &&
        currentConversation.lastMessage?.id === msg.id
          ? { ...currentConversation, lastMessage: null }
          : currentConversation,
      );
    } catch (error) {
      console.error("Failed to delete message for everyone:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not delete message for everyone",
      );
    } finally {
      setDeletingMessageId(null);
    }
  }

  function toggleDeleteMessageMenu(messageId: string) {
    setDeleteMessageMenuId((currentId) =>
      currentId === messageId ? null : messageId,
    );
  }

  function openMessageContextMenu(messageId: string) {
    setMessageContextMenuId((currentId) =>
      currentId === messageId ? null : messageId,
    );
    setDeleteMessageMenuId(null);
    setReactionPickerMessageId(null);
  }

  function closeMessageContextMenu() {
    setMessageContextMenuId(null);
    setDeleteMessageMenuId(null);
    setReactionPickerMessageId(null);
  }

  // --------------------------------------------------
  // --------------------------------------------------
  // Forward message
  // --------------------------------------------------

  function openForwardMessage(msg: Message) {
    setForwardingMessage(msg);
    setForwardingToUserId(null);
    setError("");
  }

  function closeForwardMessage() {
    if (forwardingMessageLoading) {
      return;
    }

    setForwardingMessage(null);
    setForwardingToUserId(null);
  }

  async function confirmForwardMessage() {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setError("Please login first.");
      return;
    }

    if (!forwardingMessage) {
      setError("Please select a message to forward.");
      return;
    }

    if (!forwardingToUserId) {
      setError("Please select a friend.");
      return;
    }

    try {
      setForwardingMessageLoading(true);
      setError("");

      const response = await fetch(
        `http://localhost:3001/messages/${forwardingMessage.id}/forward`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiverId: forwardingToUserId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not forward message",
        );
      }

      // The API returns the newly created forwarded message.
      // Remember its id so the UI can label it clearly.
      if (data?.id) {
        setForwardedMessageIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(data.id as string);
          return nextIds;
        });
      }

      // If the target conversation is currently open, reload it so
      // the newly forwarded message appears immediately.
      const targetConversation =
        conversations.find(
          (item) =>
            item.otherUser.id ===
            forwardingToUserId,
        );

      if (
        targetConversation &&
        conversationRef.current?.id ===
          targetConversation.id
      ) {
        const refreshed = await fetch(
          `http://localhost:3001/messages/${targetConversation.id}?limit=30`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (refreshed.ok) {
          const refreshedData = await refreshed.json();
          setMessages(
            (refreshedData.messages ?? []) as Message[],
          );
          setHasMoreMessages(
            refreshedData.hasMore === true,
          );
          setNextMessageCursor(
            refreshedData.nextCursor ?? null,
          );
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({
              behavior: "smooth",
            });
          }, 0);
        }
      }

      // Refresh sidebar conversations because forwarding changes the
      // target conversation's updatedAt / latest message.
      const conversationsResponse = await fetch(
        "http://localhost:3001/messages/conversations",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (conversationsResponse.ok) {
        const conversationData =
          await conversationsResponse.json();
        setConversations(conversationData);
      }

      setForwardingMessage(null);
      setForwardingToUserId(null);
    } catch (error) {
      console.error(
        "Failed to forward message:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Could not forward message",
      );
    } finally {
      setForwardingMessageLoading(false);
    }
  }

  // Send message
  // --------------------------------------------------

  const allowedAttachmentTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
  ];

  const maxAttachmentSize = 10 * 1024 * 1024;

  function formatMessageTime(createdAt: string) {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function startOfDay(date: Date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
  }

  function formatMessageDate(createdAt: string) {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const today = new Date();
    const messageDay = startOfDay(date);
    const todayDay = startOfDay(today);
    const oneDay = 24 * 60 * 60 * 1000;
    const dayDifference = Math.round(
      (todayDay - messageDay) / oneDay,
    );

    if (dayDifference === 0) {
      return "Today";
    }

    if (dayDifference === 1) {
      return "Yesterday";
    }

    if (dayDifference > 1 && dayDifference < 7) {
      return date.toLocaleDateString([], {
        weekday: "long",
      });
    }

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() === today.getFullYear()
          ? undefined
          : "numeric",
    });
  }

  function shouldShowDateSeparator(
    currentMessage: Message,
    previousMessage?: Message,
  ) {
    if (!previousMessage) {
      return true;
    }

    const currentDate = new Date(currentMessage.createdAt);
    const previousDate = new Date(previousMessage.createdAt);

    if (
      Number.isNaN(currentDate.getTime()) ||
      Number.isNaN(previousDate.getTime())
    ) {
      return false;
    }

    return (
      startOfDay(currentDate) !==
      startOfDay(previousDate)
    );
  }

  function formatFileSize(size: number) {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleAttachmentSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedAttachment(null);
      return;
    }

    if (!allowedAttachmentTypes.includes(file.type)) {
      setError(
        "File type is not allowed. Use JPG, PNG, GIF, WEBP, PDF, or TXT.",
      );
      event.target.value = "";
      setSelectedAttachment(null);
      return;
    }

    if (file.size > maxAttachmentSize) {
      setError("File is too large. Maximum size is 10 MB.");
      event.target.value = "";
      setSelectedAttachment(null);
      return;
    }

    setError("");
    setSelectedAttachment(file);
  }

  function clearSelectedAttachment() {
    setSelectedAttachment(null);

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  async function uploadAttachment(
    file: File,
  ): Promise<MessageAttachment> {
    const token =
      localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Please login first.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      "http://localhost:3001/attachments/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Could not upload attachment",
      );
    }

    return {
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
    };
  }

  function getAttachmentUrl(fileUrl: string) {
    if (
      fileUrl.startsWith("http://") ||
      fileUrl.startsWith("https://")
    ) {
      return fileUrl;
    }

    return `http://localhost:3001${fileUrl}`;
  }

  function isImageAttachment(
    attachment: MessageAttachment,
  ) {
    return attachment.mimeType.startsWith("image/");
  }

  async function sendMessage(
    retryPayload?: {
      receiverId: string;
      content: string;
      replyToId?: string;
      attachment?: MessageAttachment;
    },
  ) {
    if (sendingMessage) {
      return;
    }

    const payload = retryPayload ?? {
      receiverId: selectedFriend?.id ?? "",
      content: message.trim(),
      ...(replyingToMessage
        ? {
            replyToId: replyingToMessage.id,
          }
        : {}),
    };

    if (isBlocked) {
      setError(
        "You cannot send messages to a blocked user.",
      );
      return;
    }

    if (
      !payload.content &&
      !selectedAttachment &&
      !payload.attachment
    ) {
      return;
    }

    if (!selectedFriend && !retryPayload) {
      setError("Please select a friend first.");
      return;
    }

    if (!conversation && !retryPayload) {
      setError("Conversation is not ready yet.");
      return;
    }

    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setError(
        "You are offline. Reconnect and try sending again.",
      );

      if (!retryPayload && selectedFriend) {
        setFailedOutgoingMessage({
          ...payload,
        });
      }

      return;
    }

    try {
      setSendingMessage(true);
      setUploadingAttachment(
        Boolean(selectedAttachment) && !retryPayload,
      );
      setError("");

      stopTyping();

      let attachment =
        payload.attachment ?? undefined;

      // Upload only on the first attempt. If the socket send fails
      // after a successful upload, the uploaded file is reused on retry.
      if (selectedAttachment && !retryPayload) {
        attachment =
          await uploadAttachment(selectedAttachment);
      }

      const sendPayload = {
        receiverId: payload.receiverId,
        content: payload.content,
        ...(payload.replyToId
          ? {
              replyToId: payload.replyToId,
            }
          : {}),
        ...(attachment
          ? {
              attachments: [attachment],
            }
          : {}),
      };

      shouldScrollToBottomRef.current = true;

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(
            new Error(
              "Message sending timed out. Please try again.",
            ),
          );
        }, 10000);

        socket.emit(
          "sendMessage",
          sendPayload,
          (response?: {
            id?: string;
            message?: string;
            error?: string;
            statusCode?: number;
          }) => {
            window.clearTimeout(timeout);

            if (
              response?.error ||
              response?.statusCode >= 400
            ) {
              reject(
                new Error(
                  response.error ||
                    response.message ||
                    "Could not send message.",
                ),
              );
              return;
            }

            resolve();
          },
        );
      });

      setMessage("");
      setReplyingToMessage(null);
      clearSelectedAttachment();
      setFailedOutgoingMessage(null);
      setError("");
    } catch (error) {
      console.error(
        "Failed to send message:",
        error,
      );

      const messageText =
        error instanceof Error
          ? error.message
          : "Could not send message.";

      setError(messageText);

      // Preserve the message and any already-uploaded attachment so
      // the user can retry without losing their content.
      setFailedOutgoingMessage({
        receiverId: payload.receiverId,
        content: payload.content,
        ...(payload.replyToId
          ? {
              replyToId: payload.replyToId,
            }
          : {}),
        ...(payload.attachment
          ? {
              attachment: payload.attachment,
            }
          : {}),
      });
    } finally {
      setSendingMessage(false);
      setUploadingAttachment(false);
    }
  }

  function retryFailedMessage() {
    if (!failedOutgoingMessage || sendingMessage) {
      return;
    }

    void sendMessage(failedOutgoingMessage);
  }

  function cancelFailedMessage() {
    if (sendingMessage) {
      return;
    }

    setFailedOutgoingMessage(null);
    setError("");
  }

  // --------------------------------------------------
  // Enter key
  // --------------------------------------------------

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key ===
      "Enter"
    ) {
      event.preventDefault();

      void sendMessage();
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="flex h-screen bg-gray-100">

      {/* ------------------------------------------ */}
      {/* LEFT SIDEBAR                              */}
      {/* ------------------------------------------ */}

      <aside className="w-80 border-r bg-white overflow-y-auto">

        {/* HEADER */}

        <div className="border-b p-5">

          <h1 className="text-2xl font-bold text-gray-900">
            FriendChat
          </h1>

          <div className="mt-2 flex items-center gap-2">

            <span
              className={
                "h-2.5 w-2.5 rounded-full " +
                (connected
                  ? "bg-green-500"
                  : "bg-red-500")
              }
            />

            <p className="text-sm text-gray-600">
              {connected
                ? "Connected"
                : "Disconnected"}
            </p>

          </div>

          {currentUser && (
            <p className="mt-2 text-xs text-gray-500">
              Logged in as @
              {currentUser.username}
            </p>
          )}

          {currentUser && (
            <div className="relative mt-3">
              <button
                type="button"
                onClick={() =>
                  setShowNotifications(
                    (current) => !current,
                  )
                }
                className="relative w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <span className="mr-2">
                  🔔
                </span>
                Notifications

                {unreadNotificationCount >
                  0 && (
                  <span className="absolute right-3 top-1/2 min-w-5 -translate-y-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadNotificationCount >
                    99
                      ? "99+"
                      : unreadNotificationCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Notifications
                      </p>
                      <p className="text-xs text-gray-500">
                        {unreadNotificationCount} unread
                      </p>
                    </div>

                    {unreadNotificationCount >
                      0 && (
                      <button
                        type="button"
                        onClick={
                          markAllNotificationsAsRead
                        }
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {loadingNotifications ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">
                        Loading notifications...
                      </p>
                    ) : notifications.length ===
                      0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map(
                        (notification) => (
                          <div
                            key={
                              notification.id
                            }
                            className={
                              "border-b px-4 py-3 last:border-b-0 " +
                              (notification.isRead
                                ? "bg-white"
                                : "bg-blue-50")
                            }
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 text-lg">
                                {notification.type ===
                                "MESSAGE"
                                  ? "💬"
                                  : "🔔"}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={
                                    "text-sm " +
                                    (notification.isRead
                                      ? "text-gray-600"
                                      : "font-semibold text-gray-900")
                                  }
                                >
                                  {
                                    notification.message
                                  }
                                </p>

                                <p className="mt-1 text-[11px] text-gray-400">
                                  {new Date(
                                    notification.createdAt,
                                  ).toLocaleString()}
                                </p>

                                {!notification.isRead && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      markNotificationAsRead(
                                        notification.id,
                                      )
                                    }
                                    disabled={
                                      processingNotificationId ===
                                      notification.id
                                    }
                                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                  >
                                    {processingNotificationId ===
                                    notification.id
                                      ? "Marking..."
                                      : "Mark as read"}
                                  </button>
                                )}
                              </div>

                              {!notification.isRead && (
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                              )}
                            </div>
                          </div>
                        ),
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentUser && (
            <button
              type="button"
              onClick={() => {
                setShowProfile(
                  true,
                );

                loadProfile();
              }}
              className="mt-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              My Profile
            </button>
          )}

          {currentUser && (
            <button
              type="button"
              onClick={
                handleLogout
              }
              className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Logout
            </button>
          )}

        </div>

        {/* FIND USERS */}

        <div className="border-b p-4">

          <p className="mb-3 text-sm font-semibold text-gray-500">
            FIND USERS
          </p>

          <div className="flex gap-2">

            <input
              type="text"
              value={
                searchUsername
              }
              onChange={(event) => {
                setSearchUsername(
                  event.target.value,
                );

                setHasSearched(
                  false,
                );
              }}
              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  event.preventDefault();

                  searchUsers();
                }
              }}
              placeholder="Search username..."
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="button"
              onClick={
                searchUsers
              }
              disabled={
                searching ||
                !searchUsername.trim()
              }
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching
                ? "..."
                : "Search"}
            </button>

          </div>

          {searchResults.length >
            0 && (
            <div className="mt-3 space-y-2">

              {searchResults.map(
                (user) => (
                  <div
                    key={user.id}
                    className="rounded-lg bg-gray-100 p-3"
                  >

                    <div className="flex items-center justify-between gap-2">

                      <div className="min-w-0">

                        <p className="truncate font-semibold text-gray-900">
                          {
                            user.displayName
                          }
                        </p>

                        <p className="truncate text-xs text-gray-500">
                          @
                          {
                            user.username
                          }
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          sendFriendRequest(
                            user.id,
                          )
                        }
                        disabled={
                          sendingRequestId ===
                          user.id
                        }
                        className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sendingRequestId ===
                        user.id
                          ? "Sending..."
                          : "Add Friend"}
                      </button>

                    </div>

                  </div>
                ),
              )}

            </div>
          )}

          {hasSearched &&
            !searching &&
            searchResults.length ===
              0 && (
              <p className="mt-3 text-sm text-gray-400">
                No users found.
              </p>
            )}

        </div>

        {/* FRIEND REQUESTS */}

        <div className="border-b p-4">

          <p className="mb-3 text-sm font-semibold text-gray-500">

            FRIEND REQUESTS

            {friendRequests.length >
              0 && (
              <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                {
                  friendRequests.length
                }
              </span>
            )}

          </p>

          {loadingRequests && (
            <p className="text-sm text-gray-400">
              Loading requests...
            </p>
          )}

          {!loadingRequests &&
            friendRequests.length ===
              0 && (
              <p className="text-sm text-gray-400">
                No pending requests.
              </p>
            )}

          {!loadingRequests &&
            friendRequests.map(
              (request) => (
                <div
                  key={request.id}
                  className="mb-2 rounded-lg bg-gray-100 p-3"
                >

                  <p className="font-semibold text-gray-900">
                    {
                      request.sender
                        .displayName
                    }
                  </p>

                  <p className="text-xs text-gray-500">
                    @
                    {
                      request.sender
                        .username
                    }
                  </p>

                  <div className="mt-2 flex gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        acceptFriendRequest(
                          request.id,
                        )
                      }
                      disabled={
                        processingRequestId ===
                        request.id
                      }
                      className="flex-1 rounded-lg bg-green-600 px-2 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processingRequestId ===
                      request.id
                        ? "..."
                        : "Accept"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        rejectFriendRequest(
                          request.id,
                        )
                      }
                      disabled={
                        processingRequestId ===
                        request.id
                      }
                      className="flex-1 rounded-lg bg-red-600 px-2 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject
                    </button>

                  </div>

                </div>
              ),
            )}

        </div>

        {/* CONVERSATIONS */}

        <div className="p-4">

          <p className="mb-3 text-sm font-semibold text-gray-500">
            CONVERSATIONS
          </p>

          {loadingConversations && (
            <p className="text-sm text-gray-400">
              Loading conversations...
            </p>
          )}

          {!loadingConversations &&
            conversations.length ===
              0 && (
              <p className="text-sm text-gray-400">
                No conversations yet.
              </p>
            )}

          {!loadingConversations &&
            conversations.map(
              (item) => {
                const isSelected =
                  conversation?.id ===
                  item.id;

                const hasUnreadLastMessage =
                  item.lastMessage !==
                    null &&
                  item.lastMessage
                    .senderId !==
                    currentUser?.id &&
                  item.lastMessage
                    .isRead ===
                    false;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      selectConversation(
                        item,
                      )
                    }
                    className={
                      "mb-2 w-full rounded-lg p-4 text-left transition " +
                      (isSelected
                        ? "bg-blue-50 ring-1 ring-blue-200"
                        : "bg-gray-100 hover:bg-gray-200")
                    }
                  >

                    <div className="flex items-center gap-2">

                      <span
                        className={
                          "h-2 w-2 rounded-full " +
                          (onlineUsers.has(
                            item.otherUser
                              .id,
                          )
                            ? "bg-green-500"
                            : "bg-gray-400")
                        }
                      />

                      <p className="font-semibold text-gray-900">
                        {
                          item.otherUser
                            .displayName
                        }
                      </p>

                      {hasUnreadLastMessage && (
                        <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          UNREAD
                        </span>
                      )}

                    </div>

                    <p className="mt-1 truncate text-sm text-gray-500">
                      {item.lastMessage
                        ? item.lastMessage.content ||
                          (item.lastMessage.attachments?.length
                            ? `📎 ${item.lastMessage.attachments.length} attachment${item.lastMessage.attachments.length > 1 ? "s" : ""}`
                            : "Message")
                        : "No messages yet"}
                    </p>

                  </button>
                );
              },
            )}

        </div>

        {/* FRIENDS */}

        <div className="border-t p-4">

          <p className="mb-3 text-sm font-semibold text-gray-500">
            FRIENDS
          </p>

          {loadingFriends && (
            <p className="text-sm text-gray-400">
              Loading friends...
            </p>
          )}

          {!loadingFriends &&
            friends.length ===
              0 && (
              <p className="text-sm text-gray-400">
                You don't have any friends yet.
              </p>
            )}

          {!loadingFriends &&
            friends.map(
              (friend) => {
                const isSelected =
                  selectedFriend?.id ===
                  friend.id;

                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() =>
                      setSelectedFriend(
                        friend,
                      )
                    }
                    className={
                      "mb-2 w-full rounded-lg p-4 text-left transition " +
                      (isSelected
                        ? "bg-blue-50 ring-1 ring-blue-200"
                        : "bg-gray-100 hover:bg-gray-200")
                    }
                  >

                    <p className="font-semibold text-gray-900">
                      {
                        friend.displayName
                      }
                    </p>

                    <div className="mt-1 flex items-center gap-2">

                      <span
                        className={
                          "h-2 w-2 rounded-full " +
                          (onlineUsers.has(
                            friend.id,
                          )
                            ? "bg-green-500"
                            : "bg-gray-400")
                        }
                      />

                      <p className="text-sm text-gray-500">
                        {onlineUsers.has(
                          friend.id,
                        )
                          ? "Online"
                          : "Offline"}
                      </p>

                      <span className="text-sm text-gray-400">
                        · @
                        {
                          friend.username
                        }
                      </span>

                    </div>

                  </button>
                );
              },
            )}

        </div>

      </aside>

      {/* ------------------------------------------ */}
      {/* CHAT AREA                                 */}
      {/* ------------------------------------------ */}

      <section className="flex flex-1 flex-col">

        {/* Header */}

        <header className="border-b bg-white p-5">

          {selectedFriend ? (
            <>

              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {
                    selectedFriend.displayName
                  }
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={deleteConversation}
                    disabled={deletingConversation || processingBlock}
                    className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingConversation
                      ? "Deleting..."
                      : "Delete Chat"}
                  </button>

                  <button
                    type="button"
                    onClick={toggleBlockUser}
                    disabled={processingBlock || deletingConversation}
                    className={
                      isBlocked
                        ? "rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        : "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    {processingBlock
                      ? "Please wait..."
                      : isBlocked
                        ? "Unblock User"
                        : "Block User"}
                  </button>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2">

                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (onlineUsers.has(
                      selectedFriend.id,
                    )
                      ? "bg-green-500"
                      : "bg-gray-400")
                  }
                />

                <p className="text-sm text-gray-500">
                  {onlineUsers.has(
                    selectedFriend.id,
                  )
                    ? "Online"
                    : "Offline"}
                </p>

                <span className="text-sm text-gray-400">
                  · @
                  {
                    selectedFriend.username
                  }
                </span>

              </div>

              {/* Message search */}
              <div className="mt-3">
                {!showMessageSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMessageSearch(true);
                      setError("");
                    }}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    🔎 Search messages
                  </button>
                ) : (
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={messageSearchQuery}
                        onChange={(event) =>
                          setMessageSearchQuery(
                            event.target.value,
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter"
                          ) {
                            event.preventDefault();
                            void searchMessages();
                          }

                          if (
                            event.key === "Escape"
                          ) {
                            clearMessageSearch();
                            setShowMessageSearch(false);
                          }
                        }}
                        placeholder="Search messages..."
                        autoFocus
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          void searchMessages()
                        }
                        disabled={
                          searchingMessages ||
                          !messageSearchQuery.trim()
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {searchingMessages
                          ? "Searching..."
                          : "Search"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          clearMessageSearch();
                          setShowMessageSearch(false);
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                        aria-label="Close message search"
                      >
                        ✕
                      </button>
                    </div>

                    {messageSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                        <div className="border-b px-4 py-2 text-xs font-semibold text-gray-500">
                          {messageSearchResults.length} result
                          {messageSearchResults.length === 1
                            ? ""
                            : "s"}
                        </div>

                        {messageSearchResults.map(
                          (result) => (
                            <button
                              key={result.id}
                              type="button"
                              onClick={() =>
                                void jumpToSearchResult(
                                  result,
                                )
                              }
                              disabled={
                                searchingMessageId ===
                                result.id
                              }
                              className="block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-60"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-xs font-semibold text-gray-700">
                                  {result.sender?.displayName ??
                                    "User"}
                                </p>
                                <p className="shrink-0 text-[10px] text-gray-400">
                                  {new Date(
                                    result.createdAt,
                                  ).toLocaleString()}
                                </p>
                              </div>

                              <p className="mt-1 line-clamp-2 text-sm text-gray-900">
                                {result.content ||
                                  "📎 Attachment"}
                              </p>

                              {result.replyTo && (
                                <p className="mt-1 truncate text-xs text-gray-400">
                                  ↳ Reply:{" "}
                                  {result.replyTo.content}
                                </p>
                              )}
                            </button>
                          ),
                        )}
                      </div>
                    )}

                    {!searchingMessages &&
                      messageSearchQuery.trim() &&
                      messageSearchResults.length ===
                        0 && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-500 shadow-xl">
                          No matching messages found.
                        </div>
                      )}
                  </div>
                )}
              </div>

              <div className="relative mt-3">
                <button
                  type="button"
                  onClick={() => {
                    const nextVisible = !showPinnedMessages;
                    setShowPinnedMessages(nextVisible);

                    if (nextVisible && conversation?.id) {
                      void loadPinnedMessages(conversation.id);
                    }
                  }}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                >
                  📌 Pinned messages
                  {pinnedMessages.length > 0
                    ? ` (${pinnedMessages.length})`
                    : ""}
                </button>

                {showPinnedMessages && (
                  <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-xl rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Pinned messages
                      </h3>

                      <button
                        type="button"
                        onClick={() => setShowPinnedMessages(false)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100"
                      >
                        ✕
                      </button>
                    </div>

                    {loadingPinnedMessages ? (
                      <p className="py-4 text-center text-sm text-gray-500">
                        Loading pinned messages...
                      </p>
                    ) : pinnedMessages.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-500">
                        No pinned messages.
                      </p>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {pinnedMessages.map((pinnedMessage) => (
                          <button
                            key={pinnedMessage.id}
                            type="button"
                            onClick={() =>
                              jumpToPinnedMessage(pinnedMessage.id)
                            }
                            className="w-full rounded-lg border border-gray-100 bg-gray-50 p-3 text-left hover:bg-amber-50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-gray-700">
                                {pinnedMessage.sender?.displayName ??
                                  (pinnedMessage.senderId ===
                                  currentUserRef.current?.id
                                    ? "You"
                                    : selectedFriend?.displayName ??
                                      "User")}
                              </span>

                              <span className="text-xs text-gray-400">
                                {new Date(
                                  pinnedMessage.createdAt,
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <p className="mt-1 truncate text-sm text-gray-700">
                              {pinnedMessage.content ||
                                (pinnedMessage.attachments?.length
                                  ? "📎 Attachment"
                                  : "Message")}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isOtherUserTyping && (
                <p className="mt-2 text-sm font-medium text-blue-600">
                  {selectedFriend.displayName} is typing...
                </p>
              )}

            </>
          ) : (
            <>

              <h2 className="text-lg font-semibold text-gray-900">
                No friend selected
              </h2>

              <p className="text-sm text-gray-500">
                Select a friend to start chatting
              </p>

            </>
          )}

        </header>

        {selectedMessageIds.size > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={clearMessageSelection}
                disabled={deletingSelectedMessages}
                className="rounded-lg px-2 py-1 text-lg font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cancel message selection"
                title="Cancel selection"
              >
                ✕
              </button>

              <div>
                <p className="text-sm font-semibold text-blue-900">
                  {selectedMessageIds.size} message
                  {selectedMessageIds.size === 1 ? "" : "s"} selected
                </p>
                <p className="text-xs text-blue-600">
                  Choose an action below
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void copySelectedMessages()}
                disabled={deletingSelectedMessages}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                📋 Copy
              </button>

              {selectedMessageIds.size === 1 && (
                <>
                  <button
                    type="button"
                    onClick={replyToSelectedMessage}
                    disabled={deletingSelectedMessages}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ↩️ Reply
                  </button>

                  <button
                    type="button"
                    onClick={forwardSelectedMessage}
                    disabled={
                      deletingSelectedMessages ||
                      forwardingMessageLoading
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ↗️ Forward
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => void deleteSelectedMessagesForMe()}
                disabled={deletingSelectedMessages}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingSelectedMessages
                  ? "Deleting..."
                  : "🗑️ Delete"}
              </button>
            </div>
          </div>
        )}

        {/* Messages */}

        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="relative flex-1 overflow-y-auto p-6"
        >
          {newMessageCount > 0 && !isNearBottom && (
            <button
              type="button"
              onClick={scrollToLatestMessages}
              className="sticky bottom-4 left-full z-20 ml-auto flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-lg transition hover:bg-blue-50"
            >
              ↓ {newMessageCount === 1 ? "New message" : `${newMessageCount} new messages`}
            </button>
          )}

          {!isNearBottom && newMessageCount === 0 && messages.length > 0 && (
            <button
              type="button"
              onClick={scrollToLatestMessages}
              aria-label="Scroll to latest messages"
              className="sticky bottom-4 left-full z-20 ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg text-gray-600 shadow-lg transition hover:bg-gray-50"
            >
              ↓
            </button>
          )}

          {loadingOlderMessages && (
            <div className="mb-4 text-center text-xs font-medium text-gray-400">
              Loading older messages...
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loadingConversation &&
            hasMoreMessages &&
            nextMessageCursor && (
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    void loadOlderMessages();
                  }}
                  disabled={loadingOlderMessages}
                  className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingOlderMessages
                    ? "Loading older messages..."
                    : "Load older messages"}
                </button>
              </div>
            )}

          {loadingConversation && (
            <div className="flex h-full items-center justify-center">

              <p className="text-gray-400">
                Opening conversation...
              </p>

            </div>
          )}

          {!loadingConversation &&
            selectedFriend &&
            messages.length ===
              0 &&
            !error && (
              <div className="flex h-full items-center justify-center">

                <p className="text-gray-400">
                  No messages yet
                </p>

              </div>
            )}

          {!loadingConversation &&
            messages.map(
              (msg, messageIndex) => {
                const isMine =
                  msg.senderId ===
                  currentUser?.id;

                const previousMessage =
                  messages[messageIndex - 1];
                const showDateSeparator =
                  shouldShowDateSeparator(
                    msg,
                    previousMessage,
                  );

                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div className="my-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-500 shadow-sm">
                          {formatMessageDate(msg.createdAt)}
                        </span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                    )}

                    <div
                      key={`${msg.id}-bubble`}
                    id={`message-${msg.id}`}
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        toggleMessageSelection(msg.id);
                      }
                    }}
                    className={
                      "group relative mb-4 flex items-start gap-2 " +
                      (isMine
                        ? "justify-end"
                        : "justify-start") +
                      (searchingMessageId === msg.id
                        ? " rounded-xl bg-yellow-100/70 p-2 ring-2 ring-yellow-300"
                        : "") +
                      (msg.isPinned
                        ? " ring-1 ring-amber-300"
                        : "")
                    }
                  >

                    {selectedMessageIds.size > 0 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleMessageSelection(msg.id);
                        }}
                        className={
                          "mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm transition " +
                          (selectedMessageIds.has(msg.id)
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-gray-300 bg-white text-transparent hover:border-blue-400")
                        }
                        aria-label={
                          selectedMessageIds.has(msg.id)
                            ? "Deselect message"
                            : "Select message"
                        }
                        title={
                          selectedMessageIds.has(msg.id)
                            ? "Deselect message"
                            : "Select message"
                        }
                      >
                        {selectedMessageIds.has(msg.id) ? "✓" : ""}
                      </button>
                    )}

                    <div
                      className={
                        "relative max-w-md rounded-2xl px-4 py-3 " +
                        (messageContextMenuId === msg.id
                          ? "z-40 "
                          : "") +
                        (selectedMessageIds.has(msg.id)
                          ? "ring-2 ring-blue-400 ring-offset-2 "
                          : "") +
                        (isMine
                          ? "rounded-br-md bg-blue-600 pr-12 text-white"
                          : "rounded-bl-md bg-white pr-12 text-gray-900 shadow-sm")
                      }
                    >
                      <button
                        type="button"
                        data-message-context-trigger
                        onClick={() =>
                          openMessageContextMenu(msg.id)
                        }
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openMessageContextMenu(msg.id);
                        }}
                        disabled={deletingMessageId === msg.id}
                        aria-label="Message actions"
                        title="Message actions"
                        className={
                          "absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border text-base font-bold opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 " +
                          (isMine
                            ? "border-blue-200 bg-blue-500 text-white hover:bg-blue-400"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100")
                        }
                      >
                        ⋮
                      </button>

                      {messageContextMenuId === msg.id && (
                        <div
                          data-message-context-menu
                          className={
                            "absolute top-10 z-50 w-48 rounded-xl border border-gray-200 bg-white p-1.5 text-gray-800 shadow-xl " +
                            (isMine ? "right-2" : "left-2")
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              startMessageSelection(msg);
                            }}
                            disabled={
                              deletingMessageId === msg.id ||
                              deletingSelectedMessages
                            }
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>☑️</span>
                            <span>Select</span>
                          </button>

                          <div className="my-1 border-t border-gray-100" />

                          <button
                            type="button"
                            onClick={() => {
                              startReplyingToMessage(msg);
                              closeMessageContextMenu();
                            }}
                            disabled={deletingMessageId === msg.id}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>↩️</span>
                            <span>Reply</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              toggleReactionPicker(msg.id);
                              setDeleteMessageMenuId(null);
                            }}
                            disabled={deletingMessageId === msg.id}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>😊</span>
                            <span>React</span>
                          </button>

                          {reactionPickerMessageId === msg.id && (
                            <div className="my-1 flex items-center justify-between gap-1 rounded-lg bg-gray-50 px-2 py-1.5">
                              {reactionEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    reactToMessage(msg, emoji);
                                    closeMessageContextMenu();
                                  }}
                                  className="rounded-md px-1.5 py-1 text-lg leading-none hover:bg-white hover:shadow-sm"
                                  title={`React ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              openForwardMessage(msg);
                              closeMessageContextMenu();
                            }}
                            disabled={
                              deletingMessageId === msg.id ||
                              forwardingMessageLoading
                            }
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>↗️</span>
                            <span>Forward</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              void togglePinMessage(msg);
                              closeMessageContextMenu();
                            }}
                            disabled={
                              deletingMessageId === msg.id ||
                              processingPinnedMessageId === msg.id
                            }
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>{msg.isPinned ? "📍" : "📌"}</span>
                            <span>
                              {processingPinnedMessageId === msg.id
                                ? "Please wait..."
                                : msg.isPinned
                                  ? "Unpin"
                                  : "Pin"}
                            </span>
                          </button>

                          {isMine && (
                            <button
                              type="button"
                              onClick={() => {
                                startEditingMessage(msg);
                                closeMessageContextMenu();
                              }}
                              disabled={deletingMessageId === msg.id}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>
                          )}

                          <div className="my-1 border-t border-gray-100" />

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteMessageMenuId((currentId) =>
                                currentId === msg.id ? null : msg.id,
                              );
                              setReactionPickerMessageId(null);
                            }}
                            disabled={deletingMessageId === msg.id}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>🗑️</span>
                            <span>Delete</span>
                          </button>

                          {deleteMessageMenuId === msg.id && (
                            <div className="mt-1 rounded-lg border border-red-100 bg-red-50/60 p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteMessageForMe(msg)
                                }
                                className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-white"
                              >
                                Delete for me
                              </button>

                              {isMine && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteMessageForEveryone(msg)
                                  }
                                  className="block w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-white"
                                >
                                  Delete for everyone
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {editingMessageId ===
                      msg.id ? (
                        <div className="min-w-[260px]">
                          <textarea
                            value={
                              editingMessageContent
                            }
                            onChange={(event) =>
                              setEditingMessageContent(
                                event.target.value,
                              )
                            }
                            onKeyDown={(event) => {
                              if (
                                event.key ===
                                  "Enter" &&
                                !event.shiftKey
                              ) {
                                event.preventDefault();
                                saveEditedMessage();
                              }

                              if (
                                event.key ===
                                "Escape"
                              ) {
                                cancelEditingMessage();
                              }
                            }}
                            disabled={
                              savingEditedMessage
                            }
                            autoFocus
                            rows={3}
                            className="w-full resize-none rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                          />

                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={
                                cancelEditingMessage
                              }
                              disabled={
                                savingEditedMessage
                              }
                              className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={
                                saveEditedMessage
                              }
                              disabled={
                                savingEditedMessage ||
                                !editingMessageContent.trim()
                              }
                              className="rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingEditedMessage
                                ? "Saving..."
                                : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {forwardedMessageIds.has(msg.id) && (
                            <div
                              className={
                                "mb-2 flex items-center gap-1 text-[11px] font-semibold italic " +
                                (isMine
                                  ? "text-blue-100"
                                  : "text-gray-500")
                              }
                            >
                              <span aria-hidden="true">↗</span>
                              <span>Forwarded</span>
                            </div>
                          )}

                          {msg.replyTo && (
                            <button
                              type="button"
                              onClick={() => {
                                const target = document.getElementById(
                                  `message-${msg.replyTo?.id}`,
                                );
                                target?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                              }}
                              className={
                                "mb-2 w-full rounded-xl border-l-4 px-3 py-2 text-left text-xs transition " +
                                (isMine
                                  ? "border-blue-200 bg-blue-500/30 text-blue-50 hover:bg-blue-500/40"
                                  : "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200")
                              }
                              title="Jump to the original message"
                            >
                              <div className="flex items-center gap-1 font-semibold">
                                <span aria-hidden="true">↩</span>
                                <span>
                                  {msg.replyTo.sender?.displayName ??
                                    (msg.replyTo.senderId === currentUserRef.current?.id
                                      ? "You"
                                      : selectedFriend?.displayName ?? "User")}
                                </span>
                              </div>
                              <div className="mt-1 line-clamp-2 break-words opacity-80">
                                {msg.replyTo.content || "📎 Attachment"}
                              </div>
                            </button>
                          )}

                          {msg.content && (
                            <div className="whitespace-pre-wrap break-words">
                              {msg.content}
                            </div>
                          )}

                          {editedMessageIds.has(msg.id) && (
                            <span
                              className={
                                "mt-1 inline-block text-[10px] font-medium italic " +
                                (isMine
                                  ? "text-blue-100"
                                  : "text-gray-400")
                              }
                            >
                              Edited
                            </span>
                          )}

                          {msg.attachments &&
                            msg.attachments.length > 0 && (
                              <div
                                className={
                                  msg.content
                                    ? "mt-3 space-y-2"
                                    : "space-y-2"
                                }
                              >
                                {msg.attachments.map(
                                  (attachment, attachmentIndex) => {
                                    const attachmentUrl =
                                      getAttachmentUrl(
                                        attachment.fileUrl,
                                      );

                                    return (
                                      <div
                                        key={
                                          attachment.id ??
                                          `${msg.id}-attachment-${attachmentIndex}`
                                        }
                                        className={
                                          "rounded-xl border p-2 " +
                                          (isMine
                                            ? "border-blue-400/50 bg-blue-500/30"
                                            : "border-gray-200 bg-gray-50")
                                        }
                                      >
                                        {isImageAttachment(
                                          attachment,
                                        ) ? (
                                          <a
                                            href={attachmentUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block"
                                          >
                                            <img
                                              src={attachmentUrl}
                                              alt={attachment.fileName}
                                              className="max-h-72 w-full rounded-lg object-contain"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            href={attachmentUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={
                                              "flex items-center gap-3 rounded-lg px-3 py-2 transition " +
                                              (isMine
                                                ? "hover:bg-blue-500/40"
                                                : "hover:bg-gray-100")
                                            }
                                          >
                                            <span className="text-2xl">
                                              📎
                                            </span>

                                            <span className="min-w-0 flex-1">
                                              <span
                                                className={
                                                  "block truncate text-sm font-semibold " +
                                                  (isMine
                                                    ? "text-white"
                                                    : "text-gray-900")
                                                }
                                              >
                                                {attachment.fileName}
                                              </span>

                                              <span
                                                className={
                                                  "block text-xs " +
                                                  (isMine
                                                    ? "text-blue-100"
                                                    : "text-gray-500")
                                                }
                                              >
                                                {attachment.mimeType} ·{" "}
                                                {formatFileSize(
                                                  attachment.fileSize,
                                                )}
                                              </span>
                                            </span>

                                            <span
                                              className={
                                                "text-xs font-semibold " +
                                                (isMine
                                                  ? "text-blue-100"
                                                  : "text-blue-600")
                                              }
                                            >
                                              Open
                                            </span>
                                          </a>
                                        )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            )}

                          {msg.isPinned && (
                            <div
                              className={
                                "mt-2 text-xs font-semibold " +
                                (isMine
                                  ? "text-amber-100"
                                  : "text-amber-600")
                              }
                            >
                              📌 Pinned
                            </div>
                          )}

                          {/* Reaction summary */}
                          {(msg.reactions ?? []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Array.from(
                                new Set(
                                  (msg.reactions ?? []).map(
                                    (reaction) => reaction.emoji,
                                  ),
                                ),
                              ).map((emoji) => {
                                const emojiReactions =
                                  (msg.reactions ?? []).filter(
                                    (reaction) =>
                                      reaction.emoji === emoji,
                                  );

                                const myReaction =
                                  emojiReactions.some(
                                    (reaction) =>
                                      reaction.userId ===
                                      currentUserRef.current?.id,
                                  );

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() =>
                                      reactToMessage(msg, emoji)
                                    }
                                    className={
                                      "rounded-full border px-2 py-0.5 text-xs shadow-sm transition " +
                                      (myReaction
                                        ? "border-blue-400 bg-blue-100 text-blue-700"
                                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100")
                                    }
                                    title={
                                      emojiReactions
                                        .map(
                                          (reaction) =>
                                            reaction.user?.displayName ??
                                            reaction.user?.username ??
                                            "User",
                                        )
                                        .join(", ")
                                    }
                                  >
                                    {emoji} {emojiReactions.length}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div
                            className={
                              "mt-2 flex items-center justify-end gap-2 text-[10px] font-medium " +
                              (isMine
                                ? "text-blue-100"
                                : "text-gray-400")
                            }
                          >
                            <span className="tabular-nums">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            {isMine && (
                              <span
                                className={
                                  "inline-flex items-center gap-0.5 " +
                                  (msg.isRead
                                    ? "font-semibold text-sky-100"
                                    : "text-blue-100")
                                }
                                title={
                                  msg.isRead
                                    ? "Read"
                                    : "Sent"
                                }
                              >
                                {msg.isRead ? "✓✓" : "✓"}
                                <span className="sr-only">
                                  {msg.isRead ? "Read" : "Sent"}
                                </span>
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    </div>
                  </div>
                );
              },
            )}

          <div
            ref={
              messagesEndRef
            }
          />

        </div>

        {/* Failed message retry banner */}

        {failedOutgoingMessage && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">
                  Message failed to send
                </p>
                <p className="mt-1 truncate text-xs text-red-600">
                  {failedOutgoingMessage.content ||
                    (failedOutgoingMessage.attachment
                      ? `📎 ${failedOutgoingMessage.attachment.fileName}`
                      : "Message")}
                </p>
              </div>

              <button
                type="button"
                onClick={retryFailedMessage}
                disabled={sendingMessage || !connected}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingMessage ? "Retrying..." : "🔄 Retry"}
              </button>

              <button
                type="button"
                onClick={cancelFailedMessage}
                disabled={sendingMessage}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Input */}

        <div className="border-t bg-white p-4">

          {!isBlocked && replyingToMessage && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-blue-700">
                  Replying to {replyingToMessage.senderId === currentUserRef.current?.id ? "yourself" : selectedFriend?.displayName ?? "message"}
                </p>
                <p className="mt-1 truncate text-sm text-gray-600">
                  {replyingToMessage.content}
                </p>
              </div>
              <button
                type="button"
                onClick={cancelReplyingToMessage}
                className="rounded-full px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-blue-100 hover:text-gray-700"
                aria-label="Cancel reply"
              >
                ✕
              </button>
            </div>
          )}

          {isBlocked ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
              You blocked this user. Unblock them to send messages.
            </div>
          ) : (
            <>
              {selectedAttachment && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <span className="text-xl">
                  {selectedAttachment.type.startsWith("image/")
                    ? "🖼️"
                    : "📎"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {selectedAttachment.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedAttachment.type} ·{" "}
                    {formatFileSize(selectedAttachment.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedAttachment}
                  disabled={uploadingAttachment}
                  className="rounded-full px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Remove selected attachment"
                >
                  ✕
                </button>
              </div>
              )}

              <div className="flex gap-3">
              <input
                ref={attachmentInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain"
                onChange={handleAttachmentSelected}
                disabled={
                  !connected ||
                  !conversation ||
                  !selectedFriend ||
                  uploadingAttachment
                }
                className="hidden"
              />

              <button
                type="button"
                onClick={() =>
                  attachmentInputRef.current?.click()
                }
                disabled={
                  !connected ||
                  !conversation ||
                  !selectedFriend ||
                  uploadingAttachment ||
                  sendingMessage
                }
                className="rounded-full border border-gray-300 bg-white px-4 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Attach file"
                title="Attach file"
              >
                📎
              </button>

              <input
                type="text"
                value={message}
                onChange={
                  handleMessageChange
                }
                onBlur={stopTyping}
                onKeyDown={
                  handleKeyDown
                }
                placeholder={
                  selectedFriend
                    ? `Message ${selectedFriend.displayName}...`
                    : "Select a friend..."
                }
                disabled={
                  !connected ||
                  !conversation ||
                  !selectedFriend ||
                  uploadingAttachment ||
                  sendingMessage
                }
                className="flex-1 rounded-full border border-gray-300 bg-white px-5 py-3 text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />

              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={
                  !connected ||
                  !conversation ||
                  !selectedFriend ||
                  uploadingAttachment ||
                  sendingMessage ||
                  (!message.trim() &&
                    !selectedAttachment)
                }
                className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadingAttachment
                  ? "Uploading..."
                  : sendingMessage
                    ? "Sending..."
                    : "Send"}
              </button>
              </div>
            </>
          )}

        </div>

      </section>

      {/* ------------------------------------------ */}
      {/* FORWARD MESSAGE PANEL                      */}
      {/* ------------------------------------------ */}

      {forwardingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Forward message
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Choose a friend to receive this message.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForwardMessage}
                disabled={forwardingMessageLoading}
                className="rounded-full px-3 py-1 text-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Close forward message panel"
              >
                ✕
              </button>
            </div>

            <div className="mb-5 rounded-xl bg-gray-50 p-3">
              <p className="mb-1 text-xs font-semibold text-gray-500">
                Message
              </p>
              <p className="max-h-20 overflow-hidden whitespace-pre-wrap break-words text-sm text-gray-800">
                {forwardingMessage.content ||
                  (forwardingMessage.attachments?.length
                    ? "📎 Attachment"
                    : "Empty message")}
              </p>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {friends.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  No friends available.
                </p>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() =>
                      setForwardingToUserId(friend.id)
                    }
                    disabled={forwardingMessageLoading}
                    className={
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 " +
                      (forwardingToUserId === friend.id
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                        : "border-gray-200 bg-white hover:bg-gray-50")
                    }
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-700">
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (friend.displayName ||
                          friend.username ||
                          "U")
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {friend.displayName}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        @{friend.username}
                      </p>
                    </div>

                    {forwardingToUserId === friend.id && (
                      <span className="text-lg text-blue-600">
                        ✓
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForwardMessage}
                disabled={forwardingMessageLoading}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void confirmForwardMessage()}
                disabled={
                  forwardingMessageLoading ||
                  !forwardingToUserId
                }
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forwardingMessageLoading
                  ? "Forwarding..."
                  : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------ */}
      {/* PROFILE PANEL                              */}
      {/* ------------------------------------------ */}

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">

            <div className="mb-6 flex items-center justify-between">

              <h2 className="text-xl font-bold text-gray-900">
                My Profile
              </h2>

              <button
                type="button"
                onClick={() => {
                  setShowProfile(
                    false,
                  );

                  setProfileMessage(
                    "",
                  );
                }}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                ✕
              </button>

            </div>

            {loadingProfile ? (
              <div className="py-10 text-center text-gray-500">
                Loading profile...
              </div>
            ) : (
              <div className="space-y-5">

                <div className="flex justify-center">

                  {profileAvatarUrl.trim() ? (
                    <img
                      src={
                        profileAvatarUrl
                      }
                      alt="Profile"
                      className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-100"
                      onError={(
                        event,
                      ) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-600">

                      {(
                        profileDisplayName ||
                        currentUser?.username ||
                        "U"
                      )
                        .charAt(
                          0,
                        )
                        .toUpperCase()}

                    </div>
                  )}

                </div>

                <div>

                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Username
                  </label>

                  <input
                    type="text"
                    value={
                      currentUser?.username ||
                      ""
                    }
                    disabled
                    className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 text-gray-500"
                  />

                </div>

                <div>

                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={
                      currentUser?.email ||
                      ""
                    }
                    disabled
                    className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 text-gray-500"
                  />

                </div>

                <div>

                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Display Name
                  </label>

                  <input
                    type="text"
                    value={
                      profileDisplayName
                    }
                    onChange={(
                      event,
                    ) =>
                      setProfileDisplayName(
                        event.target.value,
                      )
                    }
                    placeholder="Enter display name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                </div>

                <div>

                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Avatar URL
                  </label>

                  <input
                    type="url"
                    value={
                      profileAvatarUrl
                    }
                    onChange={(
                      event,
                    ) =>
                      setProfileAvatarUrl(
                        event.target.value,
                      )
                    }
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                </div>

                {profileMessage && (
                  <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                    {
                      profileMessage
                    }
                  </div>
                )}

                <div className="flex gap-3 pt-2">

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfile(
                        false,
                      );

                      setProfileMessage(
                        "",
                      );
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      updateProfile
                    }
                    disabled={
                      savingProfile
                    }
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingProfile
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                </div>

              </div>
            )}

          </div>

        </div>
      )}

    </main>
  );
}

