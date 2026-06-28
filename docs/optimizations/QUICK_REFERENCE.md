# DB Operators & Transactions - Quick Reference Guide

**For**: Developers working on JomContest  
**Updated**: November 7, 2025

---

## 🚀 When to Use What

### Use `createOperations()` When:
- ✅ You have **multiple operations** (3+) to stage in a transaction
- ✅ Operations are **similar** (all deletes, all updates, etc.)
- ✅ You want to **reduce network calls** (50-80% faster)
- ✅ You need **bulk operations** across multiple tables

### Use Individual Operations When:
- ✅ You have **1-2 operations** only
- ✅ Operations need **complex logic** between them
- ✅ You need to **read data** between operations

### Use Transactions When:
- ✅ Operations must be **atomic** (all succeed or all fail)
- ✅ Operations span **multiple tables**
- ✅ You need **rollback** capability on errors
- ✅ You want to prevent **partial writes**

---

## 📖 Code Templates

### Template 1: Bulk Delete with Transaction

```typescript
// Create transaction
const transaction = await tablesDB.createTransaction()
const transactionId = transaction.$id

try {
  // Build operations array
  const operations = items.map(item => ({
    action: 'delete' as const,
    databaseId: DATABASE_ID,
    tableId: COLLECTION_ID,
    rowId: item.$id,
  }))

  // Stage all operations
  await tablesDB.createOperations({
    transactionId,
    operations,
  })

  // Commit transaction
  await tablesDB.updateTransaction({
    transactionId,
    commit: true,
  })

  console.log(`✅ Deleted ${operations.length} items atomically`)
} catch (error) {
  // Rollback on error
  await tablesDB.updateTransaction({
    transactionId,
    rollback: true,
  })
  throw error
}
```

---

### Template 2: Bulk Update with Transaction

```typescript
// Create transaction
const transaction = await tablesDB.createTransaction()
const transactionId = transaction.$id

try {
  // Build operations array
  const operations = items.map((item, index) => ({
    action: 'update' as const,
    databaseId: DATABASE_ID,
    tableId: COLLECTION_ID,
    rowId: item.$id,
    data: {
      order: index + 1,
      // ... other fields
    },
  }))

  // Stage all operations
  await tablesDB.createOperations({
    transactionId,
    operations,
  })

  // Commit transaction
  await tablesDB.updateTransaction({
    transactionId,
    commit: true,
  })

  console.log(`✅ Updated ${operations.length} items atomically`)
} catch (error) {
  // Rollback on error
  await tablesDB.updateTransaction({
    transactionId,
    rollback: true,
  })
  throw error
}
```

---

### Template 3: Mixed Operations (Create, Update, Delete)

```typescript
// Create transaction
const transaction = await tablesDB.createTransaction()
const transactionId = transaction.$id

try {
  // Build mixed operations array
  const operations = [
    // Create operations
    ...newItems.map(item => ({
      action: 'create' as const,
      databaseId: DATABASE_ID,
      tableId: COLLECTION_ID,
      rowId: ID.unique(),
      data: item,
    })),
    
    // Update operations
    ...existingItems.map(item => ({
      action: 'update' as const,
      databaseId: DATABASE_ID,
      tableId: COLLECTION_ID,
      rowId: item.$id,
      data: { status: 'updated' },
    })),
    
    // Delete operations
    ...deletedItems.map(item => ({
      action: 'delete' as const,
      databaseId: DATABASE_ID,
      tableId: COLLECTION_ID,
      rowId: item.$id,
    })),
  ]

  // Stage all operations
  await tablesDB.createOperations({
    transactionId,
    operations,
  })

  // Commit transaction
  await tablesDB.updateTransaction({
    transactionId,
    commit: true,
  })

  console.log(`✅ Executed ${operations.length} mixed operations atomically`)
} catch (error) {
  // Rollback on error
  await tablesDB.updateTransaction({
    transactionId,
    rollback: true,
  })
  throw error
}
```

