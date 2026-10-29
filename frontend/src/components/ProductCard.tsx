import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request, money } from '../api'
import { useSession } from '../session'
import { ErrorBox } from './ui'
import type { Product } from '../types'

export function ProductVisual({
  product,
  large = false,
}: {
  product: Product
  large?: boolean
}) {
  return (
    <div
      className={`product-visual tone-${product.id % 4} ${large ? 'large' : ''}`}
      aria-hidden="true"
    >
      <div className="object-shape">
        <span>{product.name.slice(0, 1)}</span>
      </div>
      <span className="visual-sku">{product.sku}</span>
    </div>
  )
}
export function FavoriteButton({
  product,
  active,
}: {
  product: Product
  active: boolean
}) {
  const { token } = useSession()
  const navigate = useNavigate()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: () =>
      request(`/favorites/${product.id}`, {
        method: active ? 'DELETE' : 'PUT',
        token,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['favorites'] }),
  })
  return (
    <>
      <button
        className={`favorite ${active ? 'active' : ''}`}
        aria-label={`${product.name}をお気に入り${active ? 'から解除' : 'に登録'}`}
        aria-pressed={active}
        disabled={mutation.isPending}
        onClick={() => (token ? mutation.mutate() : navigate('/login'))}
      >
        {active ? '♥' : '♡'}
      </button>
      {mutation.error && <ErrorBox error={mutation.error} />}
    </>
  )
}
export default function ProductCard({
  product,
  favorite,
}: {
  product: Product
  favorite: boolean
}) {
  return (
    <article className="product-card">
      <div className="card-visual">
        <Link
          to={`/products/${product.id}`}
          aria-label={`${product.name}の詳細`}
        >
          <ProductVisual product={product} />
        </Link>
        <FavoriteButton product={product} active={favorite} />
        {product.stock === 0 && <span className="stock-badge">SOLD OUT</span>}
      </div>
      <p className="sku">{product.sku}</p>
      <h3>
        <Link to={`/products/${product.id}`}>{product.name}</Link>
      </h3>
      <div className="card-bottom">
        <span>{money(product.price)}</span>
        <span className="muted">
          {product.stock > 0 ? `在庫 ${product.stock}` : '在庫なし'}
        </span>
      </div>
    </article>
  )
}
