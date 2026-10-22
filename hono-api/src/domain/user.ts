export type User = {
  id: number
  email: string
  name: string | null
  pass: string
  createdAt: Date
}
export type PublicUser = Omit<User, 'pass'>
export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  }
}
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>
  create(input: {
    email: string
    name: string | null
    pass: string
  }): Promise<User>
}
