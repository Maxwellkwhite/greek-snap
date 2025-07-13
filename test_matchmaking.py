#!/usr/bin/env python3
"""
Simple test script for the matchmaking system
"""
import requests
import json
import time

# Test server URL
BASE_URL = "http://localhost:5002"

def test_matchmaking():
    print("🧪 Testing Matchmaking System")
    print("=" * 50)
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Server is running")
        else:
            print(f"❌ Server returned status code: {response.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure it's running on port 5002")
        return
    
    # Test 2: Check if multiplayer page is accessible
    try:
        response = requests.get(f"{BASE_URL}/multiplayer")
        if response.status_code == 302:  # Redirect to login
            print("✅ Multiplayer page exists (redirects to login as expected)")
        else:
            print(f"⚠️ Multiplayer page returned status code: {response.status_code}")
    except Exception as e:
        print(f"❌ Error accessing multiplayer page: {e}")
    
    # Test 3: Check if WebSocket endpoint is available
    try:
        response = requests.get(f"{BASE_URL}/socket.io/")
        if response.status_code == 200:
            print("✅ WebSocket endpoint is available")
        else:
            print(f"⚠️ WebSocket endpoint returned status code: {response.status_code}")
    except Exception as e:
        print(f"❌ Error accessing WebSocket endpoint: {e}")
    
    print("\n🎯 Matchmaking System Test Complete!")
    print("\nTo test the full functionality:")
    print("1. Open http://localhost:5002 in your browser")
    print("2. Login or register an account")
    print("3. Create a battle hand")
    print("4. Go to the Multiplayer page")
    print("5. Click 'Join Queue' to test matchmaking")

if __name__ == "__main__":
    test_matchmaking() 