import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request, money } from '../api'
import { useProducts } from '../queries'
import { useSession } from '../session'
import { Empty, ErrorBox, Loading, PageTitle } from '../components/ui'
import type { Product, ProductInput } from '../types'

function ProductForm({
  product,
  close,
}: {
  product: Product | null
  close: () => void
}) {
  const { token } = useSession()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (body: ProductInput) =>
      request(product ? `/products/${product.id}` : '/products', {
        method: product ? 'PATCH' : 'POST',
        token,
        body,
      }),
    onSuccess: async () => {
      await Promise.all(
        ['products', 'product', 'favorites'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      )
      close()
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const sku = String(data.get('sku')).trim()
    const name = String(data.get('name')).trim()
    if (!sku || !name) return
    mutation.mutate({
      sku,
      name,
      price: Number(data.get('price')),
      stock: Number(data.get('stock')),
    })
  }
  return (
    <section className="panel product-form">
      <h2>{product ? '商品を編集' : '新しい商品を登録'}</h2>
      <form onSubmit={submit}>
        <fieldset disabled={mutation.isPending}>
          <label>
            商品名
            <input
              name="name"
              required
              pattern=".*\S.*"
              maxLength={200}
              defaultValue={product?.name}
            />
          </label>
          <label>
            SKU
            <input
              name="sku"
              required
              pattern=".*\S.*"
              maxLength={64}
              defaultValue={product?.sku}
            />
            <small>全商品で一意の値。削除後も再利用できません。</small>
          </label>
          <div className="form-columns">
            <label>
              価格（円）
              <input
                name="price"
                type="number"
                min={0}
                max={100_000_000}
                step={1}
                required
                defaultValue={product?.price ?? 0}
              />
            </label>
            <label>
              在庫数
              <input
                name="stock"
                type="number"
                min={0}
                max={1_000_000}
                step={1}
                required
                defaultValue={product?.stock ?? 0}
              />
            </label>
          </div>
          {product && (
            <p className="muted">在庫数は現在の販売可能数を上書きします。</p>
          )}
          {mutation.error && <ErrorBox error={mutation.error} />}
          <div className="button-row">
            <button className="button">
              {mutation.isPending ? '保存中…' : '保存する'}
            </button>
            <button type="button" onClick={close}>
              閉じる
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
export default function Manage() {
  const { user, token } = useSession()
  const query = useProducts()
  const client = useQueryClient()
  const [editing, setEditing] = useState<Product | null | undefined>()
  const mutation = useMutation({
    mutationFn: (id: number) =>
      request(`/products/${id}`, { method: 'DELETE', token }),
    onSuccess: () =>
      Promise.all(
        ['products', 'product', 'favorites'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  })
  const own =
    query.data?.filter((product) => product.ownerId === user?.id) || []
  return (
    <section>
      <PageTitle label="YOUR SHOP" title="商品管理">
        <button className="button" onClick={() => setEditing(null)}>
          ＋ 商品を登録
        </button>
      </PageTitle>
      <p className="muted">あなたが登録した商品の価格と在庫を管理できます。</p>
      {editing !== undefined && (
        <ProductForm
          key={editing?.id ?? 'new'}
          product={editing}
          close={() => setEditing(undefined)}
        />
      )}
      {mutation.error && <ErrorBox error={mutation.error} />}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
      ) : own.length === 0 ? (
        <Empty title="最初の商品を登録しましょう">
          <p>商品名・SKU・価格・在庫を設定して出品できます。</p>
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>商品 / SKU</th>
                <th>価格</th>
                <th>在庫</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {own.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <span className="sku">{product.sku}</span>
                  </td>
                  <td>{money(product.price)}</td>
                  <td>
                    <span className={product.stock === 0 ? 'danger' : ''}>
                      {product.stock}
                    </span>
                  </td>
                  <td>
                    <div className="button-row">
                      <button onClick={() => setEditing(product)}>編集</button>
                      <button
                        className="text-button danger"
                        disabled={mutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `「${product.name}」を削除しますか？商品一覧から非表示になります。`,
                            )
                          )
                            mutation.mutate(product.id)
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
