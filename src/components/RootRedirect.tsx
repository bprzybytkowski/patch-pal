import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function RootRedirect() {
  const { user, loading } = useAuthStore()
  if (loading) return null
  return user ? <Navigate to="/sessions" replace /> : <Navigate to="/auth" replace />
}
