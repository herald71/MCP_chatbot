"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import styles from "../app/layout.module.css";

export default function LayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className={styles.layoutContainer}>
            <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    );
}
