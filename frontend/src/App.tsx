import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { I18nProvider } from './context/I18nContext'
import { ThemeProvider } from './context/ThemeProvider'
import { MainLayout } from './components/layout/MainLayout'
import RequireAuth from './components/layout/RequireAuth'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ButlerPage from './pages/ButlerPage'
import OpenHandsOpsPage from './pages/OpenHandsOpsPage'
import AgentsPage from './pages/AgentsPage'
import OperationsPage from './pages/OperationsPage'
import SettingsPage from './pages/SettingsPage'
import DialogueMonitorPage from './pages/DialogueMonitorPage'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes */}
              <Route element={<RequireAuth />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/butler" element={<ButlerPage />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route element={<RequireAuth adminOnly />}>
                    <Route path="/operator" element={<OpenHandsOpsPage />} />
                  </Route>
                  <Route element={<RequireAuth adminOnly />}>
                    <Route path="/dialogue-monitor" element={<DialogueMonitorPage />} />
                  </Route>
                  
                  {/* Admin Only Routes */}
                  <Route element={<RequireAuth adminOnly />}>
                    <Route path="/operations" element={<OperationsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/team" element={<Navigate to="/operations" replace />} />
                  </Route>

                  {/* Default Redirect */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

export default App
