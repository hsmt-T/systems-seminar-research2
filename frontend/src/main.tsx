import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, NavLink, Link, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './session'
import { ErrorBox, Loading, Protected } from './components/ui'
import Catalog from './pages/Catalog'
import './styles.css'

const Auth = lazy(() => import('./pages/Auth'))
const Cart = lazy(() => import('./pages/Cart'))
const Orders = lazy(() => import('./pages/Orders'))
const Manage = lazy(() => import('./pages/Manage'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})
function App() {
  const { user, token, error, retry, logout, cart } = useSession()
  return (
    <>
      <div className="announcement">日々の暮らしに、ちょうどいい出会いを。</div>
      <header className="header">
        <Link to="/" className="brand">
          KURASHI<span>暮らしのマーケット</span>
        </Link>
        <nav aria-label="メインナビゲーション">
          <NavLink to="/" end>
            商品を探す
          </NavLink>
          <NavLink to="/favorites">お気に入り</NavLink>
          <NavLink to="/orders">注文履歴</NavLink>
          <NavLink to="/manage">商品管理</NavLink>
        </nav>
        <div className="account">
          {user ? (
            <>
              <span className="username">{user.name || user.email}</span>
              <button className="text-button" onClick={logout}>
                ログアウト
              </button>
            </>
          ) : (
            <Link to="/login">ログイン</Link>
          )}
          <NavLink className="cart-link" to="/cart">
            バッグ{' '}
            <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </NavLink>
        </div>
      </header>
      <main id="main">
        {token && error && <ErrorBox error={error} retry={retry} />}
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route
              path="/favorites"
              element={
                <Protected>
                  <Catalog favoritesOnly />
                </Protected>
              }
            />
            <Route path="/login" element={<Auth />} />
            <Route path="/cart" element={<Cart />} />
            <Route
              path="/orders"
              element={
                <Protected>
                  <Orders />
                </Protected>
              }
            />
            <Route
              path="/manage"
              element={
                <Protected>
                  <Manage />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>ページが見つかりません</h1>
                  <Link to="/">商品一覧へ戻る</Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer>
        <Link className="brand" to="/">
          KURASHI
        </Link>
        <p>お気に入りがある、毎日を。</p>
        <span>暮らしのマーケット</span>
      </footer>
    </>
  )
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <SessionProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </SessionProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
