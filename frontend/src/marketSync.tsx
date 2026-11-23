import { useIsFetching, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { api, type Investment } from './api'

const SYNC_MS = 10 * 60 * 1000

const isTracked = (i: Investment) => i.active && i.type !== 'seguros' && i.type !== 'roboadvisor' && Boolean(i.ft_symbol || i.isin)

async function syncAll(queryClient: QueryClient, ids: number[], force = false) {
  const results = await Promise.all(ids.map((id) => api.investments.syncMarket(id, force).catch(() => null)))
  await Promise.all(
    ['investments', 'investments-market', 'investments-summary', 'investments-composition'].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  )
  return results
}

const syncKey = (ids: number[]) => ['investments-market-sync', ids.join(',')]

export function useMarketSync() {
  const queryClient = useQueryClient()
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const ids = investments.filter(isTracked).map((i) => i.id)
  return useQuery({
    queryKey: syncKey(ids),
    enabled: ids.length > 0,
    refetchInterval: SYNC_MS,
    queryFn: () => syncAll(queryClient, ids),
  })
}

function parseUtc(iso: string) {
  return new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
}

export function PricesUpdatedAt({ className = '' }: { className?: string }) {
  const queryClient = useQueryClient()
  const syncing = useIsFetching({ queryKey: ['investments-market-sync'] }) > 0
  const { data: investments = [] } = useQuery({ queryKey: ['investments'], queryFn: () => api.investments.list() })
  const ids = investments.filter(isTracked).map((i) => i.id)
  const stamps = investments.filter(isTracked).flatMap((i) => (i.price_updated_at ? [parseUtc(i.price_updated_at).getTime()] : []))
  if (stamps.length === 0) return null
  const last = new Date(Math.max(...stamps))
  return (
    <span className={`num inline-flex items-center gap-1.5 text-[11.5px] text-faint ${className}`} title="Los precios se actualizan cada 10 minutos">
      Precios actualizados {last.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      <button
        type="button"
        onClick={() => queryClient.fetchQuery({ queryKey: syncKey(ids), queryFn: () => syncAll(queryClient, ids, true), staleTime: 0 })}
        disabled={syncing}
        aria-label="Actualizar precios ahora"
        title="Actualizar precios ahora"
        className="rounded p-0.5 hover:text-fg disabled:cursor-wait"
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
      </button>
    </span>
  )
}
