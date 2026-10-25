'use client';

import { useState, useCallback } from 'react';
import { HomeScreen } from '@/components/HomeScreen';
import { ConversationView } from '@/components/ConversationView';
import { UploadView } from '@/components/UploadView';
import { BookingDetailView } from '@/components/BookingDetailView';
import { HistoryView } from '@/components/HistoryView';
import { RulesView } from '@/components/RulesView';
import { NavTabs } from '@/components/NavTabs';
import type { BookingReport } from '@/lib/schemas';

export type AppView = 'home' | 'conversation' | 'upload' | 'booking-detail' | 'history' | 'rules';

export default function Home() {
  const [view, setView] = useState<AppView>('home');
  const [batchReports, setBatchReports] = useState<BookingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<BookingReport | null>(null);
  const [conversationReport, setConversationReport] = useState<BookingReport | null>(null);

  const handleViewBooking = (report: BookingReport) => {
    setSelectedReport(report);
    setView('booking-detail');
  };

  const handleBack = () => {
    if (selectedReport && batchReports.length > 0) {
      setSelectedReport(null);
      setView('upload');
    } else if (conversationReport) {
      setSelectedReport(null);
      setView('conversation');
    } else {
      setView('home');
    }
  };

  const handleTabChange = useCallback((newView: AppView) => {
    setSelectedReport(null);
    setView(newView);
  }, []);

  const showTabs = view !== 'booking-detail';

  return (
    <>
      {showTabs && (
        <div
          className="sticky top-14 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-4 border-b glass"
          style={{ borderColor: 'var(--border)' }}
        >
          <NavTabs current={view} onChange={handleTabChange} />
        </div>
      )}

      {view === 'home' && (
        <HomeScreen
          onStartConversation={() => setView('conversation')}
          onStartUpload={() => setView('upload')}
        />
      )}
      {view === 'conversation' && (
        <ConversationView
          onBack={() => setView('home')}
          onViewReport={(report) => {
            setConversationReport(report);
            setSelectedReport(report);
            setView('booking-detail');
          }}
        />
      )}
      {view === 'upload' && (
        <UploadView
          onBack={() => setView('home')}
          reports={batchReports}
          onReportsChange={setBatchReports}
          onViewBooking={handleViewBooking}
        />
      )}
      {view === 'booking-detail' && selectedReport && (
        <BookingDetailView
          report={selectedReport}
          onBack={handleBack}
          onUpdate={(updated) => {
            setSelectedReport(updated);
            if (batchReports.length > 0) {
              setBatchReports(prev => prev.map(r =>
                r.booking.bookingId === updated.booking.bookingId ? updated : r
              ));
            }
            if (conversationReport?.booking.bookingId === updated.booking.bookingId) {
              setConversationReport(updated);
            }
          }}
        />
      )}
      {view === 'history' && (
        <HistoryView onBack={() => setView('home')} />
      )}
      {view === 'rules' && (
        <RulesView onBack={() => setView('home')} />
      )}
    </>
  );
}
