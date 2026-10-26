export interface TokenService {
  issue(userId: number): Promise<{ accessToken: string; expiresIn: number }>
  verify(token: string): Promise<number>
}
