import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request, money, date } from '../api'
import { useSession } from '../session'
import { useOrders, useProducts } from '../queries'
import { Empty, ErrorBox, Loading, PageTitle } from '../components/ui'
import OrderEditor from '../components/OrderEditor'
import type { CartItem, Order } from '../types'

function OrderCard({ order }: { order: Order }) {
  const { token } = useSession()
  const client = useQueryClient()
  const products = useProducts()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState<CartItem[]>([])
  const detail = useQuery({
    queryKey: ['order', order.id, token],
    enabled: expanded,
    queryFn: ({ signal }) =>
      request<{ order: Order }>(`/orders/${order.id}`, { token, signal }),
  })
  const current = detail.data?.order || order
  const mutation = useMutation({
    mutationFn: (action: 'cancel' | 'replace') =>
      request(`/orders/${order.id}`, {
        method: action === 'cancel' ? 'DELETE' : 'PUT',
        token,
        ...(action === 'replace' ? { body: { items } } : {}),
      }),
    onSuccess: async () => {
      setEditing(false)
      await Promise.all(
        ['orders', 'order', 'products', 'product', 'favorites'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
  return (
    <article className="panel order-card">
      <div className="order-header">
        <div>
          <p className="eyebrow">ORDER #{current.id}</p>
          <p className="muted">{date(current.createdAt)}</p>
        </div>
        <span
          className={`status ${current.status === 'CANCELLED' ? 'cancelled' : ''}`}
        >
          {current.status === 'PLACED' ? '注文済み' : '取消済み'}
        </span>
      </div>
      {current.items.map((item) => (
        <div className="order-row" key={item.productId}>
          <div>
            <strong>{item.name}</strong>
            <p className="muted">
              {item.sku} · {money(item.unitPrice)} × {item.quantity}
            </p>
          </div>
          <span>{money(item.unitPrice * item.quantity)}</span>
        </div>
      ))}
      <div className="order-summary">
        <span>注文合計</span>
        <strong>{money(current.total)}</strong>
      </div>
      <div className="button-row">
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? '詳細を閉じる' : '注文詳細'}
        </button>
        {current.status === 'PLACED' && (
          <>
            <button
              disabled={mutation.isPending}
              onClick={() => {
                setItems(
                  current.items.map(({ productId, quantity }) => ({
                    productId,
                    quantity,
                  })),
                )
                setEditing(!editing)
                mutation.reset()
              }}
            >
              {editing ? '編集を閉じる' : '注文を変更'}
            </button>
            <button
              className="text-button danger"
              disabled={mutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `注文 #${current.id} を取り消しますか？在庫が返却されます。`,
                  )
                )
                  mutation.mutate('cancel')
              }}
            >
              注文を取り消す
            </button>
          </>
        )}
      </div>
      {expanded &&
        (detail.isPending ? (
          <Loading />
        ) : detail.error ? (
          <ErrorBox error={detail.error} retry={() => void detail.refetch()} />
        ) : (
          <p className="muted">最終更新: {date(current.updatedAt)}</p>
        ))}
      {mutation.error && <ErrorBox error={mutation.error} />}
      {editing && (
        <div className="order-edit">
          <h3>注文内容を変更</h3>
          {products.isPending ? (
            <Loading />
          ) : products.error ? (
            <ErrorBox
              error={products.error}
              retry={() => void products.refetch()}
            />
          ) : (
            <OrderEditor
              items={items}
              products={products.data}
              onChange={setItems}
              onSubmit={() => mutation.mutate('replace')}
              busy={mutation.isPending}
              submitLabel="この内容に変更する"
              allowMissing
            />
          )}
        </div>
      )}
    </article>
  )
}
export default function Orders() {
  const query = useOrders()
  const location = useLocation()
  const [page, setPage] = useState(0)
  const orders = query.data || []
  const current = Math.min(page, Math.max(0, Math.ceil(orders.length / 10) - 1))
  return (
    <section className="narrow">
      <PageTitle label="YOUR ORDERS" title="注文履歴" />
      {location.state?.created && (
        <p className="success" role="status">
          ご注文ありがとうございます。注文を受け付けました。
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : orders.length === 0 ? (
        <Empty title="まだ注文はありません">
          <Link to="/" className="button">
            商品を探す →
          </Link>
        </Empty>
      ) : (
        orders
          .slice(current * 10, current * 10 + 10)
          .map((order) => <OrderCard key={order.id} order={order} />)
      )}
      {orders.length > 10 && (
        <div className="pagination">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}>
            ← 前へ
          </button>
          <span>
            {current + 1} / {Math.ceil(orders.length / 10)}
          </span>
          <button
            disabled={(current + 1) * 10 >= orders.length}
            onClick={() => setPage(current + 1)}
          >
            次へ →
          </button>
        </div>
      )}
    </section>
  )
}
