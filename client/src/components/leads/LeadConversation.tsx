import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Bot, Copy } from "lucide-react";
import { useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Message } from "../../../../shared/interfaces";

interface LeadConversationProps {
  messages: Message[];
  outboundCount: number;
  inboundCount: number;
}

export function LeadConversation({ messages, outboundCount, inboundCount }: LeadConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card className="border-border bg-card flex flex-col" style={{ height: "460px" }}>
      <CardHeader className="pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Conversation
            {messages.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {messages.length}
              </Badge>
            )}
          </CardTitle>
          {outboundCount + inboundCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {outboundCount} sent · {inboundCount} received
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground opacity-40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Type a message below to start the conversation
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isOutbound = msg.direction === "outbound";
              const msgDate = new Date(msg.createdAt).toDateString();
              const prevDate = i > 0 ? new Date(messages[i - 1].createdAt).toDateString() : null;
              const showDateSep = msgDate !== prevDate;
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground px-2">
                        {new Date(msg.createdAt).toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                    <div className={`group max-w-[75%] relative`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm ${
                          isOutbound
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="leading-relaxed">{msg.body}</p>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 mt-1 px-1 ${
                          isOutbound ? "justify-end" : "justify-start"
                        }`}
                      >
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {msg.aiRewritten && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                        <button
                          className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.body);
                            toast.success("Copied");
                          }}
                          title="Copy message"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
