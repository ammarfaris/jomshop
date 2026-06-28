# Rate Limits & Suspicious Activity Cleanup Strategies

## Problem

The `rateLimits` and `suspiciousActivity` collections will accumulate data over time. Without cleanup, they can grow indefinitely and impact performance.

---

## Option 1: Scheduled Appwrite Function (RECOMMENDED) ✅

### How It Works

- Appwrite Function runs on a schedule (e.g., daily at 3 AM)
- Automatically deletes records older than retention period
- No manual intervention needed

### Implementation

**File:** `functions/cleanup-rate-limits/index.js`

**Schedule:** Daily at 3:00 AM UTC

```
0 3 * * *
```

**Retention Period:**

- Rate Limits: 90 days

**Note:** Suspicious Activity is NOT cleaned up by this function. It should be kept indefinitely for security audits and compliance, or cleaned up manually when needed.

### Pros ✅

- **Fully automated** - Set it and forget it
- **Consistent** - Runs reliably on schedule
- **Configurable** - Easy to adjust retention periods
- **Logged** - Function logs show cleanup activity
- **Safe** - Batched deletions prevent timeouts
- **No manual work** - Zero maintenance

### Cons ❌

- Requires deploying one more function
- Uses function execution credits (minimal)

### Cost

- **~$0.01/month** - One 10-second execution per day
- **Negligible** compared to database storage costs

---

## Option 2: Manual Periodic Cleanup Query

### How It Works

- Run manual queries in Appwrite Console
- Delete old records when you remember
- Requires human intervention

### Implementation

**Step 1: Go to Appwrite Console → Databases → rateLimits**

**Step 2: Run Query**

```javascript
// In Console Filters
$createdAt < '2024-07-26T00:00:00.000Z' // 90 days ago
```

**Step 3: Select All → Delete**

**Step 4: Repeat for suspiciousActivity**

### Pros ✅

- No function deployment needed
- Simple to understand
- Full control over what gets deleted

### Cons ❌

- **Manual work** - You have to remember to do it
- **Inconsistent** - Easy to forget
- **Time-consuming** - Multiple steps each time
- **Error-prone** - Might delete wrong data
- **No logging** - No audit trail
- **Batch limits** - Can only delete 100 at a time in console

---

## Comparison Table

| Feature              | Scheduled Function   | Manual Query               |
| -------------------- | -------------------- | -------------------------- |
| **Automation**       | ✅ Fully automated   | ❌ Manual                  |
| **Consistency**      | ✅ Runs on schedule  | ❌ When you remember       |
| **Maintenance**      | ✅ Zero              | ❌ Regular work            |
| **Logging**          | ✅ Function logs     | ❌ No audit trail          |
| **Safety**           | ✅ Batched deletions | ⚠️ Risk of mistakes        |
| **Cost**             | ~$0.01/month         | Free (but costs your time) |
| **Setup Time**       | 10 minutes           | 0 minutes                  |
| **Long-term Effort** | 0 minutes/month      | 15 minutes/month           |

---

## Recommendation: Scheduled Function ✅

**Why?**

1. **Set it once, forget it forever**
2. **Costs pennies** (~$0.01/month)
3. **Reliable** - Never forgets to run
4. **Professional** - Production-grade solution
5. **Scalable** - Works as your app grows

**When to use Manual Cleanup:**

- You're in early development
- You have < 100 users
- You check your database daily anyway

---

## Deployment: Scheduled Function

### Step 1: Create Function in Appwrite Console

```
Name: cleanup-rate-limits
Runtime: Node.js (18.0 or higher)
Entrypoint: index.js
Execute Access: Server (this function is only triggered by schedule, not by users)
```

**Why "Server"?**

- This function runs on a schedule (cron job)
- No users should be able to call it directly
- "Server" means only Appwrite's internal scheduler can execute it
- More secure than "Any"

### Step 2: Upload Function

Upload: `functions/cleanup-rate-limits.tar.gz`

### Step 3: Set Environment Variables

```env
DATABASE_ID=6859b128002afc56c476
RATE_LIMITS_COLLECTION_ID=rateLimits
```

### Step 4: Configure Schedule

Go to **Settings** → **Schedule**:

```
Schedule: 0 3 * * *
Description: Daily cleanup at 3 AM UTC
```

**Schedule Explanation:**

- `0 3 * * *` = Every day at 3:00 AM UTC
- Runs when traffic is lowest
- Completes before users wake up

### Step 5: Test Manually

Click **"Execute Now"** to test:

- Check function logs
- Verify old records are deleted
- Confirm no errors

---

## Adjusting Retention Periods

Edit `functions/cleanup-rate-limits/index.js`:

```javascript
const RETENTION_DAYS = 90 // ← Change this (days)
```

**Recommendations:**

- **Rate Limits**: 30-90 days (short-term abuse tracking)
- **Suspicious Activity**: Keep indefinitely or clean up manually (security audits, compliance)

---

## Monitoring

**Check Function Logs:**

1. Go to Functions → cleanup-rate-limits → Executions
2. View latest execution
3. Check logs for deletion counts

**Example Log Output:**

```
Starting cleanup of rate limits...
Cleaning up rate limits older than 90 days...
Rate Limits cleanup: 1,234 documents deleted
```

---

## Alternative: TTL (Time To Live)

**Note:** Appwrite doesn't currently support automatic TTL on documents. If this feature is added in the future, it would be the best solution (zero-code automatic cleanup).

Until then, the scheduled function is the best approach.

---

## Summary

**For Production:** Use **Scheduled Function** ✅

- Automated, reliable, professional
- Costs pennies, saves hours
- Set once, works forever

**For Development:** Either works

- Manual cleanup is fine for testing
- Scheduled function is better practice

---

_Last Updated: October 24, 2025_
