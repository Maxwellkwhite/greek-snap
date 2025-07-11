#!/usr/bin/env python3
"""
Debug script for the claim system
"""

from xp_system import XPSystem
from cards_data import CHARACTERS

def test_claim_system():
    print("Testing Claim System with Correct Card IDs...")
    print("=" * 60)
    
    # Show all available cards
    print("Available Cards:")
    for card in CHARACTERS:
        print(f"ID: {card['id']:2d} | Name: {card['name']}")
    
    print("\n" + "=" * 60)
    print("Level Rewards Configuration:")
    
    # Test each level's rewards
    for level in range(1, 11):
        rewards = XPSystem.get_rewards_for_level(level)
        if rewards:
            print(f"Level {level:2d}: Card IDs {rewards}")
            # Show card names for each reward
            for card_id in rewards:
                card = next((c for c in CHARACTERS if c['id'] == card_id), None)
                if card:
                    print(f"         -> {card['name']} (ID: {card_id})")
                else:
                    print(f"         -> UNKNOWN CARD (ID: {card_id}) - DOESN'T EXIST!")
        else:
            print(f"Level {level:2d}: No rewards")
    
    print("\n" + "=" * 60)
    print("Testing Pending Rewards:")
    
    # Test pending rewards for a user with 1200 XP (level 6)
    user_xp = 1200
    user_level = XPSystem.get_level_from_xp(user_xp)
    unlocked_cards = []  # Start with no cards
    
    print(f"User XP: {user_xp} (Level {user_level})")
    print(f"Unlocked cards: {unlocked_cards}")
    
    pending = XPSystem.get_pending_rewards(user_xp, unlocked_cards)
    print(f"Pending rewards: {pending}")
    
    # Show what would be claimed
    for reward in pending:
        level = reward['level']
        card_id = reward['card_id']
        card = next((c for c in CHARACTERS if c['id'] == card_id), None)
        if card:
            print(f"  Level {level}: {card['name']} (ID: {card_id})")
        else:
            print(f"  Level {level}: UNKNOWN CARD (ID: {card_id}) - DOESN'T EXIST!")

if __name__ == "__main__":
    test_claim_system() 