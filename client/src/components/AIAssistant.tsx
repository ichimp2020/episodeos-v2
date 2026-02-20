import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Plus, Trash2, MessageSquare, Lightbulb, PenLine, HelpCircle, SpellCheck, Share2, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: number;
  title: string;
  messages?: Message[];
}

const quickActions = [
  { key: "episodeTitles", icon: Lightbulb },
  { key: "episodeDescription", icon: PenLine },
  { key: "interviewQuestions", icon: HelpCircle },
  { key: "grammarCheck", icon: SpellCheck },
  { key: "socialCaption", icon: Share2 },
  { key: "showNotes", icon: FileText },
] as const;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function MarkdownContent({ content }: { content: string }) {
  const escaped = escapeHtml(content);
  const html = escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-muted/60 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^### (.*$)/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-sm font-bold mt-3 mb-1">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-base font-bold mt-3 mb-1">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
    .replace(/\n/g, "<br />");

  return <div className="prose-sm max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AIAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, isRTL } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]);

  const loadConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await apiRequest("POST", "/api/conversations", { title: "New Chat" });
      const conversation = await res.json();
      setConversations((prev) => [conversation, ...prev]);
      setActiveConversation(conversation);
      setMessages([]);
      setInput("");
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
  };

  const loadConversation = async (conv: Conversation) => {
    try {
      const res = await fetch(`/api/conversations/${conv.id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversation(data);
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error("Failed to load conversation:", e);
    }
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;

    let conversation = activeConversation;
    if (!conversation) {
      try {
        const res = await apiRequest("POST", "/api/conversations", { title: content.slice(0, 50) });
        conversation = await res.json();
        setConversations((prev) => [conversation!, ...prev]);
        setActiveConversation(conversation);
      } catch (e) {
        console.error("Failed to create conversation:", e);
        return;
      }
    }

    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/conversations/${conversation!.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          for (const line of parts) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                if (data.done) {
                  setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
                  setStreamingContent("");
                } else if (data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.error("Streaming error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
      setStreamingContent("");
    } finally {
      setStreaming(false);
    }
  };

  const handleQuickAction = (actionKey: string) => {
    const prompts: Record<string, string> = {
      episodeTitles: t.ai.episodeTitlesPrompt,
      episodeDescription: t.ai.episodeDescriptionPrompt,
      interviewQuestions: t.ai.interviewQuestionsPrompt,
      grammarCheck: t.ai.grammarCheckPrompt,
      socialCaption: t.ai.socialCaptionPrompt,
      showNotes: t.ai.showNotesPrompt,
    };
    setInput(prompts[actionKey] + "\n\n");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const showQuickActions = messages.length === 0 && !streamingContent;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRTL ? "left" : "right"}
        className="w-full sm:max-w-[440px] p-0 flex flex-col gap-0 border-border/30"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <SheetTitle className="text-[15px] font-semibold">{t.ai.title}</SheetTitle>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{t.ai.subtitle}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={createNewChat}
              className="rounded-xl h-8 text-xs gap-1.5"
              data-testid="button-new-chat"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.ai.newChat}
            </Button>
          </div>
        </SheetHeader>

        {conversations.length > 0 && !activeConversation && (
          <div className="border-b border-border/20 px-3 py-2 max-h-[200px] overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors text-start group"
                data-testid={`chat-conversation-${conv.id}`}
              >
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <span className="text-sm truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 transition-all"
                  data-testid={`button-delete-chat-${conv.id}`}
                >
                  <Trash2 className="h-3 w-3 text-destructive/70" />
                </button>
              </button>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-4 space-y-4">
            {showQuickActions && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider px-1">{t.ai.quickActions}</p>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map(({ key, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => handleQuickAction(key)}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-border/30 hover:border-primary/20 hover:bg-primary/5 transition-all text-start group"
                      data-testid={`button-quick-action-${key}`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary/70 transition-colors shrink-0" />
                      <span className="text-xs font-medium text-muted-foreground/70 group-hover:text-foreground transition-colors leading-tight">
                        {t.ai[key as keyof typeof t.ai]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[90%]",
                  msg.role === "user" ? (isRTL ? "mr-0 ml-auto" : "ml-auto mr-0") : ""
                )}
              >
                <div
                  className={cn(
                    "px-3.5 py-2.5 rounded-2xl",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/50 border border-border/20 rounded-bl-md"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {streamingContent && (
              <div className="max-w-[90%]">
                <div className="px-3.5 py-2.5 rounded-2xl bg-muted/50 border border-border/20 rounded-bl-md">
                  <MarkdownContent content={streamingContent} />
                  <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {streaming && !streamingContent && (
              <div className="max-w-[90%]">
                <div className="px-3.5 py-2.5 rounded-2xl bg-muted/50 border border-border/20 rounded-bl-md">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-muted-foreground/50">{t.ai.thinking}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border/30 p-3 shrink-0">
          <div className="flex items-end gap-2 bg-muted/30 rounded-xl border border-border/30 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.ai.placeholder}
              rows={1}
              className="flex-1 bg-transparent text-sm outline-none resize-none max-h-[120px] min-h-[36px] py-1 placeholder:text-muted-foreground/40"
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
              data-testid="input-ai-message"
            />
            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="rounded-xl h-8 w-8 p-0 shrink-0"
              data-testid="button-send-ai-message"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
