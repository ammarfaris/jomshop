#!/bin/bash

# Contest Host Logo Processing Script
# This script processes all image files (PNG, JPG, JPEG, SVG) in the current directory
# and creates aligned versions with consistent 200x200px dimensions and proper padding.
#
# Requirements: ImageMagick (install with: brew install imagemagick)
#
# Usage:
#   ./process-logos.sh                    # Process all images (default medium size)
#   ./process-logos.sh file.png           # Process file (default medium size)
#   ./process-logos.sh file1.png file2.png # Process multiple files
#   ./process-logos.sh --size x-small file.png  # Set size: x-small (100x100)
#   ./process-logos.sh --size small file.png    # Set size: small (120x120)
#   ./process-logos.sh --size medium file.png   # Set size: medium (140x140)
#   ./process-logos.sh --size large file.png    # Set size: large (160x160)
#   ./process-logos.sh --size x-large file.png  # Set size: x-large (180x180)
#   ./process-logos.sh --size 150 file.png      # Set custom size (100-180)
#   ./process-logos.sh --help             # Show help
#
# Output: For each image file, creates a "logo-[size]-[filename].png" version with:
# - 200x200px square canvas
# - Image resized with chosen padding
# - Centered with equal padding
# - Transparent background
# - Size-aware naming: input.png → logo-medium-input.png

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check for help flag
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo -e "${BLUE}=== Contest Host Logo Processor - Help ===${NC}\n"
            echo "Usage:"
            echo "  ./process-logos.sh                    Process all images (default medium size)"
            echo "  ./process-logos.sh file.png           Process file (default medium size)"
            echo "  ./process-logos.sh file1.png file2.png Process multiple files"
            echo "  ./process-logos.sh --size x-small file.png  Set size: x-small (100x100) → logo-x-small-file.png"
            echo "  ./process-logos.sh --size small file.png    Set size: small (120x120) → logo-small-file.png"
            echo "  ./process-logos.sh --size medium file.png   Set size: medium (140x140) → logo-medium-file.png"
            echo "  ./process-logos.sh --size large file.png    Set size: large (160x160) → logo-large-file.png"
            echo "  ./process-logos.sh --size x-large file.png  Set size: x-large (180x180) → logo-x-large-file.png"
            echo "  ./process-logos.sh --size 150 file.png      Set custom size (100-180) → logo-150px-file.png"
            echo "  ./process-logos.sh --help             Show this help message"
    echo ""
            echo "Size Options:"
            echo "  x-small (100x100) - Maximum padding, smallest logo"
            echo "  small   (120x120) - More padding, smaller logo"
            echo "  medium  (140x140) - Balanced padding (default)"
            echo "  large   (160x160) - Less padding, larger logo"
            echo "  x-large (180x180) - Minimum padding, largest logo"
            echo "  100-180           - Custom size in pixels"
    echo ""
            echo "Output: Creates 'logo-[size]-[filename].png' versions (200x200px) with chosen padding"
            echo "Examples:"
            echo "  shell.png → logo-medium-shell.png"
            echo "  logo.png with --size large → logo-large-logo.png"
    exit 0
fi

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo -e "${RED}Error: ImageMagick is not installed.${NC}"
    echo -e "${YELLOW}Install it with: brew install imagemagick${NC}"
    exit 1
fi

