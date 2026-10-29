import { useDeferredValue, useState } from 'react'
import { useProducts, useFavorites } from '../queries'
import ProductCard from '../components/ProductCard'
import { Empty, ErrorBox, Loading, PageTitle } from '../components/ui'

export default function Catalog({
  favoritesOnly = false,
}: {
  favoritesOnly?: boolean
}) {
  const products = useProducts()
  const favorites = useFavorites()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('default')
  const [inStock, setInStock] = useState(false)
  const [page, setPage] = useState(0)
  const query = useDeferredValue(search.trim().toLocaleLowerCase())
  const source = favoritesOnly ? favorites : products
  const favoriteIds = new Set(favorites.data?.map((product) => product.id))
  const filtered = (source.data || []).filter(
    (product) =>
      (!inStock || product.stock > 0) &&
      `${product.name} ${product.sku}`.toLocaleLowerCase().includes(query),
  )
  if (sort !== 'default')
    filtered.sort((a, b) =>
      sort === 'price-asc'
        ? a.price - b.price
        : sort === 'price-desc'
          ? b.price - a.price
          : b.id - a.id,
    )
  const lastPage = Math.max(0, Math.ceil(filtered.length / 12) - 1)
  const currentPage = Math.min(page, lastPage)
  return (
    <>
      {!favoritesOnly && (
        <section className="hero">
          <div>
            <p className="eyebrow">FIND YOUR EVERYDAY FAVORITES</p>
            <h1>
              暮らしに、
              <br />
              小さなときめきを。
            </h1>
            <p>
              毎日を少し心地よくする、あなたの一品を。
              <br />
              お気に入りとの出会いを、ここから。
            </p>
            <a
              className="hero-link"
              href="#/"
              onClick={(event) => {
                event.preventDefault()
                document
                  .getElementById('collection')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              コレクションを見る <span>↗</span>
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sun" />
            <div className="vase">
              <i />
              <i />
              <i />
            </div>
            <div className="art-caption">
              THE EVERYDAY
              <br />
              COLLECTION <span>暮らしを、楽しむ。</span>
            </div>
          </div>
        </section>
      )}
      <section id="collection">
        <PageTitle
          label={favoritesOnly ? 'YOUR FAVORITES' : 'OUR COLLECTION'}
          title={favoritesOnly ? 'お気に入り' : '商品を探す'}
        >
          <span className="muted">{filtered.length} items</span>
        </PageTitle>
        <div className="toolbar">
          <label className="search-label">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="商品名・SKUで検索"
              type="search"
              placeholder="商品名・SKUで検索"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => {
                setInStock(e.target.checked)
                setPage(0)
              }}
            />
            在庫ありのみ
          </label>
          <select
            aria-label="並び順"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setPage(0)
            }}
          >
            <option value="default">おすすめ順（商品ID順）</option>
            <option value="new">新しい順</option>
            <option value="price-asc">価格が安い順</option>
            <option value="price-desc">価格が高い順</option>
          </select>
        </div>
        {source.isPending ? (
          <Loading />
        ) : source.error ? (
          <ErrorBox error={source.error} retry={() => void source.refetch()} />
        ) : filtered.length === 0 ? (
          <Empty
            title={
              favoritesOnly
                ? 'お気に入りはまだありません'
                : '商品が見つかりません'
            }
          >
            <p>
              {favoritesOnly
                ? '気になる商品のハートを押して保存しましょう。'
                : '検索条件を変えるか、商品管理から商品を登録してください。'}
            </p>
          </Empty>
        ) : (
          <div className="product-grid">
            {filtered
              .slice(currentPage * 12, currentPage * 12 + 12)
              .map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  favorite={favoriteIds.has(product.id)}
                />
              ))}
          </div>
        )}
        {favorites.error && !favoritesOnly && (
          <ErrorBox
            error={favorites.error}
            retry={() => void favorites.refetch()}
          />
        )}
        {lastPage > 0 && (
          <div className="pagination">
            <button
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              ← 前へ
            </button>
            <span>
              {currentPage + 1} / {lastPage + 1}
            </span>
            <button
              disabled={currentPage === lastPage}
              onClick={() => setPage(currentPage + 1)}
            >
              次へ →
            </button>
          </div>
        )}
      </section>
    </>
  )
}
