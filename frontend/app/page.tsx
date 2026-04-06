'use client';

import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  type: 'user' | 'assistant' | 'status' | 'tool' | 'error';
  content: string;
  toolName?: string;
  timestamp: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resources, setResources] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }]);
  };

  const appendToLastAssistant = (content: string) => {
    setMessages(prev => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].type === 'assistant') {
          next[i] = {
            ...next[i],
            content: next[i].content + content,
          };
          break;
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resources.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    addMessage({
      type: 'user',
      content: 'Analyze the following Azure resources:\n' + resources.substring(0, 200) + '...',
    });

    try {
      // Parse resources JSON
      let resourcesData;
      try {
        resourcesData = JSON.parse(resources);
      } catch (err) {
        addMessage({
          type: 'error',
          content: 'Invalid JSON format. Please provide valid Azure resource data.',
        });
        setIsAnalyzing(false);
        return;
      }

      // Connect to SSE endpoint
      const response = await fetch('http://localhost:3000/api/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resources: Array.isArray(resourcesData) ? resourcesData : resourcesData.resources || [],
          scope: 'all',
          format: 'json',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      addMessage({
        type: 'assistant',
        content: '',
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'status') {
              addMessage({
                type: 'status',
                content: event.message,
              });
            } else if (event.type === 'tool_start') {
              addMessage({
                type: 'tool',
                content: `Using tool: ${event.toolName}`,
                toolName: event.toolName,
              });
            } else if (event.type === 'text') {
              appendToLastAssistant(event.text);
            } else if (event.type === 'report') {
              // Add formatted report
              addMessage({
                type: 'assistant',
                content: '\n\n📊 **Analysis Complete**\n\n' + JSON.stringify(event.report, null, 2),
              });
            } else if (event.type === 'error') {
              addMessage({
                type: 'error',
                content: event.error,
              });
            } else if (event.type === 'done') {
              break;
            }
          } catch (err) {
            console.error('Failed to parse event:', line, err);
          }
        }
      }

    } catch (error) {
      addMessage({
        type: 'error',
        content: `Failed to analyze: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSampleData = async () => {
    try {
      const response = await fetch('/sample-azure-export.json');
      const data = await response.json();
      setResources(JSON.stringify(data, null, 2));
    } catch (error) {
      addMessage({
        type: 'error',
        content: 'Failed to load sample data',
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-auto">
        <h2 className="text-xl font-bold mb-4">Azure Resources</h2>
        <p className="text-sm text-gray-400 mb-4">
          Paste your Azure resource export JSON here, or load sample data.
        </p>
        <button
          onClick={loadSampleData}
          className="w-full mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          Load Sample Data
        </button>
        <textarea
          value={resources}
          onChange={(e) => setResources(e.target.value)}
          placeholder='{"resources": [...]}'
          className="w-full h-96 p-2 bg-gray-900 border border-gray-700 rounded text-sm font-mono"
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <h1 className="text-2xl font-bold">Azure Resource Analysis Agent</h1>
          <p className="text-sm text-gray-400 mt-1">
            Powered by Claude Agent SDK + Microsoft Foundry
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <h2 className="text-xl mb-2">Welcome!</h2>
              <p>Paste Azure resource data in the sidebar and click "Analyze" to get started.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  msg.type === 'user'
                    ? 'bg-blue-600'
                    : msg.type === 'error'
                    ? 'bg-red-900/50 border border-red-700'
                    : msg.type === 'tool'
                    ? 'bg-purple-900/50 border border-purple-700'
                    : msg.type === 'status'
                    ? 'bg-gray-700 text-gray-300 text-sm'
                    : 'bg-gray-800 border border-gray-700'
                }`}
              >
                {msg.type === 'tool' && (
                  <div className="text-xs text-purple-300 mb-1">🔧 Tool Execution</div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="text-sm">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 bg-gray-800 px-6 py-4">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <button
              type="submit"
              disabled={!resources.trim() || isAnalyzing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setResources('');
              }}
              disabled={isAnalyzing}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Clear
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
