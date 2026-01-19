'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Box,
  Typography,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Cloud,
  Storage,
  Dataset, // ✅ CHANGED: replaced Database
  Security,
  NetworkCheck,
  Apps,
  Dashboard as DashboardIcon,
} from '@mui/icons-material'
import { ServiceType } from '@/types'
import { getStoredSession, canAccessService } from '@/lib/auth'

/* ============================
   ✅ CHANGED: Strong typing
============================ */
type MenuItemConfig = {
  value: ServiceType | 'dashboard'
  label: string
  icon: React.ReactNode
  path: string
}

const MENU_ITEMS: MenuItemConfig[] = [
  { value: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { value: 'ec2', label: 'EC2', icon: <Cloud />, path: '/dashboard?service=ec2' },
  { value: 's3', label: 'S3', icon: <Storage />, path: '/dashboard?service=s3' },
  { value: 'rds', label: 'RDS', icon: <Dataset />, path: '/dashboard?service=rds' },           // ✅ CHANGED
  { value: 'dynamodb', label: 'DynamoDB', icon: <Dataset />, path: '/dashboard?service=dynamodb' }, // ✅ CHANGED
  { value: 'iam', label: 'IAM', icon: <Security />, path: '/dashboard?service=iam' },
  { value: 'vpc', label: 'VPC', icon: <NetworkCheck />, path: '/dashboard?service=vpc' },
  { value: 'eks', label: 'EKS', icon: <Apps />, path: '/dashboard?service=eks' },
  { value: 'ecs', label: 'ECS', icon: <Apps />, path: '/dashboard?service=ecs' },
]

const DRAWER_WIDTH = 240

export default function DashboardSidebar({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const session = getStoredSession()
  const groups = session?.groups || []

  const handleNavigation = (path: string, service?: ServiceType) => {
    if (service && !canAccessService(groups, service)) return
    router.push(path)
  }

  const filteredItems = MENU_ITEMS.filter((item) => {
    if (item.value === 'dashboard') return true
    return canAccessService(groups, item.value as ServiceType)
  })

  return (
    <Drawer
      variant="persistent"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          transition: 'width 0.3s',
        },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Services</Typography>
        <IconButton onClick={onToggle}>
          <MenuIcon />
        </IconButton>
      </Box>
      <Divider />
      <List>
        {filteredItems.map((item) => (
          <ListItem key={item.value} disablePadding>
            <ListItemButton
              selected={pathname === item.path.split('?')[0]} // ✅ SAFE
              onClick={() => handleNavigation(item.path, item.value as ServiceType)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  )
}
