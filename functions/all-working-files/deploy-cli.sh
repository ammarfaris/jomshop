#!/bin/bash

# Appwrite Functions Deployment Script
# This script deploys tar.gz archives to Appwrite Functions via CLI
# Automatically cleans up old deployments (keeps last 3 by default)
# Run from the functions directory: ./deploy-cli.sh [function1] [function2] ...
# If no arguments provided, shows interactive menu

# Show usage information
show_usage() {
  echo "Usage: $0 [function1] [function2] ... [functionN]"
  echo ""
  echo "Arguments:"
  echo "  function1, function2, ...    Specific function names to deploy"
  echo "  --help, -h                  Show this help message"
  echo "  --list, -l                  List all available functions"
  echo "  --all                       Deploy all functions"
  echo ""
  echo "If no arguments provided, shows interactive menu."
  echo ""
  echo "Features:"
  echo "  - Automatic deployment cleanup (keeps last $DEPLOYMENT_RETENTION_COUNT deployments)"
  echo "  - Real-time deployment status monitoring"
  echo ""
  echo "Available functions:"
  for func_name in "${!FUNCTION_IDS[@]}"; do
    echo "  - $func_name (ID: ${FUNCTION_IDS[$func_name]})"
  done
  echo ""
  echo "Examples:"
  echo "  $0                           # Interactive menu"
  echo "  $0 --all                     # Deploy all functions"
  echo "  $0 meilisearch-admin         # Deploy only meilisearch-admin"
  echo "  $0 sanitize-text validate-captcha  # Deploy specific functions"
  echo "  $0 --list                    # List all functions"
}

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_ID="6915515900296397d382"
ENDPOINT="https://sgp.cloud.appwrite.io/v1"

# Deployment cleanup configuration
# Number of recent deployments to keep for each function
DEPLOYMENT_RETENTION_COUNT=3

# Function configurations (bash 3.2 compatible)
FUNCTION_KEYS=(
  "validate-captcha"
  "sanitize-text"
  "process-feedback-optimized"
  "validate-receipt-upload"
  "update-receipt-notes"
  "archive-receipts"
  "generate-img-blurhash-img-token"
  "meilisearch-admin"
  "meilisearch-search"
  "process-feedback"
  "cleanup-rate-limits"
  "cleanup-rate-limits-above-one-hour"
  "cleanup-orphaned-receipts"
  "public-contests"
  "revenuecat-webhook"
  "get-subscription-tier"
  "initialize-user-points"
  "award-points"
  "get-user-points"
  "redeem-points-for-subscription"
  "redeem-referral-code"
  "update-auto-renew"
  "auto-renew-subscriptions"
  "sync-public-contests"
)

FUNCTION_IDS=(
  "68fb33c5000f4b5d57e0"      # validate-captcha
  "69083a2c0000d0128bb1"      # sanitize-text
  "6908400c0030a1e117b4"      # process-feedback-optimized
  "69079c76000d70f2b7bb"      # validate-receipt-upload
  "690dd09c000cc197e204"      # update-receipt-notes
  "69083b5100310d3e8195"      # archive-receipts
  "68f2e388002d9a6d76f5"      # generate-img-blurhash-img-token
  "68c0f9db0023bb7cc14f"      # meilisearch-admin
  "68c0fb9d00000f1ab95c"      # meilisearch-search
  "68fb36f30033ce3b4ad5"      # process-feedback
  "68fb87d9001ab877b5fd"      # cleanup-rate-limits
  "68fc0ce500083e315006"      # cleanup-rate-limits-above-one-hour
  "fn_cleanup-orphaned-receipts_176647"  # cleanup-orphaned-receipts
  "fn_public-contests_1765067990_6624"  # public-contests
  "fn_revenuecat-webhook_1766476173_1b"  # revenuecat-webhook
  "fn_get-subscription-tier_1766476188"  # get-subscription-tier
  "fn_initialize-user-points_176647620"  # initialize-user-points
  "fn_award-points_1766476217_551e"      # award-points
  "fn_get-user-points_1766476231_1bc9"   # get-user-points
  "fn_redeem-points-for-subscription_1"  # redeem-points-for-subscription
  "fn_redeem-referral-code"              # redeem-referral-code
  "fn_update-auto-renew"                 # update-auto-renew
  "fn_auto-renew-subscriptions"          # auto-renew-subscriptions
  "fn_sync-public-contests"              # sync-public-contests
)

