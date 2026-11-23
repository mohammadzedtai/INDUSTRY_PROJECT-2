import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, LogOut, MessageCircle, UserPlus, Trash2 } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ChatListItem } from '../components/chat/ChatListItem';
import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageBubble } from '../components/chat/MessageBubble';
import { MessageInputBar } from '../components/chat/MessageInputBar';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';

export default function ChatDashboardPage() {
  const { user, logout } = useAuth();
  const { socket, onlineUsers } = useSocket() || { socket: null, onlineUsers: [] };

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [typingUserId, setTypingUserId] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [actionError, setActionError] = useState('');

  // Group Modal & File Upload states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const selectedChatRef = useRef(null);
  const typingUserIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    typingUserIdRef.current = typingUserId;
  }, [typingUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUserId]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const getOtherParticipant = useCallback(
    (chat) => {
      if (!chat?.participants || !user) return null;
      return chat.participants.find((p) => p._id !== user._id) || chat.participants[0];
    },
    [user]
  );

  const getChatDisplayName = useCallback(
    (chat) => {
      if (chat.isGroup) return chat.chatName || 'Group Chat';
      return getOtherParticipant(chat)?.name || 'Unknown User';
    },
    [getOtherParticipant]
  );

  const getChatAvatar = useCallback(
    (chat) => {
      if (chat.isGroup) return 'https://i.pravatar.cc/150?img=32';
      return getOtherParticipant(chat)?.avatar || 'https://i.pravatar.cc/150?img=12';
    },
    [getOtherParticipant]
  );

  // Fetch initial chat list
  useEffect(() => {
    let active = true;

    const fetchInbox = async () => {
      try {
        const { data } = await axiosInstance.get('/chats');
        if (!active) return;
        setChats(Array.isArray(data) ? data : data?.chats || []);
      } catch (err) {
        if (active) console.error('Failed to fetch chats:', err);
      }
    };

    fetchInbox();
    return () => {
      active = false;
    };
  }, []);

  // Search users
  useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        if (active) setSearchResults([]);
        return;
      }
      try {
        const { data } = await axiosInstance.get(
          `/auth/users?search=${encodeURIComponent(searchQuery.trim())}`
        );
        if (!active) return;
        setSearchResults(Array.isArray(data) ? data : data?.users || []);
      } catch (err) {
        if (active) {
          console.error('User search failed:', err);
          setSearchResults([]);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Select chat, load messages & mark as read
  const handleSelectChat = useCallback(
    async (chat) => {
      if (!chat?._id) return;
      setActionError('');
      setSelectedChat(chat);
      setTypingUserId(null);
      setLoadingMessages(true);

      socket?.emit('join_chat', chat._id);

      try {
        const { data } = await axiosInstance.get(`/messages/${chat._id}?page=1&limit=30`);
        setMessages(Array.isArray(data) ? data : data?.messages || []);
        await axiosInstance.patch(`/messages/${chat._id}/read`);
        socket?.emit('mark_read', { chatId: chat._id });
      } catch (err) {
        console.error('Failed to load messages:', err);
        setActionError('Failed to load messages.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [socket]
  );

  // Start 1-on-1 chat with searched user
  const handleStartChatWithUser = async (targetUser) => {
    try {
      const { data: chat } = await axiosInstance.post('/chats', { userId: targetUser._id });
      setChats((prev) => {
        const exists = prev.some((c) => c._id === chat._id);
        return exists ? prev : [chat, ...prev];
      });
      setSearchQuery('');
      setSearchResults([]);
      await handleSelectChat(chat);
    } catch (err) {
      console.error('Failed to create/open chat:', err);
      setActionError('Could not start chat with user.');
    }
  };

  // Socket real-time listeners (receive_message, typing, chat_messages_read, message_deleted)
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (newMsg) => {
      if (!newMsg) return;
      const msgChatId = typeof newMsg.chatId === 'object' ? newMsg.chatId._id : newMsg.chatId;
      const senderId = typeof newMsg.sender === 'object' ? newMsg.sender._id : newMsg.sender;

      setChats((prev) => {
        const updated = prev.map((c) =>
          c._id === msgChatId
            ? { ...c, latestMessage: newMsg, updatedAt: new Date().toISOString() }
            : c
        );
        return [...updated].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });

      if (selectedChatRef.current?._id === msgChatId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        if (senderId !== user?._id) {
          socket.emit('mark_read', { chatId: msgChatId });
        }
      }
    };

    const handleTyping = ({ chatId, userId: senderId }) => {
      if (selectedChatRef.current?._id === chatId && senderId !== user?._id) {
        setTypingUserId(senderId);
      }
    };

    const handleStopTyping = ({ chatId, userId: senderId }) => {
      if (
        selectedChatRef.current?._id === chatId &&
        senderId === typingUserIdRef.current
      ) {
        setTypingUserId(null);
      }
    };

    const handleChatMessagesRead = ({ chatId, readerId }) => {
      if (readerId === user?._id) return;

      if (selectedChatRef.current?._id === chatId) {
        setMessages((prev) =>
          prev.map((msg) => {
            const msgSenderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            return msgSenderId === user?._id ? { ...msg, status: 'read' } : msg;
          })
        );
      }

      setChats((prev) =>
        prev.map((c) => {
          if (c._id !== chatId || !c.latestMessage) return c;
          const latestSenderId =
            typeof c.latestMessage.sender === 'object'
              ? c.latestMessage.sender._id
              : c.latestMessage.sender;
          return latestSenderId === user?._id
            ? { ...c, latestMessage: { ...c.latestMessage, status: 'read' } }
            : c;
        })
      );
    };

    const handleMessageDeleted = ({ messageId, chatId, newLatestMessage, wasLatest }) => {
      if (selectedChatRef.current?._id === chatId) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }

      if (wasLatest) {
        setChats((prev) =>
          prev.map((c) =>
            c._id === chatId
              ? {
                  ...c,
                  latestMessage: newLatestMessage || { content: 'Message deleted' },
                }
              : c
          )
        );
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);
    socket.on('chat_messages_read', handleChatMessagesRead);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
      socket.off('chat_messages_read', handleChatMessagesRead);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, user?._id]);

  const handleTypingSignal = () => {
    if (!socket || !selectedChat) return;
    socket.emit('typing', { chatId: selectedChat._id });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { chatId: selectedChat._id });
    }, 1500);
  };

  // Send message (text + optional attachment)
  const handleSendMessage = async ({ content, file }) => {
    if (!selectedChat || (!content && !file)) return;
    setActionError('');
    socket?.emit('stop_typing', { chatId: selectedChat._id });

    let attachment = null;
    if (file) {
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await axiosInstance.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        attachment = data;
      } catch (err) {
        console.error('File upload failed:', err);
        setActionError('Failed to upload file.');
        return;
      } finally {
        setUploadingFile(false);
      }
    }

    const finalText = content || (attachment ? attachment.name : '');

    if (socket?.connected) {
      socket.emit('send_message', {
        chatId: selectedChat._id,
        content: finalText,
        attachment,
      });
    } else {
      try {
        const { data } = await axiosInstance.post('/messages', {
          chatId: selectedChat._id,
          content: finalText,
          attachment,
        });
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        console.error('Send message failed:', err);
        setActionError('Failed to send message.');
      }
    }
  };

  // Delete own message
  const handleDeleteMessage = (messageId) => {
    if (!selectedChat || !messageId) return;

    if (socket?.connected) {
      socket.emit('delete_message', {
        messageId,
        chatId: selectedChat._id,
      });
    } else {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    }
  };

  const otherUser = selectedChat && !selectedChat.isGroup ? getOtherParticipant(selectedChat) : null;
  const isOtherOnline = otherUser ? onlineUsers.includes(otherUser._id) : false;

  const statusLabel = typingUserId
    ? 'Typing...'
    : selectedChat?.isGroup
      ? `${selectedChat.participants?.length || 0} members`
      : isOtherOnline
        ? 'Online'
        : 'Offline';

  return (
    <div className="h-screen bg-[#0B141A] text-[#E9EDEF] flex overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className={`${
          selectedChat ? 'hidden md:flex' : 'flex'
        } w-full md:w-[370px] bg-[#111B21] border-r border-[#202C33] flex-col shrink-0`}
      >
        {/* Top User Bar */}
        <div className="h-16 px-4 bg-[#111B21] border-b border-[#202C33] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={user?.avatar || 'https://i.pravatar.cc/150?img=12'}
              alt={user?.name || 'User'}
              className="w-9 h-9 rounded-full object-cover bg-[#202C33]"
            />
            <span className="font-semibold text-[15px] truncate">{user?.name || 'Chats'}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
              title="Create Group"
              className="p-2 rounded-full text-[#8696A0] hover:bg-[#202C33] hover:text-[#E9EDEF] transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={logout}
              title="Logout"
              className="p-2 rounded-full text-[#8696A0] hover:bg-[#202C33] hover:text-[#E9EDEF] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-2.5 border-b border-[#202C33]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8696A0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users to start chat..."
              className="w-full bg-[#202C33] text-sm text-[#E9EDEF] placeholder-[#8696A0] rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
            />
          </div>
        </div>

        {/* Search Results or Chats List */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim() ? (
            searchResults.length > 0 ? (
              searchResults.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => handleStartChatWithUser(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#202C33]/70 border-b border-[#202C33]/50 text-left cursor-pointer"
                >
                  <img
                    src={u.avatar || 'https://i.pravatar.cc/150?img=12'}
                    alt={u.name}
                    className="w-11 h-11 rounded-full object-cover bg-[#202C33]"
                  />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium truncate">{u.name}</p>
                    <p className="text-xs text-[#8696A0] truncate">{u.email}</p>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-sm text-[#8696A0] py-8">No matching users found</p>
            )
          ) : chats.length > 0 ? (
            chats.map((chat) => {
              const peer = getOtherParticipant(chat);
              const lastMsgObj = chat.latestMessage;
              const timeStr = lastMsgObj?.createdAt
                ? new Date(lastMsgObj.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <ChatListItem
                  key={chat._id}
                  name={getChatDisplayName(chat)}
                  avatarUrl={getChatAvatar(chat)}
                  lastMessage={lastMsgObj?.content || 'Start a conversation'}
                  hasAttachment={Boolean(lastMsgObj?.attachment)}
                  timestamp={timeStr}
                  isOnline={!chat.isGroup && peer ? onlineUsers.includes(peer._id) : false}
                  isSentByMe={
                    lastMsgObj?.sender?._id === user?._id || lastMsgObj?.sender === user?._id
                  }
                  deliveryStatus={lastMsgObj?.status || 'sent'}
                  isActive={selectedChat?._id === chat._id}
                  onClick={() => handleSelectChat(chat)}
                />
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 text-[#8696A0]">
              <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No chats yet. Search a user above to start messaging.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Right Panel: Active Chat Thread */}
      <main
        className={`${
          selectedChat ? 'flex' : 'hidden md:flex'
        } flex-1 flex-col bg-[#0B141A] min-w-0`}
        onInput={handleTypingSignal}
      >
        {selectedChat ? (
          <>
            <ChatHeader
              userName={getChatDisplayName(selectedChat)}
              avatarUrl={getChatAvatar(selectedChat)}
              statusText={statusLabel}
              isTyping={Boolean(typingUserId)}
              isOnline={!selectedChat.isGroup && isOtherOnline}
              onBack={() => setSelectedChat(null)}
            />

            {actionError && (
              <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
                {actionError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMessages ? (
                <p className="text-center text-sm text-[#8696A0] mt-6">Loading messages...</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-[#8696A0] mt-6">
                  No messages yet. Say hello!
                </p>
              ) : (
                messages.map((msg) => {
                  const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
                  const isMine = senderId === user?._id;
                  const timeFormatted = msg.createdAt
                    ? new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div key={msg._id} className="group flex items-center justify-end gap-1.5">
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg._id)}
                          title="Delete message"
                          aria-label="Delete message"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-full text-[#8696A0] hover:text-red-400 hover:bg-[#202C33]/60 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="flex-1">
                        <MessageBubble
                          text={msg.content}
                          timestamp={timeFormatted}
                          isMe={isMine}
                          status={msg.status || 'sent'}
                          attachment={msg.attachment}
                        />
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <MessageInputBar
              onSendMessage={handleSendMessage}
              uploading={uploadingFile}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#8696A0]">
            <div className="w-16 h-16 rounded-full bg-[#111B21] flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#00A884]" />
            </div>
            <h2 className="text-xl font-semibold text-[#E9EDEF]">Select a Chat</h2>
            <p className="text-sm max-w-sm mt-1">
              Choose an existing conversation from the left panel or search for a user to begin.
            </p>
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onGroupCreated={(newGroup) => {
          setChats((prev) => [newGroup, ...prev]);
          handleSelectChat(newGroup);
        }}
      />
    </div>
  );
}