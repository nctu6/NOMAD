import { useState, useMemo, useRef } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import {
  CheckSquare, Square, Trash2, Plus, ChevronDown, ChevronRight,
  Sparkles, X, Pencil, Check, MoreHorizontal, CheckCheck, RotateCcw, Luggage,
} from 'lucide-react'
import type { PackingItem } from '../../types'

const VORSCHLAEGE = [
  { name: 'Passport', category: 'Documents' },
  { name: 'Travel Insurance', category: 'Documents' },
  { name: 'Visa Documents', category: 'Documents' },
  { name: 'Flight Tickets', category: 'Documents' },
  { name: 'Hotel Bookings', category: 'Documents' },
  { name: 'Vaccination Card', category: 'Documents' },
  { name: 'T-Shirts (5x)', category: 'Clothing' },
  { name: 'Pants (2x)', category: 'Clothing' },
  { name: 'Underwear (7x)', category: 'Clothing' },
  { name: 'Socks (7x)', category: 'Clothing' },
  { name: 'Jacket', category: 'Clothing' },
  { name: 'Swimwear', category: 'Clothing' },
  { name: 'Sport Shoes', category: 'Clothing' },
  { name: 'Toothbrush', category: 'Toiletries' },
  { name: 'Toothpaste', category: 'Toiletries' },
  { name: 'Shampoo', category: 'Toiletries' },
  { name: 'Sunscreen', category: 'Toiletries' },
  { name: 'Deodorant', category: 'Toiletries' },
  { name: 'Razor', category: 'Toiletries' },
  { name: 'Phone Charger', category: 'Electronics' },
  { name: 'Travel Adapter', category: 'Electronics' },
  { name: 'Headphones', category: 'Electronics' },
  { name: 'Camera', category: 'Electronics' },
  { name: 'Power Bank', category: 'Electronics' },
  { name: 'First Aid Kit', category: 'Health' },
  { name: 'Prescription Medication', category: 'Health' },
  { name: 'Pain Medication', category: 'Health' },
  { name: 'Insect Repellent', category: 'Health' },
  { name: 'Cash', category: 'Finances' },
  { name: 'Credit Card', category: 'Finances' },
]

// Cycling color palette — works in light & dark mode
const KAT_COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#22c55e', // green
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ef4444', // red
  '#eab308', // yellow
  '#8b5cf6', // violet
  '#14b8a6', // teal
]
// Stable color assignment: category name → index via simple hash
function katColor(kat, allCategories) {
  const idx = allCategories ? allCategories.indexOf(kat) : -1
  if (idx >= 0) return KAT_COLORS[idx % KAT_COLORS.length]
  // Fallback: hash-based
  let h = 0
  for (let i = 0; i < kat.length; i++) h = ((h << 5) - h + kat.charCodeAt(i)) | 0
  return KAT_COLORS[Math.abs(h) % KAT_COLORS.length]
}

// ── Artikel-Zeile ──────────────────────────────────────────────────────────
interface ArtikelZeileProps {
  item: PackingItem
  tripId: number
  categories: string[]
  onCategoryChange: () => void
}

