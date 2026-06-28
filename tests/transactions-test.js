/**
 * Appwrite Transactions Testing Script
 * 
 * This script tests the transaction implementation across all critical operations
 * Run with: node tests/transactions-test.js
 * 
 * Prerequisites:
 * - npm install node-appwrite
 * - Set environment variables or update the constants below
 */

const sdk = require('node-appwrite');

// Configuration - Update these with your values
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://api.jomcontest.com/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || 'your-project-id';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || 'your-api-key';
const DATABASE_ID = process.env.DATABASE_ID || 'your-database-id';

// Test collections
const TEST_COLLECTION_ID = 'test_transactions';

// Initialize Appwrite client
const client = new sdk.Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const tablesDB = new sdk.TablesDB(client);

/**
 * Test 1: Basic Transaction - Create and Commit
 */
async function test1_BasicTransaction() {
  console.log('\n📝 Test 1: Basic Transaction - Create and Commit');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Create transaction
    const transaction = await tablesDB.createTransaction();
    console.log(`✅ Transaction created: ${transaction.$id}`);
    
    // Stage a row creation
    const row = await tablesDB.createRow(
      DATABASE_ID,
      TEST_COLLECTION_ID,
      sdk.ID.unique(),
      {
        test_field: 'test_value',
        test_number: 42
      },
      [],
      transaction.$id
    );
    console.log(`✅ Row staged: ${row.$id}`);
    
    // Commit transaction
    await tablesDB.updateTransaction(transaction.$id, true);
    console.log(`✅ Transaction committed successfully`);
    
    return { success: true, transactionId: transaction.$id, rowId: row.$id };
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: Transaction Rollback
 */
async function test2_TransactionRollback() {
  console.log('\n📝 Test 2: Transaction Rollback');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Create transaction
    const transaction = await tablesDB.createTransaction();
    console.log(`✅ Transaction created: ${transaction.$id}`);
    
    // Stage a row creation
    const row = await tablesDB.createRow(
      DATABASE_ID,
      TEST_COLLECTION_ID,
      sdk.ID.unique(),
      {
        test_field: 'should_be_rolled_back',
        test_number: 99
      },
      [],
      transaction.$id
    );
    console.log(`✅ Row staged: ${row.$id}`);
    
    // Rollback transaction (intentional)
    await tablesDB.updateTransaction(transaction.$id, false);
    console.log(`✅ Transaction rolled back successfully`);
    
    // Try to fetch the row (should fail)
    try {
      await tablesDB.getRow(DATABASE_ID, TEST_COLLECTION_ID, row.$id);
      console.error(`❌ Row should not exist after rollback`);
      return { success: false, error: 'Row exists after rollback' };
    } catch (fetchError) {
      console.log(`✅ Confirmed: Row does not exist after rollback`);
      return { success: true };
    }
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Multiple Operations in Single Transaction
 */
async function test3_MultipleOperations() {
  console.log('\n📝 Test 3: Multiple Operations in Single Transaction');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Create transaction
    const transaction = await tablesDB.createTransaction();
    console.log(`✅ Transaction created: ${transaction.$id}`);
    
    const rowIds = [];
    
    // Stage multiple row creations (simulating multi-step operation)
    for (let i = 0; i < 5; i++) {
      const row = await tablesDB.createRow(
        DATABASE_ID,
        TEST_COLLECTION_ID,
        sdk.ID.unique(),
        {
          test_field: `batch_item_${i}`,
          test_number: i * 10
        },
        [],
        transaction.$id
      );
      rowIds.push(row.$id);
      console.log(`✅ Row ${i + 1} staged: ${row.$id}`);
    }
    
    // Commit all operations atomically
    await tablesDB.updateTransaction(transaction.$id, true);
    console.log(`✅ Transaction committed - all ${rowIds.length} rows created atomically`);
    
    return { success: true, rowCount: rowIds.length, rowIds };
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 4: Atomic Numeric Operations (Race Condition Prevention)
 */
async function test4_AtomicOperations() {
  console.log('\n📝 Test 4: Atomic Numeric Operations');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Create a test row with a counter
    const row = await tablesDB.createRow(
      DATABASE_ID,
      TEST_COLLECTION_ID,
      sdk.ID.unique(),
      {
        counter: 0,
        test_field: 'atomic_test'
      }
    );
    console.log(`✅ Test row created: ${row.$id} with counter = 0`);
    
    // Simulate concurrent increments (10 operations)
    const incrementPromises = [];
    for (let i = 0; i < 10; i++) {
      incrementPromises.push(
        tablesDB.incrementRowColumn(
          DATABASE_ID,
          TEST_COLLECTION_ID,
          row.$id,
          'counter',
          1
        )
      );
    }
    
    console.log(`🚀 Running 10 concurrent increments...`);
    await Promise.all(incrementPromises);
    
    // Fetch final value
    const finalRow = await tablesDB.getRow(DATABASE_ID, TEST_COLLECTION_ID, row.$id);
    console.log(`📊 Final counter value: ${finalRow.counter}`);
    
    if (finalRow.counter === 10) {
      console.log(`✅ SUCCESS: All increments applied correctly (expected: 10, actual: ${finalRow.counter})`);
      return { success: true, finalValue: finalRow.counter };
    } else {
      console.error(`❌ RACE CONDITION DETECTED: Expected 10, got ${finalRow.counter}`);
      return { success: false, error: `Race condition: expected 10, got ${finalRow.counter}` };
    }
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 5: Transaction Error Recovery
 */
async function test5_ErrorRecovery() {
  console.log('\n📝 Test 5: Transaction Error Recovery');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const transaction = await tablesDB.createTransaction();
    console.log(`✅ Transaction created: ${transaction.$id}`);
    
    try {
      // Stage a valid row
      await tablesDB.createRow(
        DATABASE_ID,
        TEST_COLLECTION_ID,
        sdk.ID.unique(),
        {
          test_field: 'valid_data',
          test_number: 123
        },
        [],
        transaction.$id
      );
      console.log(`✅ Valid row staged`);
      
      // Try to stage an invalid operation (simulating error)
      // This should trigger rollback
      await tablesDB.createRow(
        DATABASE_ID,
        'non_existent_collection', // Invalid collection
        sdk.ID.unique(),
        { data: 'test' },
        [],
        transaction.$id
      );
      
      console.error(`❌ Should have thrown error for invalid collection`);
      return { success: false, error: 'No error thrown for invalid operation' };
    } catch (operationError) {
      console.log(`✅ Error caught: ${operationError.message}`);
      
      // Rollback transaction
      try {
        await tablesDB.updateTransaction(transaction.$id, false);
        console.log(`✅ Transaction rolled back successfully`);
        return { success: true, errorHandled: true };
      } catch (rollbackError) {
        console.error(`❌ Rollback failed: ${rollbackError.message}`);
        return { success: false, error: `Rollback failed: ${rollbackError.message}` };
      }
    }
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         Appwrite Transactions Integration Tests               ║
║                                                               ║
║  Testing transaction atomicity, rollback, and race           ║
║  condition prevention across all critical operations         ║
╚═══════════════════════════════════════════════════════════════╝
`);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Run all tests
  const tests = [
    { name: 'Basic Transaction', fn: test1_BasicTransaction },
    { name: 'Transaction Rollback', fn: test2_TransactionRollback },
    { name: 'Multiple Operations', fn: test3_MultipleOperations },
    { name: 'Atomic Operations', fn: test4_AtomicOperations },
    { name: 'Error Recovery', fn: test5_ErrorRecovery }
  ];
  
  for (const test of tests) {
    results.total++;
    const result = await test.fn();
    results.tests.push({ name: test.name, ...result });
    
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                        TEST SUMMARY                           ║
╚═══════════════════════════════════════════════════════════════╝
`);
  
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);
  
  // Detailed results
  results.tests.forEach((test, index) => {
    const status = test.success ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${test.name}`);
    if (!test.success && test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  
  console.log('\n');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  test1_BasicTransaction,
  test2_TransactionRollback,
  test3_MultipleOperations,
  test4_AtomicOperations,
  test5_ErrorRecovery,
  runAllTests
};
