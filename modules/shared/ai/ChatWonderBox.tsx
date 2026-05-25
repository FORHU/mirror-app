import React, { useState, useRef, useEffect } from "react";
import { useChatWonderStream } from "./useChatWonderStream";

export default function ChatWonderBox() {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatWonderStream();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever a message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    
    sendMessage(inputValue);
    setInputValue("");
  };

  return (
    <div className="flex flex-col w-full max-w-2xl h-[600px] border border-gray-300 rounded-xl overflow-hidden bg-white shadow-xl">
      {/* Header */}
      <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">ChatWonder Assistant</h2>
        <button 
          onClick={clearMessages}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-auto mb-auto">
            <p>Send a message to start chatting with the AI!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[80%] ${
                msg.role === "USER" 
                  ? "self-end items-end" 
                  : "self-start items-start"
              }`}
            >
              <div 
                className={`px-4 py-3 rounded-2xl ${
                  msg.role === "USER" 
                    ? "bg-blue-500 text-white rounded-br-none" 
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                }`}
              >
                {/* 
                  If AI is streaming and content is still empty, show a loading indicator.
                  Otherwise, show the content. 
                */}
                {msg.role === "AI" && msg.content === "" && isStreaming ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></span>
                  </span>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {error && (
          <div className="self-center bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            disabled={isStreaming}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            className="px-6 py-3 bg-blue-500 text-white rounded-full font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? "Wait" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
