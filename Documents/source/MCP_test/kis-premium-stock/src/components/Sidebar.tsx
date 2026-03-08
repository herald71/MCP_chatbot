"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../app/layout.module.css";

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <span className="gradient-text">KIS</span> Premium
            </div>

            <nav className={styles.nav}>
                <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.active : ''}`}>
                    📊 Dashboard
                </Link>
                <Link href="/quant" className={`${styles.navItem} ${pathname === '/quant' ? styles.active : ''}`}>
                    🔬 Quant Lab
                </Link>
                <Link href="/assistant" className={`${styles.navItem} ${pathname === '/assistant' ? styles.active : ''}`}>
                    🤖 AI Assistant
                </Link>
            </nav>
        </aside>
    );
}
