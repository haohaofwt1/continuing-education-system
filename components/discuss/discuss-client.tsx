"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, FileText, Hash, Inbox, MessageCircle, Paperclip, Pin, Plus, Search, Send, Smile, Star, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEmployees } from "@/lib/demo-store";

type ThreadType = "channel" | "direct";
type ThreadPanel = "channel" | "direct";
type Thread = {
  id: string;
  type: ThreadType;
  name: string;
  description: string;
  unread: number;
  online?: boolean;
  persisted?: boolean;
  memberCount?: number;
};
type ChatMessage = {
  id: string;
  threadId: string;
  author: string;
  body: string;
  at: string;
  mine?: boolean;
  attachments?: MessageAttachment[];
};
type MessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};
type ApiThread = {
  id: string;
  type: "CHANNEL" | "DIRECT";
  name: string;
  description: string;
  memberCount: number;
};
type ApiMessage = {
  id: string;
  conversationId: string;
  author: string;
  body: string;
  attachments?: MessageAttachment[];
  createdAt: string;
  mine?: boolean;
};
type DirectoryUser = {
  id: string;
  name: string;
  email?: string;
  department?: string;
  position?: string;
  avatarUrl?: string | null;
};

const channels: Thread[] = [
  { id: "inbox", type: "channel", name: "Inbox", description: "Thông báo hệ thống và việc được nhắc", unread: 2 },
  { id: "all", type: "channel", name: "All", description: "Kênh chung toàn đơn vị", unread: 0 },
  { id: "admins", type: "channel", name: "Administrators", description: "Trao đổi quản trị hệ thống", unread: 1 },
  { id: "training", type: "channel", name: "Đào tạo liên tục", description: "Nhắc hồ sơ, chứng chỉ, số tiết", unread: 0 }
];

const seedMessages: ChatMessage[] = [
  { id: "m1", threadId: "all", author: "Quản trị hệ thống", body: "Nhắc các khoa/phòng rà soát chứng chỉ cần nhập thêm thông tin trong tuần này.", at: "08:30" },
  { id: "m2", threadId: "all", author: "Nguyễn Văn An", body: "Phòng khám đã bổ sung xong danh sách nhân sự thiếu số tiết.", at: "08:42" },
  { id: "m3", threadId: "training", author: "Trần Thị Bình", body: "Có thể gửi lại link upload chứng chỉ cho nhóm kỹ thuật viên không?", at: "09:05" },
  { id: "m4", threadId: "admins", author: "Quản trị hệ thống", body: "API OCR đang dùng adapter mock, chưa gọi provider thật.", at: "09:20" }
];

function readMessages() {
  if (typeof window === "undefined") return seedMessages;
  const raw = window.localStorage.getItem("cme.demo.discuss.messages");
  if (!raw) return seedMessages;
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return seedMessages;
  }
}

function saveMessages(messages: ChatMessage[]) {
  window.localStorage.setItem("cme.demo.discuss.messages", JSON.stringify(messages));
}

function readThreads(fallback: Thread[]) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem("cme.demo.discuss.threads");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as Thread[];
  } catch {
    return fallback;
  }
}

function saveThreads(threads: Thread[]) {
  window.localStorage.setItem("cme.demo.discuss.threads", JSON.stringify(threads));
}

function apiMessageToChatMessage(message: ApiMessage): ChatMessage {
  return {
    id: message.id,
    threadId: message.conversationId,
    author: message.author,
    body: message.body,
    attachments: message.attachments ?? [],
    at: new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    mine: Boolean(message.mine)
  };
}

function broadcastMessage(message: ChatMessage) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("cme.discuss");
  channel.postMessage({ type: "message-created", message });
  channel.close();
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => window.clearTimeout(timeout));
}

