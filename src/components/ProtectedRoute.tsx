import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function ProtectedRoute() {
  const { user, loading } = useAuthStore()
  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}
