"use client";

import styles from './page.module.css';
import AIAssistant from '../components/AIAssistant';

export default function Home() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI <span className="gradient-text">Assistant</span> 🤖</h1>
        <p className={styles.subtitle}>프리미엄 투자 어시스턴트와 심도 깊은 대화를 나누어 보세요.</p>
      </header>

      <div className={`glass-panel ${styles.chatContainer}`}>
        <AIAssistant />
      </div>
    </div>
  );
}
