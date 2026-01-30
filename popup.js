let extractedConversation = '';
let messageCount = 0;

const extractBtn = document.getElementById('extractBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const status = document.getElementById('status');
const statusText = document.getElementById('status-text');
const previewContainer = document.getElementById('previewContainer');
const preview = document.getElementById('preview');
const messageCountEl = document.getElementById('messageCount');

extractBtn.addEventListener('click', extractConversation);
downloadBtn.addEventListener('click', downloadConversation);
copyBtn.addEventListener('click', copyToClipboard);

async function extractConversation() {
  try {
    updateStatus('Extracting...', 'loading');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeConversation
    });
    
    if (results && results[0] && results[0].result) {
      const { text, count, platform } = results[0].result;
      
      if (count > 0) {
        extractedConversation = text;
        messageCount = count;
        
        updateStatus(`Extracted from ${platform}`, 'success');
        showPreview(text, count);
        
        downloadBtn.disabled = false;
        copyBtn.disabled = false;
      } else {
        updateStatus('No conversation found', 'error');
      }
    } else {
      updateStatus('Could not extract', 'error');
    }
  } catch (error) {
    console.error('Extraction error:', error);
    updateStatus('Error: Check if on AI chat page', 'error');
  }
}

function scrapeConversation() {
  const url = window.location.href;
  let messages = [];
  let platform = 'Unknown';
  
  // ChatGPT / OpenAI
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    platform = 'ChatGPT';
    const turns = document.querySelectorAll('[data-message-author-role]');
    turns.forEach(turn => {
      const role = turn.getAttribute('data-message-author-role');
      const content = turn.innerText.trim();
      if (content) {
        const speaker = role === 'user' ? 'USER' : 'ASSISTANT';
        messages.push(`[${speaker}]\n${content}`);
      }
    });
    
    // Fallback for ChatGPT
    if (messages.length === 0) {
      const articles = document.querySelectorAll('article');
      articles.forEach((article, index) => {
        const content = article.innerText.trim();
        if (content) {
          const speaker = index % 2 === 0 ? 'USER' : 'ASSISTANT';
          messages.push(`[${speaker}]\n${content}`);
        }
      });
    }
  }
  
  // Claude
  else if (url.includes('claude.ai')) {
    platform = 'Claude';
    const humanMessages = document.querySelectorAll('[data-testid="human-turn"]');
    const assistantMessages = document.querySelectorAll('[data-testid="assistant-turn"]');
    
    // Try to get interleaved messages
    const allTurns = document.querySelectorAll('[class*="font-claude-message"], [class*="font-user-message"]');
    if (allTurns.length > 0) {
      allTurns.forEach(turn => {
        const isUser = turn.className.includes('user');
        const content = turn.innerText.trim();
        if (content) {
          const speaker = isUser ? 'USER' : 'ASSISTANT';
          messages.push(`[${speaker}]\n${content}`);
        }
      });
    }
    
    // Fallback: look for conversation container
    if (messages.length === 0) {
      const containers = document.querySelectorAll('[class*="prose"], [class*="message"]');
      containers.forEach((container, index) => {
        const content = container.innerText.trim();
        if (content && content.length > 10) {
          const speaker = index % 2 === 0 ? 'USER' : 'ASSISTANT';
          messages.push(`[${speaker}]\n${content}`);
        }
      });
    }
  }
  
  // Gemini
  else if (url.includes('gemini.google.com')) {
    platform = 'Gemini';
    const userMessages = document.querySelectorAll('.query-content, [class*="user-query"]');
    const modelMessages = document.querySelectorAll('.model-response-text, [class*="model-response"]');
    
    userMessages.forEach((msg, i) => {
      const userContent = msg.innerText.trim();
      if (userContent) {
        messages.push(`[USER]\n${userContent}`);
      }
      if (modelMessages[i]) {
        const assistantContent = modelMessages[i].innerText.trim();
        if (assistantContent) {
          messages.push(`[ASSISTANT]\n${assistantContent}`);
        }
      }
    });
  }
  
  // Microsoft Copilot
  else if (url.includes('copilot.microsoft.com') || url.includes('bing.com/chat')) {
    platform = 'Copilot';
    const turns = document.querySelectorAll('[class*="message"], [class*="turn"]');
    turns.forEach(turn => {
      const isUser = turn.className.includes('user') || turn.className.includes('request');
      const content = turn.innerText.trim();
      if (content && content.length > 5) {
        const speaker = isUser ? 'USER' : 'ASSISTANT';
        messages.push(`[${speaker}]\n${content}`);
      }
    });
  }
  
  // Perplexity
  else if (url.includes('perplexity.ai')) {
    platform = 'Perplexity';
    const queries = document.querySelectorAll('[class*="query"], [class*="question"]');
    const answers = document.querySelectorAll('[class*="answer"], [class*="response"]');
    
    queries.forEach((query, i) => {
      const userContent = query.innerText.trim();
      if (userContent) {
        messages.push(`[USER]\n${userContent}`);
      }
      if (answers[i]) {
        const assistantContent = answers[i].innerText.trim();
        if (assistantContent) {
          messages.push(`[ASSISTANT]\n${assistantContent}`);
        }
      }
    });
  }
  
  // Poe
  else if (url.includes('poe.com')) {
    platform = 'Poe';
    const messageElements = document.querySelectorAll('[class*="Message_row"]');
    messageElements.forEach(msg => {
      const isUser = msg.className.includes('human');
      const content = msg.innerText.trim();
      if (content) {
        const speaker = isUser ? 'USER' : 'ASSISTANT';
        messages.push(`[${speaker}]\n${content}`);
      }
    });
  }
  
  // Generic fallback - try common patterns
  if (messages.length === 0) {
    platform = 'Generic';
    const possibleContainers = document.querySelectorAll(
      '[class*="message"], [class*="chat"], [class*="conversation"], ' +
      '[role="article"], [role="listitem"], article, .prose'
    );
    possibleContainers.forEach((container, index) => {
      const content = container.innerText.trim();
      if (content && content.length > 20) {
        const speaker = index % 2 === 0 ? 'USER' : 'ASSISTANT';
        messages.push(`[${speaker}]\n${content}`);
      }
    });
  }
  
  // Format output
  const timestamp = new Date().toISOString();
  const header = `=== Conversation Master Export ===
Platform: ${platform}
URL: ${url}
Exported: ${timestamp}
Messages: ${messages.length}
${'='.repeat(40)}

`;
  
  const conversation = header + messages.join('\n\n' + '-'.repeat(40) + '\n\n');
  
  return {
    text: conversation,
    count: messages.length,
    platform: platform
  };
}

function updateStatus(text, type = 'loading') {
  status.className = 'status ' + type;
  statusText.textContent = text;
}

function showPreview(text, count) {
  previewContainer.style.display = 'block';
  preview.textContent = text.substring(0, 500) + (text.length > 500 ? '...' : '');
  messageCountEl.textContent = `${count} messages extracted`;
}

function downloadConversation() {
  if (!extractedConversation) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `conversation_${timestamp}.txt`;
  
  const blob = new Blob([extractedConversation], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
  
  updateStatus('Downloaded!', 'success');
}

async function copyToClipboard() {
  if (!extractedConversation) return;
  
  try {
    await navigator.clipboard.writeText(extractedConversation);
    updateStatus('Copied to clipboard!', 'success');
    
    copyBtn.innerHTML = '<span class="icon">✓</span> Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = '<span class="icon">📋</span> Copy to Clipboard';
    }, 2000);
  } catch (error) {
    updateStatus('Failed to copy', 'error');
  }
}
