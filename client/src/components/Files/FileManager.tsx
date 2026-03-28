import ReactDOM from 'react-dom'
import { useState, useCallback } from 'react'
import DOM from 'react-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, Trash2, ExternalLink, X, FileText, FileImage, File, MapPin, Ticket, StickyNote } from 'lucide-react'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import type { Place, Reservation, TripFile } from '../../types'

function isImage(mimeType) {
  if (!mimeType) return false
  return mimeType.startsWith('image/') // covers jpg, png, gif, webp, etc.
}

function getFileIcon(mimeType) {
  if (!mimeType) return File
  if (mimeType === 'application/pdf') return FileText
  if (isImage(mimeType)) return FileImage
  return File
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDateWithLocale(dateStr, locale) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '' }
}

// Image lightbox
interface ImageLightboxProps {
  file: TripFile & { url: string }
  onClose: () => void
}

function ImageLightbox({ file, onClose }: ImageLightboxProps) {
  const { t } = useTranslation()
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <img
          src={file.url}
          alt={file.original_name}
          style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, display: 'block' }}
        />
        <div style={{ position: 'absolute', top: -40, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{file.original_name}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={file.url} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.7)', display: 'flex' }} title={t('files.openTab')}>
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', padding: 0 }}>
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Source badge — unified style for both place and reservation
interface SourceBadgeProps {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
}

function SourceBadge({ icon: Icon, label }: SourceBadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10.5, color: '#4b5563',
      background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
      borderRadius: 6, padding: '2px 7px',
      fontWeight: 500, maxWidth: '100%', overflow: 'hidden',
    }}>
      <Icon size={10} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
  )
}

interface FileManagerProps {
  files?: TripFile[]
  onUpload: (fd: FormData) => Promise<void>
  onDelete: (fileId: number) => Promise<void>
  onUpdate: (fileId: number, data: Partial<TripFile>) => Promise<void>
  places: Place[]
  reservations?: Reservation[]
  tripId: number
  allowedFileTypes: Record<string, string[]>
}

