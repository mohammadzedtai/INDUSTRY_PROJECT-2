import React, { useState, useRef } from 'react';
import { Smile, Paperclip, Mic, Send, X, FileText, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function MessageInputBar({
  onSendMessage,
  onVoiceRecord,
  replyingTo = null,
  onCancelReply,
  uploading = false,
}) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInput = (e) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 112)}px`;
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError('File size must be 10 MB or less.');
      return;
    }

    setFileError('');
    setSelectedFile(file);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !selectedFile) || uploading) return;

    const fileToSend = selectedFile;
    setText('');
    setSelectedFile(null);
    setFileError('');
    resetTextareaHeight();

    await onSendMessage?.({ content: trimmed, file: fileToSend });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = text.trim().length > 0 || Boolean(selectedFile);

  return (
    <footer className="bg-[#111B21] border-t border-[#202C33] px-3 py-2 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {fileError && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center justify-between gap-2">
          <span>{fileError}</span>
          <button
            type="button"
            onClick={() => setFileError('')}
            aria-label="Dismiss error"
            className="p-0.5 text-red-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {replyingTo && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-[#202C33] border-l-4 border-[#00A884] flex items-center justify-between gap-2">
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-[#00A884] truncate">
              {replyingTo.senderName || 'Reply'}
            </p>
            <p className="text-[#8696A0] truncate">{replyingTo.text || ''}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="p-1 text-[#8696A0] hover:text-[#E9EDEF] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="mb-2 px-3 py-2 rounded-xl bg-[#202C33] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <FileText className="w-4 h-4 text-[#00A884] shrink-0" />
            <span className="truncate text-[#E9EDEF]">{selectedFile.name}</span>
            <span className="text-[#8696A0] shrink-0">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            disabled={uploading}
            aria-label="Remove attachment"
            className="p-1 text-[#8696A0] hover:text-[#E9EDEF] disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 flex items-end gap-1.5 bg-[#202C33] rounded-2xl px-3 py-1.5">
          <button
            type="button"
            aria-label="Emoji"
            className="p-1.5 text-[#8696A0] hover:text-[#E9EDEF] transition-colors shrink-0"
          >
            <Smile className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? 'Uploading attachment...' : 'Type a message...'}
            disabled={uploading}
            className="w-full bg-transparent text-[15px] text-[#E9EDEF] placeholder-[#8696A0] resize-none focus:outline-none py-1.5 max-h-28 leading-[1.4]"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach file"
            className="p-1.5 text-[#8696A0] hover:text-[#E9EDEF] transition-colors shrink-0 cursor-pointer"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        {canSend ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={uploading}
            aria-label="Send message"
            className="w-11 h-11 rounded-full bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-60 text-[#0B141A] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onVoiceRecord}
            disabled={!onVoiceRecord}
            aria-label="Voice message"
            className="w-11 h-11 rounded-full bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 text-[#0B141A] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </footer>
  );
}