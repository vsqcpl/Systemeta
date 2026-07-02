import dotenv from "dotenv";
dotenv.config();

export async function callGroqService(messages: any[], jsonMode = true): Promise<any> {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // Strict anti-hallucination system prompt wrapper
  const systemPromptObj = messages.find(m => m.role === "system");
  const baseSystemPrompt = 'You are a strict project management analyst. Use ONLY the provided context. If context is insufficient, output {"error": "Insufficient data"}. Output MUST be valid JSON.';
  
  if (systemPromptObj) {
    systemPromptObj.content = `${baseSystemPrompt}\n${systemPromptObj.content}`;
  } else {
    messages.unshift({ role: "system", content: baseSystemPrompt });
  }

  // Use NVIDIA if available and groq is placeholder or absent
  if (nvidiaKey && (!groqKey || groqKey.includes("placeholder"))) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${nvidiaKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages,
          temperature: 0,
          max_tokens: 500,
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const content = data.choices[0].message.content;
        
        if (jsonMode) {
          let cleanContent = content.trim();
          if (cleanContent.startsWith("```json")) {
            cleanContent = cleanContent.substring(7, cleanContent.length - 3).trim();
          } else if (cleanContent.startsWith("```")) {
            cleanContent = cleanContent.substring(3, cleanContent.length - 3).trim();
          }
          try {
            return JSON.parse(cleanContent);
          } catch (e) {
            console.warn("Nvidia JSON parse failed, returning raw content:", cleanContent);
            return { error: "JSON_PARSE_FAILED", content: cleanContent };
          }
        }
        return content;
      } else {
        console.warn("Nvidia NIM API call failed, falling back to Groq...");
      }
    } catch (e) {
      console.warn("Nvidia fetch call error, falling back to Groq...", e);
    }
  }

  const apiKey = groqKey || "gsk_placeholder_replace_with_real_key";
  if (!apiKey || apiKey.includes("placeholder")) {
    throw new Error("No configured LLM API key found (GROQ or NVIDIA).");
  }
  
  const body: any = {
    model: "llama3-8b-8192",
    messages,
    temperature: 0,
    max_tokens: 500,
  };
  
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }
  
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API error: ${res.statusText} - ${errorText}`);
  }
  
  const data = await res.json() as any;
  const content = data.choices[0].message.content;
  return jsonMode ? JSON.parse(content) : content;
}
