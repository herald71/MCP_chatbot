"use client";

import { useState, useRef, useEffect } from 'react';
import styles from './AIAssistant.module.css';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function AIAssistant() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '반갑습니다! 저는 프리미엄 투자 AI 어시스턴트입니다. 오늘의 포트폴리오 분석이나 종목 추천을 원하시면 말씀해 주세요.'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Focus input field on load and after loading state changes
    useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus();
        }
    }, [isLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userText = input.trim();
        setInput('');

        // Add user message
        const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
        setMessages((prev) => [...prev, newUserMsg]);
        setIsLoading(true);

        try {
            // API call to custom AI endpoint
            // filter out the initial welcome message if we want to save tokens, but it's fine to keep it.
            // map frontend messages to API expected format {role, content}
            const history = messages.map(msg => ({ role: msg.role, content: msg.content }));

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: userText, history: history })
            });

            if (!res.ok) {
                throw new Error('API 오류');
            }

            const data = await res.json();
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.reply
            };

            setMessages((prev) => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '앗, 현재 AI 서비스를 일시적으로 사용할 수 없어요. 잠시 후 다시 시도해 주세요.'
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.assistantContainer}>
            <div className={styles.chatArea}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.user : styles.assistant}`}>
                        {msg.role === 'assistant' && (
                            <div className={styles.avatar}>AI</div>
                        )}
                        <div className={styles.messageBubble}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className={`${styles.messageWrapper} ${styles.assistant}`}>
                        <div className={styles.avatar}>AI</div>
                        <div className={styles.messageBubble}>
                            <span className={styles.typingDot}>.</span>
                            <span className={styles.typingDot}>.</span>
                            <span className={styles.typingDot}>.</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className={styles.inputForm}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="무엇이든 물어보세요..."
                    className={styles.inputField}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                />
                <button type="submit" className={styles.sendButton} disabled={isLoading || !input.trim()}>
                    전송
                </button>
            </form>
        </div>
    );
}
