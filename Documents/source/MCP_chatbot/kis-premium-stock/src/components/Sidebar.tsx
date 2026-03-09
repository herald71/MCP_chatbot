"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../app/layout.module.css";

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
            <button className={styles.toggleBtn} onClick={onToggle} title={isCollapsed ? "확장" : "축소"}>
                {isCollapsed ? "❯" : "❮"}
            </button>

            <div className={styles.logo}>
                <span className="gradient-text">KIS</span> Premium
            </div>

            <nav className={styles.nav}>
                <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.active : ''}`}>
                    <span className={styles.icon}>📊</span>
                    {!isCollapsed && <span className={styles.navText}>Dashboard</span>}
                </Link>
                <Link href="/quant" className={`${styles.navItem} ${pathname === '/quant' ? styles.active : ''}`}>
                    <span className={styles.icon}>🔬</span>
                    {!isCollapsed && <span className={styles.navText}>Quant Lab</span>}
                </Link>
                <Link href="/assistant" className={`${styles.navItem} ${pathname === '/assistant' ? styles.active : ''}`}>
                    <span className={styles.icon}>🤖</span>
                    {!isCollapsed && <span className={styles.navText}>AI Assistant</span>}
                </Link>
            </nav>
        </aside>
    );
}
