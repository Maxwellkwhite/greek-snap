#!/usr/bin/env python3
"""
Simple test for the claim system
"""

from xp_system import XPSystem
from cards_data import CHARACTERS

def test_simple_claim():
    print("Simple Claim System Test")
    print("=" * 40)
    
    # Test 1: Check if level 2 has rewards
    level_2_rewards = XPSystem.get_rewards_for_level(2)
    print(f"Level 2 rewards: {level_2_rewards}")
    
    # Test 2: Check if the card exists
    if level_2_rewards:
        card_id = level_2_rewards[0]
        card = next((c for c in CHARACTERS if c['id'] == card_id), None)
        if card:
            print(f"Card found: {card['name']} (ID: {card_id})")
        else:
            print(f"ERROR: Card with ID {card_id} not found!")
    
    # Test 3: Simulate claiming process
    user_xp = 100  # Level 2
    unlocked_cards = []
    
    print(f"\nSimulating claim for user with {user_xp} XP (Level {XPSystem.get_level_from_xp(user_xp)})")
    print(f"Starting unlocked cards: {unlocked_cards}")
    
    # Get pending rewards
    pending = XPSystem.get_pending_rewards(user_xp, unlocked_cards)
    print(f"Pending rewards: {pending}")
    
    # Simulate claiming level 2
    if pending:
        level_2_claim = next((r for r in pending if r['level'] == 2), None)
        if level_2_claim:
            card_id = level_2_claim['card_id']
            unlocked_cards.append(card_id)
            print(f"Claimed card ID {card_id}")
            print(f"New unlocked cards: {unlocked_cards}")
            
            # Check if card exists in CHARACTERS
            card_exists = any(c['id'] == card_id for c in CHARACTERS)
            print(f"Card exists in CHARACTERS: {card_exists}")
        else:
            print("No level 2 claim found in pending rewards")
    else:
        print("No pending rewards found")

if __name__ == "__main__":
    test_simple_claim() 