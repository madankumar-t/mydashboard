# DynamoDB Migration Guide

This guide explains the changes made to migrate from direct AWS API calls to DynamoDB-based storage.

## Overview

The application now stores all inventory data in DynamoDB instead of fetching directly from AWS APIs. This provides:
- **Faster response times** - Data is pre-collected and cached
- **Reduced AWS API calls** - Lower costs and rate limit issues
- **Scheduled updates** - Automatic daily refresh at 2 AM UTC
- **On-demand refresh** - Manual refresh capability from the UI

## Architecture Changes

### Before
```
Frontend → API Gateway → Lambda → AWS APIs (EC2, S3, RDS, etc.)
```

### After
```
Frontend → API Gateway → Lambda → DynamoDB (Read)
                                    ↑
Refresh Lambda → AWS APIs → DynamoDB (Write)
     ↑
EventBridge (Daily at 2 AM UTC)
```

## Backend Changes

### 1. New Files Created

#### `backend/src/utils/dynamodb_storage.py`
- DynamoDB storage utility class
- Handles storing and retrieving inventory data
- Manages metadata (last update times)

#### `backend/src/refresh_handler.py`
- Lambda function for collecting data from AWS
- Stores data in DynamoDB
- Can be triggered on-demand or via EventBridge schedule

### 2. Modified Files

#### `backend/src/app.py`
- **Changed**: `collect_inventory()` now reads from DynamoDB instead of AWS APIs
- **Added**: `/inventory/refresh` endpoint to trigger refresh
- **Added**: `/inventory/metadata` endpoint to get last update time

#### `backend/template.yaml`
- **Added**: DynamoDB tables (InventoryTable, MetadataTable)
- **Added**: RefreshFunction Lambda
- **Added**: EventBridge schedule (daily at 2 AM UTC)
- **Added**: API endpoints for refresh and metadata
- **Updated**: Permissions for DynamoDB access

## Frontend Changes

### 1. Modified Files

#### `frontend/src/lib/api.ts`
- **Added**: `refreshInventory()` method
- **Added**: `getMetadata()` method

#### `frontend/src/app/dashboard/page.tsx`
- **Added**: Refresh button in the UI
- **Added**: Last update timestamp display
- **Added**: Refresh status and notifications

## DynamoDB Table Structure

### InventoryTable (`aws-inventory-data`)
- **Partition Key**: `pk` (format: `service#accountId#region`)
- **Sort Key**: `sk` (resource ID)
- **Attributes**:
  - `service`: Service name (e.g., 'ec2', 's3')
  - `accountId`: AWS account ID
  - `region`: AWS region
  - `resourceId`: Unique resource identifier
  - `data`: Full resource data (JSON)
  - `updatedAt`: ISO timestamp
  - `ttl`: Time-to-live (90 days)

### MetadataTable (`aws-inventory-metadata`)
- **Partition Key**: `service`
- **Sort Key**: `accountId#region`
- **Attributes**:
  - `service`: Service name
  - `accountId`: AWS account ID
  - `region`: AWS region
  - `updatedAt`: ISO timestamp
  - `resourceCount`: Number of resources

## Deployment Steps

### 1. Deploy Backend

```bash
cd backend
sam build
sam deploy
```

This will create:
- DynamoDB tables
- Refresh Lambda function
- EventBridge schedule
- Updated API endpoints

### 2. Initial Data Collection

After deployment, trigger the first refresh:

```bash
# Via API
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR_API_URL/inventory/refresh

# Or wait for the scheduled refresh (2 AM UTC daily)
```

### 3. Verify

1. Check DynamoDB tables are created
2. Check refresh Lambda is scheduled
3. Test refresh from UI
4. Verify data appears in dashboard

## Configuration

### Environment Variables

The following environment variables are automatically set:

- `INVENTORY_TABLE_NAME`: DynamoDB table for inventory data
- `METADATA_TABLE_NAME`: DynamoDB table for metadata
- `REFRESH_FUNCTION_NAME`: Name of refresh Lambda function

### Schedule Configuration

The daily refresh runs at **2 AM UTC** by default. To change:

Edit `backend/template.yaml`:
```yaml
Events:
  ScheduledRefresh:
    Type: Schedule
    Properties:
      Schedule: cron(0 2 * * ? *)  # Change this
```

Cron format: `cron(minute hour day-of-month month day-of-week year)`

Examples:
- `cron(0 2 * * ? *)` - Daily at 2 AM UTC
- `cron(0 */6 * * ? *)` - Every 6 hours
- `cron(0 0 * * ? *)` - Daily at midnight UTC

## API Endpoints

### Refresh Inventory
```
POST /inventory/refresh
Query Parameters:
  - service (optional): Service to refresh (e.g., 'ec2', 's3')
  - accounts (optional): Comma-separated account IDs

Response:
{
  "message": "Refresh triggered",
  "service": "ec2"
}
```

### Get Metadata
```
GET /inventory/metadata
Query Parameters:
  - service (optional): Service to get metadata for

Response:
{
  "lastUpdate": "2024-01-15T10:30:00Z",
  "service": "ec2"
}
```

## Troubleshooting

### Issue: No data showing in dashboard

**Solutions:**
1. Check if refresh has run: Look at CloudWatch logs for RefreshFunction
2. Check DynamoDB tables: Verify data exists in InventoryTable
3. Trigger manual refresh from UI
4. Check IAM permissions for refresh Lambda

### Issue: Refresh failing

**Solutions:**
1. Check CloudWatch logs for RefreshFunction
2. Verify IAM permissions for AWS service access
3. Check if role assumption is working (for multi-account)
4. Verify DynamoDB write permissions

### Issue: Slow refresh

**Solutions:**
1. Increase Lambda timeout (currently 15 minutes)
2. Increase Lambda memory (currently 1024 MB)
3. Check if rate limiting is occurring
4. Consider refreshing services separately

### Issue: Data not updating

**Solutions:**
1. Check EventBridge schedule is enabled
2. Verify refresh Lambda is being triggered
3. Check CloudWatch logs for errors
4. Manually trigger refresh from UI

## Performance Considerations

### DynamoDB Capacity

- Tables use **PAY_PER_REQUEST** billing mode (no capacity planning needed)
- TTL is set to 90 days to automatically clean up old data
- Consider adding GSI if you need different query patterns

### Lambda Timeouts

- Refresh function has 15-minute timeout
- For large accounts, consider:
  - Increasing timeout
  - Refreshing services separately
  - Using Step Functions for orchestration

### Cost Optimization

- TTL on items (90 days) prevents unbounded growth
- PAY_PER_REQUEST mode scales automatically
- Consider reducing refresh frequency if cost is a concern

## Migration from Old System

If you're migrating from the old direct-API system:

1. **Deploy new infrastructure** (DynamoDB tables, refresh Lambda)
2. **Run initial refresh** to populate DynamoDB
3. **Update frontend** to use new API endpoints
4. **Monitor** for any issues
5. **Remove old code** once verified working

## Rollback Plan

If you need to rollback:

1. Revert `backend/src/app.py` to use direct AWS API calls
2. Remove DynamoDB-related code
3. Redeploy backend
4. DynamoDB tables can be kept for reference or deleted

## Next Steps

1. Monitor refresh Lambda execution
2. Set up CloudWatch alarms for failures
3. Consider adding refresh status dashboard
4. Optimize refresh schedule based on usage patterns

