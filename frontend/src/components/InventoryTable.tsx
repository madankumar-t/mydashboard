'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Warning,
  Download,
  Visibility,
} from '@mui/icons-material'
import { ServiceType, AWSResource } from '@/types'
import { api } from '@/lib/api'

interface InventoryTableProps {
  service: ServiceType
  onResourceClick: (resource: AWSResource) => void
  search?: string
  accounts?: string[]
  regions?: string[]
}

export default function InventoryTable({
  service,
  onResourceClick,
  search,
  accounts,
  regions,
}: InventoryTableProps) {
  const [data, setData] = useState<AWSResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, page, rowsPerPage, search, accounts, regions])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getInventory(service, {
        page: page + 1,
        size: rowsPerPage,
        search: search || undefined,
        accounts: accounts && accounts.length > 0 ? accounts : undefined,
        regions: regions && regions.length > 0 ? regions : undefined,
      })
      setData(response.items || [])
      setTotal(response.total || 0)
    } catch (err: any) {
      console.error('Failed to load inventory:', err)
      setError(err instanceof Error ? err : new Error(err?.message || 'Failed to load inventory'))
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    const lower = status.toLowerCase()
    if (lower.includes('running') || lower.includes('available') || lower === 'active') {
      return 'success'
    }
    if (lower.includes('stopped') || lower.includes('pending') || lower.includes('stopping')) {
      return 'warning'
    }
    if (lower.includes('error') || lower.includes('failed') || lower.includes('terminated')) {
      return 'error'
    }
    return 'default'
  }

  /* ============================
     ✅ CHANGED: return type + undefined
  ============================ */
  const getStatusIcon = (status: string): React.ReactElement | undefined => {
    const color = getStatusColor(status)
    if (color === 'success') return <CheckCircle color="success" fontSize="small" />
    if (color === 'warning') return <Warning color="warning" fontSize="small" />
    if (color === 'error') return <Cancel color="error" fontSize="small" />
    return undefined // ✅ CHANGED (was null)
  }

  const renderCell = (key: string, value: any) => {
    if (key === 'state' || key === 'status') {
      return (
        <Chip
          icon={getStatusIcon(String(value))} // ✅ now type-safe
          label={String(value)}
          color={getStatusColor(String(value))}
          size="small"
        />
      )
    }

    if (key === 'tags' && typeof value === 'object') {
      return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {Object.entries(value).slice(0, 3).map(([k, v]) => (
            <Chip key={k} label={`${k}: ${v}`} size="small" variant="outlined" />
          ))}
          {Object.keys(value).length > 3 && (
            <Chip label={`+${Object.keys(value).length - 3}`} size="small" />
          )}
        </Box>
      )
    }

    if (Array.isArray(value)) {
      return value.slice(0, 2).join(', ') + (value.length > 2 ? ` (+${value.length - 2})` : '')
    }

    return String(value || '-')
  }

  const getColumns = () => {
    if (data.length === 0) return []

    const allColumns = Object.keys(data[0])
    const priorityColumns = ['accountId', 'region']
    const otherColumns = allColumns.filter(col => !priorityColumns.includes(col))

    return [
      ...priorityColumns.filter(col => allColumns.includes(col)),
      ...otherColumns,
    ]
  }

  const columns = getColumns()

  if (loading && data.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <strong>Error loading inventory:</strong> {error.message}
      </Alert>
    )
  }

  return (
    <TableContainer 
      component={Paper}
      sx={{
        width: '100%',
        maxHeight: 'calc(100vh - 400px)',
        overflowX: 'auto',
        overflowY: 'auto',
        position: 'relative',
        display: 'block',
      }}
    >
      {loading && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}
      <Table sx={{ minWidth: 1200, width: '100%' }}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col}
                sx={{
                  fontWeight: 'bold',
                  backgroundColor:
                    col === 'accountId' || col === 'region' ? 'action.hover' : 'inherit',
                  whiteSpace: 'nowrap',
                  minWidth: 120,
                }}
              >
                {col.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </TableCell>
            ))}
            <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx} hover>
              {columns.map((col) => (
                <TableCell 
                  key={col}
                  sx={{
                    whiteSpace: 'nowrap',
                    minWidth: 120,
                  }}
                >
                  {renderCell(col, row[col])}
                </TableCell>
              ))}
              <TableCell>
                <Tooltip title="View Details">
                  <IconButton size="small" onClick={() => onResourceClick(row)}>
                    <Visibility fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} align="center">
                No resources found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10))
          setPage(0)
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </TableContainer>
  )
}
