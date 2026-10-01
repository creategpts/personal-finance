import type { ReactNode } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui'
import { authClient } from './lib/auth-client'

function Link({ href, ...props }: { href: string } & Record<string, unknown>) {
  return <RouterLink to={href} {...props} />
}

export function Providers({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(path: string) => navigate(path)}
      replace={(path: string) => navigate(path, { replace: true })}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
