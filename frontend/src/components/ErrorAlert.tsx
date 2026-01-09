'use client'

import { Alert, AlertTitle, AlertProps, Box, Button } from '@mui/material'
import { ErrorOutline, Warning, Info, CheckCircle, Close } from '@mui/icons-material'
import { useState } from 'react'

export interface ErrorAlertProps extends Omit<AlertProps, 'severity'> {
  error?: Error | string | null
  severity?: 'error' | 'warning' | 'info' | 'success'
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
  action?: React.ReactNode
}

export default function ErrorAlert({
  error,
  severity = 'error',
  title,
  dismissible = false,
  onDismiss,
  action,
  ...props
}: ErrorAlertProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!error || dismissed) {
    return null
  }

  const errorMessage = typeof error === 'string' ? error : error?.message || 'An error occurred'

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const getIcon = () => {
    switch (severity) {
      case 'error':
        return <ErrorOutline />
      case 'warning':
        return <Warning />
      case 'info':
        return <Info />
      case 'success':
        return <CheckCircle />
      default:
        return <ErrorOutline />
    }
  }

  return (
    <Alert
      severity={severity}
      icon={getIcon()}
      action={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {action}
          {dismissible && (
            <Button
              size="small"
              onClick={handleDismiss}
              sx={{ minWidth: 'auto', p: 0.5 }}
            >
              <Close fontSize="small" />
            </Button>
          )}
        </Box>
      }
      sx={{ mb: 2 }}
      {...props}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {errorMessage}
    </Alert>
  )
}

