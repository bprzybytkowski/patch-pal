import { useToastStore, type Toast } from '../store/toast'

function ToastItem({ toast }: { toast: Toast }) {
  const borderClass = toast.type === 'success' ? 'border-l-ink-muted' : 'border-l-accent'

  return (
    <div
      data-type={toast.type}
      className={`bg-ink border-l-4 ${borderClass} rounded-[2px] px-4 py-3`}
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
    >
      <p className="font-serif italic text-[14px] text-paper leading-snug">{toast.message}</p>
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
