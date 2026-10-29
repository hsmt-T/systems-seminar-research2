import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from './api'
import type { CartItem, LoginResponse, User } from './types'

const storageKey = 'kurashi.session.v1'
function readToken() {
  try {
    return sessionStorage.getItem(storageKey)
  } catch {
    return null
  }
}
function storeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(storageKey, token)
    else sessionStorage.removeItem(storageKey)
  } catch {
    /* Storage disabled: keep the session in memory. */
  }
}
interface Session {
  token: string | null
  user: User | undefined
  loading: boolean
  error: Error | null
  retry: () => void
  login: (response: LoginResponse) => void
  logout: () => void
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
}
const Context = createContext<Session | null>(null)
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [token, setToken] = useState(readToken)
  const [cart, setCart] = useState<CartItem[]>([])
  const me = useQuery({
    queryKey: ['me', token],
    enabled: !!token,
    queryFn: ({ signal }) =>
      request<{ user: User }>('/auth/me', { token, signal }),
    retry: false,
  })
  const logout = useCallback(() => {
    storeToken(null)
    setToken(null)
    setCart([])
    client.clear()
  }, [client])
  useEffect(() => {
    const expired = (event: Event) => {
      if ((event as CustomEvent).detail === token) logout()
    }
    window.addEventListener('session-expired', expired)
    return () => window.removeEventListener('session-expired', expired)
  }, [token, logout])
  function login(response: LoginResponse) {
    client.clear()
    storeToken(response.accessToken)
    client.setQueryData(['me', response.accessToken], { user: response.user })
    setToken(response.accessToken)
  }
  return (
    <Context.Provider
      value={{
        token,
        user: me.data?.user,
        loading: !!token && me.isPending,
        error: me.error,
        retry: () => void me.refetch(),
        login,
        logout,
        cart,
        setCart,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useSession() {
  const value = useContext(Context)
  if (!value) throw new Error('SessionProvider is required')
  return value
}
