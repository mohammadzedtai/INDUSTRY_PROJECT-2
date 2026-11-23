import React, { useState, useEffect } from 'react';
import { X, Users, Search, Check, Loader2 } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const timer = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const { data } = await axiosInstance.get(
          `/auth/users?search=${encodeURIComponent(query.trim())}`
        );
        if (!active) return;
        const list = Array.isArray(data) ? data : data?.users || [];
        setUsers(list);
      } catch (err) {
        if (active) {
          console.error('Failed to load users:', err);
          setUsers([]);
        }
      } finally {
        if (active) setLoadingUsers(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, query]);

  if (!isOpen) return null;

  const toggleUser = (targetUser) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u._id === targetUser._id);
      return exists
        ? prev.filter((u) => u._id !== targetUser._id)
        : [...prev, targetUser];
    });
  };

  const resetAndClose = () => {
    setGroupName('');
    setSelectedUsers([]);
    setQuery('');
    setError('');
    onClose?.();
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (!groupName.trim()) {
      setError('Please enter a group name.');
      return;
    }
    if (selectedUsers.length < 2) {
      setError('Select at least 2 members to create a group.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post('/chats/group', {
        name: groupName.trim(),
        users: selectedUsers.map((u) => u._id),
      });
      onGroupCreated?.(data);
      resetAndClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create group.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={resetAndClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#111B21] border border-[#202C33] rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202C33] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00A884]" />
            <h3 className="font-semibold text-base text-[#E9EDEF]">New Group Chat</h3>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-[#8696A0] hover:bg-[#202C33] hover:text-[#E9EDEF] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateGroup} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-[#8696A0] mb-1.5">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Project Alpha Team"
              className="w-full bg-[#202C33] text-sm text-[#E9EDEF] placeholder-[#8696A0] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00A884]"
            />
          </div>

          {/* Selected Members Chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {selectedUsers.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => toggleUser(u)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00A884]/20 text-[#00A884] text-xs font-medium cursor-pointer hover:bg-[#00A884]/30"
                >
                  <span>{u.name}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {/* Search Users */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8696A0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full bg-[#202C33] text-sm text-[#E9EDEF] placeholder-[#8696A0] rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
            />
          </div>

          {/* User Checklist */}
          <div className="max-h-48 overflow-y-auto divide-y divide-[#202C33]/60 border border-[#202C33] rounded-xl">
            {loadingUsers ? (
              <p className="text-center text-xs text-[#8696A0] py-6">Loading users...</p>
            ) : users.length > 0 ? (
              users.map((u) => {
                const isSelected = selectedUsers.some((s) => s._id === u._id);
                return (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => toggleUser(u)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-[#202C33]/60 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={u.avatar || 'https://i.pravatar.cc/150?img=12'}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover bg-[#202C33]"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#E9EDEF] truncate">{u.name}</p>
                        <p className="text-xs text-[#8696A0] truncate">{u.email}</p>
                      </div>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? 'bg-[#00A884] border-[#00A884] text-[#0B141A]'
                          : 'border-[#8696A0]'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="text-center text-xs text-[#8696A0] py-6">No users available</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 rounded-xl bg-[#202C33] text-sm text-[#E9EDEF] hover:bg-[#2A3942] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-60 text-sm font-semibold text-[#0B141A] flex items-center gap-1.5 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}