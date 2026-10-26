'use client';

import { DeskProvider, useDesk } from '@/lib/desk';
import { useRoute } from '@/lib/route';
import { Topbar } from '@/components/Topbar';
import { HomeScreen } from '@/components/HomeScreen';
import { ConversationView } from '@/components/ConversationView';
import { UploadView } from '@/components/UploadView';
import { ReportView } from '@/components/ReportView';
import { HistoryView } from '@/components/HistoryView';
import { RulesView } from '@/components/RulesView';

function Shell() {
  const { route } = useRoute();
  const { toast } = useDesk();
  return (
    <>
      <Topbar route={route} />
      <main id="main" tabIndex={-1}>
        {route.name === 'home' && <HomeScreen />}
        {route.name === 'describe' && <ConversationView />}
        {route.name === 'upload' && <UploadView />}
        {route.name === 'history' && <HistoryView />}
        {route.name === 'rules' && <RulesView />}
        {route.name === 'report' && <ReportView route={route} />}
      </main>
      <div role="status" aria-live="polite">{toast && <div className="toast">{toast}</div>}</div>
    </>
  );
}

export default function Page() {
  return (
    <DeskProvider>
      <Shell />
    </DeskProvider>
  );
}
