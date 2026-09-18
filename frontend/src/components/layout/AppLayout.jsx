import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({
  activeTab,
  activeSubItem,
  onNavigate,
  onOpenCommandPalette,
  children
}) {
  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} onSelectTab={onNavigate} />

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        <Header
          activeTab={activeTab}
          activeSubItem={activeSubItem}
          onNavigate={onNavigate}
          onOpenCommandPalette={onOpenCommandPalette}
        />

        <main className="main-content" style={{ flexGrow: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