# Function configurations (continued)
RUNTIMES=(
  "node-22"  # validate-captcha
  "node-22"  # sanitize-text
  "node-22"  # process-feedback-optimized
  "node-22"  # validate-receipt-upload
  "node-22"  # update-receipt-notes
  "node-22"  # archive-receipts
  "node-22"  # generate-img-blurhash-img-token
  "node-22"  # meilisearch-admin
  "node-22"  # meilisearch-search
  "node-22"  # process-feedback
  "node-22"  # cleanup-rate-limits
  "node-22"  # cleanup-rate-limits-above-one-hour
  "node-22"  # cleanup-orphaned-receipts
  "node-22"  # public-contests
  "node-22"  # revenuecat-webhook
  "node-22"  # get-subscription-tier
  "node-22"  # initialize-user-points
  "node-22"  # award-points
  "node-22"  # get-user-points
  "node-22"  # redeem-points-for-subscription
  "node-22"  # redeem-referral-code
  "node-22"  # update-auto-renew
  "node-22"  # auto-renew-subscriptions
  "node-22"  # sync-public-contests
)

CPUS=(
  "1.0"  # validate-captcha
  "0.5"  # sanitize-text
  "1.0"  # process-feedback-optimized
  "1.0"  # validate-receipt-upload
  "1.0"  # update-receipt-notes
  "1.0"  # archive-receipts
  "1.0"  # generate-img-blurhash-img-token
  "1.0"  # meilisearch-admin
  "1.0"  # meilisearch-search
  "1.0"  # process-feedback
  "1.0"  # cleanup-rate-limits
  "1.0"  # cleanup-rate-limits-above-one-hour
  "1.0"  # cleanup-orphaned-receipts
  "1.0"  # public-contests
  "0.5"  # revenuecat-webhook
  "0.5"  # get-subscription-tier
  "0.5"  # initialize-user-points
  "0.5"  # award-points
  "0.5"  # get-user-points
  "0.5"  # redeem-points-for-subscription
  "0.5"  # redeem-referral-code
  "0.5"  # update-auto-renew
  "1.0"  # auto-renew-subscriptions (cron - may process many users)
  "1.0"  # sync-public-contests (cron + admin - batch processing)
)

MEMORY=(
  "512"   # validate-captcha
  "512"   # sanitize-text
  "512"   # process-feedback-optimized
  "512"   # validate-receipt-upload
  "512"   # update-receipt-notes
  "512"   # archive-receipts
  "1024"  # generate-img-blurhash-img-token
  "512"   # meilisearch-admin
  "512"   # meilisearch-search
  "512"   # process-feedback
  "512"   # cleanup-rate-limits
  "512"   # cleanup-rate-limits-above-one-hour
  "512"   # cleanup-orphaned-receipts
  "512"   # public-contests
  "512"   # revenuecat-webhook
  "512"   # get-subscription-tier
  "512"   # initialize-user-points
  "512"   # award-points
  "512"   # get-user-points
  "512"   # redeem-points-for-subscription
  "512"   # redeem-referral-code
  "512"   # update-auto-renew
  "512"   # auto-renew-subscriptions
  "512"   # sync-public-contests
)

TIMEOUTS=(
  "15"  # validate-captcha
  "15"  # sanitize-text
  "60"  # process-feedback-optimized
  "30"  # validate-receipt-upload
  "30"  # update-receipt-notes
  "60"  # archive-receipts
  "30"  # generate-img-blurhash-img-token
  "60"  # meilisearch-admin
  "15"  # meilisearch-search
  "60"  # process-feedback
  "60"  # cleanup-rate-limits
  "60"  # cleanup-rate-limits-above-one-hour
  "60"  # cleanup-orphaned-receipts
  "30"  # public-contests
  "30"  # revenuecat-webhook
  "15"  # get-subscription-tier
  "15"  # initialize-user-points
  "15"  # award-points
  "15"  # get-user-points
  "30"  # redeem-points-for-subscription
  "15"  # redeem-referral-code
  "15"  # update-auto-renew
  "120" # auto-renew-subscriptions (cron - may take time)
  "60"  # sync-public-contests (batch sync)
)

