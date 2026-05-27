import { createBrowserRouter } from 'react-router-dom'
import RootRedirect from './components/RootRedirect'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import AuthPage from './pages/Auth'
import ResetPasswordPage from './pages/ResetPassword'
import SessionsPage from './pages/Sessions'
import NewSessionPage from './pages/NewSession'
import SessionDetailPage from './pages/SessionDetail'
import DevicesPage from './pages/Devices'
import QuickCapturePage from './pages/QuickCapture'

export const routes = [
  { path: '/', element: <RootRedirect /> },
  { path: '/auth', element: <AuthPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/sessions', element: <SessionsPage /> },
          { path: '/sessions/new', element: <NewSessionPage /> },
          { path: '/sessions/quick', element: <QuickCapturePage /> },
          { path: '/sessions/:id', element: <SessionDetailPage /> },
          { path: '/devices', element: <DevicesPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
