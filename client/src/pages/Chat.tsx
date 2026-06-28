import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Streamdown } from "streamdown";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Chat() {
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch models list with refetch interval
  const { data: models = [], refetch: refetchModels } = trpc.models.list.useQuery(undefined, {
    refetchInterval: 3000, // 每 3 秒自动刷新一次
    staleTime: 0, // 数据立即过期，强制每次都重新获取
  });

  // Create conversation mutation
  const createConversationMutation = trpc.chat.createConversation.useMutation();

  // Send message mutation
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  // Get conversation
  const { data: conversation } = trpc.chat.getConversation.useQuery(
    conversationId ?? 0,
    { enabled: !!conversationId }
  );

  // Initialize with first model on load
  useEffect(() => {
    if (models && models.length > 0 && !selectedModelId) {
      const firstModel = models[0] as any;
      handleModelChange(firstModel.id.toString());
    }
  }, [models, selectedModelId]);

  // Update messages when conversation changes
  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages as Message[]);
    }
  }, [conversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const handleModelChange = async (id: string) => {
    const modelId = parseInt(id);
    setSelectedModelId(modelId);
    setMessages([]);
    setInputValue("");

    try {
      const result = await createConversationMutation.mutateAsync({
        modelId,
        title: "New Conversation",
      });
      if (result && result.id) {
        setConversationId(result.id);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("创建对话失败");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    if (!conversationId) {
      toast.error("请先选择一个模型");
      return;
    }

    const userMessage = inputValue;
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const result = await sendMessageMutation.mutateAsync({
        conversationId,
        content: userMessage,
      });

      if (result.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: String(result.response) },
        ]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => prev.slice(0, -1));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "抱歉，发生了错误。请重试。" },
      ]);
      toast.error("发送消息失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍰</span>
            <h1 className="text-2xl font-bold text-foreground">蛋糕🍰ai</h1>
          </div>
          <Select value={selectedModelId?.toString() ?? ""} onValueChange={handleModelChange}>
            <SelectTrigger className="w-48 bg-background text-foreground border-border">
              <SelectValue placeholder="选择 AI 模型" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model: any) => (
                <SelectItem key={model.id} value={model.id.toString()}>
                  {model.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 pb-24">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="text-5xl mb-4">🍰</div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">开始对话</h2>
              <p className="text-muted-foreground max-w-md">
                选择一个 AI 模型，然后输入您的问题开始对话。我会记住上下文，支持多轮对话。
              </p>
            </div>
          ) : (
            <>
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-card text-card-foreground border border-border rounded-bl-none"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{message.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start gap-2">
                  <div className="bg-card text-card-foreground border border-border px-4 py-3 rounded-lg rounded-bl-none flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">思考中...</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
              className="resize-none focus:ring-2 focus:ring-primary"
              rows={3}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
            />
            <Button
              type="submit"
              disabled={isLoading || !inputValue.trim() || !conversationId}
              className="self-end px-6"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card text-center py-3 text-sm text-muted-foreground">
        <a
          href="https://1007080.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          由 mountain ai 提供技术支持
        </a>
      </div>
    </div>
  );
}
