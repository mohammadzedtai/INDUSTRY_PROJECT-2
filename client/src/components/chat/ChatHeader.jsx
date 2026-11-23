import React from 'react';
import { ArrowLeft, Phone, Video, MoreVertical } from 'lucide-react';

export function ChatHeader({
  userName = 'Chat',
  avatarUrl = 'https://i.pravatar.cc/150?img=12',
  statusText = 'Offline', // 'Online' | 'Typing...' | 'Offline' | '3 members'
  isTyping = false,
  isOnline = false,
  onBack,
  onVoiceCall,
  onVideoCall,
  onOpenMenu,
}) {
  return (
    <header className="h-16 px-3 sm:px-4 bg-[#111B21] border-b border-[#202C33] flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {typeof onBack === 'function' && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chats"
            className="md:hidden p-2 rounded-full text-[#E9EDEF] hover:bg-[#202C33] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="relative shrink-0">
          <img
            src={avatarUrl}
            alt={userName}
            className="w-10 h-10 rounded-full object-cover bg-[#202C33]"
          />
          {isOnline && !isTyping && (
            <span
              title="Online"
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00A884] ring-2 ring-[#111B21]"
            />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-[#E9EDEF] truncate leading-tight">
            {userName}
          </h2>
          <p
            className={`text-[12px] truncate mt-0.5 ${
              isTyping
                ? 'text-[#00A884] font-medium'
                : isOnline
                  ? 'text-[#00A884]/90'
                  : 'text-[#8696A0]'
            }`}
          >
            {statusText}
          </p>
        </div>
      </div>

      {/* Header Action Buttons */}
      <div className="flex items-center gap-1 text-[#8696A0]">
        {typeof onVideoCall === 'function' && (
          <button
            type="button"
            onClick={onVideoCall}
            aria-label="Video call"
            className="p-2 rounded-full hover:bg-[#202C33] hover:text-[#E9EDEF] transition-colors cursor-pointer"
          >
            <Video className="w-5 h-5" />
          </button>
        )}
        {typeof onVoiceCall === 'function' && (
          <button
            type="button"
            onClick={onVoiceCall}
            aria-label="Voice call"
            className="p-2 rounded-full hover:bg-[#202C33] hover:text-[#E9EDEF] transition-colors cursor-pointer"
          >
            <Phone className="w-5 h-5" />
          </button>
        )}
        {typeof onOpenMenu === 'function' && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="More options"
            className="p-2 rounded-full hover:bg-[#202C33] hover:text-[#E9EDEF] transition-colors cursor-pointer"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
}