/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

// --- System prompt: constrain assistant to L'Oréal products/routines ---
// Keep this short but explicit; the assistant will prepend this to each request.
const systemPrompt = `You are a helpful, cheerful assistant that ONLY answers questions about L'Oréal products, routines, and product recommendations. Limit responses to factual information about L'Oréal brands, product usage, recommended routines, suitable skin/hair types, shade/finish guidance, and comparable L'Oréal alternatives. If a question is outside this scope, politely reply: "Sorry! I'm not sure about that. I can only help with L'Oréal products, routines, and recommendations." Allow for a bit of vagueness in user questions and do not require full sentences, and just answer to the best of your ability, but ask 1–2 short clarifying follw-up questions at the end of the response when necessary to provide better assistance. Do not provide medical or emergency advice.`;

// Small helper to append messages into the chat window
function appendMessage(cls, text) {
  const el = document.createElement("div");
  el.className = `msg ${cls}`;
  // Escape user text lightly to prevent accidental HTML injection
  el.textContent = text;
  chatWindow.appendChild(el);
  // keep scroll at bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// show an initial greeting
appendMessage(
  "ai",
  "👋 Hello! Ask me about foundations, skincare, haircare, or personalized routines."
);

// disable/enable input while waiting for response
function setLoading(isLoading) {
  userInput.disabled = isLoading;
  sendBtn.disabled = isLoading;
}

// Track conversation context
let conversation = [];
let userName = ""; // Store user's name if provided

// Updated sendToOpenAI to include conversation history
async function sendToOpenAI(userText) {
  // Add user message to conversation history
  conversation.push({ role: "user", content: userText });

  // Build messages array with full conversation history
  const messages = [{ role: "system", content: systemPrompt }, ...conversation];

  try {
    const WORKER_URL = "https://chatbot-for-loreal.glatch.workers.dev";
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: messages }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Worker error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const assistantMsg = data?.choices?.[0]?.message?.content;
    if (!assistantMsg) throw new Error("No assistant response returned.");

    // Add assistant message to conversation history
    conversation.push({ role: "assistant", content: assistantMsg });

    return assistantMsg;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// Extract user's name if mentioned
function extractUserName(text) {
  const nameMatch = text.match(/(?:my name is|I am|I'm)\s+(\w+)/i);
  return nameMatch ? nameMatch[1] : null;
}

// Function to reset the chat window
function resetChatWindow() {
  chatWindow.innerHTML = ""; // Clear all messages
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Reset the chat window
  resetChatWindow();

  // Check if the user provided their name
  const detectedName = extractUserName(text);
  if (detectedName) {
    userName = detectedName;
  }

  // Personalize greeting if name is known
  const personalizedText = userName ? `${text} (from ${userName})` : text;

  // Show user's message
  appendMessage("user", text);
  userInput.value = "";

  // Show a temporary loading message from the assistant
  const loadingEl = document.createElement("div");
  loadingEl.className = "msg ai";
  loadingEl.textContent = "…thinking…";
  chatWindow.appendChild(loadingEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  setLoading(true);
  try {
    const reply = await sendToOpenAI(personalizedText);
    // Replace loading with actual reply
    loadingEl.textContent = reply;
  } catch (err) {
    loadingEl.textContent = "Sorry — there was an error contacting the API.";
  } finally {
    setLoading(false);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
});
