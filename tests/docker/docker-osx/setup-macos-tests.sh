#!/bin/bash
# Setup script for Docker-OSX macOS testing

set -e

echo "Docker-OSX macOS Testing Setup"
echo "================================"
echo ""

# Check if running on Linux with KVM
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "Warning: Docker-OSX works best on Linux with KVM support."
    echo "On macOS, run tests natively with: pnpm test:run"
    echo ""
fi

if [ ! -e /dev/kvm ]; then
    echo "Error: KVM device not found at /dev/kvm"
    echo "Please ensure:"
    echo "  1. Your CPU supports virtualization (VT-x/AMD-V)"
    echo "  2. KVM is enabled in BIOS/UEFI"
    echo "  3. KVM kernel module is loaded: sudo modprobe kvm"
    exit 1
fi

echo "✓ KVM is available"
echo ""

# Create test data directory
mkdir -p macos-test-data

# Pull and start the container
echo "Starting macOS VM in Docker..."
echo "This will take 10-15 minutes on first boot."
echo ""

docker-compose -f docker-compose.osx.yml up -d

echo ""
echo "macOS VM is starting..."
echo ""
echo "To check status:"
echo "  docker logs -f docker-osx-macos"
echo ""
echo "To SSH into the VM (once booted):"
echo "  docker exec -it docker-osx-macos ssh -p 50922 user@localhost"
echo ""
echo "To run tests manually:"
echo "  docker exec docker-osx-macos ssh -p 50922 user@localhost 'cd /app && pnpm test:run'"
echo ""
echo "To stop the VM:"
echo "  docker-compose -f docker-compose.osx.yml down"
