'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Chip,
  Button,
  CircularProgress,
  OutlinedInput,
  Checkbox,
  ListItemText,
} from '@mui/material'
import {
  Cloud,
  Storage,
  Dataset, // ✅ CHANGED: replaced Database with Dataset
  Security,
  NetworkCheck,
  Apps,
  Settings,
} from '@mui/icons-material'
import { ServiceType } from '@/types'
import { api } from '@/lib/api'
import InventoryTable from '@/components/InventoryTable'
import SummaryCards from '@/components/SummaryCards'
import ResourceDetailDrawer from '@/components/ResourceDetailDrawer'

const SERVICES: Array<{ value: ServiceType; label: string; icon: React.ReactNode }> = [
  { value: 'ec2', label: 'EC2 Instances', icon: <Cloud /> },
  { value: 's3', label: 'S3 Buckets', icon: <Storage /> },
  { value: 'rds', label: 'RDS Instances', icon: <Dataset /> },       // ✅ CHANGED
  { value: 'dynamodb', label: 'DynamoDB Tables', icon: <Dataset /> }, // ✅ CHANGED
  { value: 'iam', label: 'IAM Roles', icon: <Security /> },
  { value: 'vpc', label: 'VPCs', icon: <NetworkCheck /> },
  { value: 'eks', label: 'EKS Clusters', icon: <Apps /> },
  { value: 'ecs', label: 'ECS Clusters', icon: <Apps /> },
]

// AWS Regions list (matching backend)
const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'ca-central-1', 'sa-east-1'
]