---

### Template 4: DB Operators (Increment/Decrement)

```typescript
// Atomic increment (no read-modify-write)
await tablesDB.incrementRowColumn({
  databaseId: DATABASE_ID,
  tableId: COLLECTION_ID,
  rowId: documentId,
  column: 'counter',
  value: 1,
  max: 100, // Optional: cap at maximum
})

// Atomic decrement
await tablesDB.decrementRowColumn({
  databaseId: DATABASE_ID,
  tableId: COLLECTION_ID,
  rowId: documentId,
  column: 'counter',
  value: 1,
  min: 0, // Optional: cap at minimum
})
```

---

### Template 5: Array Operators

```typescript
// Append to array (no read-modify-write)
await tablesDB.updateRow({
  databaseId: DATABASE_ID,
  tableId: COLLECTION_ID,
  rowId: documentId,
  data: {
    tags: { $arrayAppend: ['new-tag'] }
  }
})

// Remove from array
await tablesDB.updateRow({
  databaseId: DATABASE_ID,
  tableId: COLLECTION_ID,
  rowId: documentId,
  data: {
    tags: { $arrayRemove: 'old-tag' }
  }
})
```

---

## ⚠️ Common Pitfalls

### ❌ DON'T: Forget to rollback on error
```typescript
// BAD
try {
  await tablesDB.createOperations({ transactionId, operations })
  await tablesDB.updateTransaction({ transactionId, commit: true })
} catch (error) {
  console.error(error) // ❌ Transaction left hanging!
}
```

### ✅ DO: Always rollback on error
```typescript
// GOOD
try {
  await tablesDB.createOperations({ transactionId, operations })
  await tablesDB.updateTransaction({ transactionId, commit: true })
} catch (error) {
  await tablesDB.updateTransaction({ transactionId, rollback: true }) // ✅
  throw error
}
```

---

### ❌ DON'T: Use sequential operations for bulk
```typescript
// BAD - Slow and inefficient
for (const item of items) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: COLLECTION_ID,
    rowId: item.$id,
    transactionId,
  })
}
```

### ✅ DO: Use bulk operations
```typescript
// GOOD - Fast and efficient
const operations = items.map(item => ({
  action: 'delete' as const,
  databaseId: DATABASE_ID,
  tableId: COLLECTION_ID,
  rowId: item.$id,
}))

await tablesDB.createOperations({ transactionId, operations })
```

---

### ❌ DON'T: Forget `as const` for action types
```typescript
// BAD - TypeScript won't catch errors
const operations = items.map(item => ({
  action: 'delete', // ❌ Type is string, not literal
  // ...
}))
```

### ✅ DO: Use `as const` for type safety
```typescript
// GOOD - TypeScript will catch typos
const operations = items.map(item => ({
  action: 'delete' as const, // ✅ Type is 'delete'
  // ...
}))
```

---

### ❌ DON'T: Include storage operations in transactions
```typescript
// BAD - Storage doesn't support transactions
const transaction = await tablesDB.createTransaction()
await storage.deleteFile(bucketId, fileId) // ❌ Not transactional
await tablesDB.deleteRow({ transactionId, ... })
await tablesDB.updateTransaction({ commit: true })
```

### ✅ DO: Handle storage separately
```typescript
// GOOD - Storage operations outside transaction
// 1. Delete storage files first
for (const file of files) {
  try {
    await storage.deleteFile(bucketId, file.id)
  } catch (err) {
    console.warn('Failed to delete file:', err)
  }
}

// 2. Then handle database in transaction
const transaction = await tablesDB.createTransaction()
await tablesDB.deleteRow({ transactionId, ... })
await tablesDB.updateTransaction({ commit: true })
```

---

## 📊 Performance Guidelines

### Network Round-Trips

