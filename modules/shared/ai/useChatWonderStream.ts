import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "USER" | "AI";
  content: string;
}

export interface UseChatWonderStreamResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string, conversationId?: string, kioskId?: string) => Promise<void>;
  clearMessages: () => void;
}

export function useChatWonderStream(): UseChatWonderStreamResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of the AbortController so we can cancel streams if needed
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (text: string, conversationId?: string, kioskId?: string) => {
    if (!text.trim()) return;

    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setError(null);

    // Optimistically add the user message
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "USER", content: text }
    ]);

    // Create a placeholder for the AI response
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "AI", content: "" }
    ]);

    try {
      // In mirror-app, we assume the token is stored somewhere or the session is handled.
      // If there is an auth token required, you would attach it here.
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") || "" : "";

      const response = await fetch("/api/mirror/chat-wonder/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          input: text,
          conversationId,
          kioskId
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body available from the server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let aiContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // SSE messages are separated by double newlines
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.replace("data: ", "");
            try {
              const parsed = JSON.parse(jsonStr);
              
              if (parsed.type === "chunk") {
                aiContent += parsed.content;
                // Update the AI message in state
                setMessages((prev) => 
                  prev.map((msg) => 
                    msg.id === aiMsgId ? { ...msg, content: aiContent } : msg
                  )
                );
              } else if (parsed.type === "complete") {
                console.log("Chat completed with data:", parsed);
                
                // Trigger AWS Polly TTS to play the final message audio
                if (parsed.message) {
                  fetch("/api/mirror/voice/tts", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(token ? { "Authorization": `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ text: parsed.message })
                  })
                  .then(async (ttsRes) => {
                    if (ttsRes.ok) {
                      const blob = await ttsRes.blob();
                      const url = URL.createObjectURL(blob);
                      const audio = new Audio(url);
                      audio.play().catch(e => console.error("Audio play failed:", e));
                    }
                  })
                  .catch(e => console.error("Failed to fetch TTS:", e));
                }
              } else if (parsed.type === "error") {
                setError(parsed.message || "Unknown ChatWonder error");
              }
            } catch (e) {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Stream error:", err);
        setError(err.message || "An error occurred while communicating with ChatWonder.");
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages
  };
}
