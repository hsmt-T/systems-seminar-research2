import { Link } from 'react-router-dom'
import { errorMessage } from '../api'
import { useSession } from '../session'
import type { ReactNode } from 'react'

export function ErrorBox({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  return (
    <div className="error" role="alert">
      {errorMessage(error)} {retry && <button onClick={retry}>再試行</button>}
    </div>
  )
}
export function Empty({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="empty">
      <span aria-hidden="true">◇</span>
      <h2>{title}</h2>
      {children}
    </div>
  )
}
export function Loading() {
  return (
    <p className="loading" role="status">
      読み込み中…
    </p>
  )
}
export function Protected({ children }: { children: ReactNode }) {
  const { user, token, loading, error, retry } = useSession()
  if (loading) return <Loading />
  if (token && error) return <ErrorBox error={error} retry={retry} />
  if (!user)
    return (
      <Empty title="ログインして、続きを。">
        <p>この機能を利用するにはログインが必要です。</p>
        <Link className="button" to="/login">
          ログイン / 会員登録
        </Link>
      </Empty>
    )
  return children
}
export function PageTitle({
  label,
  title,
  children,
}: {
  label: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{label}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  )
}
