import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
  duration: number
  removing: boolean
}

declare global {
  interface Window {
    __addToast?: (message: string, type?: ToastType, duration?: number) => number
  }
}

let toastIdCounter = 0

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev, { id, message, type, duration, removing: false }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id))
        }, 300)
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }, [])

  useEffect(() => {
    window.__addToast = addToast
    return () => { delete window.__addToast }
  }, [addToast])

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
  }

  const bgColors: Record<ToastType, string> = {
    success: 'bg-white border-l-4 border-emerald-500',
    error: 'bg-white border-l-4 border-red-500',
    warning: 'bg-white border-l-4 border-amber-500',
    info: 'bg-white border-l-4 border-blue-500',
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            ${bgColors[toast.type] || bgColors.info}
            ${toast.removing ? 'toast-exit' : 'toast-enter'}
            flex items-start gap-3 p-4 rounded-lg shadow-lg pointer-events-auto
            min-w-0
          `}
        >
          {icons[toast.type] || icons.info}
          <p className="text-sm text-slate-700 flex-1 leading-relaxed">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export const useToast = () => {
  const show = useCallback((message: string, type: ToastType, duration?: number) => {
    if (window.__addToast) {
      window.__addToast(message, type, duration)
    }
  }, [])

  return {
    success: (message: string, duration?: number) => show(message, 'success', duration),
    error: (message: string, duration?: number) => show(message, 'error', duration),
    warning: (message: string, duration?: number) => show(message, 'warning', duration),
    info: (message: string, duration?: number) => show(message, 'info', duration),
  }
}

export default useToast