EXECUTE_PERMS=(
  ""            # validate-captcha (server-side only)
  ""            # sanitize-text (server-side only)
  "users"       # process-feedback-optimized
  "users"       # validate-receipt-upload
  "users"       # update-receipt-notes
  "users"       # archive-receipts
  "team:admin"  # generate-img-blurhash-img-token
  "team:admin"  # meilisearch-admin
  "users"       # meilisearch-search
  "users"       # process-feedback
  ""            # cleanup-rate-limits (server-side only)
  ""            # cleanup-rate-limits-above-one-hour (server-side only)
  ""            # cleanup-orphaned-receipts (server-side only)
  "any"         # public-contests
  ""            # revenuecat-webhook (webhook only - no user execution)
  "users"       # get-subscription-tier (user can fetch their own)
  "users"       # initialize-user-points (user triggers on first login)
  "users"       # award-points (admin check done server-side)
  "users"       # get-user-points (user can fetch their own)
  "users"       # redeem-points-for-subscription (user triggers redemption)
  "users"       # redeem-referral-code (user redeems their friend's code)
  "users"       # update-auto-renew (user updates their own preference)
  ""            # auto-renew-subscriptions (cron only - no user execution)
  "team:admin"  # sync-public-contests (admin + cron only)
)

FUNCTION_DISPLAY_NAMES=(
  "Validate Captcha"
  "Sanitize Text"
  "Process Feedback (Optimized)"
  "Validate Receipt Upload"
  "Update Receipt Notes"
  "Archive Receipts"
  "Generate Image Blurhash & Token"
  "Meilisearch Admin"
  "Meilisearch Search"
  "Process Feedback"
  "Cleanup Rate Limits"
  "Cleanup Rate Limits (>1 hour)"
  "Cleanup Orphaned Receipts"
  "Public Contests"
  "RevenueCat Webhook"
  "Get Subscription Tier"
  "Initialize User Points"
  "Award Points"
  "Get User Points"
  "Redeem Points for Subscription"
  "Redeem Referral Code"
  "Update Auto-Renew"
  "Auto-Renew Subscriptions (CRON)"
  "Sync Public Contests"
)

# Helper function to get array index for a function key
get_function_index() {
  local func_name="$1"
  local i=0
  for key in "${FUNCTION_KEYS[@]}"; do
    if [ "$key" = "$func_name" ]; then
      echo "$i"
      return 0
    fi
    ((i++))
  done
  echo "-1"
  return 1
}

# Helper function to get function property by name
get_function_property() {
  local func_name="$1"
  local property="$2"
  local index=$(get_function_index "$func_name")

  if [ "$index" -eq -1 ]; then
    echo ""
    return 1
  fi

  case "$property" in
    "id") echo "${FUNCTION_IDS[$index]}" ;;
    "runtime") echo "${RUNTIMES[$index]}" ;;
    "cpu") echo "${CPUS[$index]}" ;;
    "memory") echo "${MEMORY[$index]}" ;;
    "timeout") echo "${TIMEOUTS[$index]}" ;;
    "execute") echo "${EXECUTE_PERMS[$index]}" ;;
    "display") echo "${FUNCTION_DISPLAY_NAMES[$index]}" ;;
    *) echo "" ;;
  esac
}

# All available functions
ALL_FUNCTIONS=(
  "validate-receipt-upload"
  "archive-receipts"
  "process-feedback-optimized"
  "meilisearch-admin"
  "meilisearch-search"
  "cleanup-rate-limits"
  "cleanup-rate-limits-above-one-hour"
  "generate-img-blurhash-img-token"
  "sanitize-text"
  "validate-captcha"
  "update-receipt-notes"
  "cleanup-orphaned-receipts"
  "process-feedback"
  "public-contests"
  "revenuecat-webhook"
  "get-subscription-tier"
  "initialize-user-points"
  "award-points"
  "get-user-points"
  "redeem-points-for-subscription"
  "redeem-referral-code"
  "update-auto-renew"
  "auto-renew-subscriptions"
  "sync-public-contests"
)