| Pattern | Round-Trips | Relative Speed |
|---------|-------------|----------------|
| Sequential operations (10 items) | 10 | 1x (baseline) |
| Bulk operations (10 items) | 1 | **10x faster** ⚡ |
| Sequential operations (100 items) | 100 | 1x (baseline) |
| Bulk operations (100 items) | 1 | **100x faster** ⚡ |

### When to Use Bulk Operations

- ✅ **3+ operations**: Always use bulk
- ⚠️ **2 operations**: Consider bulk if performance critical
- ❌ **1 operation**: Use individual operation

---

## 🎯 Real-World Examples from JomContest

### Example 1: Contest Deletion
**File**: `packages/app/features/admin/EditContestTabContent.tsx`  
**Lines**: 963-1020

```typescript
// Build operations for all related data
const operations = [
  ...files.map(file => ({ action: 'delete' as const, ... })),
  ...translations.map(tr => ({ action: 'delete' as const, ... })),
  ...upvotes.map(upvote => ({ action: 'delete' as const, ... })),
  ...saves.map(save => ({ action: 'delete' as const, ... })),
  { action: 'delete' as const, ... }, // Contest document
]

await tablesDB.createOperations({ transactionId, operations })
```

**Result**: 50-70% faster, atomic deletion

---

### Example 2: File Reordering
**File**: `packages/app/features/admin/EditContestTabContent.tsx`  
**Lines**: 1548-1596

```typescript
// Build reorder operations
const reorderOperations = []
let order = 2
for (const fileDoc of files) {
  reorderOperations.push({
    action: 'update' as const,
    databaseId: DATABASE_ID,
    tableId: CONTEST_FILES_COLLECTION_ID,
    rowId: fileDoc.$id,
    data: { file_order: order },
  })
  order++
}

// Execute in transaction
const transaction = await tablesDB.createTransaction()
await tablesDB.createOperations({
  transactionId: transaction.$id,
  operations: reorderOperations
})
await tablesDB.updateTransaction({
  transactionId: transaction.$id,
  commit: true
})
```

**Result**: 60-80% faster, no race conditions

---

## 📚 Further Reading

### Appwrite Documentation
- [DB Operators Blog](https://appwrite.io/blog/post/announcing-db-operators)
- [DB Operators Docs](https://appwrite.io/docs/products/databases/db-operators)
- [Transactions Blog](https://appwrite.io/blog/post/announcing-transactions-api)
- [Transactions Docs](https://appwrite.io/docs/products/databases/transactions)

### JomContest Documentation
- `docs/general/TRANSACTIONS_IMPLEMENTATION.md` - Existing implementations
- `docs/optimizations/DB_OPERATORS_AND_TRANSACTIONS_OPPORTUNITIES.md` - Full analysis
- `docs/optimizations/IMPLEMENTATION_SUMMARY.md` - What was implemented

---

## 🆘 Troubleshooting

### "Transaction not found"
**Cause**: Transaction expired (60s timeout)  
**Solution**: Keep transactions short, commit/rollback promptly

### "Too many operations"
**Cause**: Exceeded plan limit (Pro: 1,000 ops)  
**Solution**: Split into multiple transactions

### "Conflict detected"
**Cause**: Row changed externally during transaction  
**Solution**: Retry with fresh data

### "Storage operation failed but database committed"
**Cause**: Storage doesn't support transactions  
**Solution**: Expected behavior, handle storage separately

---

## ✅ Checklist for New Code

When writing new database operations:

- [ ] Do I have 3+ similar operations? → Use `createOperations()`
- [ ] Do operations need to be atomic? → Use transaction
- [ ] Am I updating counters? → Consider atomic operators
- [ ] Am I modifying arrays? → Consider array operators
- [ ] Did I add error handling? → Try-catch with rollback
- [ ] Did I add logging? → Console logs for debugging
- [ ] Did I use `as const`? → Type safety for actions
- [ ] Did I test rollback? → Verify error scenarios

---

**Quick Tip**: When in doubt, use transactions with bulk operations. They're fast, safe, and easy to debug!


