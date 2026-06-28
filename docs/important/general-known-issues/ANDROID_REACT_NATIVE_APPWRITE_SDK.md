# Bug Report: react-native-appwrite Session Persistence Failure on Android

## Environment

- **Package**: `react-native-appwrite`
- **Version**: `0.17.1`
- **Platform**: Android (Physical devices and emulators)
- **React Native**: `0.79.6`
- **Expo**: `53.0.23`
- **AsyncStorage**: `@react-native-async-storage/async-storage@2.1.2`
- **Appwrite Server**: Cloud (fra.cloud.appwrite.io)

## Issue Description

The `react-native-appwrite` SDK **fails to maintain session state on Android** after OAuth authentication. While sessions are successfully created and initially stored in AsyncStorage, the SDK **loses the session state** when making subsequent API calls, causing authenticated users to be treated as guests.

**This issue does NOT occur on iOS or Web** - it is specific to Android.

## Steps to Reproduce

1. **Initialize Appwrite client on Android**:

```typescript
import { Client, Account } from 'react-native-appwrite'
import { Platform } from 'react-native'

const client = new Client()
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('YOUR_PROJECT_ID')
  .setPlatform('com.yourapp.alpha')

const account = new Account(client)
```

2. **Perform OAuth authentication**:

```typescript
const loginUrl = await account.createOAuth2Token(
  OAuthProvider.Google,
  'exp://192.168.1.100:19001',
  'exp://192.168.1.100:19001'
)

const result = await WebBrowser.openAuthSessionAsync(loginUrl, scheme)

if (result.type === 'success' && result.url) {
  const url = new URL(result.url)
  const secret = url.searchParams.get('secret')
  const userId = url.searchParams.get('userId')

  await account.createSession({ userId, secret })
}
```

3. **Verify session immediately after creation**:

```typescript
const user = await account.get() // ✅ Works
console.log('User:', user.$id)
```

4. **Wait a few seconds or navigate to another screen**

5. **Try to make another API call**:

```typescript
const user = await account.get() // ❌ Fails with "User (role: guests) missing scopes"
```

## Expected Behavior

- Session should persist across API calls
- `account.get()` should return the authenticated user
- AsyncStorage should maintain session data
- All API calls should use the authenticated session

## Actual Behavior

- Session is created successfully ✅
- Session is stored in AsyncStorage ✅
- Initial `account.get()` call works ✅
- **Subsequent `account.get()` calls fail** ❌
- Error: `User (role: guests) missing scopes (["account"])` ❌
- User is treated as a guest instead of authenticated user ❌

## Debug Logs

### Platform Comparison - Working vs Broken

#### iOS (✅ WORKS):

```
[AuthContext] Checking for active session...
[AuthContext] User loaded: 685d0963d9f324bdfb0d
[FeedbackDialog] Verifying session before opening dialog...
[FeedbackDialog] ✅ Session valid, opening dialog: 685d0963d9f324bdfb0d
[FeedbackDialog] Pre-flight check - verifying session before function call...
[FeedbackDialog] Session check attempt 1/3
[FeedbackDialog] ✅ SDK session valid: 685d0963d9f324bdfb0d
[FeedbackDialog] Calling function with: {"functionId": "68ff0c0a000fc0e33e48", "platform": "ios", "userId": "685d0963d9f324bdfb0d"}
[FeedbackDialog] Function execution completed: {"executionId": "6901cdb0254da3fca191", "status": "completed"}
```

#### Web (✅ WORKS):

```
[AuthContext] Checking for active session...
[AuthContext] User loaded: 685a15df0c6f3190bf1c
[FeedbackDialog] Verifying session before opening dialog...
[FeedbackDialog] ✅ Session valid, opening dialog: 685a15df0c6f3190bf1c
[FeedbackDialog] Pre-flight check - verifying session before function call...
[FeedbackDialog] Session check attempt 1/3
[FeedbackDialog] ✅ SDK session valid: 685a15df0c6f3190bf1c
[FeedbackDialog] Calling function with: {functionId: '68ff0c0a000fc0e33e48', userId: '685a15df0c6f3190bf1c', platform: 'web'}
[FeedbackDialog] Function execution completed: {executionId: '6901ce1a129d99262fa0', status: 'completed'}
```

#### Android (❌ BROKEN):

```
[Native Auth] Session created: {"id": "6901ca948284cb00de4d", "userId": "685cf1b3d6761e8877ce"}
[SessionDebug] ✅ SDK has session: {"email": "user@example.com", "userId": "685cf1b3d6761e8877ce"}
[SessionDebug] ALL AsyncStorage keys (1): ["appwrite_session_current"]
[Native Auth] ✅ Session verified on attempt 1: 685cf1b3d6761e8877ce
[AuthContext] User loaded: 685cf1b3d6761e8877ce
[FeedbackDialog] Verifying session before opening dialog...
[FeedbackDialog] ✅ Session valid, opening dialog: 685cf1b3d6761e8877ce
[FeedbackDialog] Pre-flight check - verifying session before function call...
[FeedbackDialog] Session check attempt 1/3
ERROR [FeedbackDialog] SDK session check failed (attempt 1): User (role: guests) missing scopes (["account"])
[FeedbackDialog] Session check attempt 2/3
ERROR [FeedbackDialog] SDK session check failed (attempt 2): User (role: guests) missing scopes (["account"])
[FeedbackDialog] Session check attempt 3/3
ERROR [FeedbackDialog] SDK session check failed (attempt 3): User (role: guests) missing scopes (["account"])
```

