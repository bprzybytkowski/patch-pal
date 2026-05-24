import { createBrowserRouter } from 'react-router-dom'
import RootRedirect from './components/RootRedirect'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import AuthPage from './pages/Auth'
import SessionsPage from './pages/Sessions'
import NewSessionPage from './pages/NewSession'
import SessionDetailPage from './pages/SessionDetail'
import DevicesPage from './pages/Devices'

export const routes = [
  { path: '/', element: <RootRedirect /> },
  { path: '/auth', element: <AuthPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/sessions', element: <SessionsPage /> },
          { path: '/sessions/new', element: <NewSessionPage /> },
          { path: '/sessions/:id', element: <SessionDetailPage /> },
          { path: '/devices', element: <DevicesPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
