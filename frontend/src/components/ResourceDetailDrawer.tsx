'use client'

import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper,
} from '@mui/material'
import { Close, Cloud, Security, NetworkCheck } from '@mui/icons-material'
import { ServiceType, AWSResource } from '@/types'

interface ResourceDetailDrawerProps {
  open: boolean
  onClose: () => void
  resource: AWSResource | null
  service: ServiceType
}

const DRAWER_WIDTH = 600

export default function ResourceDetailDrawer({
  open,
  onClose,
  resource,
  service,
}: ResourceDetailDrawerProps) {
  if (!resource) return null

  const renderValue = (key: string, value: any) => {
    if (value === null || value === undefined) {
      return <Typography variant="body2" color="text.secondary">-</Typography>
    }

    if (typeof value === 'boolean') {
      return <Chip label={value ? 'Yes' : 'No'} color={value ? 'success' : 'default'} size="small" />
    }

    if (Array.isArray(value)) {
      return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {value.map((item, idx) => (
            <Chip key={idx} label={String(item)} size="small" variant="outlined" />
          ))}
        </Box>
      )
    }

    if (typeof value === 'object') {
      return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {Object.entries(value).map(([k, v]) => (
            <Chip key={k} label={`${k}: ${v}`} size="small" variant="outlined" />
          ))}
        </Box>
      )
    }

    return <Typography variant="body2">{String(value)}</Typography>
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: DRAWER_WIDTH },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Resource Details</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            {resource.name || resource.id || 'Unnamed Resource'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Chip 
              label={`Account: ${resource.accountId || 'N/A'}`} 
              size="small" 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
            />
            <Chip 
              label={`Region: ${resource.region || 'N/A'}`} 
              size="small" 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
            />
            <Chip 
              label={`Service: ${service.toUpperCase()}`} 
              size="small" 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
            />
          </Box>
        </Paper>

        <List>
          {Object.entries(resource)
            .filter(([key]) => !['name', 'id', 'region', 'accountId'].includes(key))
            .map(([key, value]) => (
              <ListItem key={key} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <ListItemText
                  primary={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  secondary={renderValue(key, value)}
                />
              </ListItem>
            ))}
        </List>
      </Box>
    </Drawer>
  )
}

