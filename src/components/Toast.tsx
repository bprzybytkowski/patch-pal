import { useToastStore, type Toast } from '../store/toast'

function ToastItem({ toast }: { toast: Toast }) {
  const borderClass =
    toast.type === 'success' ? 'border-l-indigo-500' : 'border-l-red-500'

  return (
    <div
      data-type={toast.type}
      className={`bg-zinc-800 border-l-4 ${borderClass} rounded-md px-4 py-3 text-sm text-zinc-100 shadow-lg`}
    >
      {toast.message}
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const visible = toasts.slice(-3)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
