import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { request, money } from '../api'
import { useSession } from '../session'
import { useFavorites } from '../queries'
import { ProductVisual, FavoriteButton } from '../components/ProductCard'
import { ErrorBox, Loading } from '../components/ui'
import type { Product } from '../types'

export default function ProductDetail() {
  const { id } = useParams()
  const { cart, setCart } = useSession()
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState('')
  const favorites = useFavorites()
  const query = useQuery({
    queryKey: ['product', id],
    queryFn: ({ signal }) =>
      request<{ product: Product }>(`/products/${id}`, { signal }),
  })
  if (query.isPending) return <Loading />
  if (query.error)
    return <ErrorBox error={query.error} retry={() => void query.refetch()} />
  const product = query.data.product
  const existing = cart.find((item) => item.productId === product.id)
  const available = Math.min(1000, product.stock) - (existing?.quantity || 0)
  function add() {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > available)
      return
    if (!existing && cart.length >= 50) {
      setNotice('バッグには最大50種類の商品を追加できます。')
      return
    }
    setCart((items) =>
      existing
        ? items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...items, { productId: product.id, quantity }],
    )
    setNotice('バッグに追加しました。')
  }
  return (
    <>
      <Link className="back-link" to="/">
        ← 商品一覧へ
      </Link>
      <section className="detail-layout">
        <ProductVisual product={product} large />
        <div className="detail-info">
          <p className="eyebrow">THE EVERYDAY COLLECTION</p>
          <p className="sku">{product.sku}</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{money(product.price)}</p>
          <p className="availability">
            {product.stock > 0
              ? `● 在庫あり · 残り ${product.stock} 点`
              : '在庫なし'}
          </p>
          <div className="divider" />
          <label>
            数量
            <input
              aria-label="数量"
              className="quantity"
              type="number"
              min={1}
              max={Math.max(1, available)}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <div className="detail-actions">
            <button
              className="button"
              disabled={
                available < 1 ||
                quantity < 1 ||
                quantity > available ||
                !Number.isInteger(quantity)
              }
              onClick={add}
            >
              バッグに追加する ＋
            </button>
            <FavoriteButton
              product={product}
              active={
                favorites.data?.some((item) => item.id === product.id) || false
              }
            />
          </div>
          <p role="status">
            {notice}{' '}
            {notice === 'バッグに追加しました。' && (
              <Link to="/cart">バッグを見る →</Link>
            )}
          </p>
          <p className="muted">ご注文の確定時に在庫と価格を再確認します。</p>
        </div>
      </section>
    </>
  )
}
