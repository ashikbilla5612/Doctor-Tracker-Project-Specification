/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AuthPage } from './components/AuthPage';
import { DashboardView } from './components/DashboardView';
import { DoctorDetailDrawer } from './components/DoctorDetailDrawer';
import { DoctorsView } from './components/DoctorsView';
import { Layout } from './components/Layout';
import { PatientsView } from './components/PatientsView';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { ActiveTab } from './types';

function readInitialTab(): ActiveTab {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  if (hash === 'doctors' || hash === 'patients' || hash === 'dashboard') {
    return hash;
  }
  return 'dashboard';
}

function PortalShell() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>(readInitialTab);
  const [createDoctorOpen, setCreateDoctorOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [inspectedDoctorId, setInspectedDoctorId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(readInitialTab());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    window.location.hash = `#/${tab}`;
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshSignal((s) => s + 1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
          <p className="text-xs font-medium text-slate-500">Verifying clinical session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const primaryActionLabel =
    activeTab === 'doctors'
      ? 'Add Doctor'
      : activeTab === 'patients'
        ? 'Add Patient'
        : 'Add Doctor';

  const handlePrimaryAction = () => {
    if (activeTab === 'patients') {
      setCreatePatientOpen(true);
    } else if (activeTab === 'doctors') {
      setCreateDoctorOpen(true);
    } else {
      handleTabChange('doctors');
      setCreateDoctorOpen(true);
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      primaryActionLabel={primaryActionLabel}
      onPrimaryAction={handlePrimaryAction}
    >
      {activeTab === 'dashboard' && (
        <DashboardView
          onNavigateTab={handleTabChange}
          onInspectDoctor={setInspectedDoctorId}
          refreshSignal={refreshSignal}
        />
      )}

      {activeTab === 'doctors' && (
        <DoctorsView
          createModalOpen={createDoctorOpen}
          onCloseCreateModal={() => setCreateDoctorOpen(false)}
          onInspectDoctor={setInspectedDoctorId}
          onDataChanged={triggerRefresh}
          refreshSignal={refreshSignal}
        />
      )}

      {activeTab === 'patients' && (
        <PatientsView
          createModalOpen={createPatientOpen}
          onCloseCreateModal={() => setCreatePatientOpen(false)}
          onInspectDoctor={setInspectedDoctorId}
          onDataChanged={triggerRefresh}
          refreshSignal={refreshSignal}
        />
      )}

      <DoctorDetailDrawer
        doctorId={inspectedDoctorId}
        onClose={() => setInspectedDoctorId(null)}
        onChanged={triggerRefresh}
      />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PortalShell />
    </AuthProvider>
  );
}