# Check if Appwrite CLI is installed
check_cli() {
  if ! command -v appwrite &> /dev/null; then
    echo -e "${RED}❌ Appwrite CLI not found${NC}"
    echo ""
    echo "Please install it first:"
    echo "  npm install -g appwrite-cli"
    echo "  # or"
    echo "  yarn global add appwrite-cli"
    echo ""
    exit 1
  fi
  
  echo -e "${GREEN}✓${NC} Appwrite CLI found: $(appwrite --version)"
}

# Check if user is logged in
check_login() {
  echo -e "${CYAN}Checking authentication...${NC}"
  
  # Try to get account info
  if ! appwrite client getAccount &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Appwrite${NC}"
    echo ""
    echo "Please login first:"
    echo "  appwrite login"
    echo ""
    read -p "Would you like to login now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      appwrite login
      if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Login failed${NC}"
        exit 1
      fi
    else
      exit 1
    fi
  fi
  
  echo -e "${GREEN}✓${NC} Authenticated"
}

# Set project context
set_project() {
  echo -e "${CYAN}Setting project context...${NC}"
  appwrite client setEndpoint "$ENDPOINT" &> /dev/null
  appwrite client setProject "$PROJECT_ID" &> /dev/null
  echo -e "${GREEN}✓${NC} Project: $PROJECT_ID"
  echo -e "${GREEN}✓${NC} Endpoint: $ENDPOINT"
}