export function DiscussClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const employees = useMemo(() => getEmployees(), []);
  const directThreads = useMemo<Thread[]>(() => employees.slice(0, 10).map((employee, index) => ({
    id: `dm-${employee.id}`,
    type: "direct",
    name: employee.name,
    description: employee.position,
    unread: index % 4 === 0 ? 1 : 0,
    online: index % 3 !== 0
  })), [employees]);
  const fallbackThreads = useMemo(() => [...channels, ...directThreads], [directThreads]);
  const [localThreads, setLocalThreads] = useState<Thread[]>(() => readThreads(fallbackThreads));
  const [serverThreads, setServerThreads] = useState<Thread[]>([]);
  const threads = serverThreads.length ? serverThreads : localThreads;
  const [activeId, setActiveId] = useState("all");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => readMessages());
  const [draft, setDraft] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ThreadPanel>("channel");
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>(() => employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    department: employee.department,
    position: employee.position,
    avatarUrl: employee.avatarUrl
  })));
  const [storageMode, setStorageMode] = useState<"database" | "demo">("demo");
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const activeThread = threads.find((thread) => thread.id === activeId) ?? threads[0];
  const visibleThreads = threads.filter((thread) => thread.type === activePanel && (!query || `${thread.name} ${thread.description}`.toLowerCase().includes(query.toLowerCase())));
  const activeMessages = messages.filter((message) => message.threadId === activeThread.id);

  useEffect(() => {
    if (threads.some((thread) => thread.id === activeId && thread.type === activePanel)) return;
    const next = threads.find((thread) => thread.type === activePanel);
    if (next) setActiveId(next.id);
  }, [activeId, activePanel, threads]);

  useEffect(() => {
    fetchWithTimeout("/api/discuss/users", undefined, 2500)
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload: { data?: DirectoryUser[] }) => {
        if (Array.isArray(payload.data) && payload.data.length) setDirectoryUsers(payload.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLocalThreads((current) => {
      const existing = new Set(current.map((thread) => thread.id));
      const merged = [...current, ...fallbackThreads.filter((thread) => !existing.has(thread.id))];
      saveThreads(merged);
      return merged;
    });
  }, [fallbackThreads]);

  useEffect(() => {
    let cancelled = false;
    async function loadThreads() {
      try {
        const response = await fetchWithTimeout("/api/discuss/threads", undefined, 2500);
        if (!response.ok) throw new Error("threads unavailable");
        const payload = await response.json();
        const nextThreads = (payload.data as ApiThread[]).map((thread) => ({
          id: thread.id,
          type: thread.type === "CHANNEL" ? "channel" : "direct",
          name: thread.name,
          description: thread.description,
          unread: 0,
          online: true,
          persisted: true,
          memberCount: thread.memberCount
        } satisfies Thread));
        if (!cancelled && nextThreads.length) {
          setServerThreads(nextThreads);
          setActiveId((current) => nextThreads.some((thread) => thread.id === current) ? current : nextThreads.find((thread) => thread.type === activePanel)?.id ?? nextThreads[0].id);
          setStorageMode("database");
        }
      } catch {
        if (!cancelled) {
          setStorageMode("demo");
        }
      }
    }
    void loadThreads();
    const interval = window.setInterval(loadThreads, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activePanel]);

  useEffect(() => {
    if (!activeThread?.persisted) return;
    let cancelled = false;
    async function loadMessages() {
      try {
        const response = await fetchWithTimeout(`/api/discuss/messages?conversationId=${encodeURIComponent(activeThread.id)}`, undefined, 2500);
        if (!response.ok) throw new Error("messages unavailable");
        const payload = await response.json();
        const nextMessages = (payload.data as ApiMessage[]).map(apiMessageToChatMessage);
        if (!cancelled) {
          setMessages((current) => {
            const optimisticMine = current.filter((message) => message.threadId === activeThread.id && message.id.startsWith("optimistic-"));
            return [...current.filter((message) => message.threadId !== activeThread.id), ...nextMessages, ...optimisticMine];
          });
          setLastSyncedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
          setStorageMode("database");
        }
      } catch {
        if (!cancelled) {
          setStorageMode("demo");
        }
      }
    }
    void loadMessages();
    const interval = window.setInterval(loadMessages, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeThread?.id, activeThread?.persisted]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("cme.discuss");
    channel.onmessage = (event) => {
      const message = event.data as { type?: string; message?: ChatMessage };
      if (message.type !== "message-created" || !message.message) return;
      setMessages((current) => current.some((item) => item.id === message.message?.id) ? current : [...current, message.message as ChatMessage]);
    };
    return () => channel.close();
  }, []);

  const send = async () => {
    const body = draft.trim();
    if ((!body && !selectedFiles.length) || sending) return;
    setSending(true);

    if (activeThread.persisted) {
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        threadId: activeThread.id,
        author: "Bạn",
        body,
        attachments: selectedFiles.map((file, index) => ({
          id: `local-${Date.now()}-${index}`,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          url: URL.createObjectURL(file)
        })),
        at: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        mine: true
      };
      setMessages((current) => [...current, optimistic]);
      setDraft("");
      setSelectedFiles([]);
      try {
        const formData = new FormData();
        formData.append("conversationId", activeThread.id);
        formData.append("body", body);
        selectedFiles.forEach((file) => formData.append("files", file));
        const response = await fetchWithTimeout("/api/discuss/messages", { method: "POST", body: formData }, 8000);
        if (!response.ok) throw new Error("send failed");
        const payload = await response.json();
        const saved = payload.data as ApiMessage;
        const savedMessage = {
          id: saved.id,
          threadId: saved.conversationId,
          author: "Bạn",
          body: saved.body,
          attachments: saved.attachments ?? [],
          at: new Date(saved.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          mine: true
        };
        setMessages((current) => current.map((message) => message.id === optimistic.id ? savedMessage : message));
        broadcastMessage(savedMessage);
        setStorageMode("database");
        setSending(false);
        return;
      } catch {
        setStorageMode("demo");
      }
    }

    const next = [...messages, {
      id: `m-${Date.now()}`,
      threadId: activeThread.id,
      author: "Bạn",
      body,
      attachments: selectedFiles.map((file, index) => ({
        id: `local-${Date.now()}-${index}`,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        url: URL.createObjectURL(file)
      })),
      at: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      mine: true
    }];
    setMessages(next);
    saveMessages(next);
    broadcastMessage(next[next.length - 1]);
    setDraft("");
    setSelectedFiles([]);
    setSending(false);
  };

  const createThread = async (payload: { type: ThreadType; name: string; description: string; memberIds: string[] }) => {
    {
      try {
        const response = await fetchWithTimeout("/api/discuss/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: payload.type === "channel" ? "CHANNEL" : "DIRECT",
            name: payload.name,
            description: payload.description,
            memberIds: payload.memberIds
          })
        }, 2500);
        if (!response.ok) throw new Error("create thread failed");
        const saved = await response.json() as { data: { id: string } };
        const selectedUser = directoryUsers.find((user) => payload.memberIds.includes(user.id));
        const thread: Thread = {
          id: saved.data.id,
          type: payload.type,
          name: payload.type === "direct" ? selectedUser?.name ?? payload.name : payload.name,
          description: payload.type === "direct" ? selectedUser?.position ?? selectedUser?.email ?? "Tin nhắn trực tiếp" : payload.description || "Kênh trao đổi nội bộ",
          unread: 0,
          online: payload.type === "direct" ? true : undefined,
          persisted: true,
          memberCount: payload.type === "direct" ? 2 : payload.memberIds.length + 1
        };
        setServerThreads((current) => current.some((item) => item.id === thread.id) ? current : [thread, ...current]);
        setStorageMode("database");
        setActivePanel(payload.type);
        setActiveId(saved.data.id);
        setCreateOpen(false);
        setDirectOpen(false);
        return;
      } catch {
        setStorageMode("demo");
      }
    }

    const selectedUser = directoryUsers.find((user) => payload.memberIds.includes(user.id));
    const thread: Thread = {
      id: `${payload.type === "channel" ? "ch" : "dm"}-${Date.now()}`,
      type: payload.type,
      name: payload.type === "direct" ? selectedUser?.name ?? payload.name : payload.name,
      description: payload.type === "direct" ? selectedUser?.position ?? selectedUser?.email ?? "Tin nhắn trực tiếp" : payload.description || "Kênh trao đổi nội bộ",
      unread: 0,
      online: payload.type === "direct" ? true : undefined,
      memberCount: payload.type === "direct" ? 2 : payload.memberIds.length + 1
    };
    const nextThreads = [...localThreads, thread];
    setLocalThreads(nextThreads);
    saveThreads(nextThreads);
    const welcome: ChatMessage = {
      id: `m-${Date.now()}`,
      threadId: thread.id,
      author: "Hệ thống",
      body: payload.type === "direct" ? `Đã mở tin nhắn trực tiếp với ${thread.name}.` : `Đã tạo kênh ${thread.name}. Thành viên có thể trao đổi, ghim thông tin và theo dõi công việc tại đây.`,
      at: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    };
    const nextMessages = [...messages, welcome];
    setMessages(nextMessages);
    saveMessages(nextMessages);
    setActivePanel(payload.type);
    setActiveId(thread.id);
    setCreateOpen(false);
    setDirectOpen(false);
  };

  return (
    <div className="-m-4 flex h-[calc(100vh-5rem)] overflow-hidden rounded-none border bg-white shadow-sm lg:-m-6 lg:h-[calc(100vh-5rem)] lg:rounded-3xl">
      <aside className="hidden w-80 flex-none border-r bg-slate-50/80 md:flex md:flex-col">
        <div className="border-b bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white"><MessageCircle className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-950">Discuss</div>
              <div className="text-xs text-slate-500">Tin nhắn nội bộ · {storageMode === "database" ? `Đã đồng bộ ${lastSyncedAt || ""}` : "Chế độ offline"}</div>
            </div>
            <Button size="icon" variant="secondary" aria-label={activePanel === "channel" ? "Tạo channel" : "Tạo direct message"} onClick={() => activePanel === "channel" ? setCreateOpen(true) : setDirectOpen(true)}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 grid grid-cols-2 rounded-2xl border bg-slate-50 p-1">
            <button type="button" onClick={() => setActivePanel("channel")} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${activePanel === "channel" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Channels</button>
            <button type="button" onClick={() => setActivePanel("direct")} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${activePanel === "direct" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Direct</button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Search conversations" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {activePanel === "channel" ? (
          <ThreadSection title="Channels" action={<button type="button" onClick={() => setCreateOpen(true)} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">Tạo</button>}>
            {visibleThreads.map((thread) => (
              <ThreadButton key={thread.id} thread={thread} active={thread.id === activeId} onClick={() => setActiveId(thread.id)} />
            ))}
          </ThreadSection>
          ) : (
          <ThreadSection title="Direct messages" action={<button type="button" onClick={() => setDirectOpen(true)} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">Chọn người</button>}>
            {visibleThreads.map((thread) => (
              <ThreadButton key={thread.id} thread={thread} active={thread.id === activeId} onClick={() => setActiveId(thread.id)} />
            ))}
            {!visibleThreads.length ? (
              <button type="button" onClick={() => setDirectOpen(true)} className="mt-2 w-full rounded-2xl border border-dashed bg-white p-4 text-left text-sm text-slate-500 transition hover:border-teal-300 hover:bg-teal-50">
                <div className="font-semibold text-slate-800">Chọn người để chat</div>
                <div className="mt-1 text-xs">Tạo hội thoại trực tiếp với nhân viên hoặc quản trị viên.</div>
              </button>
            ) : null}
          </ThreadSection>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {activeThread.type === "channel" ? <Hash className="h-5 w-5 text-teal-700" /> : <Avatar name={activeThread.name} online={activeThread.online} />}
              <h1 className="truncate text-base font-bold text-slate-950">{activeThread.name}</h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{activeThread.description}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Star"><Star className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Pin"><Pin className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-4 scrollbar-thin">
          <div className="mx-auto max-w-3xl space-y-4">
            {activeMessages.length ? activeMessages.map((message) => <MessageBubble key={message.id} message={message} />) : (
              <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed bg-white p-6 text-center">
                <div>
                  <MessageCircle className="mx-auto h-10 w-10 text-teal-600" />
                  <div className="mt-3 font-semibold text-slate-950">Chưa có tin nhắn trong {activeThread.name}</div>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">Bắt đầu trao đổi, phân công người xử lý hoặc gửi nhắc hồ sơ trong khung bên dưới.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {["Nhắc rà soát chứng chỉ cần nhập thêm", "Ai phụ trách cập nhật CCHN?", "Tổng hợp việc cần xử lý hôm nay"].map((item) => (
                      <button key={item} type="button" onClick={() => setDraft(item)} className="rounded-full border px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:bg-teal-50">{item}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="border-t bg-white p-4">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-2 shadow-sm">
            {selectedFiles.length ? (
              <div className="mb-2 flex flex-wrap gap-2 px-1">
                {selectedFiles.map((file) => (
                  <span key={`${file.name}-${file.size}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    <FileText className="h-3.5 w-3.5 flex-none text-teal-700" />
                    <span className="max-w-48 truncate">{file.name}</span>
                    <button type="button" onClick={() => setSelectedFiles((items) => items.filter((item) => item !== file))} className="rounded-md p-0.5 text-slate-400 hover:bg-white hover:text-slate-700" aria-label={`Bỏ ${file.name}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setSelectedFiles((items) => [...items, ...files].slice(0, 5));
                event.target.value = "";
              }}
            />
            <Button variant="ghost" size="icon" aria-label="Attach" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-4 w-4" /></Button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={`Nhắn tin tới ${activeThread.name}...`}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
            />
            <Button variant="ghost" size="icon" aria-label="Emoji"><Smile className="h-4 w-4" /></Button>
            <Button onClick={send} size="icon" aria-label="Send" disabled={sending || (!draft.trim() && !selectedFiles.length)}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </footer>
      </section>

      <aside className="hidden w-80 flex-none border-l bg-white xl:block">
        <div className="border-b p-4">
          <div className="text-sm font-semibold uppercase text-teal-700">Thông tin</div>
          <div className="mt-3 flex items-center gap-3">
            {activeThread.type === "channel" ? <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700"><UsersRound className="h-6 w-6" /></div> : <Avatar name={activeThread.name} online={activeThread.online} large />}
            <div>
              <div className="font-bold text-slate-950">{activeThread.name}</div>
              <div className="text-sm text-slate-500">{activeThread.description}</div>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <InfoRow label="Loại" value={activeThread.type === "channel" ? "Kênh nội bộ" : "Tin nhắn trực tiếp"} />
          <InfoRow label="Thành viên" value={activeThread.type === "channel" ? `${activeThread.memberCount ?? employees.length + 1} người` : "2 người"} />
          <InfoRow label="Lưu trữ" value={storageMode === "database" ? "PostgreSQL / Prisma" : "Thiết bị hiện tại"} />
          <InfoRow label="Trạng thái" value={storageMode === "database" ? "Đã kết nối dữ liệu" : "Offline fallback"} />
          <div className="rounded-2xl border bg-teal-50 p-3 text-teal-900">
            Tin nhắn dùng chung cho admin và portal nhân viên. Hệ thống đã ghi nhận đọc tin nhắn; file đính kèm sẽ hiển thị trong cùng luồng khi bật upload nội bộ.
          </div>
        </div>
      </aside>

      {createOpen ? <CreateChannelDialog employees={employees} onCancel={() => setCreateOpen(false)} onCreate={(payload) => createThread({ type: "channel", ...payload })} /> : null}
      {directOpen ? <CreateDirectDialog users={directoryUsers} onCancel={() => setDirectOpen(false)} onCreate={(user) => createThread({ type: "direct", name: user.name, description: user.position || user.email || "Tin nhắn trực tiếp", memberIds: [user.id] })} /> : null}
    </div>
  );
}

function ThreadSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-2 px-2 text-xs font-semibold uppercase text-slate-400">
        <span className="flex items-center gap-1"><ChevronDown className="h-3 w-3" />{title}</span>
        {action}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ThreadButton({ thread, active, onClick }: { thread: Thread; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${active ? "bg-white text-teal-800 shadow-sm ring-1 ring-teal-100" : "text-slate-600 hover:bg-white"}`}>
      {thread.type === "channel" ? <ChannelIcon id={thread.id} /> : <Avatar name={thread.name} online={thread.online} />}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{thread.name}</div>
        <div className="truncate text-xs text-slate-400">{thread.description}</div>
      </div>
      {thread.unread ? <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">{thread.unread}</span> : null}
    </button>
  );
}

function ChannelIcon({ id }: { id: string }) {
  if (id === "inbox") return <Inbox className="h-5 w-5 text-slate-500" />;
  return <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Hash className="h-4 w-4" /></div>;
}

function Avatar({ name, online, large = false }: { name: string; online?: boolean; large?: boolean }) {
  const initials = name.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase();
  return (
    <div className="relative">
      <div className={`${large ? "h-12 w-12 text-base" : "h-8 w-8 text-xs"} flex items-center justify-center rounded-2xl bg-slate-200 font-bold text-slate-700`}>{initials}</div>
      {online !== undefined ? <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"}`} /> : null}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`flex gap-3 ${message.mine ? "justify-end" : ""}`}>
      {!message.mine ? <Avatar name={message.author} online /> : null}
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${message.mine ? "bg-teal-600 text-white" : "border bg-white text-slate-800"}`}>
        <div className={`mb-1 flex items-center gap-2 text-xs ${message.mine ? "text-teal-50" : "text-slate-500"}`}>
          <span className="font-semibold">{message.author}</span>
          <span>{message.at}</span>
        </div>
        {message.body ? <div className="text-sm leading-6">{message.body}</div> : null}
        {message.attachments?.length ? (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${message.mine ? "bg-white/15 text-white hover:bg-white/25" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
              >
                <FileText className="h-4 w-4 flex-none" />
                <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                <span className={message.mine ? "text-teal-50" : "text-slate-400"}>{formatFileSize(attachment.sizeBytes)}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-2xl border px-3 py-2"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-900">{value}</span></div>;
}

function CreateChannelDialog({
  employees,
  onCancel,
  onCreate
}: {
  employees: ReturnType<typeof getEmployees>;
  onCancel: () => void;
  onCreate: (payload: { name: string; description: string; memberIds: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>(employees.slice(0, 4).map((employee) => employee.id));
  const toggleMember = (id: string) => setMemberIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-bold text-slate-950">Tạo channel mới</div>
            <p className="mt-1 text-sm text-slate-500">Tạo kênh theo khoa/phòng, dự án, nhóm rà soát dữ liệu chứng chỉ hoặc chiến dịch nhắc hồ sơ.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tên channel</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Khoa Dược, Tự động tính tín chỉ, Chu kỳ 2026" autoFocus />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Mô tả</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mục đích trao đổi của kênh..." className="min-h-28 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <div className="rounded-2xl border bg-teal-50 p-3 text-sm leading-6 text-teal-900">
              Channel mới được lưu local khi database chưa chạy. Khi PostgreSQL sẵn sàng, bước tiếp theo là ghi vào `Conversation` và `ConversationMember`.
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thành viên</div>
            <div className="max-h-80 overflow-y-auto rounded-2xl border p-2 scrollbar-thin">
              {employees.map((employee) => (
                <button key={employee.id} type="button" onClick={() => toggleMember(employee.id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2 text-left transition last:mb-0 ${memberIds.includes(employee.id) ? "bg-teal-50 text-teal-900" : "hover:bg-slate-50"}`}>
                  <Avatar name={employee.name} online={memberIds.includes(employee.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{employee.name}</span>
                    <span className="block truncate text-xs text-slate-500">{employee.department} · {employee.position}</span>
                  </span>
                  <span className={`h-4 w-4 rounded border ${memberIds.includes(employee.id) ? "border-teal-600 bg-teal-600" : "border-slate-300"}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
          <Button variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button onClick={() => name.trim() && onCreate({ name: name.trim(), description: description.trim(), memberIds })} disabled={!name.trim()}><Plus className="h-4 w-4" />Tạo channel</Button>
        </div>
      </div>
    </div>
  );
}

function CreateDirectDialog({
  users,
  onCancel,
  onCreate
}: {
  users: DirectoryUser[];
  onCancel: () => void;
  onCreate: (user: DirectoryUser) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = users.filter((user) => `${user.name} ${user.email ?? ""} ${user.department ?? ""} ${user.position ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-bold text-slate-950">Tạo direct message</div>
            <p className="mt-1 text-sm text-slate-500">Chọn một thành viên để mở hội thoại riêng.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Tìm theo tên, email, khoa/phòng..." autoFocus />
          </div>
          <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border p-2 scrollbar-thin">
            {filtered.map((user) => (
              <button key={user.id} type="button" onClick={() => onCreate(user)} className="mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition last:mb-0 hover:bg-teal-50">
                <Avatar name={user.name} online />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-950">{user.name}</span>
                  <span className="block truncate text-xs text-slate-500">{[user.department, user.position, user.email].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-teal-700">Chat</span>
              </button>
            ))}
            {!filtered.length ? (
              <div className="p-6 text-center text-sm text-slate-500">Không tìm thấy thành viên phù hợp.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
