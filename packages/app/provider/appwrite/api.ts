import {
  Client,
  Account,
  TablesDB,
  Teams,
  Storage,
  Functions,
} from 'app/lib/appwrite-universal'
import { Platform } from 'react-native'
import { APPWRITE_PROJECT_ID, APPWRITE_ENDPOINT } from './constants'

const client = new Client()

// Configure client for all platforms
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID)

// Add platform-specific configuration
// Enable platform configuration for better session persistence
if (Platform.OS === 'ios') {
  client.setPlatform('com.jomcontest')
} else if (Platform.OS === 'android') {
  client.setPlatform('com.jomcontest')
}

// Let Appwrite SDK auto-detect realtime endpoint
// This should automatically use wss://api.jomcontest.com/v1/realtime
// console.log('Using Appwrite SDK auto-detected realtime endpoint')

export const account = new Account(client)
export const tablesDB = new TablesDB(client) // Modern API for all database operations
export const teams = new Teams(client)
export const storage = new Storage(client)
export const functions = new Functions(client)
// Export the underlying client so callers can use client.subscribe for Realtime
export const appwriteClient = client

// Note: TablesDB is the modern API for all database operations (Appwrite 1.8+)
// Available in both client and server SDKs
// Features:
// - Transactions (createTransaction, updateTransaction with {commit/rollback})
// - Atomic operations (incrementRowColumn, decrementRowColumn)
// - Race condition prevention with DB operators
// - Object-parameter syntax for all methods
