import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { request } from '../api'
import { useSession } from '../session'
import { ErrorBox } from '../components/ui'
import type { LoginResponse } from '../types'

export default function Auth() {
  const [register, setRegister] = useState(false)
  const session = useSession()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: async (data: {
      email: string
      password: string
      name?: string
    }) => {
      if (register)
        await request('/auth/register', { method: 'POST', body: data })
      return request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email: data.email, password: data.password },
      })
    },
    onSuccess: (response) => {
      session.login(response)
      navigate('/')
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({
      email: String(data.get('email')).trim(),
      password: String(data.get('password')),
      ...(register && data.get('name')
        ? { name: String(data.get('name')).trim() }
        : {}),
    })
  }
  if (session.user)
    return (
      <div className="empty">
        <h1>ログイン済みです</h1>
        <Link to="/">お買い物を続ける</Link>
      </div>
    )
  return (
    <section className="auth-layout">
      <div className="auth-intro">
        <p className="eyebrow">WELCOME TO KURASHI</p>
        <h1>
          あなたの暮らしに、
          <br />
          新しいお気に入りを。
        </h1>
        <p>
          見つける楽しみも、選ぶ時間も。
          <br />
          ここから、あなたらしい毎日へ。
        </p>
        <div className="botanical" aria-hidden="true">
          ✳
        </div>
      </div>
      <div className="panel auth-panel">
        <p className="eyebrow">MY ACCOUNT</p>
        <h2>{register ? 'アカウントを作成' : 'おかえりなさい'}</h2>
        <div className="tabs">
          <button
            aria-pressed={!register}
            disabled={mutation.isPending}
            onClick={() => {
              setRegister(false)
              mutation.reset()
            }}
          >
            ログイン
          </button>
          <button
            aria-pressed={register}
            disabled={mutation.isPending}
            onClick={() => {
              setRegister(true)
              mutation.reset()
            }}
          >
            新規会員登録
          </button>
        </div>
        <form onSubmit={submit}>
          {register && (
            <label>
              お名前（任意）
              <input name="name" autoComplete="name" maxLength={100} />
            </label>
          )}
          <label>
            メールアドレス
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
          </label>
          <label>
            パスワード
            <input
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 12 : undefined}
              maxLength={128}
              required
            />
          </label>
          {register && (
            <p className="muted">パスワードは12〜128文字で設定してください。</p>
          )}
          {mutation.error && <ErrorBox error={mutation.error} />}
          <button className="button full" disabled={mutation.isPending}>
            {mutation.isPending
              ? '処理中…'
              : register
                ? '登録してはじめる'
                : 'ログイン'}
          </button>
        </form>
        <p className="muted">
          ログイン情報はこのタブを閉じるまで保存されます。
        </p>
      </div>
    </section>
  )
}
