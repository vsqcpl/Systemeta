"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Hello! I'm the VSQC AI Assistant.\n\nI can help with attendance, timesheets, leave requests, projects, and any other operational queries.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const data = useAppStore((state) => state.data);
  const punchHoursToday = useAppStore((state) => state.punchHoursToday);
  const punchHoursWeek = useAppStore((state) => state.punchHoursWeek);
  const punchedIn = useAppStore((state) => state.punchedIn);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Build context from real store data
      const contextLines: string[] = [];
      contextLines.push(`Attendance: ${punchedIn ? "Punched In" : "Punched Out"}`);
      contextLines.push(`Hours Today: ${punchHoursToday.toFixed(2)}h`);
      contextLines.push(`Hours This Week: ${punchHoursWeek.toFixed(2)}h`);
      contextLines.push(`Active Projects: ${data.projects.length}`);
      const atRisk = data.projects.filter((p) => p.health === "at-risk").length;
      const delayed = data.projects.filter((p) => p.health === "delayed").length;
      if (atRisk > 0) contextLines.push(`At-Risk Projects: ${atRisk}`);
      if (delayed > 0) contextLines.push(`Delayed Projects: ${delayed}`);
      const pendingLeaves = data.leaveRequests.filter((lr) => lr.status === "pending").length;
      contextLines.push(`Pending Leave Requests: ${pendingLeaves}`);
      const totalTimesheetHours = data.timesheets.reduce(
        (sum, t) => sum + t.entries.reduce((s, e) => s + e.hours, 0),
        0
      );
      contextLines.push(`Total Logged Timesheet Hours: ${totalTimesheetHours}h`);

      const systemContext = `You are the VSQC AI Assistant for an enterprise operations platform. Answer concisely and helpfully. 
Current platform data:
${contextLines.join("\n")}
Only reference figures that appear in this context. If data is unavailable, say so.`;

      const res = await fetch("/api/ai/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemContext },
            ...messages.slice(-6).map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text,
            })),
            { role: "user", content: textToSend },
          ],
        }),
      });

      const json = await res.json();
      const aiResponseText =
        json?.choices?.[0]?.message?.content ||
        json?.response ||
        "I couldn't process that request. Please try again.";

      const aiMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: Message = {
        id: `msg-err-${Date.now()}`,
        sender: "ai",
        text: "Sorry, I encountered an error. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  const suggestedPrompts = [
    { label: "My attendance today", query: "Show my attendance status today" },
    { label: "Timesheet summary", query: "My timesheet summary" },
    { label: "Leave balance", query: "What is my leave balance?" },
    { label: "Active projects", query: "Show active projects status" },
  ];

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, fontFamily: "var(--font-inter), sans-serif" }}>
      {/* Floating Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: "76px",
              right: 0,
              width: "min(420px, 90vw)",
              height: "min(600px, 80vh)",
              background: "var(--ob-bg-surface, #112236)",
              borderRadius: "16px",
              border: "1px solid var(--ob-border-subtle, #1E3A52)",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--ob-border-subtle, #1E3A52)",
                background: "var(--ob-bg-elevated, #16304A)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#1ABC9C",
                      border: "2px solid var(--ob-bg-elevated, #16304A)",
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                    }}
                  />
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #2E86C1, #1ABC9C)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "white",
                      fontSize: "12px",
                    }}
                  >
                    AI
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>VSQC AI Assistant</div>
                  <div style={{ fontSize: "11px", color: "#1ABC9C" }}>Online</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                  }}
                  title="Minimize"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Message History Area */}
            <div
              style={{
                flex: 1,
                padding: "20px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                background: "rgba(13, 27, 42, 0.2)",
              }}
            >
              {messages.map((msg) => {
                const isAI = msg.sender === "ai";
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isAI ? "flex-start" : "flex-end",
                      maxWidth: "80%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isAI ? "flex-start" : "flex-end",
                    }}
                  >
                    <div
                      style={{
                        background: isAI
                          ? "var(--ob-bg-elevated, #16304A)"
                          : "var(--ob-accent-blue, #2E86C1)",
                        color: "var(--text-primary)",
                        padding: "12px 16px",
                        borderRadius: isAI ? "12px 12px 12px 2px" : "12px 12px 2px 12px",
                        fontSize: "13.5px",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      }}
                    >
                      {msg.text}
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-tertiary)",
                        marginTop: "4px",
                        padding: "0 4px",
                      }}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {isLoading && (
                <div style={{ alignSelf: "flex-start", display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      background: "var(--ob-bg-elevated, #16304A)",
                      padding: "12px 18px",
                      borderRadius: "12px 12px 12px 2px",
                      display: "flex",
                      gap: "4px",
                      alignItems: "center",
                    }}
                  >
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--text-primary)" }}
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                      style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--text-primary)" }}
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                      style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--text-primary)" }}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts */}
            {messages.length === 1 && !isLoading && (
              <div
                style={{
                  padding: "0 20px 12px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {suggestedPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p.query)}
                    style={{
                      background: "var(--ob-bg-elevated, #16304A)",
                      border: "1px solid var(--ob-border-subtle, #1E3A52)",
                      color: "var(--text-primary)",
                      fontSize: "11px",
                      padding: "6px 10px",
                      borderRadius: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--ob-accent-blue)";
                      e.currentTarget.style.background = "var(--ob-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--ob-border-subtle)";
                      e.currentTarget.style.background = "var(--ob-bg-elevated)";
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--ob-border-subtle, #1E3A52)",
                background: "var(--ob-bg-surface, #112236)",
                display: "flex",
                gap: "10px",
                alignItems: "flex-end",
              }}
            >
              <textarea
                value={inputValue}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setInputValue(e.target.value);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about attendance, timesheets, leave, or projects..."
                style={{
                  flex: 1,
                  background: "var(--ob-bg-elevated, #16304A)",
                  border: "1px solid var(--ob-border-subtle, #1E3A52)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                  resize: "none",
                  height: "40px",
                  maxHeight: "100px",
                  fontFamily: "inherit",
                  lineHeight: "1.4",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>
                  {inputValue.length}/500
                </span>
                <button
                  onClick={() => handleSend(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  style={{
                    background:
                      !inputValue.trim() || isLoading
                        ? "var(--ob-bg-elevated, #16304A)"
                        : "var(--ob-accent-blue, #2E86C1)",
                    border: "none",
                    color: !inputValue.trim() || isLoading ? "var(--text-tertiary)" : "white",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: !inputValue.trim() || isLoading ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #2E86C1, #1ABC9C)",
          border: "none",
          boxShadow: "0 4px 20px rgba(46, 134, 193, 0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </motion.button>
    </div>
  );
}