# Determine mode and specific files
SIZE_MODE=false
CUSTOM_SIZE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --size)
            SIZE_MODE=true
            if [[ -n "$2" && "$2" != -* ]]; then
                CUSTOM_SIZE="$2"
                shift 2
            else
                echo -e "${RED}Error: --size requires a value (small, medium, large, or number 100-180)${NC}" >&2
                exit 1
            fi
            ;;
        --help|-h)
            # Show help
            echo -e "${BLUE}=== Contest Host Logo Processor - Help ===${NC}\n"
            echo "Usage:"
            echo "  ./process-logos.sh                    Process all images (default medium size)"
            echo "  ./process-logos.sh file.png           Process file (default medium size)"
            echo "  ./process-logos.sh file1.png file2.png Process multiple files"
            echo "  ./process-logos.sh --size x-small file.png  Set size: x-small (100x100) → logo-x-small-file.png"
            echo "  ./process-logos.sh --size small file.png    Set size: small (120x120) → logo-small-file.png"
            echo "  ./process-logos.sh --size medium file.png   Set size: medium (140x140) → logo-medium-file.png"
            echo "  ./process-logos.sh --size large file.png    Set size: large (160x160) → logo-large-file.png"
            echo "  ./process-logos.sh --size x-large file.png  Set size: x-large (180x180) → logo-x-large-file.png"
            echo "  ./process-logos.sh --size 150 file.png      Set custom size (100-180) → logo-150px-file.png"
            echo "  ./process-logos.sh --help             Show this help message"
            echo ""
            echo "Size Options:"
            echo "  x-small (100x100) - Maximum padding, smallest logo"
            echo "  small   (120x120) - More padding, smaller logo"
            echo "  medium  (140x140) - Balanced padding (default)"
            echo "  large   (160x160) - Less padding, larger logo"
            echo "  x-large (180x180) - Minimum padding, largest logo"
            echo "  100-180           - Custom size in pixels"
            echo ""
            echo "Output: Creates 'logo-[size]-[filename].png' versions (200x200px) with chosen padding"
            echo "Examples:"
            echo "  shell.png → logo-medium-shell.png"
            echo "  logo.png with --size large → logo-large-logo.png"
            echo "  image.jpg with --size 150 → logo-150px-image.png"
            exit 0
            ;;
        *)
            # Treat as filename
            SPECIFIC_FILES+=("$1")
            shift
            ;;
    esac
done

echo -e "${BLUE}=== Contest Host Logo Processor ===${NC}"
if [ "$SIZE_MODE" = true ]; then
    echo -e "${CYAN}Mode: Size specified (${CUSTOM_SIZE})${NC}"
else
    echo -e "${CYAN}Mode: Default (medium size 140x140)${NC}"
fi

if [ ${#SPECIFIC_FILES[@]} -gt 0 ]; then
    echo -e "${CYAN}Processing specific files: ${SPECIFIC_FILES[*]}${NC}\n"
else
    echo -e "${CYAN}Processing all image files in directory${NC}\n"
fi

# Counter for processed files
processed=0
skipped=0

# Function to get size choice
get_size_choice() {
    local filename="$1"

    # Default to medium size if no specific mode is set
    if [ "$SIZE_MODE" = false ]; then
        echo "140"
        return
    fi

    if [ "$SIZE_MODE" = true ]; then
        case "$CUSTOM_SIZE" in
            x-small|xsmall|X-SMALL|XS) echo "100" ;;
            small|Small|SMALL) echo "120" ;;
            medium|Medium|MEDIUM|"") echo "140" ;;
            large|Large|LARGE) echo "160" ;;
            x-large|xlarge|X-LARGE|XL) echo "180" ;;
            [0-9]*)
                # Check if it's a valid number between 100-180
                if [[ "$CUSTOM_SIZE" =~ ^[0-9]+$ ]] && [ "$CUSTOM_SIZE" -ge 100 ] && [ "$CUSTOM_SIZE" -le 180 ]; then
                    echo "$CUSTOM_SIZE"
                else
                    echo -e "${YELLOW}Invalid size '$CUSTOM_SIZE', using default (140)${NC}" >&2
                    echo "140"
                fi
                ;;
            *) echo "140" ;;
        esac
        return
    fi
}

# Function to get size name for filename
get_size_name() {
    local size_pixels="$1"

    case "$size_pixels" in
        100) echo "x-small" ;;
        120) echo "small" ;;
        140) echo "medium" ;;
        160) echo "large" ;;
        180) echo "x-large" ;;
        *) echo "${size_pixels}px" ;;  # For custom sizes like 150px
    esac
}

# Build file list
FILES_TO_PROCESS=()

