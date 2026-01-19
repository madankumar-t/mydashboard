'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material'
import { ErrorOutline, Refresh } from '@mui/icons-material'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            p: 4,
            gap: 2,
          }}
        >
          <ErrorOutline sx={{ fontSize: 64, color: 'error.main' }} />
          <Alert severity="error" sx={{ maxWidth: 600, width: '100%' }}>
            <AlertTitle>Something went wrong</AlertTitle>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Typography>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" component="pre" sx={{ fontSize: '0.75rem' }}>
                  {this.state.error?.stack}
                </Typography>
              </Box>
            )}
          </Alert>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={this.handleReset}
          >
            Try Again
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}

