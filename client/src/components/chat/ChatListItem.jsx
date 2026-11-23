import React from 'react';
import { Check, CheckCheck, VolumeX, Paperclip } from 'lucide-react';

export function ChatListItem({
  name = 'Unknown Chat',
  avatarUrl = 'https://i.pravatar.cc/150?img=12',
  lastMessage = '',
  hasAttachment = false,
  timestamp = '',
  unreadCount = 0,
  isOnline = false,
  isMuted = false,
  deliveryStatus = 'sent', // 'sent' | 'delivered' | 'read'
  isSentByMe = false,
  isActive = false,
  onClick,
}) {
  const safeUnreadCount = Number(unreadCount) > 0 ? Number(unreadCount) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b border-[#202C33]/60 cursor-pointer ${
        isActive ? 'bg-[#2A3942]' : 'bg-[#111B21] hover:bg-[#202C33]/70'
      }`}
    >
      {/* Avatar + Online Status Dot */}
      <div className="relative shrink-0">
        <img
          src={avatarUrl || 'https://i.pravatar.cc/150?img=12'}
          alt={name || 'Avatar'}
          className="w-12 h-12 rounded-full object-cover bg-[#202C33]"
        />
        {isOnline && (
          <span
            title="Online"
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00A884] ring-2 ring-[#111B21]"
          />
        )}
      </div>

      {/* Chat Name, Last Message & Metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-semibold text-[#E9EDEF] truncate">
            {name}
          </h3>
          {timestamp && (
            <span
              className={`text-[12px] shrink-0 ${
                safeUnreadCount > 0 ? 'text-[#00A884] font-semibold' : 'text-[#8696A0]'
              }`}
            >
              {timestamp}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1 min-w-0 text-[14px] text-[#8696A0]">
            {isSentByMe && (
              <span className="shrink-0">
                {deliveryStatus === 'read' ? (
                  <CheckCheck className="w-4 h-4 text-[#53BDEB]" />
                ) : deliveryStatus === 'delivered' ? (
                  <CheckCheck className="w-4 h-4 text-[#8696A0]" />
                ) : (
                  <Check className="w-4 h-4 text-[#8696A0]" />
                )}
              </span>
            )}

            {hasAttachment && <Paperclip className="w-3.5 h-3.5 text-[#8696A0] shrink-0" />}

            <p className={`truncate ${safeUnreadCount > 0 ? 'text-[#E9EDEF] font-medium' : ''}`}>
              {lastMessage || (hasAttachment ? 'Attachment' : 'Start a conversation')}
            </p>
          </div>

          {/* Muted Icon & Unread Counter */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isMuted && <VolumeX className="w-4 h-4 text-[#8696A0]" />}
            {safeUnreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#00A884] text-[#0B141A] text-[11px] font-bold flex items-center justify-center">
                {safeUnreadCount > 99 ? '99+' : safeUnreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}