if [ ${#SPECIFIC_FILES[@]} -gt 0 ]; then
    # Process specific files provided as arguments
    for file in "${SPECIFIC_FILES[@]}"; do
        if [ -e "$file" ]; then
            FILES_TO_PROCESS+=("$file")
        else
            echo -e "${RED}✗ File not found:${NC} $file"
        fi
    done
else
    # Process all image files in current directory
    for file in *.{png,PNG,jpg,JPG,jpeg,JPEG,svg,SVG}; do
        # Skip if file doesn't exist (happens when glob doesn't match)
        [ -e "$file" ] || continue
        FILES_TO_PROCESS+=("$file")
    done
fi

# Process each file
for file in "${FILES_TO_PROCESS[@]}"; do
    # Skip if filename starts with logo- (already processed)
    if [[ "$file" == logo-* ]]; then
        echo -e "${YELLOW}⊘ Skipping:${NC} $file (already processed)"
        ((skipped++))
        continue
    fi
    
    # Skip if filename contains -ok-aligned (legacy format)
    if [[ "$file" == *"-ok-aligned"* ]]; then
        echo -e "${YELLOW}⊘ Skipping:${NC} $file (legacy processed file)"
        ((skipped++))
        continue
    fi
    
    # Get filename without extension
    filename="${file%.*}"

    # Get size choice from user (or use default in auto mode)
    size=$(get_size_choice "$file")

    # Get size name for filename
    size_name=$(get_size_name "$size")

    # Output filename with logo- prefix and size
    output="logo-${size_name}-${file%.*}.png"

    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Processing:${NC} $file"
    
    # Determine padding description
    case "$size" in
        100) padding_desc="50px padding (extra small logo)" ;;
        120) padding_desc="40px padding (small logo)" ;;
        140) padding_desc="30px padding (medium logo)" ;;
        160) padding_desc="20px padding (large logo)" ;;
        180) padding_desc="10px padding (extra large logo)" ;;
    esac
    
    echo -e "${CYAN}  → Size: ${size}x${size}px ($padding_desc)${NC}"
    
    # Check if file is SVG
    if [[ "$file" == *.svg ]] || [[ "$file" == *.SVG ]]; then
        echo -e "${YELLOW}  → SVG detected, converting to PNG first...${NC}"
        # For SVG: Convert to PNG with high DPI, then process
        # Note: Some SVGs may not render correctly. If output looks wrong,
        # use a PNG version of the logo instead.
        magick "$file" \
            -density 300 \
            -background white \
            -resize ${size}x${size} \
            -gravity center \
            -extent 200x200 \
            "$output"
    else
        # For raster images (PNG, JPG, etc.):
        magick "$file" \
            -resize ${size}x${size} \
            -background none \
            -gravity center \
            -extent 200x200 \
            "$output"
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Created:${NC} $output (200x200px, ${size}x${size} content)"
        ((processed++))
    else
        echo -e "${RED}✗ Failed to process:${NC} $file"
    fi
done

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}=== Summary ===${NC}"
echo -e "${GREEN}Processed: $processed files${NC}"
if [ $skipped -gt 0 ]; then
    echo -e "${YELLOW}Skipped: $skipped files (already processed)${NC}"
fi

if [ $processed -eq 0 ]; then
    echo -e "\n${YELLOW}No new files were processed.${NC}"
    if [ ${#SPECIFIC_FILES[@]} -gt 0 ]; then
        echo -e "${YELLOW}The specified files may already be processed or not found.${NC}"
        echo -e "${YELLOW}Delete existing 'logo-*.png' files to reprocess them.${NC}"
    else
        echo -e "${YELLOW}Make sure you have image files (png, jpg, svg) in this directory.${NC}"
        echo -e "${YELLOW}Or delete existing 'logo-*.png' files to reprocess them.${NC}"
    fi
else
    echo -e "\n${GREEN}✓ All logos processed successfully!${NC}"
    echo -e "${BLUE}Upload the 'logo-*.png' files to Appwrite's contestHostsBucket.${NC}"
fi

