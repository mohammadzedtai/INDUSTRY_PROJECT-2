import React from 'react';
import { Check, CheckCheck, FileText, Download } from 'lucide-react';

export function MessageBubble({
  text = '',
  timestamp = '',
  isMe = false,
  status = 'read',
  replyTo = null,
  attachment = null, // { url, name, mimeType, size }
}) {
  const hasValidAttachment = Boolean(attachment?.url);
  const isImage =
    hasValidAttachment &&
    typeof attachment?.mimeType === 'string' &&
    attachment.mimeType.toLowerCase().startsWith('image/');
  const fileSizeNumber = Number(attachment?.size);
  const showFileSize = Number.isFinite(fileSizeNumber) && fileSizeNumber > 0;

  // Avoid showing duplicate filename text when an image or file attachment already displays it
  const showCaptionText =
    Boolean(text?.trim()) &&
    (!hasValidAttachment || text.trim() !== attachment.name?.trim());

  return (
    <div className={`flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm ${
          isMe
            ? 'bg-[#005C4B] text-[#E9EDEF] rounded-tr-sm'
            : 'bg-[#202C33] text-[#E9EDEF] rounded-tl-sm'
        }`}
      >
        {replyTo && (replyTo.senderName || replyTo.text) && (
          <div className="mb-1.5 pl-2.5 pr-2 py-1 rounded-lg bg-[#0B141A]/40 border-l-4 border-[#00A884] text-xs">
            <p className="font-semibold text-[#00A884] truncate">
              {replyTo.senderName || 'Reply'}
            </p>
            <p className="text-[#8696A0] truncate">{replyTo.text || ''}</p>
          </div>
        )}

        {/* Attachment Render */}
        {hasValidAttachment && (
          <div className="mb-1.5">
            {isImage ? (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={attachment.url}
                  alt={attachment.name || 'Image attachment'}
                  className="max-h-64 w-full rounded-xl object-cover bg-[#0B141A]"
                />
              </a>
            ) : (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                download={attachment.name || 'attachment'}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#0B141A]/40 hover:bg-[#0B141A]/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-[#00A884] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">
                      {attachment.name || 'Download file'}
                    </p>
                    {showFileSize && (
                      <p className="text-[11px] text-[#8696A0]">
                        {(fileSizeNumber / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </div>
                <Download className="w-4 h-4 text-[#8696A0] shrink-0" />
              </a>
            )}
          </div>
        )}

        {/* Message Text + Timestamp */}
        <div className="flex flex-wrap items-end justify-end gap-2">
          {showCaptionText && (
            <p className="text-[15px] leading-[1.45] whitespace-pre-wrap break-words flex-1 min-w-[60px]">
              {text}
            </p>
          )}

          <div className="flex items-center gap-1 text-[11px] text-[#E9EDEF]/70 shrink-0 ml-auto pt-0.5">
            {timestamp && <span>{timestamp}</span>}
            {isMe && (
              <span>
                {status === 'read' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                ) : status === 'delivered' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#E9EDEF]/70" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-[#E9EDEF]/70" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}