export default function FileManager({ files = [], onUpload, onDelete, onUpdate, places, reservations = [], tripId, allowedFileTypes }: FileManagerProps) {
  const [uploading, setUploading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [lightboxFile, setLightboxFile] = useState(null)
  const toast = useToast()
  const { t, locale } = useTranslation()

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return
    setUploading(true)
    try {
      for (const file of acceptedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        await onUpload(formData)
      }
      toast.success(t('files.uploaded', { count: acceptedFiles.length }))
    } catch {
      toast.error(t('files.uploadError'))
    } finally {
      setUploading(false)
    }
  }, [onUpload, toast, t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024,
    noClick: false,
  })

  // Paste support
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      onDrop(files)
    }
  }, [onDrop])

  const filteredFiles = files.filter(f => {
    if (filterType === 'pdf') return f.mime_type === 'application/pdf'
    if (filterType === 'image') return isImage(f.mime_type)
    if (filterType === 'doc') return (f.mime_type || '').includes('word') || (f.mime_type || '').includes('excel') || (f.mime_type || '').includes('text')
    if (filterType === 'collab') return !!f.note_id
    return true
  })

  const handleDelete = async (id) => {
    if (!confirm(t('files.confirm.delete'))) return
    try {
      await onDelete(id)
      toast.success(t('files.toast.deleted'))
    } catch {
      toast.error(t('files.toast.deleteError'))
    }
  }

  const [previewFile, setPreviewFile] = useState(null)

  const openFile = (file) => {
    if (isImage(file.mime_type)) {
      setLightboxFile(file)
    } else {
      setPreviewFile(file)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }} onPaste={handlePaste} tabIndex={-1}>
      {/* Lightbox */}
      {lightboxFile && <ImageLightbox file={lightboxFile} onClose={() => setLightboxFile(null)} />}

      {/* Datei-Vorschau Modal — portal to body to escape stacking context */}
      {previewFile && ReactDOM.createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 950, height: '94vh', background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{previewFile.original_name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <a href={previewFile.url || `/uploads/files/${previewFile.filename}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', padding: '4px 8px', borderRadius: 6, transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <ExternalLink size={13} /> {t('files.openTab')}
                </a>
                <button onClick={() => setPreviewFile(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <object
              data={`${previewFile.url || `/uploads/files/${previewFile.filename}`}#view=FitH`}
              type="application/pdf"
              style={{ flex: 1, width: '100%', border: 'none' }}
              title={previewFile.original_name}
            >
              <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                <a href={previewFile.url || `/uploads/files/${previewFile.filename}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>PDF herunterladen</a>
              </p>
            </object>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{t('files.title')}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-faint)' }}>
            {files.length === 1 ? t('files.countSingular') : t('files.count', { count: files.length })}
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        {...getRootProps()}
        style={{
          margin: '16px 16px 0', border: '2px dashed', borderRadius: 14, padding: '20px 16px',
          textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
          borderColor: isDragActive ? 'var(--text-secondary)' : 'var(--border-primary)',
          background: isDragActive ? 'var(--bg-secondary)' : 'var(--bg-card)',
        }}
      >
        <input {...getInputProps()} />
        <Upload size={24} style={{ margin: '0 auto 8px', color: isDragActive ? 'var(--text-secondary)' : 'var(--text-faint)', display: 'block' }} />
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div style={{ width: 14, height: 14, border: '2px solid var(--text-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {t('files.uploading')}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>{t('files.dropzone')}</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}>{t('files.dropzoneHint')}</p>
            <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 6, opacity: 0.7 }}>
              {(allowedFileTypes || 'jpg,jpeg,png,gif,webp,heic,pdf,doc,docx,xls,xlsx,txt,csv').toUpperCase().split(',').join(', ')} · Max 50 MB
            </p>
          </>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0', flexShrink: 0 }}>
        {[
          { id: 'all', label: t('files.filterAll') },
          { id: 'pdf', label: t('files.filterPdf') },
          { id: 'image', label: t('files.filterImages') },
          { id: 'doc', label: t('files.filterDocs') },
          ...(files.some(f => f.note_id) ? [{ id: 'collab', label: t('files.filterCollab') || 'Collab' }] : []),
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterType(tab.id)} style={{
            padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12,
            fontFamily: 'inherit', transition: 'all 0.12s',
            background: filterType === tab.id ? 'var(--accent)' : 'transparent',
            color: filterType === tab.id ? 'var(--accent-text)' : 'var(--text-muted)',
            fontWeight: filterType === tab.id ? 600 : 400,
          }}>{tab.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-faint)', alignSelf: 'center' }}>
          {filteredFiles.length === 1 ? t('files.countSingular') : t('files.count', { count: filteredFiles.length })}
        </span>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        {filteredFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-faint)' }}>
            <FileText size={40} style={{ color: 'var(--text-faint)', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{t('files.empty')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>{t('files.emptyHint')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredFiles.map(file => {
              const FileIcon = getFileIcon(file.mime_type)
              const linkedPlace = places?.find(p => p.id === file.place_id)
              const linkedReservation = file.reservation_id
                ? (reservations?.find(r => r.id === file.reservation_id) || { title: file.reservation_title })
                : null
              const fileUrl = file.url || (file.filename?.startsWith('files/') ? `/uploads/${file.filename}` : `/uploads/files/${file.filename}`)

              return (
                <div key={file.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12,
                  padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
                  transition: 'border-color 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-faint)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-primary)'}
                  className="group"
                >
                  {/* Icon or thumbnail */}
                  <div
                    onClick={() => openFile({ ...file, url: fileUrl })}
                    style={{
                      flexShrink: 0, width: 36, height: 36, borderRadius: 8,
                      background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden',
                    }}
                  >
                    {isImage(file.mime_type)
                      ? <img src={fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (() => {
                          const ext = (file.original_name || '').split('.').pop()?.toUpperCase() || '?'
                          const isPdf = file.mime_type === 'application/pdf'
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: isPdf ? '#ef44441a' : 'var(--bg-tertiary)' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: isPdf ? '#ef4444' : 'var(--text-muted)', letterSpacing: 0.3 }}>{ext}</span>
                            </div>
                          )
                        })()
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      onClick={() => openFile({ ...file, url: fileUrl })}
                      style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    >
                      {file.original_name}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {file.file_size && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{formatSize(file.file_size)}</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{formatDateWithLocale(file.created_at, locale)}</span>

                      {linkedPlace && (
                        <SourceBadge
                          icon={MapPin}
                          label={`${t('files.sourcePlan')} · ${linkedPlace.name}`}
                        />
                      )}
                      {linkedReservation && (
                        <SourceBadge
                          icon={Ticket}
                          label={`${t('files.sourceBooking')} · ${linkedReservation.title || t('files.sourceBooking')}`}
                        />
                      )}
                      {file.note_id && (
                        <SourceBadge
                          icon={StickyNote}
                          label={t('files.sourceCollab') || 'Collab Notes'}
                        />
                      )}
                    </div>

                    {file.description && !linkedReservation && (
                      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0, transition: 'opacity 0.12s' }} className="file-actions">
                    <button onClick={() => openFile({ ...file, url: fileUrl })} title={t('common.open')} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', borderRadius: 6, display: 'flex' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
                      <ExternalLink size={14} />
                    </button>
                    <button onClick={() => handleDelete(file.id)} title={t('common.delete')} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', borderRadius: 6, display: 'flex' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        div:hover > .file-actions { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
