import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({
  activeTab,
  activeSubItem,
  onNavigate,
  onOpenCommandPalette,
  children
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('autorpa_sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('autorpa_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        <Header
          activeTab={activeTab}
          activeSubItem={activeSubItem}
          onNavigate={onNavigate}
          onOpenCommandPalette={onOpenCommandPalette}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        <main
          className={`main-content ${activeTab === 'sandbox' ? 'main-content-sandbox' : ''}`}
          style={{
            flexGrow: 1,
            overflowY: activeTab === 'sandbox' ? 'hidden' : 'auto',
            padding: activeTab === 'sandbox' ? '12px 18px 14px' : undefined
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
