import { useState, type FormEvent } from 'react'
import { money } from '../api'
import type { CartItem, Product } from '../types'

export default function OrderEditor({
  items,
  products,
  onChange,
  onSubmit,
  busy,
  submitLabel,
  allowMissing = false,
}: {
  items: CartItem[]
  products: Product[]
  onChange: (items: CartItem[]) => void
  onSubmit: () => void
  busy: boolean
  submitLabel: string
  allowMissing?: boolean
}) {
  const [selected, setSelected] = useState('')
  const productMap = new Map(products.map((product) => [product.id, product]))
  const choices = products.filter(
    (product) =>
      !items.some((item) => item.productId === product.id) && product.stock > 0,
  )
  const total = items.reduce(
    (sum, item) =>
      sum + (productMap.get(item.productId)?.price || 0) * item.quantity,
    0,
  )
  const invalid =
    items.length < 1 ||
    items.length > 50 ||
    total > 2_147_483_647 ||
    items.some((item) => {
      const product = productMap.get(item.productId)
      return (
        !product ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 1000 ||
        (!allowMissing && item.quantity > product.stock)
      )
    })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!invalid) onSubmit()
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="order-fieldset">
        <div className="line-items">
          {items.map((item) => {
            const product = productMap.get(item.productId)
            return (
              <div className="line-item" key={item.productId}>
                <div>
                  <strong>
                    {product?.name ||
                      `商品 #${item.productId}（現在は販売されていません）`}
                  </strong>
                  <p className="muted">
                    {product
                      ? `${product.sku} · ${money(product.price)}`
                      : 'この商品を削除してから注文してください。'}
                  </p>
                </div>
                <label>
                  数量
                  <input
                    aria-label={`${product?.name || item.productId}の数量`}
                    className="quantity"
                    type="number"
                    min={1}
                    max={
                      allowMissing ? 1000 : Math.min(1000, product?.stock || 1)
                    }
                    value={item.quantity}
                    onChange={(e) =>
                      onChange(
                        items.map((entry) =>
                          entry.productId === item.productId
                            ? { ...entry, quantity: Number(e.target.value) }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() =>
                    onChange(
                      items.filter(
                        (entry) => entry.productId !== item.productId,
                      ),
                    )
                  }
                >
                  削除
                </button>
              </div>
            )
          })}
        </div>
        <div className="add-item">
          <select
            aria-label="追加する商品"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">商品を選んで追加</option>
            {choices.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} / {money(product.price)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || items.length >= 50}
            onClick={() => {
              if (
                selected &&
                choices.some((product) => product.id === Number(selected))
              )
                onChange([
                  ...items,
                  { productId: Number(selected), quantity: 1 },
                ])
              setSelected('')
            }}
          >
            追加
          </button>
        </div>
        <div className="order-summary">
          <span>商品合計（参考）</span>
          <strong>{money(total)}</strong>
        </div>
        <p className="muted">
          最大50種類・各1,000点まで。合計は2,147,483,647円まで。確定時の価格と在庫で処理します。
          {allowMissing && '変更時は元の注文分の在庫が返却されます。'}
        </p>
        {invalid && (
          <p className="muted">
            商品・数量・在庫・合計金額を確認してください。
          </p>
        )}
        <button className="button" disabled={invalid || busy}>
          {busy ? '処理中…' : submitLabel}
        </button>
      </fieldset>
    </form>
  )
}