function DashboardContent() {
  const searchParams = useSearchParams()
  const [service, setService] = useState<ServiceType>(
    (searchParams.get('service') as ServiceType) || 'ec2'
  )
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [availableAccounts, setAvailableAccounts] = useState<Array<{ accountId: string; accountName: string }>>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Load available accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    setLoadingAccounts(true)
    try {
        const accounts = await api.getAccounts()
        setAvailableAccounts(accounts)
    } catch (error) {
      console.error('Failed to load accounts:', error)
      // If accounts endpoint fails, try to get current account
      // This allows single-account setups to work
      setAvailableAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  useEffect(() => {
    loadInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, selectedAccounts, selectedRegions, search, page])

  const loadInventory = async () => {
    setLoading(true)
    try {
      await api.getInventory(service, {
        page,
        size: 50,
        search: search || undefined,
        accounts: selectedAccounts.length > 0 ? selectedAccounts : undefined,
        regions: selectedRegions.length > 0 ? selectedRegions : undefined,
      })
    } catch (error) {
      console.error('Failed to load inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResourceClick = (resource: any) => {
    setSelectedResource(resource)
    setDrawerOpen(true)
  }

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Filters */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Service</InputLabel>
                    <Select
                      value={service}
                      label="Service"
                      onChange={(e) => {
                        setService(e.target.value as ServiceType)
                        setPage(1)
                      }}
                    >
                      {SERVICES.map((s) => (
                        <MenuItem key={s.value} value={s.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {s.icon}
                            {s.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Accounts</InputLabel>
                    <Select
                      multiple
                      value={selectedAccounts}
                      onChange={(e) => {
                        const value = typeof e.target.value === 'string' 
                          ? e.target.value.split(',') 
                          : e.target.value
                        setSelectedAccounts(value as string[])
                        setPage(1)
                      }}
                      input={<OutlinedInput label="Accounts" />}
                      renderValue={(selected) => {
                        if (selected.length === 0) {
                          return <Typography color="text.secondary" variant="body2">All Accounts</Typography>
                        }
                        // Show actual account names, truncated if too many
                        const selectedAccountsList = selected
                          .map(id => {
                            const account = availableAccounts.find(a => a.accountId === id)
                            return account?.accountName || account?.accountId || id
                          })
                          .slice(0, 2) // Show first 2
                        
                        const displayText = selectedAccountsList.join(', ')
                        const remaining = selected.length - selectedAccountsList.length
                        return (
                          <Typography variant="body2" sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {displayText}
                            {remaining > 0 && ` +${remaining} more`}
                          </Typography>
                        )
                      }}
                      disabled={loadingAccounts}
                    >
                      {loadingAccounts ? (
                        <MenuItem disabled>
                          <CircularProgress size={16} sx={{ mr: 1 }} />
                          Loading accounts...
                        </MenuItem>
                      ) : availableAccounts.length > 0 ? (
                        availableAccounts.map((account) => (
                          <MenuItem key={account.accountId} value={account.accountId}>
                            <Checkbox checked={selectedAccounts.indexOf(account.accountId) > -1} />
                            <ListItemText
                              primary={account.accountName || account.accountId}
                              secondary={account.accountId}
                            />
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>
                          <Typography variant="body2" color="text.secondary">
                            No accounts available. Using current account.
                          </Typography>
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Regions</InputLabel>
                    <Select
                      multiple
                      value={selectedRegions}
                      onChange={(e) => {
                        const value = typeof e.target.value === 'string' 
                          ? e.target.value.split(',') 
                          : e.target.value
                        setSelectedRegions(value as string[])
                        setPage(1)
                      }}
                      input={<OutlinedInput label="Regions" />}
                      renderValue={(selected) => {
                        if (selected.length === 0) {
                          return <Typography color="text.secondary" variant="body2">All Regions</Typography>
                        }
                        // Show actual region names, truncated if too many
                        const selectedRegionsList = selected.slice(0, 2) // Show first 2
                        const displayText = selectedRegionsList.join(', ')
                        const remaining = selected.length - selectedRegionsList.length
                        return (
                          <Typography variant="body2" sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {displayText}
                            {remaining > 0 && ` +${remaining} more`}
                          </Typography>
                        )
                      }}
                    >
                      {AWS_REGIONS.map((region) => (
                        <MenuItem key={region} value={region}>
                          <Checkbox checked={selectedRegions.indexOf(region) > -1} />
                          <ListItemText primary={region} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    placeholder="Search resources..."
                  />
                </Grid>
              </Grid>
              {/* Selected filters display */}
              {(selectedAccounts.length > 0 || selectedRegions.length > 0) && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  {selectedAccounts.length > 0 && (
                    <Chip
                      label={
                        <Box>
                          <Typography variant="caption" fontWeight="bold">Accounts:</Typography>{' '}
                          {selectedAccounts
                            .map(id => {
                              const account = availableAccounts.find(a => a.accountId === id)
                              return account?.accountName || account?.accountId || id
                            })
                            .slice(0, 2)
                            .join(', ')}
                          {selectedAccounts.length > 2 && ` +${selectedAccounts.length - 2}`}
                        </Box>
                      }
                      onDelete={() => setSelectedAccounts([])}
                      color="primary"
                      variant="outlined"
                      sx={{ maxWidth: '100%' }}
                    />
                  )}
                  {selectedRegions.length > 0 && (
                    <Chip
                      label={
                        <Box>
                          <Typography variant="caption" fontWeight="bold">Regions:</Typography>{' '}
                          {selectedRegions.slice(0, 2).join(', ')}
                          {selectedRegions.length > 2 && ` +${selectedRegions.length - 2}`}
                        </Box>
                      }
                      onDelete={() => setSelectedRegions([])}
                      color="primary"
                      variant="outlined"
                      sx={{ maxWidth: '100%' }}
                    />
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Cards */}
        <Grid item xs={12}>
          <SummaryCards service={service} accounts={selectedAccounts} regions={selectedRegions} />
        </Grid>

        {/* Inventory Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : (
                <InventoryTable
                  service={service}
                  onResourceClick={handleResourceClick}
                  search={search}
                  accounts={selectedAccounts}
                  regions={selectedRegions}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ResourceDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        resource={selectedResource}
        service={service}
      />
    </Box>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    }>
      <DashboardContent />
    </Suspense>
  )
}