### AsyncStorage Debug:

```
[SessionDebug] ALL AsyncStorage keys (1): ["appwrite_session_current"]
[SessionDebug] Session-related keys: ["appwrite_session_current"]
[SessionDebug] appwrite_session_current: {"$id":"6901c819e73a8dfd9a77","userId":"685cf1b3d6761e8877ce","expire":"2026-10-29T07:54:01.947+00:0
[SessionDebug] Appwrite keys: ["appwrite_session_current"]
```

**Key Finding**: AsyncStorage **DOES contain the session data**, but the SDK **fails to read it** when making API calls.

## Root Cause Analysis

The issue appears to be in how `react-native-appwrite` handles session persistence on Android:

1. **Session Creation**: Works correctly, session is stored in AsyncStorage
2. **Session Retrieval**: The SDK fails to read the session from AsyncStorage on subsequent API calls
3. **Session State**: The SDK loses its in-memory session state between calls
4. **AsyncStorage Format**: The session data is stored but may not be in the format the SDK expects when reading

## Workarounds Attempted

### ❌ Failed Workarounds:

1. **Multiple `account.get()` calls** to force persistence - Doesn't help
2. **Manual AsyncStorage session storage** - SDK still can't read it
3. **JWT-based session storage** - SDK doesn't recognize it
4. **Duplicate session creation** - Blocked by "session already active" error
5. **Server session refresh** - Doesn't restore SDK session state

### ⚠️ Partial Workaround:

```typescript
// Force user to re-authenticate on every session-dependent action
// This is NOT a viable solution for production
```

## Impact

### Critical Issues:

- ❌ **Authentication broken on Android** - Users cannot stay logged in
- ❌ **API calls fail** - Any action requiring authentication fails
- ❌ **Poor UX** - Users forced to re-login constantly
- ❌ **Feature limitations** - Cannot implement secure features on Android

### Affected Features:

- User profile access
- Authenticated API calls (databases, functions, storage)
- Any feature requiring user session
- File uploads with authentication
- Database queries with user permissions

## Comparison with Other Platforms

| Platform    | Session Creation | Session Persistence | API Calls    |
| ----------- | ---------------- | ------------------- | ------------ |
| **iOS**     | ✅ Works         | ✅ Works            | ✅ Works     |
| **Web**     | ✅ Works         | ✅ Works            | ✅ Works     |
| **Android** | ✅ Works         | ❌ **FAILS**        | ❌ **FAILS** |

## Additional Context

### Testing Environment:

- **Physical Device**: Android 11, Samsung Galaxy
- **Emulator**: Android 14, Pixel 5
- **Development**: Expo development client
- **Network**: Both WiFi and mobile data tested

### Related Issues:

- This appears to be specific to `react-native-appwrite` and does not occur with the web SDK (`appwrite`)
- Issue persists across different Android versions
- Issue persists across different network conditions
- Issue is **100% reproducible**

## Requested Fix

1. **Session Persistence**: Ensure AsyncStorage sessions are properly read on Android
2. **Session State Management**: Maintain in-memory session state across API calls
3. **Session Recovery**: Implement automatic session recovery from AsyncStorage
4. **Debug Logging**: Add SDK-level debug logs for session state changes

## Minimal Reproduction Repository

A minimal reproduction repository can be provided upon request with:

- Clean Expo + react-native-appwrite setup
- Simple OAuth flow
- Demonstration of session loss

## Priority

**CRITICAL** - This bug makes `react-native-appwrite` **unusable for production Android apps** requiring authentication.

## Temporary Solution in Production

Until this is fixed, Android users in our app must:

- Re-authenticate frequently
- Use limited features that don't require authentication
- Experience degraded functionality compared to iOS/Web users

This is **not acceptable for production** and requires an urgent fix.

---

## Technical Details for SDK Maintainers

### AsyncStorage Investigation:

**Session IS stored**:

```json
{
  "$id": "6901c819e73a8dfd9a77",
  "userId": "685cf1b3d6761e8877ce",
  "expire": "2026-10-29T07:54:01.947+00:00",
  ...
}
```

**Key used**: `appwrite_session_current`

**Problem**: SDK's `account.get()` fails to read this session, returning guest user instead.

### Suspected Code Path:

The issue likely exists in:

1. Session retrieval logic in `Account.get()`
2. AsyncStorage read operations in the Android native bridge
3. Session state initialization in the Client class
4. Cookie/session management in fetch interceptors

### Suggested Investigation:

1. Check AsyncStorage read operations on Android
2. Verify session deserialization on Android
3. Test session state management between API calls
4. Compare iOS vs Android session handling code paths

---

**Thank you for your attention to this critical issue. Happy to provide additional debugging information or testing as needed.**