function ArtikelZeile({ item, tripId, categories, onCategoryChange }: ArtikelZeileProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(item.name)
  const [hovered, setHovered] = useState(false)
  const [showCatPicker, setShowCatPicker] = useState(false)
  const { togglePackingItem, updatePackingItem, deletePackingItem } = useTripStore()
  const toast = useToast()
  const { t } = useTranslation()

  const handleToggle = () => togglePackingItem(tripId, item.id, !item.checked)

  const handleSaveName = async () => {
    if (!editName.trim()) { setEditing(false); setEditName(item.name); return }
    try { await updatePackingItem(tripId, item.id, { name: editName.trim() }); setEditing(false) }
    catch { toast.error(t('packing.toast.saveError')) }
  }

  const handleDelete = async () => {
    try { await deletePackingItem(tripId, item.id) }
    catch { toast.error(t('packing.toast.deleteError')) }
  }

  const handleCatChange = async (cat) => {
    setShowCatPicker(false)
    if (cat === item.category) return
    try { await updatePackingItem(tripId, item.id, { category: cat }) }
    catch { toast.error(t('common.error')) }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowCatPicker(false) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 10, position: 'relative',
        background: hovered ? 'var(--bg-secondary)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <button onClick={handleToggle} style={{
        flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex',
        color: item.checked ? '#10b981' : 'var(--text-faint)', transition: 'color 0.15s',
      }}>
        {item.checked ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>

      {editing ? (
        <input
          type="text" value={editName} autoFocus
          onChange={e => setEditName(e.target.value)}
          onBlur={handleSaveName}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditing(false); setEditName(item.name) } }}
          style={{ flex: 1, fontSize: 13.5, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
      ) : (
        <span
          onClick={() => !item.checked && setEditing(true)}
          style={{
            flex: 1, fontSize: 13.5,
            cursor: item.checked ? 'default' : 'text',
            color: item.checked ? 'var(--text-faint)' : 'var(--text-primary)',
            textDecoration: item.checked ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </span>
      )}

      <div style={{ display: 'flex', gap: 2, alignItems: 'center', opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowCatPicker(p => !p)}
            title={t('packing.changeCategory')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center', color: 'var(--text-faint)', fontSize: 10, gap: 2 }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: katColor(item.category || t('packing.defaultCategory'), categories), display: 'inline-block' }} />
          </button>
          {showCatPicker && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 50, background: 'var(--bg-card)',
              border: '1px solid var(--border-primary)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              padding: 4, minWidth: 140,
            }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => handleCatChange(cat)} style={{
                  display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                  padding: '6px 10px', background: cat === (item.category || t('packing.defaultCategory')) ? 'var(--bg-tertiary)' : 'none',
                  border: 'none', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit',
                  color: 'var(--text-secondary)', borderRadius: 7, textAlign: 'left',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: katColor(cat, categories), flexShrink: 0 }} />
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setEditing(true)} title={t('common.rename')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 6, display: 'flex', color: 'var(--text-faint)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
          <Pencil size={13} />
        </button>

        <button onClick={handleDelete} title={t('common.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 6, display: 'flex', color: 'var(--text-faint)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Kategorie-Gruppe ───────────────────────────────────────────────────────
interface KategorieGruppeProps {
  kategorie: string
  items: PackingItem[]
  tripId: number
  allCategories: string[]
  onRename: (oldName: string, newName: string) => Promise<void>
  onDeleteAll: (items: PackingItem[]) => Promise<void>
}

function KategorieGruppe({ kategorie, items, tripId, allCategories, onRename, onDeleteAll }: KategorieGruppeProps) {
  const [offen, setOffen] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [editKatName, setEditKatName] = useState(kategorie)
  const [showMenu, setShowMenu] = useState(false)
  const { togglePackingItem } = useTripStore()
  const toast = useToast()
  const { t } = useTranslation()
  const abgehakt = items.filter(i => i.checked).length
  const alleAbgehakt = abgehakt === items.length
  const dot = katColor(kategorie, allCategories)

  const handleSaveKatName = async () => {
    const neu = editKatName.trim()
    if (!neu || neu === kategorie) { setEditingName(false); setEditKatName(kategorie); return }
    try { await onRename(kategorie, neu); setEditingName(false) }
    catch { toast.error(t('packing.toast.renameError')) }
  }

  const handleCheckAll = async () => {
    for (const item of Array.from(items)) {
      if (!item.checked) await togglePackingItem(tripId, item.id, true)
    }
  }
  const handleUncheckAll = async () => {
    for (const item of Array.from(items)) {
      if (item.checked) await togglePackingItem(tripId, item.id, false)
    }
  }
  const handleDeleteAll = async () => {
    await onDeleteAll(items)
    setShowMenu(false)
  }

  return (
    <div style={{ marginBottom: 6, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-secondary)', overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: offen ? '1px solid var(--border-secondary)' : 'none' }}>
        <button onClick={() => setOffen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-faint)', flexShrink: 0 }}>
          {offen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />

        {editingName ? (
          <input
            autoFocus value={editKatName}
            onChange={e => setEditKatName(e.target.value)}
            onBlur={handleSaveKatName}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveKatName(); if (e.key === 'Escape') { setEditingName(false); setEditKatName(kategorie) } }}
            style={{ flex: 1, fontSize: 12.5, fontWeight: 600, border: 'none', borderBottom: '2px solid var(--text-primary)', outline: 'none', background: 'transparent', fontFamily: 'inherit', color: 'var(--text-primary)', padding: '0 2px' }}
          />
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 }}>
            {kategorie}
          </span>
        )}

        <span style={{
          fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99,
          background: alleAbgehakt ? 'rgba(22,163,74,0.12)' : 'var(--bg-tertiary)',
          color: alleAbgehakt ? '#16a34a' : 'var(--text-muted)',
        }}>
          {abgehakt}/{items.length}
        </span>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, display: 'flex', color: 'var(--text-faint)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
            <MoreHorizontal size={15} />
          </button>
          {showMenu && (
            <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: 4, minWidth: 170 }}
              onMouseLeave={() => setShowMenu(false)}>
              <MenuItem icon={<Pencil size={13} />} label={t('packing.menuRename')} onClick={() => { setEditingName(true); setShowMenu(false) }} />
              <MenuItem icon={<CheckCheck size={13} />} label={t('packing.menuCheckAll')} onClick={() => { handleCheckAll(); setShowMenu(false) }} />
              <MenuItem icon={<RotateCcw size={13} />} label={t('packing.menuUncheckAll')} onClick={() => { handleUncheckAll(); setShowMenu(false) }} />
              <div style={{ height: 1, background: 'var(--bg-tertiary)', margin: '4px 0' }} />
              <MenuItem icon={<Trash2 size={13} />} label={t('packing.menuDeleteCat')} danger onClick={handleDeleteAll} />
            </div>
          )}
        </div>
      </div>

      {offen && (
        <div style={{ padding: '4px 4px 6px' }}>
          {items.map(item => (
            <ArtikelZeile key={item.id} item={item} tripId={tripId} categories={allCategories} onCategoryChange={() => {}} />
          ))}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger: boolean
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 12.5, fontFamily: 'inherit', borderRadius: 7, textAlign: 'left',
      color: danger ? '#ef4444' : 'var(--text-secondary)',
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? '#fef2f2' : 'var(--bg-tertiary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {icon}{label}
    </button>
  )
}

// ── Haupt-Panel ────────────────────────────────────────────────────────────
interface PackingListPanelProps {
  tripId: number
  items: PackingItem[]
}

export default function PackingListPanel({ tripId, items }: PackingListPanelProps) {
  const [neuerName, setNeuerName] = useState('')
  const [neueKategorie, setNeueKategorie] = useState('')
  const [zeigeVorschlaege, setZeigeVorschlaege] = useState(false)
  const [filter, setFilter] = useState('alle') // 'alle' | 'offen' | 'erledigt'
  const [showKatDropdown, setShowKatDropdown] = useState(false)
  const katInputRef = useRef(null)
  const { addPackingItem, updatePackingItem, deletePackingItem } = useTripStore()
  const toast = useToast()
  const { t } = useTranslation()

  const allCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category || t('packing.defaultCategory')))
    return Array.from(cats).sort()
  }, [items, t])

  const gruppiert = useMemo(() => {
    const filtered = items.filter(i => {
      if (filter === 'offen') return !i.checked
      if (filter === 'erledigt') return i.checked
      return true
    })
    const groups = {}
    for (const item of filtered) {
      const kat = item.category || t('packing.defaultCategory')
      if (!groups[kat]) groups[kat] = []
      groups[kat].push(item)
    }
    return groups
  }, [items, filter, t])

  const abgehakt = items.filter(i => i.checked).length
  const fortschritt = items.length > 0 ? Math.round((abgehakt / items.length) * 100) : 0

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!neuerName.trim()) return
    const kat = neueKategorie.trim() || (allCategories[0] || t('packing.defaultCategory'))
    try {
      await addPackingItem(tripId, { name: neuerName.trim(), category: kat })
      setNeuerName('')
    } catch { toast.error(t('packing.toast.addError')) }
  }

  const vorschlaege = t('packing.suggestions.items') || VORSCHLAEGE

  const handleVorschlag = async (v) => {
    try { await addPackingItem(tripId, { name: v.name, category: v.category || v.kategorie }) }
    catch { toast.error(t('packing.toast.addError')) }
  }

  const handleRenameCategory = async (oldName, newName) => {
    const toUpdate = items.filter(i => (i.category || t('packing.defaultCategory')) === oldName)
    for (const item of toUpdate) {
      await updatePackingItem(tripId, item.id, { category: newName })
    }
  }

  const handleDeleteCategory = async (catItems) => {
    for (const item of catItems) {
      try { await deletePackingItem(tripId, item.id) } catch {}
    }
  }

  const handleClearChecked = async () => {
    if (!confirm(t('packing.confirm.clearChecked', { count: abgehakt }))) return
    for (const item of items.filter(i => i.checked)) {
      try { await deletePackingItem(tripId, item.id) } catch {}
    }
  }

  const vorhandeneNamen = new Set(items.map(i => i.name.toLowerCase()))
  const verfuegbareVorschlaege = vorschlaege.filter(v => !vorhandeneNamen.has(v.name.toLowerCase()))

  const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', ...font }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{t('packing.title')}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-faint)' }}>
              {items.length === 0 ? t('packing.empty') : t('packing.progress', { packed: abgehakt, total: items.length, percent: fortschritt })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {abgehakt > 0 && (
              <button onClick={handleClearChecked} style={{
                fontSize: 11.5, padding: '5px 10px', borderRadius: 99, border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span className="hidden sm:inline">{t('packing.clearChecked', { count: abgehakt })}</span>
                <span className="sm:hidden">{t('packing.clearCheckedShort', { count: abgehakt })}</span>
              </button>
            )}
            <button onClick={() => setZeigeVorschlaege(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99,
              border: '1px solid', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              background: zeigeVorschlaege ? 'var(--text-primary)' : 'var(--bg-card)',
              borderColor: zeigeVorschlaege ? 'var(--text-primary)' : 'var(--border-primary)',
              color: zeigeVorschlaege ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}>
              <Sparkles size={12} /> {t('packing.suggestions')}
            </button>
          </div>
        </div>

          {items.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 5, background: 'var(--bg-tertiary)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99, transition: 'width 0.4s ease',
                background: fortschritt === 100 ? '#10b981' : 'linear-gradient(90deg, var(--text-primary) 0%, var(--text-muted) 100%)',
                width: `${fortschritt}%`,
              }} />
            </div>
            {fortschritt === 100 && (
              <p style={{ fontSize: 11.5, color: '#10b981', marginTop: 4, fontWeight: 600, margin: '4px 0 0' }}>{t('packing.allPacked')}</p>
            )}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text" value={neuerName} onChange={e => setNeuerName(e.target.value)}
            placeholder={t('packing.addPlaceholder')}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-primary)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', color: 'var(--text-primary)' }}
          />
          <div style={{ position: 'relative' }}>
            <input
              ref={katInputRef}
              type="text" value={neueKategorie}
              onChange={e => { setNeueKategorie(e.target.value); setShowKatDropdown(true) }}
              onFocus={() => setShowKatDropdown(true)}
              onBlur={() => setTimeout(() => setShowKatDropdown(false), 150)}
              placeholder={allCategories[0] || t('packing.categoryPlaceholder')}
              style={{ width: 120, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--text-secondary)' }}
            />
            {showKatDropdown && allCategories.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, padding: 4, marginTop: 2 }}>
                {allCategories.filter(c => !neueKategorie || c.toLowerCase().includes(neueKategorie.toLowerCase())).map(cat => (
                  <button key={cat} type="button" onMouseDown={() => setNeueKategorie(cat)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontFamily: 'inherit', color: 'var(--text-secondary)', borderRadius: 7, textAlign: 'left',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: katColor(cat, allCategories), flexShrink: 0 }} />
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Plus size={16} />
          </button>
        </form>
      </div>

      {/* ── Vorschläge ── */}
      {zeigeVorschlaege && (
        <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'var(--bg-secondary)', padding: '10px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('packing.suggestionsTitle')}</span>
            <button onClick={() => setZeigeVorschlaege(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={14} style={{ color: 'var(--text-faint)' }} />
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 110, overflowY: 'auto' }}>
            {verfuegbareVorschlaege.map((v, i) => (
              <button key={i} onClick={() => handleVorschlag(v)} style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border-primary)',
                background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--text-primary)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-primary)' }}
              >
                + {v.name}
              </button>
            ))}
            {verfuegbareVorschlaege.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>{t('packing.allSuggested')}</p>}
          </div>
        </div>
      )}

      {/* ── Filter-Tabs ── */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', flexShrink: 0 }}>
          {[['alle', t('packing.filterAll')], ['offen', t('packing.filterOpen')], ['erledigt', t('packing.filterDone')]].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{
              padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit', fontWeight: filter === id ? 600 : 400,
              background: filter === id ? 'var(--text-primary)' : 'transparent',
              color: filter === id ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* ── Liste ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Luggage size={40} style={{ color: 'var(--text-faint)', display: 'block', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{t('packing.emptyTitle')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>{t('packing.emptyHint')}</p>
          </div>
        ) : Object.keys(gruppiert).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)' }}>
            <p style={{ fontSize: 13, margin: 0 }}>{t('packing.emptyFiltered')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(gruppiert).map(([kat, katItems]) => (
              <KategorieGruppe
                key={kat}
                kategorie={kat}
                items={katItems}
                tripId={tripId}
                allCategories={allCategories}
                onRename={handleRenameCategory}
                onDeleteAll={handleDeleteCategory}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
