# Summary of Changes for DynamoDB Integration

## Overview
The application has been updated to store all inventory data in DynamoDB instead of fetching directly from AWS APIs. This includes on-demand refresh and scheduled daily updates.

## Backend Changes

### New Files
1. **`backend/src/utils/dynamodb_storage.py`**
   - DynamoDB storage utility
   - Handles storing/retrieving inventory data
   - Manages metadata (last update times)

2. **`backend/src/refresh_handler.py`**
   - Lambda function for collecting data from AWS
   - Stores data in DynamoDB
   - Triggered on-demand or via EventBridge schedule

### Modified Files
1. **`backend/src/app.py`**
   - `collect_inventory()` now reads from DynamoDB
   - Added `/inventory/refresh` endpoint
   - Added `/inventory/metadata` endpoint

2. **`backend/template.yaml`**
   - Added DynamoDB tables (InventoryTable, MetadataTable)
   - Added RefreshFunction Lambda
   - Added EventBridge schedule (daily at 2 AM UTC)
   - Added API endpoints for refresh and metadata
   - Updated IAM permissions

## Frontend Changes

### Modified Files
1. **`frontend/src/lib/api.ts`**
   - Added `refreshInventory()` method
   - Added `getMetadata()` method

2. **`frontend/src/app/dashboard/page.tsx`**
   - Added refresh button
   - Added last update timestamp display
   - Added refresh status notifications

## Key Features

### 1. DynamoDB Storage
- All inventory data stored in DynamoDB
- Fast retrieval for dashboard
- Automatic TTL (90 days)

### 2. Scheduled Refresh
- Daily refresh at 2 AM UTC
- Configurable via EventBridge cron

### 3. On-Demand Refresh
- Manual refresh from UI
- Can refresh specific service or all services
- Can refresh specific accounts

### 4. Metadata Tracking
- Last update timestamp per service
- Displayed in UI

## Deployment

1. Deploy backend:
   ```bash
   cd backend
   sam build
   sam deploy
   ```

2. Trigger initial refresh:
   - Use the refresh button in UI, or
   - Wait for scheduled refresh (2 AM UTC)

3. Verify:
   - Check DynamoDB tables
   - Test refresh from UI
   - Verify data in dashboard

## API Endpoints

### POST /inventory/refresh
Trigger refresh of inventory data
- Query params: `service` (optional), `accounts` (optional)

### GET /inventory/metadata
Get last update time
- Query params: `service` (optional)

## DynamoDB Tables

### InventoryTable
- Stores all resource data
- Partition key: `pk` (service#accountId#region)
- Sort key: `sk` (resourceId)
- TTL: 90 days

### MetadataTable
- Stores update metadata
- Partition key: `service`
- Sort key: `accountId#region`

## See Also
- `DYNAMODB_MIGRATION_GUIDE.md` - Detailed migration guide
- `MULTI_ACCOUNT_SETUP.md` - Multi-account configuration

