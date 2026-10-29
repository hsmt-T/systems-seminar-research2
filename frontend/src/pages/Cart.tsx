import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../api'
import { useProducts } from '../queries'
import { useSession } from '../session'
import { Empty, ErrorBox, Loading, PageTitle } from '../components/ui'
import OrderEditor from '../components/OrderEditor'
import type { Order } from '../types'

export default function Cart() {
  const { cart, setCart, token, user } = useSession()
  const products = useProducts()
  const client = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () =>
      request<{ order: Order }>('/orders', {
        method: 'POST',
        token,
        body: { items: cart },
      }),
    onSuccess: async () => {
      setCart([])
      await Promise.all([
        client.invalidateQueries({ queryKey: ['orders'] }),
        client.invalidateQueries({ queryKey: ['products'] }),
        client.invalidateQueries({ queryKey: ['product'] }),
        client.invalidateQueries({ queryKey: ['favorites'] }),
      ])
      navigate('/orders', { state: { created: true } })
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ['products'] })
    },
  })
  return (
    <section className="narrow">
      <PageTitle label="SHOPPING BAG" title="ショッピングバッグ" />
      {cart.length === 0 ? (
        <Empty title="バッグはまだ空です">
          <p>お気に入りの商品を見つけにいきましょう。</p>
          <Link to="/" className="button">
            商品を探す →
          </Link>
        </Empty>
      ) : products.isPending ? (
        <Loading />
      ) : products.error ? (
        <ErrorBox
          error={products.error}
          retry={() => void products.refetch()}
        />
      ) : (
        <div className="panel">
          {mutation.error && <ErrorBox error={mutation.error} />}
          <OrderEditor
            items={cart}
            products={products.data}
            onChange={setCart}
            busy={mutation.isPending}
            submitLabel={user ? '注文を確定する' : 'ログインして注文する'}
            onSubmit={() => (user ? mutation.mutate() : navigate('/login'))}
          />
          <p className="muted">
            バッグは画面を再読み込みするとリセットされます。決済・配送の手続きはありません。
          </p>
        </div>
      )}
    </section>
  )
}
