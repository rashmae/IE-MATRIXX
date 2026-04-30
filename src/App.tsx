/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { FirebaseErrorBoundary } from './components/FirebaseErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import SubjectDetail from './pages/SubjectDetail';
import Progress from './pages/Progress';
import Bulletin from './pages/Bulletin';
import Calendar from './pages/Calendar';
import Resources from './pages/Resources';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import SyllabusIngestion from './pages/SyllabusIngestion';
import RatingsIngestion from './pages/RatingsIngestion';
import SpotlightDemo from './pages/SpotlightDemo';
import StudyTools from './pages/StudyTools';
import AIAssistant from './components/AIAssistant';

export default function App() {
  return (
    <Router>
      <FirebaseErrorBoundary>
        <AuthProvider>
          <a 
            href="#main-content" 
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:px-4 focus:py-2 focus:bg-ctu-gold focus:text-white focus:rounded-lg focus:font-bold focus:shadow-xl"
          >
            Skip to content
          </a>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/:id" element={<SubjectDetail />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/study" element={<StudyTools />} />
            <Route path="/bulletin" element={<Bulletin />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/ingest" element={<SyllabusIngestion />} />
            <Route path="/admin/ratings" element={<RatingsIngestion />} />
            <Route path="/demo" element={<SpotlightDemo />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster position="top-right" theme="dark" />
          <AIAssistant />
        </AuthProvider>
      </FirebaseErrorBoundary>
    </Router>
  );
}