# Create a function if it doesn't exist
create_function_if_needed() {
  local FUNCTION_NAME=$1
  local FUNCTION_DISPLAY=$(get_function_property "$FUNCTION_NAME" "display")
  local RUNTIME=$(get_function_property "$FUNCTION_NAME" "runtime")
  local TIMEOUT=$(get_function_property "$FUNCTION_NAME" "timeout")
  local EXECUTE=$(get_function_property "$FUNCTION_NAME" "execute")
  local CPU=$(get_function_property "$FUNCTION_NAME" "cpu")
  local MEMORY=$(get_function_property "$FUNCTION_NAME" "memory")

  # Use the predefined function ID if available, otherwise generate a new one
  local NEW_FUNCTION_ID=$(get_function_property "$FUNCTION_NAME" "id")

  if [ -z "$NEW_FUNCTION_ID" ]; then
    # Generate a unique function ID (Appwrite format: lowercase, numbers, max 36 chars)
    NEW_FUNCTION_ID="${FUNCTION_NAME}_$(date +%s)_$(printf '%04x' $((RANDOM % 65536)))"
    # Trim to 36 characters max and ensure it starts with letter
    NEW_FUNCTION_ID="fn_${NEW_FUNCTION_ID:0:32}"
  fi

  # Build execute permissions parameter
  local EXECUTE_PARAM=""
  if [ -n "$EXECUTE" ]; then
    EXECUTE_PARAM="--execute \"$EXECUTE\""
  fi

  # Determine specification based on CPU and Memory
  # Appwrite format: s-{cpu}vcpu-{memory}mb or s-{cpu}vcpu-{memory}gb
  local SPECIFICATION="s-1vcpu-512mb"  # Default: 1.0 CPU, 512MB
  
  # Map CPU and Memory to Appwrite specification format
  if [ "$CPU" = "0.5" ] && [ "$MEMORY" = "512" ]; then
    SPECIFICATION="s-0.5vcpu-512mb"
  elif [ "$CPU" = "1.0" ] && [ "$MEMORY" = "512" ]; then
    SPECIFICATION="s-1vcpu-512mb"
  elif [ "$CPU" = "1.0" ] && [ "$MEMORY" = "1024" ]; then
    SPECIFICATION="s-1vcpu-1gb"
  elif [ "$CPU" = "2.0" ] && [ "$MEMORY" = "2048" ]; then
    SPECIFICATION="s-2vcpu-2gb"
  elif [ "$CPU" = "2.0" ] && [ "$MEMORY" = "4096" ]; then
    SPECIFICATION="s-2vcpu-4gb"
  elif [ "$CPU" = "4.0" ] && [ "$MEMORY" = "4096" ]; then
    SPECIFICATION="s-4vcpu-4gb"
  fi

  # Create the function with the ID
  local CREATE_OUTPUT=$(eval appwrite functions create \
    --function-id=\"$NEW_FUNCTION_ID\" \
    --name=\"$FUNCTION_DISPLAY\" \
    --runtime=\"$RUNTIME\" \
    --entrypoint=\"index.js\" \
    --commands=\"npm install\" \
    --specification=\"$SPECIFICATION\" \
    $EXECUTE_PARAM \
    --timeout=\"$TIMEOUT\" 2>&1)

  local CREATE_EXIT_CODE=$?

  # Check both exit code and output for errors
  if [ $CREATE_EXIT_CODE -eq 0 ] && ! echo "$CREATE_OUTPUT" | grep -q "Error\|error\|failed\|Failed"; then
    # Verify the function was actually created by checking if it exists
    sleep 2  # Give Appwrite time to register the function
    
    local VERIFY_OUTPUT=$(appwrite functions get --function-id="$NEW_FUNCTION_ID" 2>&1)
    if [ $? -eq 0 ]; then
      # Success - return only the function ID
      echo "$NEW_FUNCTION_ID"
      return 0
    else
      # Function creation reported success but function doesn't exist
      echo -e "${RED}❌ Function creation reported success but function not found${NC}" >&2
      echo -e "${YELLOW}   This might indicate a permissions or quota issue${NC}" >&2
      echo "$CREATE_OUTPUT" | sed 's/^/     /' >&2
      return 1
    fi
  else
    # Failure - output error but don't return function ID
    echo -e "${RED}❌ Failed to create function${NC}" >&2
    echo "$CREATE_OUTPUT" | sed 's/^/     /' >&2
    return 1
  fi
}

# Clean up old deployments (keep only the most recent ones)
cleanup_old_deployments() {
  local FUNCTION_ID=$1
  local FUNCTION_NAME=$2
  local NEW_DEPLOYMENT_ID=$3  # Optional: ID of deployment we just created (to protect it)

  echo ""
  echo -e "  🧹 ${BLUE}Cleaning up old deployments for function: $FUNCTION_NAME (ID: $FUNCTION_ID)${NC}"

  # Get list of deployments for this function
  echo -e "  ${CYAN}📋 Fetching deployments...${NC}"
  DEPLOYMENTS_OUTPUT=$(appwrite functions list-deployments \
    --function-id="$FUNCTION_ID" 2>&1)

  DEPLOYMENT_EXIT_CODE=$?

  if [ $DEPLOYMENT_EXIT_CODE -ne 0 ]; then
    echo -e "  ${YELLOW}⚠️  Could not list deployments${NC}"
    echo -e "  ${YELLOW}Error: $(echo "$DEPLOYMENTS_OUTPUT" | grep -o "Error:.*" | head -1)${NC}"
    return 0
  fi

  # Extract deployment IDs from the table
  # The CLI output wraps on narrow terminals, so we need to extract IDs differently
  # Strategy: Extract ALL 20-char IDs, filter out function ID AND new deployment ID, deduplicate while preserving order
  
  FUNCTION_ID_TO_EXCLUDE="$FUNCTION_ID"
  
  # Use grep -o to find all 20-character IDs anywhere in the output
  # Then filter out function ID and optionally the new deployment ID
  # Then deduplicate while maintaining order
  DEPLOYMENT_IDS=$(echo "$DEPLOYMENTS_OUTPUT" | \
    grep -oE '[a-z0-9]{20}' | \
    grep -v "^$FUNCTION_ID_TO_EXCLUDE$" | \
    awk '!seen[$0]++' | \
    head -20)
  
  # If we have a new deployment ID, move it to the front (newest position)
  if [ -n "$NEW_DEPLOYMENT_ID" ]; then
    # Remove the new deployment ID from its current position and prepend it
    DEPLOYMENT_IDS=$(echo "$DEPLOYMENT_IDS" | grep -v "^$NEW_DEPLOYMENT_ID$")
    DEPLOYMENT_IDS=$(printf "%s\n%s" "$NEW_DEPLOYMENT_ID" "$DEPLOYMENT_IDS")
  fi

  # Debug output
  if [ -n "$DEBUG_DEPLOY" ]; then
    echo -e "  ${CYAN}[DEBUG] Raw deployments output:${NC}"
    echo "$DEPLOYMENTS_OUTPUT" | head -10 | sed 's/^/     /'
    echo -e "  ${CYAN}[DEBUG] Extracted IDs (newest first):${NC}"
    echo "$DEPLOYMENT_IDS" | sed 's/^/     /'
  fi

  # Convert to array for easier processing
  IFS=$'\n' read -r -d '' -a DEPLOYMENT_ARRAY <<< "$DEPLOYMENT_IDS"

  # Count deployments
  DEPLOYMENT_COUNT=${#DEPLOYMENT_ARRAY[@]}

  if [ "$DEPLOYMENT_COUNT" -eq 0 ]; then
    echo -e "  ${YELLOW}⚠️  No deployments found to clean up${NC}"
    echo -e "  ${BLUE}💡 Tip: Run with DEBUG_DEPLOY=1 to see parsing details${NC}"
    return 0
  fi

  if [ "$DEPLOYMENT_COUNT" -le "$DEPLOYMENT_RETENTION_COUNT" ]; then
    echo -e "  ${GREEN}✓${NC} Found $DEPLOYMENT_COUNT deployment(s) - keeping all for rollback safety"
    return 0
  fi

  echo "  📊 Found $DEPLOYMENT_COUNT deployments, keeping latest $DEPLOYMENT_RETENTION_COUNT..."

  # Calculate how many to delete (total - retention)
  TO_DELETE=$((DEPLOYMENT_COUNT - DEPLOYMENT_RETENTION_COUNT))

  echo "  🗑️  Will delete $TO_DELETE oldest deployment(s)"

  DELETED_COUNT=0
  KEPT_COUNT=0

  # Process deployments from oldest to newest (reverse order since array is newest first)
  for ((i = DEPLOYMENT_COUNT - 1; i >= 0; i--)); do
    DEPLOYMENT_ID="${DEPLOYMENT_ARRAY[$i]}"

    if [ "$DELETED_COUNT" -lt "$TO_DELETE" ]; then
      echo -e "  ${YELLOW}🗑️${NC} Deleting old deployment: $DEPLOYMENT_ID"
      DELETE_OUTPUT=$(appwrite functions delete-deployment \
        --function-id="$FUNCTION_ID" \
        --deployment-id="$DEPLOYMENT_ID" 2>&1)

      if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✅${NC} Successfully deleted deployment $DEPLOYMENT_ID"
        DELETED_COUNT=$((DELETED_COUNT + 1))
      else
        echo -e "  ${YELLOW}⚠️${NC} Could not delete deployment $DEPLOYMENT_ID (might be active)"
        echo "     Error: $(echo "$DELETE_OUTPUT" | head -1)"
      fi
    else
      KEPT_COUNT=$((KEPT_COUNT + 1))
      echo -e "  ${GREEN}✓${NC} Keeping deployment $KEPT_COUNT (of $DEPLOYMENT_RETENTION_COUNT): $DEPLOYMENT_ID"
    fi
  done

  echo -e "  ${GREEN}✅ Deployment cleanup completed${NC}"
  echo -e "  ${GREEN}   Deleted: $DELETED_COUNT, Kept: $KEPT_COUNT${NC}"
}

# Deploy a single function
deploy_function() {
  local FUNCTION_NAME=$1
  local FUNCTION_ID=$(get_function_property "$FUNCTION_NAME" "id")
  local FUNCTION_DIR="$FUNCTION_NAME"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${BLUE}Deploying: $(get_function_property "$FUNCTION_NAME" "display")${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Check if function directory exists
  if [ ! -d "$FUNCTION_DIR" ]; then
    echo -e "${RED}❌ Function directory not found: $FUNCTION_DIR${NC}"
    echo "   Make sure the function directory exists"
    return 1
  fi
  
  # Check if function exists in Appwrite, create if it doesn't
  local FUNCTION_CREATED=false
  
  if [ -z "$FUNCTION_ID" ]; then
    echo -e "${YELLOW}⚠️  Function ID not set - creating new function...${NC}"
    FUNCTION_ID=$(create_function_if_needed "$FUNCTION_NAME")
    if [ $? -ne 0 ] || [ -z "$FUNCTION_ID" ]; then
      echo -e "${RED}❌ Failed to create function${NC}"
      return 1
    fi
    FUNCTION_CREATED=true
    echo ""
    echo -e "${GREEN}✓${NC} Function created with ID: $FUNCTION_ID"
  else
    # Verify function exists in Appwrite
    echo -e "${CYAN}  🔍 Verifying function exists...${NC}"
    local CHECK_OUTPUT=$(appwrite functions get --function-id="$FUNCTION_ID" 2>&1)
    local CHECK_EXIT_CODE=$?

    # Check both exit code and output content for errors
    if [ $CHECK_EXIT_CODE -ne 0 ] || echo "$CHECK_OUTPUT" | grep -q "not found\|does not exist\|Error\|could not be found"; then
      echo -e "${YELLOW}⚠️  Function not found - creating with ID: $FUNCTION_ID${NC}"
      FUNCTION_ID=$(create_function_if_needed "$FUNCTION_NAME")
      if [ $? -ne 0 ] || [ -z "$FUNCTION_ID" ]; then
        echo -e "${RED}❌ Failed to create function${NC}"
        return 1
      fi
      FUNCTION_CREATED=true
      echo ""
      echo -e "${GREEN}✓${NC} Function created with ID: $FUNCTION_ID"
    else
      echo -e "${GREEN}  ✓${NC} Function exists"
    fi
  fi
  
  echo "  📦 Function: $FUNCTION_NAME"
  echo "  🆔 ID: $FUNCTION_ID"
  echo "  📁 Directory: $FUNCTION_DIR"
  echo "  ⚙️  Runtime: $(get_function_property "$FUNCTION_NAME" "runtime")"
  echo "  🧠 Memory: $(get_function_property "$FUNCTION_NAME" "memory")MB"
  echo "  ⚡ CPU: $(get_function_property "$FUNCTION_NAME" "cpu")"
  echo "  ⏱️  Timeout: $(get_function_property "$FUNCTION_NAME" "timeout")s"
  echo "  🔐 Execute: $(get_function_property "$FUNCTION_NAME" "execute")"
  echo ""
  echo "  🚀 Deploying..."
  
  # Deploy the function (CLI will automatically package the code)
  DEPLOY_OUTPUT=$(appwrite functions create-deployment \
    --function-id="$FUNCTION_ID" \
    --entrypoint="index.js" \
    --commands="npm install" \
    --activate \
    --code="$FUNCTION_DIR" 2>&1)
  
  if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ Deployment created successfully${NC}"
    
    # Extract the new deployment ID from the output
    NEW_DEPLOYMENT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oE '\$id[[:space:]]*:[[:space:]]*[a-z0-9]{20}' | grep -oE '[a-z0-9]{20}' | head -1)
    
    if [ -n "$DEBUG_DEPLOY" ] && [ -n "$NEW_DEPLOYMENT_ID" ]; then
      echo -e "  ${CYAN}[DEBUG] New deployment ID: $NEW_DEPLOYMENT_ID${NC}"
    fi
    
    echo "  ⏳ Building... (this may take 1-3 minutes)"
    echo ""

    # Wait a moment for the API to register the new deployment
    echo -e "  ${BLUE}🔄 Starting deployment cleanup process...${NC}"
    echo "  ⏳ Waiting for API to sync (10 seconds)..."
    sleep 10
    
    cleanup_old_deployments "$FUNCTION_ID" "$FUNCTION_NAME" "$NEW_DEPLOYMENT_ID"

    echo "  Monitor deployment:"
    echo "     https://cloud.appwrite.io/console/project-$PROJECT_ID/functions/function-$FUNCTION_ID"
    return 0
  else
    echo -e "  ${RED}❌ Deployment failed${NC}"
    echo ""
    echo "  Error details:"
    echo "$DEPLOY_OUTPUT" | sed 's/^/     /'
    return 1
  fi
}

# Interactive menu
show_menu() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║         Appwrite Functions - Deploy Menu                     ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Select functions to deploy (space-separated numbers, or 'all'):"
  echo ""

  local i=1
  for func in "${ALL_FUNCTIONS[@]}"; do
    local func_id=$(get_function_property "$func" "id")
    local status=""
    if [ -z "$func_id" ]; then
      status="${YELLOW}(not created)${NC}"
    else
      status="${GREEN}(ready)${NC}"
    fi
    echo -e "  $i) $(get_function_property "$func" "display") $status"
    ((i++))
  done
  
  echo ""
  echo "  all) Deploy all functions"
  echo "  q) Quit"
  echo ""
  read -p "Enter your choice: " choice
  
  if [ "$choice" = "q" ]; then
    echo "Cancelled."
    exit 0
  fi
  
  if [ "$choice" = "all" ]; then
    FUNCTIONS_TO_DEPLOY=("${ALL_FUNCTIONS[@]}")
  else
    FUNCTIONS_TO_DEPLOY=()
    for num in $choice; do
      if [[ "$num" =~ ^[0-9]+$ ]] && [ "$num" -ge 1 ] && [ "$num" -le "${#ALL_FUNCTIONS[@]}" ]; then
        FUNCTIONS_TO_DEPLOY+=("${ALL_FUNCTIONS[$((num-1))]}")
      fi
    done
    
    if [ ${#FUNCTIONS_TO_DEPLOY[@]} -eq 0 ]; then
      echo -e "${RED}❌ No valid functions selected${NC}"
      exit 1
    fi
  fi
}

# Parse arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  show_usage
  exit 0
elif [ "$1" = "--list" ] || [ "$1" = "-l" ]; then
  echo "Available functions:"
  for func in "${ALL_FUNCTIONS[@]}"; do
    func_id=$(get_function_property "$func" "id")
    if [ -z "$func_id" ]; then
      echo -e "  - $func ${YELLOW}(not created)${NC}"
    else
      echo "  - $func (ID: $func_id)"
    fi
  done
  exit 0
elif [ "$1" = "--all" ]; then
  FUNCTIONS_TO_DEPLOY=("${ALL_FUNCTIONS[@]}")
elif [ $# -eq 0 ]; then
  # No arguments - show interactive menu
  check_cli
  check_login
  set_project
  show_menu
else
  # Specific functions provided
  FUNCTIONS_TO_DEPLOY=("$@")
  
  # Validate function names
  INVALID_FUNCTIONS=()
  for func in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    if [[ ! " ${ALL_FUNCTIONS[@]} " =~ " ${func} " ]]; then
      INVALID_FUNCTIONS+=("$func")
    fi
  done
  
  if [ ${#INVALID_FUNCTIONS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Error: Unknown function(s): ${INVALID_FUNCTIONS[*]}${NC}"
    echo ""
    echo "Use '$0 --list' to see available functions."
    exit 1
  fi
fi

# Main deployment flow
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         Appwrite Functions - Deployment                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Pre-flight checks
check_cli
check_login
set_project

echo ""
echo "📦 Deploying ${#FUNCTIONS_TO_DEPLOY[@]} function(s):"
for func in "${FUNCTIONS_TO_DEPLOY[@]}"; do
  echo "   - $(get_function_property "$func" "display")"
done
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# Counter for success/failure
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIPPED_COUNT=0

# Deploy each function
for FUNCTION in "${FUNCTIONS_TO_DEPLOY[@]}"; do
  deploy_function "$FUNCTION"
  case $? in
    0)
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      ;;
    1)
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      ;;
    *)
      FAIL_COUNT=$((FAIL_COUNT + 1))
      ;;
  esac
done

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                         SUMMARY                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Total functions processed: ${#FUNCTIONS_TO_DEPLOY[@]}"
echo -e "${GREEN}✅ Deployed: $SUCCESS_COUNT${NC}"

if [ $SKIPPED_COUNT -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Skipped: $SKIPPED_COUNT${NC}"
fi

if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${RED}❌ Failed: $FAIL_COUNT${NC}"
fi

echo ""
echo "📊 Monitor deployments in Appwrite Console:"
echo "   https://cloud.appwrite.io/console/project-$PROJECT_ID/functions"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
  echo "⏳ Deployments are building in the background."
  echo "   Check the console for build status and logs."
  echo ""
fi

# Exit with appropriate status code
if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
else
  if [ $SUCCESS_COUNT -gt 0 ]; then
    echo -e "${GREEN}✨ Deployment(s) initiated successfully!${NC}"
  fi
  exit 0
fi

